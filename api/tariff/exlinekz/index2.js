var responseHelper = require('../../helpers/response');
var deliveryHelper = require('../../helpers/delivery');
var commonHelper = require('../../helpers/common');
var async = require('async');
var request = commonHelper.request;
var cheerio = require('cheerio');
var config = require('../../../conf');
var _ = require('underscore');
var logger = require('../../helpers/logger');
var delivery = 'exlinekz';

var getReq = function (from, to) {
  from = from || {};
  to = to || {};
  return {
    origin_id: from.id,
    destination_id: to.id,
    service: 'express',
    weight: 1,
    w:0,
    l:0,
    h:0
  }
};

var getDeliveryTime = function (calculation) {
  var result = '';
  if (!isNaN(parseInt(calculation.min, 10))) {
    result += calculation.min;
  }
  if (!isNaN(parseInt(calculation.max, 10))) {
    result += ('-' + calculation.max);
  }
  return result;
};

var getCost = function (calculation) {
  var result = 0;
  if (calculation.price) {
    result += calculation.price;
  }
  if (calculation.declared_value_fee) {
    result += calculation.declared_value_fee;
  }
  if (calculation.fuel_surplus) {
    result += calculation.fuel_surplus;
  }
  return result;
};

var getCityName = function (city) {
  var result = city.title;
  if (city.cached_path) {
    result += (', ' + city.cached_path);
  }
  return result;
};

var getServiceName = function (service) {
  var result = '';
  switch (service) {
    case 'standard':
      result = 'Стандарт';
      break;
    case 'express':
      result = 'Экспресс';
      break;
  }
  return result;
};

var getCity = function (city, country, opts, callback) {
  var trim = commonHelper.getCity(city || country);
  opts.uri += encodeURIComponent(trim) + '&_=' + new Date().getTime();
  opts.followAllRedirects = true;
  async.retry(config.retryOpts, function (callback) {
    request(opts, callback)
  }, function (err, r, b) {
    var result = {
      city: city,
      country: country,
      trim: trim,
      success: false
    };
    if (err) {
      result.message = city ? commonHelper.getCityJsonError(err, trim) : commonHelper.getCountriesError(err, country);
      return callback(null, result);
    }
    var json = null;
    try {
      json = JSON.parse(b);
    } catch (e) {
      result.message = city ? commonHelper.getCityJsonError(e, trim) : commonHelper.getCountriesError(e, country);
    }
    if (!json) {
      return callback(null, result);
    }
    if (!json.regions) {
      result.message = city ? commonHelper.getCityJsonError(new Error("Неверный формат ответа, отсутствует параметр regions"), trim) : commonHelper.getCountriesError(new Error("Неверный формат ответа, отсутствует параметр regions"), country);
      return callback(null, result);
    }
    if (!Array.isArray(json.regions)) {
      result.message = city ? commonHelper.getCityJsonError(new Error("Неверный формат ответа, js.Content.result - не массив"), trim) : commonHelper.getCountriesError(new Error("Неверный формат ответа, regions - не массив"), country);
      return callback(null, result);
    }
    var cities = commonHelper.findInArray(json.regions, trim, 'title', true);
    if (!cities.length) {
      cities = commonHelper.findInArray(json.regions, trim, 'cached_path', true);
    }
    if (!cities.length) {
      result.message = city ? commonHelper.getCityNoResultError(trim) : commonHelper.getCountryNoResultError(country);
    } else if (cities.length === 1) {
      result.foundCities = cities;
      result.success = true;
    } else {
      var region = commonHelper.getRegionName(city || country);
      var founds = [];
      if (region) {
        founds = commonHelper.findInArray(cities, region, 'title');
      }
      if (!founds.length) {
        founds = commonHelper.findInArray(cities, region, 'cached_path');
      }
      result.foundCities = founds.length ? founds : cities.slice(0, 3);
      result.success = true;
    }
    callback(null, result);
  });
};

var getCalcResult = function (item, service, callback) {
  setTimeout(function () {
    var copyReq = _.extend({}, item.req);
    copyReq.service = service;
    var deliveryData = deliveryHelper.get(delivery);
    var opts = _.extend({}, deliveryData.calcUrl);
    opts.uri += commonHelper.getQueryString(copyReq);
    async.retry(config.retryOpts, function (callback) {
      opts.followAllRedirects = true;
      request(opts, callback)
    }, function (err, r, b) {
      var result = {
        success: false
      };
      if (err) {
        result.error = commonHelper.getResultJsonError(err);
        return callback(null, result);
      }
      var json = null;
      try {
        json = JSON.parse(b);
      } catch (e) {
        result.error = commonHelper.getResultJsonError(e);
      }
      if (!json) {
        return callback(null, result);
      }
      if (!json.calculation) {
        result.error = commonHelper.getResultJsonError(new Error("Неверный формат ответа, отсутствует calculation"));
        return callback(null, result);
      }
      result.tariffs = [{
        service: getServiceName(service),
        cost: getCost(json.calculation),
        deliveryTime: getDeliveryTime(json.calculation)
      }];
      result.success = true;
      return callback(null, result);
    });
  }, commonHelper.randomInteger(500, 1000));
};

module.exports = function (req, cities, callback) {
  var deliveryData = deliveryHelper.get(delivery);
  var requests = [];
  var cityFromObj = {};
  var cityToObj = {};
  var timestamp = callback ? new Date().getTime*2 : commonHelper.getReqStored(req, delivery);
  cities.forEach(function (item) {
    item.countryFrom = item.countryFrom || 'Россия';
    item.countryTo = item.countryTo || 'Россия';
  });
  async.auto({
    getCities: function (callback) {
      async.mapSeries(cities, function (city, callback) {
        setTimeout(function () {
          if (commonHelper.getReqStored(req, delivery) > timestamp) {
            return callback({abort: true});
          }
          async.parallel([
            function (callback) {
              if (typeof  cityFromObj[city.from + city.countryFrom] !== 'undefined') {
                return callback(null);
              }
              var deliveryData = deliveryHelper.get(delivery);
              var opts = Object.assign({}, deliveryData.citiesFromUrl);
              getCity(city.from, city.countryFrom, opts, callback);
            },
            function (callback) {
              if (typeof  cityToObj[city.to + city.countryTo] !== 'undefined') {
                return callback(null);
              }
              var deliveryData = deliveryHelper.get(delivery);
              var opts = Object.assign({}, deliveryData.citiesToUrl);
              getCity(city.to, city.countryTo, opts, callback);
            }
          ], function (err, foundCities) { //ошибки быть не может
            if (typeof  cityFromObj[city.from + city.countryFrom] === 'undefined') {
              cityFromObj[city.from + city.countryFrom] = foundCities[0];
            }
            if (typeof  cityToObj[city.to + city.countryTo] === 'undefined') {
              cityToObj[city.to + city.countryTo] = foundCities[1];
            }
            city.fromJson = cityFromObj[city.from + city.countryFrom];
            city.toJson = cityToObj[city.to + city.countryTo];
            callback(null, city);
          });
        }, commonHelper.randomInteger(500, 1000));
      }, callback);
    },
    parseCities: ['getCities', function (results, callback) {
      var tempRequests = [];
      results.getCities.forEach(function (item) {
        if (item.error) {
          requests = requests.concat(commonHelper.getResponseArray(req.body.weights, item, delivery, item.error));
        } else if (!item.fromJson.success) {
          requests = requests.concat(commonHelper.getResponseArray(req.body.weights, item, delivery, item.fromJson.message));
        } else if (!item.toJson.success) {
          requests = requests.concat(commonHelper.getResponseArray(req.body.weights, item, delivery, item.toJson.message));
        } else {
          item.fromJson.foundCities.forEach(function (fromCity) {
            item.toJson.foundCities.forEach(function (toCity) {
              tempRequests.push({
                city: {
                  initialCityFrom: item.from,
                  initialCityTo: item.to,
                  from: getCityName(fromCity),
                  to: getCityName(toCity),
                  countryFrom: item.countryFrom,
                  countryTo: item.countryTo
                },
                req: getReq(fromCity, toCity),
                delivery: delivery,
                tariffs: []
              });
            });
          });
        }
      });
      tempRequests.forEach(function (item) {
        req.body.weights.forEach(function (weight) {
          var obj = commonHelper.deepClone(item);
          obj.weight = weight;
          obj.req['weight'] = weight;
          requests.push(obj);
        });
      });
      callback(null);
    }],
    requests: ['parseCities', function (results, callback) {
      async.mapLimit(requests, 2, function (item, callback) {
        if (commonHelper.getReqStored(req, delivery) > timestamp) {
          return callback({abort: true});
        }
        if (item.error) {
          return async.nextTick(function () {
            callback(null, item);
          });
        }
        async.parallel([
          function (cb) {
            getCalcResult(item, 'express', cb);
          },
          function (cb) {
            getCalcResult(item, 'standard', cb);
          }
        ], function (err, results) {
          if (results[0].success) {
            item.tariffs = item.tariffs.concat(results[0].tariffs);
          }
          if (results[1].success) {
            item.tariffs = item.tariffs.concat(results[1].tariffs);
          }
          if (!item.tariffs.length) {
            item.error = results[0].error || results[1].error || commonHelper.getNoResultError();
          }
          return callback(null, item);
        });
      }, callback);
    }]
  }, function (err, results) {
    commonHelper.saveResults(req, err, {
      delivery: delivery,
      timestamp: timestamp,
      cities: cities,
      items: results.requests || [],
      callback: callback
    });
  });
};