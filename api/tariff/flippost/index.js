var responseHelper = require('../../helpers/response');
var deliveryHelper = require('../../helpers/delivery');
var commonHelper = require('../../helpers/common');
var async = require('async');
var request = commonHelper.request;
var cheerio = require('cheerio');
var config = require('../../../conf');
var _ = require('underscore');
var logger = require('../../helpers/logger');
var delivery = 'flippost';

var getReq = function (to) {
  to = to || {};
  return {
    org: 'MOW',
    dest: to.citycode
  }
};

var getOtDoReq = function (to) {
  to = to || {};
  return {
    CityID: to.id
  }
};

var getCity = function (city, callback) {
  var deliveryData = deliveryHelper.get(delivery);
  var opts = Object.assign({}, deliveryData.citiesUrl);
  var trim = commonHelper.getCity(city.to || city.countryTo);
  opts.uri += ('city=' + encodeURIComponent(trim));
  async.retry(config.retryOpts, function (callback) {
    request(opts, callback)
  }, function (err, r, b) {
    var result = {
      city: city.to || city.countryTo,
      cityTrim: trim,
      success: false
    };
    if (err) {
      result.message = commonHelper.getCityJsonError(err, trim);
      return callback(null, result);
    }
    var json = null;
    try {
      json = JSON.parse(b);
    } catch (e) {
      result.message = commonHelper.getCityJsonError(e, trim);
    }
    if (!json) {
      return callback(null, result);
    }
    if (!json.success) {
      result.message = commonHelper.getCityJsonError(new Error(json.msg || "success=false"), trim);
      return callback(null, result);
    }
    if (!json.data) {
      result.message = commonHelper.getCityJsonError(new Error("Отсутствует data в ответе"), trim);
      return callback(null, result);
    }
    if (!Array.isArray(json.data)) {
      result.message = commonHelper.getCityJsonError(new Error("Неверный тип data в ответе"), trim);
      return callback(null, result);
    }
    if (!json.data.length) {
      result.message = commonHelper.getCityNoResultError(trim);
    } else if (json.data.length === 1) {
      result.foundCities = json.data;
      result.success = true;
    } else {
      var region = commonHelper.getRegionName(city.to);
      var founds = [];
      if (region) {
        json.data.forEach(function (item) {
          if (new RegExp(region, 'gi').test(item.fullname)) {
            founds.push(item);
          }
        });
      }
      if (city.countryFrom) {
        json.data.forEach(function (item) {
          if (new RegExp(city.countryFrom, 'gi').test(item.country)) {
            founds.push(item);
          }
        });
      }
      result.foundCities = founds.length ? founds : [json.data[0]];
      result.success = true;
    }
    result.cities = json.data;
    callback(null, result);
  });
};

var existsCountry = function (countries, country) {
  var found = null;
  countries.forEach(function (item) {
    if (new RegExp(country, 'gi').test(item.name)) {
      found = item;
    }
  });
  return found;
};

module.exports = function (req, cities, callback) {
  var deliveryData = deliveryHelper.get(delivery);
  var requests = [];
  var otdoRequests = [];
  var cityObj = {};
  var timestamp = callback ? new Date().getTime*2 : commonHelper.getReqStored(req, delivery);
  async.auto({
    getOtDoCountries: function (callback) {
      var opts = Object.assign({}, deliveryData.calcOtdoIntUrl);
      async.retry(config.retryOpts, function (callback) {
        request(opts, callback)
      }, function (err, r, b) {
        if (err) {
          return callback(null, []);
        }
        var $ = cheerio.load(b);
        var options = $('select[name="CityID"]').find('option');
        var countries = [];
        options.each(function (index, item) {
          countries.push({id: $(item).attr('value'), name: $(item).text().trim().toUpperCase(), success: true, isCountry: true});
        });
        callback(null, countries);
      });
    },
    getOtDoCities: function (callback) {
      var opts = Object.assign({}, deliveryData.calcOtdoUrl);
      async.retry(config.retryOpts, function (callback) {
        request(opts, callback)
      }, function (err, r, b) {
        if (err) {
          return callback(null, []);
        }
        var $ = cheerio.load(b);
        var options = $('select[name="CityID"]').find('option');
        var foundCities = [];
        options.each(function (index, item) {
          foundCities.push({id: $(item).attr('value'), name: $(item).text().trim().toUpperCase(), success: true});
        });
        callback(null, foundCities);
      });
    },
    getCities: ['getOtDoCountries', 'getOtDoCities', function (results, callback) {
      var countryOtDoObj = _.indexBy(results.getOtDoCountries, 'name');
      var cityOtDoObj = _.indexBy(results.getOtDoCities, 'name');
      async.mapSeries(cities, function (city, callback) {
        if (!city.from) {
          city.error = commonHelper.CITYFROMREQUIRED;
          return async.nextTick(function () {
            callback(null, city);
          });
        }
        if (["новосибирск", "москва"].indexOf(city.from.toLowerCase()) === -1) {
          city.error = "Отправления возможны только из г. Москва или г. Новосибирск";
          return async.nextTick(function () {
            callback(null, city);
          });
        }
        var foundCountry = existsCountry(results.getOtDoCountries, city.countryTo);
        if (["новосибирск"].indexOf(city.from.toLowerCase()) !== -1) {
          if (!city.to && city.countryTo && !results.getOtDoCountries.length) {
            city.error = commonHelper.COUNTRYLISTERROR;
            return async.nextTick(function () {
              callback(null, city);
            });
          }
          if (!city.to && city.countryTo && !foundCountry) {
            city.error = commonHelper.COUNTRYNOTFOUND;
            return async.nextTick(function () {
              callback(null, city);
            });
          }
          if (city.countryTo && !foundCountry) { //страна в приоритете
            city.error = commonHelper.COUNTRYNOTFOUND;
            return async.nextTick(function () {
              callback(null, city);
            });
          }
          if (city.to && !city.countryTo && typeof cityOtDoObj[city.to.toUpperCase()] === 'undefined') {
            city.error = commonHelper.CITYTONOTFOUND;
            return async.nextTick(function () {
              callback(null, city);
            });
          }
        }
        setTimeout(function () {
          if (commonHelper.getReqStored(req, delivery) > timestamp) {
            return callback({abort: true});
          }
          if (["новосибирск"].indexOf(city.from.toLowerCase()) !== -1) {
            if (city.countryTo) {
              city.toJson = _.clone(foundCountry);
            } else {
              city.toJson = _.clone(cityOtDoObj[city.to.toUpperCase()]);
            }
            return async.nextTick(function () {
              callback(null, city);
            });
          } else {
            getCity(city, function (err, cityTo) {
              if (typeof  cityObj[city.to + city.countryTo] === 'undefined') {
                cityObj[city.to + city.countryTo] = cityTo;
              }
              city.toJson = cityObj[city.to + city.countryTo];
              callback(null, city);
            });
          }
        }, commonHelper.randomInteger(500, 1000));
      }, callback);
    }],
    parseCities: ['getCities', function (results, callback) {
      logger.tariffsInfoLog(delivery, results.getCities, 'getCities');
      var tempRequests = [];
      var tempOtdoRequests = [];
      results.getCities.forEach(function (item) {
        if (item.error) {
          requests = requests.concat(commonHelper.getResponseArray(req.body.weights, item, delivery, item.error));
        } else if (["новосибирск"].indexOf(item.from.toLowerCase()) !== -1) {
          tempOtdoRequests.push({
            city: {
              initialCityFrom: item.from,
              initialCityTo: item.to,
              from: item.from,
              to: item.toJson.isCountry ? item.to : item.toJson.name,
              initialCountryFrom: item.countryFrom,
              initialCountryTo: item.countryTo,
              countryFrom: item.countryFrom,
              countryTo: item.toJson.isCountry ? item.toJson.name : item.countryTo
            },
            isCountry: item.toJson.isCountry,
            req: getOtDoReq(item.toJson),
            delivery: delivery,
            tariffs: []
          });
        } else if (!item.toJson.success) {
          requests = requests.concat(commonHelper.getResponseArray(req.body.weights, item, delivery, item.toJson.message));
        } else {
          item.toJson.foundCities.forEach(function (toCity) {
            tempRequests.push({
              city: {
                initialCityFrom: item.from,
                initialCityTo: item.to,
                from: item.from,
                to: toCity.fullname,
                countryFrom: item.countryFrom,
                countryTo: item.countryTo
              },
              req: getReq(toCity),
              delivery: delivery,
              tariffs: []
            });
          });
        }
      });
      tempRequests.forEach(function (item) {
        req.body.weights.forEach(function (weight) {
          var obj = commonHelper.deepClone(item);
          obj.weight = weight;
          obj.req.weight = weight;
          requests.push(obj);
        });
      });
      tempOtdoRequests.forEach(function (item) {
        req.body.weights.forEach(function (weight) {
          var obj = commonHelper.deepClone(item);
          obj.weight = weight;
          obj.req.Ves = weight;
          otdoRequests.push(obj);
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
        setTimeout(function () {
          var opts = _.extend({}, deliveryData.calcFlipUrl);
          for (var key in item.req) {
            opts.uri += (key + '=' + encodeURIComponent(item.req[key]) + '&');
          }
          async.retry(config.retryOpts, function (callback) {
            request(opts, callback)
          }, function (err, r, b) {
            if (err) {
              item.error = commonHelper.getResponseError(err);
              return callback(null, item);
            }
            var json = null;
            try {
              json = JSON.parse(b);
            } catch (e) {
              item.error = commonHelper.getCityJsonError(e);
            }
            if (!json) {
              return callback(null, item);
            }
            if (!json.success) {
              item.error = commonHelper.getCityJsonError(new Error(json.msg || "success=false"));
              return callback(null, item);
            }
            if (!json.data) {
              item.error = commonHelper.getCityJsonError(new Error("Отсутствует data в ответе"));
              return callback(null, item);
            }
            if (!Array.isArray(json.data)) {
              item.error = commonHelper.getCityJsonError(new Error("Неверный тип data в ответе"));
              return callback(null, item);
            }
            item.tariffs = json.data.map(function (trf) {
              return {
                cost: trf.tarif,
                deliveryTime: trf.deliverymin + ' - ' + trf.delivery,
                deliveryMin: trf.deliverymin,
                deliveryMax: trf.delivery
              }
            });
            if (!item.tariffs.length) {
              item.error = commonHelper.getNoResultError();
            }
            return callback(null, item);
          });
        }, commonHelper.randomInteger(500, 1000));
      }, callback);
    }],
    otDoRequests: ['parseCities', function (results, callback) {
      async.mapLimit(otdoRequests, 2, function (item, callback) {
        if (commonHelper.getReqStored(req, delivery) > timestamp) {
          return callback({abort: true});
        }
        if (item.error) {
          return async.nextTick(function () {
            callback(null, item);
          });
        }
        setTimeout(function () {
          var opts = _.extend({}, deliveryData.calcOtdoUrl);
          if (item.isCountry) {
            opts = _.extend({}, deliveryData.calcOtdoIntUrl);
          }
          for (var key in item.req) {
            opts.uri += (key + '=' + encodeURIComponent(item.req[key]) + '&');
          }
          async.retry(config.retryOpts, function (callback) {
            request(opts, callback)
          }, function (err, r, b) {
            if (err) {
              item.error = commonHelper.getResponseError(err);
              return callback(null, item);
            }
            var $ = cheerio.load(b);
            if (item.isCountry) {
              var p = $('.content').find('p')[0];
              if (p) {
                var strong = $($(p).find('strong')[1]);
                var splits = $(p).html().split('</strong>');
                if (strong.length && splits[2]) {
                  item.tariffs.push({
                    cost: strong.text().replace(/[^0-9-]/g, ''),
                    deliveryTime: cheerio.load(splits[2]).text().replace(/[^0-9-]/g, '')
                  });
                }
              }
            } else {
              var items = $('.content').find('li');
              items.each(function (index, li) {
                var splits = $(li).html().split('<strong>');
                if (splits[2]) {
                  item.tariffs.push({
                    service: cheerio.load(splits[0]).text(),
                    cost: cheerio.load(splits[1]).text().replace(/[^0-9]/g, ''),
                    deliveryTime: cheerio.load(splits[2]).text().replace(/[^0-9-]/g, '')
                  });
                }
              });
            }
            if (!item.tariffs.length) {
              item.error = commonHelper.getNoResultError();
            }
            return callback(null, item);
          });
        }, commonHelper.randomInteger(500, 1000));
      }, callback);
    }]
  }, function (err, results) {
    logger.tariffsInfoLog(delivery, results.requests, 'getTariffs');
    logger.tariffsInfoLog(delivery, results.otDoRequests, 'getOtDoTariffs');
    commonHelper.saveResults(req, err, {
      delivery: delivery,
      timestamp: timestamp,
      cities: cities,
      items: err ? [] : results.requests.concat(results.otDoRequests),
      callback: callback
    });
  });
};