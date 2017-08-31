var responseHelper = require('../../helpers/response');
var deliveryHelper = require('../../helpers/delivery');
var commonHelper = require('../../helpers/common');
var async = require('async');
var request = commonHelper.request;
var cheerio = require('cheerio');
var config = require('../../../conf');
var _ = require('underscore');
var logger = require('../../helpers/logger');
var delivery = 'cdek';

var getReq = function (from, to) {
  from = from || {};
  to = to || {};
  return {
    Action: 'GetTarifList',
    orderType: 1,
    FromCity: from.code,
    ToCity: to.code,
    'Package[0][weight]': 1,
    'Package[0][length]': 1,
    'Package[0][width]': 1,
    'Package[0][height]': 1,
    'Package[0][description]': '',
    idInterface: 3
  }
};

var getCity = function (city, country, callback) {
  var deliveryData = deliveryHelper.get(delivery);
  var opts = Object.assign({}, deliveryData.citiesUrl);
  var trim = commonHelper.getCity(city);
  opts.body = 'Action=GetLocationList&city=' + escape(trim);
  opts.followAllRedirects = true;
  opts.jar = true;
  async.retry(config.retryOpts, function (callback) {
    request(opts, callback)
  }, function (err, r, b) {
    var result = {
      city: city,
      country: country,
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
    if (!json.js) {
      result.message = commonHelper.getCityJsonError(new Error("Неверный формат ответа, отсутствует параметр js"), trim);
      return callback(null, result);
    }
    if (!json.js.Content) {
      result.message = commonHelper.getCityJsonError(new Error("Неверный формат ответа, отсутствует параметр js.Content"), trim);
      return callback(null, result);
    }
    if (!json.js.Content.result) {
      result.message = commonHelper.getCityJsonError(new Error("Неверный формат ответа, отсутствует параметр js.Content.result"), trim);
      return callback(null, result);
    }
    if (!Array.isArray(json.js.Content.result)) {
      result.message = commonHelper.getCityJsonError(new Error("Неверный формат ответа, js.Content.result - не массив"), trim);
      return callback(null, result);
    }
    var cities = commonHelper.findInArray(json.js.Content.result, trim, 'name', true);
    if (!cities.length) {
      result.message = commonHelper.getCityNoResultError(trim);
    } else if (cities.length === 1) {
      result.foundCities = cities;
      result.success = true;
    } else {
      var region = commonHelper.getRegionName(city);
      var founds = [];
      if (country) {
        founds = commonHelper.findInArray(cities, country, 'countryName');
      }
      if (region) {
        founds = commonHelper.findInArray(founds.length ? founds : cities, region, 'name');
      }
      result.foundCities = founds.length ? founds : [cities[0]];
      result.success = true;
    }
    callback(null, result);
  });
};

module.exports = function (req, cities, callback) {
  var deliveryData = deliveryHelper.get(delivery);
  var requests = [];
  var cityObj = {};
  var timestamp = callback ? new Date().getTime*2 : commonHelper.getReqStored(req, delivery);
  async.auto({
    getCities: function (callback) {
      async.mapSeries(cities, function (city, callback) {
        if (!city.from || !city.to) {
          city.error = commonHelper.CITIESREQUIRED;
          return async.nextTick(function () {
            callback(null, city);
          });
        }
        setTimeout(function () {
          if (commonHelper.getReqStored(req, delivery) > timestamp) {
            return callback({abort: true});
          }
          async.parallel([
            function (callback) {
              if (typeof  cityObj[city.from + city.countryFrom] !== 'undefined') {
                return callback(null);
              }
              getCity(city.from, city.countryFrom, callback);
            },
            function (callback) {
              if (typeof  cityObj[city.to + city.countryTo] !== 'undefined') {
                return callback(null);
              }
              getCity(city.to, city.countryTo, callback);
            }
          ], function (err, foundCities) { //ошибки быть не может
            if (typeof  cityObj[city.from + city.countryFrom] === 'undefined') {
              cityObj[city.from + city.countryFrom] = foundCities[0];
            }
            if (typeof  cityObj[city.to + city.countryTo] === 'undefined') {
              cityObj[city.to + city.countryTo] = foundCities[1];
            }
            city.fromJson = cityObj[city.from + city.countryFrom];
            city.toJson = cityObj[city.to + city.countryTo];
            callback(null, city);
          });
        }, commonHelper.randomInteger(500, 1000));
      }, callback);
    },
    parseCities: ['getCities', function (results, callback) {
      logger.tariffsInfoLog(delivery, results.getCities, 'getCities');
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
                  from: fromCity.name,
                  to: toCity.name,
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
          obj.req['Package[0][weight]'] = weight;
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
        var opts = _.extend({}, deliveryData.calcUrl);
        opts.body = '';
        for (var key in item.req) {
          opts.body += (key + '=' + item.req[key] + '&');
        }
        opts.jar = true;
        setTimeout(function () {
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
              item.error = commonHelper.getResultJsonError(e);
            }
            if (!json) {
              return callback(null, item);
            }
            if (!json.js) {
              item.error = commonHelper.getResultJsonError(new Error("Неверный формат ответа, отсутствует параметр js"));
              return callback(null, item);
            }
            if (!json.js.Content) {
              item.error = commonHelper.getResultJsonError(new Error("Неверный формат ответа, отсутствует параметр js.Content"));
              return callback(null, item);
            }
            if (!json.js.Content.result) {
              item.error = commonHelper.getResultJsonError(new Error("Неверный формат ответа, отсутствует параметр js.Content.result"));
              return callback(null, item);
            }
            if (!Array.isArray(json.js.Content.result)) {
              item.error = commonHelper.getResultJsonError(new Error("Неверный формат ответа, js.Content.result - не массив"));
              return callback(null, item);
            }

            item.tariffs = json.js.Content.result.map(function (trf) {
              return {
                service: trf.serviceName,
                cost: trf.price,
                deliveryTime: trf.periodMin === trf.periodMax ? trf.periodMin : trf.periodMin + '-' + trf.periodMax
              }
            });

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
    commonHelper.saveResults(req, err, {
      delivery: delivery,
      timestamp: timestamp,
      cities: cities,
      items: results.requests || [],
      callback: callback
    });
  });
};