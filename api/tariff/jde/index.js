var responseHelper = require('../../helpers/response');
var deliveryHelper = require('../../helpers/delivery');
var commonHelper = require('../../helpers/common');
var async = require('async');
var request = commonHelper.request;
var cheerio = require('cheerio');
var config = require('../../../conf');
var _ = require('underscore');
var logger = require('../../helpers/logger');
var delivery = 'jde';

var getReq = function (from, to) {
  from = from || {};
  to = to || {};
  return {
    FromCity: from.id,
    ToCity: to.id,
    Weight: 1,
    Volume: '0,01',
    VolumeDimension1: '',
    VolumeDimension2: '',
    VolumeDimension3: '',
    OverSizeWeight: '',
    OverSizeVolume: '',
    OverSizeVolumeDimension1: '',
    OverSizeVolumeDimension2: '',
    OverSizeVolumeDimension3: '',
    LathingVolume: '',
    LathingRatio: 1,
    SealingBag80: '',
    SealingBag100: '',
    SealingBag150: '',
    SealingBox1: '',
    SealingBox2: '',
    SealingBox3: '',
    SealingBox4: '',
    DeclaredUse: 'n',
    DeclaredPrice: '',
    FromDeliveryUse: 'y',
    FromDeliveryCity: from.trim,
    FromDeliveryCityKm: '',
    FromDeliveryLoadingUse: 'n',
    FromDeliveryLoadingTime: 15,
    ToDeliveryUse: 'y',
    ToDeliveryCity: to.trim,
    ToDeliveryCityKm: '',
    ToDeliveryLoadingUse: 'n',
    ToDeliveryLoadingTime: 15,
    add: 1
  };
};

var getCity = function (city, type, callback) {
  var deliveryData = deliveryHelper.get(delivery);
  var opts = Object.assign({}, deliveryData.citiesUrl);
  var trim = commonHelper.getCity(city);
  opts.form = {
    type: type,
    name: trim
  };
  async.retry(config.retryOpts, function (callback) {
    request(opts, callback)
  }, function (err, r, b) {
    var result = {
      city: city,
      cityTrim: trim,
      success: false
    };
    if (err) {
      result.message = commonHelper.getResponseError(err);
      return callback(null, result);
    }
    var json = null;
    try {
      json = JSON.parse(b);
    } catch (e) {
      result.message = commonHelper.getCityJsonError(e);
    }
    if (!json) {
      return callback(null, result);
    }
    if (!Array.isArray(json)) {
      result.message = commonHelper.getCityJsonError(new Error("Неверный тип данных в ответе"));
      return callback(null, result);
    }
    if (!json.length) {
      result.message = commonHelper.getCityNoResultError();
    } else if (json.length === 1) {
      result.foundCities = json;
      result.success = true;
    } else {
      var region = commonHelper.getRegionName(city);
      var founds = [];
      if (region) {
        founds = commonHelper.findInArray(json, region, 'name');
      }
      result.foundCities = founds.length ? founds : [json[0]];
      result.success = true;
    }
    result.cities = json;
    callback(null, result);
  });
};

module.exports = function (req, cities) {
  var deliveryData = deliveryHelper.get(delivery);
  var requests = [];
  var cityObj = {};
  var timestamp = global[delivery];
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
          if (global[delivery] > timestamp) {
            return callback({abort: true});
          }
          async.parallel([
            function (callback) {
              if (typeof  cityObj[city.from + city.countryFrom] !== 'undefined') {
                return callback(null);
              }
              getCity(city.from, 'from', callback);
            },
            function (callback) {
              if (typeof  cityObj[city.to + city.countryTo] !== 'undefined') {
                return callback(null);
              }
              getCity(city.to, 'to', callback);
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
              fromCity.trim = item.fromJson.cityTrim;
              toCity.trim = item.toJson.cityTrim;
              tempRequests.push({
                city: {
                  initialCityFrom: item.from,
                  initialCityTo: item.to,
                  from: fromCity.trim,
                  to: toCity.trim,
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
          obj.req.Weight = weight;
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
              item.error = commonHelper.getResponseError(e);
            }
            if (!json) {
              return callback(null, item);
            }
            if (!json.base) {
              item.error = commonHelper.getResponseError(new Error("Отсутствует обязательный параметр base"));
              return callback(null, item);
            }
            try {
              var basePrice = commonHelper.parseFloat(json.base.price);
              if (json.warm && json.warm.price) {
                basePrice += commonHelper.parseFloat(json.warm.price);
              }
              var time = json.time.min + '-' + json.time.max;
              item.tariffs.push(commonHelper.createTariff("СС", basePrice, time));
              /*if (json.auto) {
                if (json.auto.from && json.auto.from.price) {
                  item.tariffs.push(commonHelper.createTariff("ДС", basePrice + commonHelper.parseFloat(json.auto.from.price), time));
                }
                if (json.auto.to && json.auto.to.price) {
                  item.tariffs.push(commonHelper.createTariff("СД", basePrice + commonHelper.parseFloat(json.auto.to.price), time));
                }
                if (json.auto.from && json.auto.from.price && json.auto.to && json.auto.to.price) {
                  item.tariffs.push(commonHelper.createTariff("ДД", basePrice + commonHelper.parseFloat(json.auto.from.price) + commonHelper.parseFloat(json.auto.to.price), time));
                }
              }*/
            } catch (e) {
              item.error = commonHelper.getResponseError(e);
            }
            if (item.error) {
              return callback(null, item);
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
    commonHelper.saveResults(req, err, {
      delivery: delivery,
      timestamp: timestamp,
      cities: cities,
      items: results.requests || []
    });
  });
};