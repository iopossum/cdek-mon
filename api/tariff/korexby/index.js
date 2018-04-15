var responseHelper = require('../../helpers/response');
var deliveryHelper = require('../../helpers/delivery');
var commonHelper = require('../../helpers/common');
var async = require('async');
var request = commonHelper.request;
var cheerio = require('cheerio');
var config = require('../../../conf');
var _ = require('underscore');
var logger = require('../../helpers/logger');
var delivery = 'korexby';

var getReq = function (from, to) {
  from = from || {};
  to = to || {};
  return {
    fio: '',
    organiz: '',
    email: '',
    phone: '',
    address_from: from.FULL_TITLE,
    address_to: to.FULL_TITLE,
    weight: 1,
    d: '0,01',
    sh: '0,01',
    v: '0,01'
  }
};

var getDeliveryTime = function (json) {
  var result = '';
  json = json || {};
  if (!json.days) {
    return result;
  }
  if (!json.days.days_min) {
    return result;
  }
  result = json.days.days_min;
  if (json.days.days_max) {
    result += '-' + json.days.days_max;
  }
  return result;
};

var getCity = function (city, country, callback) {
  var deliveryData = deliveryHelper.get(delivery);
  var opts = Object.assign({}, deliveryData.citiesUrl);
  var trim = commonHelper.getCity(city);
  opts.form = {address_from: trim};
  opts.followAllRedirects = true;
  opts.headers['X-Requested-With'] = 'XMLHttpRequest';
  async.retry(config.retryOpts, function (callback) {
    request(opts, callback)
  }, function (err, r, json) {
    json = json || {};
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
    if (json.OK !== 'Y') {
      result.message = commonHelper.getCityJsonError(new Error("Неверный формат ответа, статус не Y"), trim);
      return callback(null, result);
    }
    if (!json.list) {
      result.message = commonHelper.getCityJsonError(new Error("Неверный формат ответа, отсутствует параметр list"), trim);
      return callback(null, result);
    }
    if (!Array.isArray(json.list)) {
      result.message = commonHelper.getCityJsonError(new Error("Неверный формат ответа, list - не массив"), trim);
      return callback(null, result);
    }
    var cities = commonHelper.findInArray(json.list, trim, 'UF_TITLE');
    if (!cities.length) {
      cities = commonHelper.findInArray(json.list, trim, 'FULL_TITLE');
    }
    if (!cities.length) {
      result.message = commonHelper.getCityNoResultError(trim);
    } else if (cities.length === 1) {
      result.foundCities = cities;
      result.success = true;
    } else {
      var region = commonHelper.getRegionName(city);
      var foundsByCountry = [];
      var foundsByRegion = [];
      if (country) {
        foundsByCountry = commonHelper.findInArray(cities, country, 'FULL_TITLE');
      }
      if (region) {
        if (foundsByCountry.length) {
          foundsByRegion = commonHelper.findInArray(foundsByCountry, region, 'FULL_TITLE');
        } else {
          foundsByRegion = commonHelper.findInArray(cities, region, 'FULL_TITLE');
        }
      }
      var totally = foundsByRegion.length ? foundsByRegion : foundsByCountry;
      result.foundCities = totally.length ? totally.slice(0, 3) : cities.slice(0, 3);
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
        city.countryFrom = city.countryFrom || 'Россия';
        city.countryTo = city.countryTo || 'Россия';
        if (commonHelper.BY.indexOf(city.countryFrom.toLowerCase()) > -1) {
          city.fromBy = true;
        }
        if (commonHelper.BY.indexOf(city.countryTo.toLowerCase()) > -1) {
          city.toBy = true;
        }
        if (!city.fromBy && !city.toBy) {
          city.error = commonHelper.CITYFROMORTOBY;
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
                  from: fromCity.FULL_TITLE,
                  to: toCity.FULL_TITLE,
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
          if (weight <= 10) {
            var obj2 = commonHelper.deepClone(item);
            obj2.weight = weight;
            obj2.req.weight = weight;
            obj2.service = 'документы';
            requests.push(obj2);
          }
          var obj = commonHelper.deepClone(item);
          obj.weight = weight;
          obj.service = 'Не документы';
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
        var opts = _.extend({}, deliveryData.calcUrl);
        opts.form = item.req;
        opts.headers['X-Requested-With'] = 'XMLHttpRequest';
        setTimeout(function () {
          async.retry(config.retryOpts, function (callback) {
            request(opts, callback)
          }, function (err, r, json) {
            json = json || {};
            if (err) {
              item.error = commonHelper.getResponseError(err);
              return callback(null, item);
            }
            if (json.OK !== 'Y') {
              item.error = commonHelper.getResultJsonError(new Error("Неверный формат ответа, статус не Y"));
              return callback(null, item);
            }
            if (!json.price) {
              item.error = commonHelper.getNoResultError();
              return callback(null, item);
            }
            item.tariffs = [{
              service: item.service,
              cost: json.price.replace(commonHelper.COSTREGDOT, '').replace(/\.$/, ''),
              deliveryTime: getDeliveryTime(json)
            }];
            delete item.service;
            return callback(null, item);
          });
        }, commonHelper.randomInteger(500, 1000));
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