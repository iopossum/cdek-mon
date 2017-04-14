var responseHelper = require('../../helpers/response');
var deliveryHelper = require('../../helpers/delivery');
var commonHelper = require('../../helpers/common');
var async = require('async');
var request = commonHelper.request;
var cheerio = require('cheerio');
var config = require('../../../conf');
var _ = require('underscore');
var logger = require('../../helpers/logger');
var delivery = 'ponyexpress';

var getReq = function (from, to, isCountry) {
  return {
    'parcel[currency_id]': 4,
    'parcel[tips_iblock_code]': 'form_tips',
    'parcel[tips_section_code]': 'pegas',
    'parcel[direction]': isCountry ? 'outer' : 'inner',
    'parcel[from_country]': isCountry ? from : '',
    'parcel[from_city]': !isCountry ? from : '',
    'parcel[to_country]': isCountry ? to : '',
    'parcel[to_city]': !isCountry ? to : '',
    'parcel[weight]': 1,
    'parcel[usecurrentdt]': 0,
    'parcel[kgo]': 0,
    'parcel[og]': 0,
    'parcel[isdoc]':0
  }
};

var getCity = function (city, isCountry, callback) {
  var deliveryData = deliveryHelper.get(delivery);
  var opts = Object.assign({}, isCountry ? deliveryData.countriesUrl : deliveryData.citiesUrl);
  var trim = commonHelper.getCity(city);
  opts.uri += encodeURIComponent(trim);
  async.retry(config.retryOpts, function (callback) {
    request(opts, callback)
  }, function (err, r, b) {
    var result = {
      city: city,
      cityTrim: trim,
      isCountry: isCountry,
      foundCities: [trim],
      success: true
    };
    if (err) {
      return callback(null, result);
    }
    b = b.substring(1, b.length);
    var json = null;
    try {
      json = JSON.parse(b);
    } catch (e) {
    }
    if (!json) {
      return callback(null, result);
    }
    if (!Array.isArray(json)) {
      return callback(null, result);
    }
    if (!json.length || !json[0]) {
      //result.message = isCountry ? commonHelper.getCountryNoResultError() : commonHelper.getCityNoResultError();
    } else if (json.length === 1) {
      result.foundCities = json;
      result.success = true;
    } else {
      var region = commonHelper.getRegionName(city);
      var founds = [];
      if (region) {
        json.forEach(function (item) {
          if (new RegExp(region, 'gi').test(item)) {
            founds.push(item);
          }
        });
      }
      result.foundCities = founds.length ? founds : [json[0]];
      result.success = true;
    }
    result.cities = json;
    callback(null, result);
  });
};

var getCalcResult = function (requests, timestamp, callback) {

};

module.exports = function (req, cities) {
  var deliveryData = deliveryHelper.get(delivery);
  var requests = [];
  var cityObj = {};
  var timestamp = global[delivery];
  var hackCities = ["москва", "владивосток", "санкт-петербург"];
  async.auto({
    getCities: [function (callback) {
      async.mapSeries(cities, function (city, callback) {
        if (!city.from && !city.countryFrom && city.countryTo) {
          city.countryFrom = 'Россия';
        }
        if (!city.to && !city.countryTo && city.countryFrom) {
          city.countryTo = 'Россия';
        }
        if (city.from && !city.countryFrom && !city.to && city.countryTo) {
          city.countryFrom = 'Россия';
        }
        if (city.to && !city.countryTo && !city.from && city.countryFrom) {
          city.countryTo = 'Россия';
        }
        if (!city.from && !city.countryFrom && !city.countryTo) {
          city.error = commonHelper.CITYORCOUNTRYFROMREQUIRED;
          return async.nextTick(function () {
            callback(null, city);
          });
        }
        if (!city.to && !city.countryTo) {
          city.error = commonHelper.CITYORCOUNTRYTOREQUIRED;
          return async.nextTick(function () {
            callback(null, city);
          });
        }
        if (!city.countryFrom || !city.countryTo) { //считаем, что доставка по стране
          if (!city.cityFrom && !city.to) {
            city.error = commonHelper.CITYORCOUNTRYREQUIRED;
            return async.nextTick(function () {
              callback(null, city);
            });
          }
        }
        setTimeout(function () {
          if (global[delivery] > timestamp) {
            return callback({abort: true});
          }
          var cityOpts = {
            from: city.from,
            to: city.to,
            isCountry: false
          };
          if (city.countryFrom && city.countryTo) {
            cityOpts.from = city.countryFrom;
            cityOpts.to = city.countryTo;
            cityOpts.isCountry = true;
          }
          async.parallel([
            function (callback) {
              if (typeof  cityObj[city.from + city.countryFrom] !== 'undefined') {
                return callback(null);
              }
              getCity(cityOpts.from, cityOpts.isCountry, callback);
            },
            function (callback) {
              if (typeof  cityObj[city.to + city.countryTo] !== 'undefined') {
                return callback(null);
              }
              getCity(cityOpts.to, cityOpts.isCountry, callback);
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
    }],
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
                  from: fromCity,
                  to: toCity,
                  countryFrom: item.countryFrom,
                  countryTo: item.countryTo
                },
                req: getReq(fromCity, toCity, item.fromJson.isCountry),
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
          obj.req['parcel[weight]'] = weight;
          requests.push(obj);
        });
      });
      callback(null);
    }],
    requests: ['parseCities', function (results, callback) {
      async.mapLimit(requests, 2, function (item, callback) {
        if (global[delivery] > timestamp) {
          return callback({abort: true});
        }
        if (item.error) {
          return async.nextTick(function () {
            callback(null, item);
          });
        }
        var opts = _.extend({}, deliveryData.calcUrl);
        opts.form = item.req;
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
              item.error = commonHelper.getCityJsonError(e);
            }
            if (!json) {
              return callback(null, item);
            }
            if (!json.result) {
              item.error = commonHelper.getCityJsonError(new Error("Неверный тип данных в ответе. Отсутствует параматер result"));
              return callback(null, item);
            }
            if (typeof json.result.calculation !== 'undefined' && !json.result.calculation) {
              item.error = commonHelper.getNoResultError();
              return callback(null, item);
            }
            for (var key in json.result) {
              item.tariffs.push({
                service: json.result[key].servise,
                cost: json.result[key].tariffvat,
                deliveryTime: json.result[key].delivery
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
    if (err) {
      if (err.abort) {
        return false;
      }
      req.session.delivery[delivery].complete = true;
      req.session.delivery[delivery].error = err.message || err.stack;
      var array = [];
      cities.forEach(function (item) {
        array = array.concat(commonHelper.getResponseArray(req.body.weights, item, delivery, err.message || err.stack))
      });
      req.session.delivery[delivery].results = array;
      req.session.save(function () {});
      return false;
    }
    req.session.delivery[delivery].complete = true;
    req.session.delivery[delivery].results = results.requests;
    req.session.save(function () {});
  });
};