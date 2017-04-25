var responseHelper = require('../../helpers/response');
var deliveryHelper = require('../../helpers/delivery');
var commonHelper = require('../../helpers/common');
var async = require('async');
var request = commonHelper.request;
var cheerio = require('cheerio');
var config = require('../../../conf');
var _ = require('underscore');
var logger = require('../../helpers/logger');
var delivery = 'garantpost';

var formatCities = function (array) {
  array = array || [];
  return array.map(function (item) {
    return {
      id: item.OkatoID,
      name: item.OkatoName.toLowerCase()
    };
  });
};

var getCity = function (city, isFrom, callback) {
  var deliveryData = deliveryHelper.get(delivery);
  var opts = Object.assign({}, deliveryData.citiesUrl);
  var initialJson = isFrom ? city.fromJson : city.toJson;
  initialJson = _.clone(initialJson);
  opts.uri += initialJson.id;
  async.retry(config.retryOpts, function (callback) {
    request(opts, callback)
  }, function (err, r, b) {
    var result = {
      city: isFrom ? city.from : city.to,
      trim: isFrom ? city.fromTrim : city.toTrim,
      foundCities: [initialJson],
      success: true
    };
    //hack for Moscow
    var regionFrom = commonHelper.getRegionName(city.from);
    var regionTo = commonHelper.getRegionName(city.to);
    if (regionFrom && regionFrom.toLowerCase() === 'московская') {
      if (city.toTrim.toLowerCase() !== 'москва') {
        return callback(null, result);
      } else {
        result.regionId = initialJson.id;
      }
    }
    if (regionTo && regionTo.toLowerCase() === 'московская') {
      if (city.fromTrim.toLowerCase() !== 'москва') {
        return callback(null, result);
      } else {
        result.regionId = initialJson.id;
      }
    }
    if (err) {
      return callback(null, result);
    }
    b = b.substring(1, b.length);
    var json = null;
    try {
      json = JSON.parse(b);
    } catch (e) {}
    if (!json) {
      return callback(null, result);
    }
    if (!Array.isArray(json)) {
      return callback(null, result);
    }
    var founds = [];
    var region = commonHelper.getRegionName(isFrom ? city.from : city.to);
    if (region) {
      founds = commonHelper.findInArray(json, region, 'OkatoName');
    }
    if (!founds.length) {
      founds = commonHelper.findInArray(json, result.trim, 'OkatoName');
    }
    result.foundCities = founds.length ? formatCities(founds) : [initialJson];
    result.cities = json;
    callback(null, result);
  });
};

var getCalcResult = function (requests, timestamp, type, services, callback) {
  async.mapLimit(requests, 2, function (item, callback) {
    if (global[delivery] > timestamp) {
      return callback({abort: true});
    }
    if (item.error) {
      return async.nextTick(function () {
        callback(null, item);
      });
    }
    if (!services.length) {
      item.error = commonHelper.getServicesError();
      return async.nextTick(function () {
        callback(null, item);
      });
    }
    var deliveryData = deliveryHelper.get(delivery);
    if (type === 'w') {
      item.req.fromJson = {
        id: 45000000
      }
    }
    setTimeout(function () {
      async.auto({
        getDeliveryTime: function (callback) {
          var opts = Object.assign({}, deliveryData.calcUrl1);
          opts.uri += 'calc=' + type;
          opts.uri += '&from=' + (item.req.regionId || item.req.fromJson.id);
          opts.uri += '&to=' + (item.req.regionId || item.req.toJson.id);
          async.retry(config.retryOpts, function (callback) {
            request(opts, callback)
          }, function (err, r, b) {
            var deliveryTime = {};
            if (err) {
              deliveryTime.error = commonHelper.getServicesError(err);
              return callback(null, deliveryTime);
            }
            b = b.substring(1, b.length);
            var json = null;
            try {
              json = JSON.parse(b);
            } catch (e) {
              deliveryTime.error = commonHelper.getServicesError(e);
            }
            if (!json) {
              return callback(null, deliveryTime);
            }
            if (!Array.isArray(json)) {
              deliveryTime.error = commonHelper.getServicesError(err);
              return callback(null, deliveryTime);
            }
            if (!json.length) {
              deliveryTime.error = commonHelper.getNoResultError();
              return callback(null, deliveryTime);
            }
            deliveryTime.from = json[0].DaysMin;
            deliveryTime.to = json[0].DaysMax;
            callback(null, deliveryTime);
          });
        },
        getTariffs: ['getDeliveryTime', function (results, callback) {
          if (results.getDeliveryTime.error) {
            return callback(null);
          }
          var index = 0;
          async.mapSeries(services, function (service, callback) {
            var opts = Object.assign({}, type === 'w' ? deliveryData.calcIntUrl : deliveryData.calcUrl2);
            opts.uri += 'service=' + service.id;
            opts.uri += '&from=' + item.req.fromJson.id;
            opts.uri += '&to=' + item.req.toJson.id;
            opts.uri += '&weight=' + item.weight;
            opts.uri += '&count=' + index;
            index++;
            async.retry(config.retryOpts, function (callback) {
              request(opts, callback)
            }, function (err, r, b) {
              var tariff = {};
              if (err) {
                tariff.error = commonHelper.getServicesError(err);
                return callback(null, tariff);
              }
              b = b.substring(1, b.length);
              var json = null;
              try {
                json = JSON.parse(b);
              } catch (e) {
                tariff.error = commonHelper.getServicesError(e);
              }
              if (!json) {
                return callback(null, tariff);
              }
              if (!Array.isArray(json)) {
                tariff.error = commonHelper.getServicesError(err);
                return callback(null, tariff);
              }
              if (!json.length) {
                tariff.error = commonHelper.getNoResultError();
                return callback(null, tariff);
              }
              tariff.cost = json[0].Tariff;
              tariff.service = service.name;
              callback(null, tariff);
            });

          }, callback);
        }]
      }, function (err, results) {
        if (results.getDeliveryTime.error) {
          item.error = results.getDeliveryTime.error;
          return callback(null, item);
        }
        var error = null;
        results.getTariffs.forEach(function (trf) {
          if (!trf.error) {
            item.tariffs.push({
              service: trf.service,
              cost: trf.cost,
              deliveryTime: results.getDeliveryTime.from + '-' + results.getDeliveryTime.to,
              deliveryMin: results.getDeliveryTime.from,
              deliveryMax: results.getDeliveryTime.to
            });
          } else {
            error = trf.error;
          }
        });
        if (!item.tariffs.length) {
          item.error = error || commonHelper.getNoResultError();
        }
        return callback(null, item);
      });
    }, commonHelper.randomInteger(500, 1000));
  }, callback);
};

var getService = function (type, callback) {
  var deliveryData = deliveryHelper.get(delivery);
  var opts = Object.assign({}, deliveryData.servicesUrl);
  opts.uri += type;
  async.retry(config.retryOpts, function (callback) {
    request(opts, callback)
  }, function (err, r, b) {
    if (err) {
      return callback(null, []);
    }
    b = b.substring(1, b.length);
    var json = null;
    try {
      json = JSON.parse(b);
    } catch (e) {}
    if (!json) {
      return callback(null, []);
    }
    var services = json.map(function (item) {
      return {
        id: item.Value,
        name: item.Type
      };
    });
    callback(null, services);
  });
};

module.exports = function (req, cities) {
  var deliveryData = deliveryHelper.get(delivery);
  var requests = [];
  var intRequests = [];
  var cityObj = {};
  var timestamp = global[delivery];
  async.auto({
    getServices: function (callback) {
      async.parallel([
        async.apply(getService, "r"),
        async.apply(getService, "w")
      ], callback);
    },
    getCountries: function (callback) {
      var opts = Object.assign({}, deliveryData.countriesUrl);
      async.retry(config.retryOpts, function (callback) {
        request(opts, callback)
      }, function (err, r, b) {
        if (err) {
          return callback(null, []);
        }
        b = b.substring(1, b.length);
        var json = null;
        try {
          json = JSON.parse(b);
        } catch (e) {}
        if (!json) {
          return callback(null, []);
        }
        var countries = json.map(function (item) {
          return {
            id: item.OkatoID,
            name: item.OkatoName.toLowerCase(),
            success: true,
            isCountry: true
          };
        });
        callback(null, countries);
      });
    },
    getInitialCities: function (callback) {
      var opts = Object.assign({}, deliveryData.citiesUrl);
      opts.uri += 'show';
      async.retry(config.retryOpts, function (callback) {
        request(opts, callback)
      }, function (err, r, b) {
        if (err) {
          return callback(null, []);
        }
        b = b.substring(1, b.length);
        var json = null;
        try {
          json = JSON.parse(b);
        } catch (e) {}
        if (!json) {
          return callback(null, []);
        }
        var items = json.map(function (item) {
          return {
            id: item.OkatoID,
            name: item.OkatoName.toLowerCase(),
            isCountry: false
          };
        });
        callback(null, items);
      });
    },
    getCities: ['getCountries', 'getInitialCities', function (results, callback) {
      var countryObj = _.indexBy(results.getCountries, 'name');
      async.mapSeries(cities, function (city, callback) {
        if (!city.from && !city.countryTo) {
          city.error = commonHelper.CITYORCOUNTRYREQUIRED;
          return async.nextTick(function () {
            callback(null, city);
          });
        }
        if (city.countryFrom) {
          city.error = commonHelper.COUNTRYFROMRUSSIA;
          return async.nextTick(function () {
            callback(null, city);
          });
        }
        if (city.countryTo && !results.getCountries.length) {
          city.error = commonHelper.COUNTRYLISTERROR;
          return async.nextTick(function () {
            callback(null, city);
          });
        }
        if (city.countryTo && typeof countryObj[city.countryTo.toLowerCase()] === 'undefined') {
          city.error = commonHelper.COUNTRYNOTFOUND;
          return async.nextTick(function () {
            callback(null, city);
          });
        }
        if (!city.countryTo) {
          if (!results.getInitialCities.length) {
            city.error = commonHelper.getResponseError({});
            return async.nextTick(function () {
              callback(null, city);
            });
          }
          city.fromTrim = commonHelper.getCity(city.from);
          var from = commonHelper.findInArray(results.getInitialCities, city.fromTrim);
          if (!from.length) {
            from = commonHelper.findInArray(results.getInitialCities, commonHelper.getRegionName(city.from));
          }
          if (!from.length) {
            city.error = commonHelper.CITYFROMNOTFOUND;
            return async.nextTick(function () {
              callback(null, city);
            });
          }
          city.toTrim = commonHelper.getCity(city.to);
          var to = commonHelper.findInArray(results.getInitialCities, city.toTrim);
          if (!to.length) {
            to = commonHelper.findInArray(results.getInitialCities, commonHelper.getRegionName(city.to));
          }
          if (!to.length) {
            city.error = commonHelper.CITYTONOTFOUND;
            return async.nextTick(function () {
              callback(null, city);
            });
          }
          city.fromJson = from[0];
          city.toJson = to[0];
        }
        setTimeout(function () {
          if (global[delivery] > timestamp) {
            return callback({abort: true});
          }
          async.parallel([
            function (callback) {
              if (typeof  cityObj[city.from + city.countryFrom] !== 'undefined') {
                return callback(null);
              }
              if (city.countryTo) {
                return callback(null);
              }
              getCity(city, true, callback);
            },
            function (callback) {
              if (typeof  cityObj[city.to + city.countryTo] !== 'undefined') {
                return callback(null);
              }
              if (city.countryTo) {
                return callback(null);
              }
              getCity(city, false, callback);
            }
          ], function (err, foundCities) { //ошибки быть не может
            if (!city.countryTo) {
              if (typeof  cityObj[city.from + city.countryFrom] === 'undefined') {
                cityObj[city.from + city.countryFrom] = foundCities[0];
              }
              if (typeof  cityObj[city.to + city.countryTo] === 'undefined') {
                cityObj[city.to + city.countryTo] = foundCities[1];
              }
              city.fromJson = cityObj[city.from + city.countryFrom];
              city.toJson = cityObj[city.to + city.countryTo];
            } else {
              city.toJson = countryObj[city.countryTo.toLowerCase()];
            }
            callback(null, city);
          });
        }, commonHelper.randomInteger(500, 1000));
      }, callback);
    }],
    parseCities: ['getCities', function (results, callback) {
      logger.tariffsInfoLog(delivery, results.getCities, 'getCities');
      var tempRequests = [];
      var tempIntRequests = [];
      results.getCities.forEach(function (item) {
        if (item.error) {
          requests = requests.concat(commonHelper.getResponseArray(req.body.weights, item, delivery, item.error));
        } else if (item.countryTo) {
          tempIntRequests.push({
            city: {
              initialCityFrom: item.from,
              initialCityTo: item.to,
              from: item.from,
              to: item.countryTo,
              countryFrom: item.countryFrom,
              countryTo: item.countryTo
            },
            req: {toJson: item.toJson},
            delivery: delivery,
            tariffs: []
          });
        } else {
          item.fromJson.foundCities.forEach(function (fromCity) {
            item.toJson.foundCities.forEach(function (toCity) {
              tempRequests.push({
                city: {
                  initialCityFrom: item.from,
                  initialCityTo: item.to,
                  from: fromCity.name,
                  to: toCity.name,
                  countryFrom: item.countryFrom,
                  countryTo: item.countryTo
                },
                req: {fromJson: fromCity, toJson: toCity, regionId: item.fromJson.regionId || item.toJson.regionId},
                delivery: delivery,
                tariffs: []
              });
            });
          });
        }
      });
      tempRequests.forEach(function (item) {
        req.body.weights.forEach(function (weight) {
          var obj = Object.assign({}, item);
          obj.weight = weight;
          obj.req.weight = weight;
          requests.push(obj);
        });
      });
      tempIntRequests.forEach(function (item) {
        req.body.weights.forEach(function (weight) {
          var obj = Object.assign({}, item);
          obj.weight = weight;
          obj.req.weight = weight;
          intRequests.push(obj);
        });
      });
      callback(null);
    }],
    requests: ['parseCities', 'getServices', function (results, callback) {
      getCalcResult(requests, timestamp, 'r', results.getServices[0], callback);
    }],
    internationalRequests: ['parseCities', 'getServices', function (results, callback) {
      getCalcResult(intRequests, timestamp, 'w', results.getServices[1], callback);
    }]
  }, function (err, results) {
    logger.tariffsInfoLog(delivery, results.requests, 'getTariffs');
    logger.tariffsInfoLog(delivery, results.internationalRequests, 'getTIntariffs');
    commonHelper.saveResults(req, err, {
      delivery: delivery,
      timestamp: timestamp,
      cities: cities,
      items: err ? [] : results.requests.concat(results.internationalRequests)
    });
  });
};