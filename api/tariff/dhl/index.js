var responseHelper = require('../../helpers/response');
var deliveryHelper = require('../../helpers/delivery');
var commonHelper = require('../../helpers/common');
var async = require('async');
var request = commonHelper.request;
var cheerio = require('cheerio');
var config = require('../../../conf');
var logger = require('../../helpers/logger');
var _ = require('underscore');
var moment = require('moment');
var delivery = 'dhl';

var getServiceReq = function (id, session) {
  return {
    language: "ru",
    max_count: 1,
    nearest: {google_place_id: id, limit_km: 100},
    session_id: session
  };
};

var getReq = function (from, to, servicePoint, session) {
  return {
    date: moment().add(1, 'day').format("YYYY-MM-DD"),
    language: "ru",
    pieces: [{id: "1", weight: "1", type: 0, width: null, height: null, depth: null}],
    ready_time: "09:00",
    rec_google_place_id: to,
    service_point_route: servicePoint || '',
    session_id: session,
    shp_google_place_id: from
  };
};

var getCity = function (json, callback) {
  var deliveryData = deliveryHelper.get(delivery);
  var opts = Object.assign({}, deliveryData.citiesUrl);
  opts.json = json;
  if (!json.google_place_id) {
    return callback(null, {success: false, message: json.purpose === 'pickup' ? commonHelper.CITYFROMNOTFOUND : commonHelper.CITYTONOTFOUND});
  }
  async.retry(config.retryOpts, function (callback) {
    request(opts, callback)
  }, function (err, r, b) {
    var result = {
      success: false
    };
    if (err) {
      result.message = commonHelper.getResponseError(err);
      return callback(null, result);
    }
    if (!b) {
      result.message = commonHelper.getCityJsonError(new Error("Неверный ответ от сервера"));
      return callback(null, result);
    }
    if (!b.success) {
      result.message = commonHelper.getCityJsonError(new Error("Отсутствует обязательный параметр success"));
      return callback(null, result);
    }
    if (!b.success.place_details) {
      result.message = commonHelper.getCityJsonError(new Error("Отсутствует обязательный параметр success.place_details"));
      return callback(null, result);
    }
    result.foundCities = [b.success.place_details];
    result.success = true;
    result.cities = [b.success.place_details];
    callback(null, result);
  });
};

var calcResults = function (item, session, callback) {
  var deliveryData = deliveryHelper.get(delivery);
  setTimeout(function () {
    async.waterfall([
      function (callback) {
        var opts = _.extend({}, deliveryData.calcUrlAdditional);
        opts.json = item.serviceReq;
        async.retry(config.retryOpts, function (callback) {
          request(opts, callback)
        }, function (err, r, b) {
          var result = '';
          if (err) {
            return callback(null, result);
          }
          try {
            result = b.success[0].route;
          } catch(e) {}
          return callback(null, result);
        });
      },
      function (servicePoint, callback) {
        var opts = _.extend({}, deliveryData.calcUrl);
        opts.json = getReq(item.city.fromGooglePlaceId, item.city.toGooglePlaceId, servicePoint, session);
        opts.json.pieces[0].weight = item.weight;
        async.retry(config.retryOpts, function (callback) {
          request(opts, callback)
        }, function (err, r, b) {
          var result = {
            tariffs: []
          };
          if (err) {
            result.error = commonHelper.getResponseError(err);
            return callback(null, result);
          }
          if (!b) {
            result.error = commonHelper.getResponseError(new Error("Неверный формат ответа"));
            return callback(null, result);
          }
          if (!b.success) {
            result.error = commonHelper.getNoResultError();
            return callback(null, result);
          }
          if (b.success.call) {
            var deliveryTime = '';
            if (b.success.call.delivery_date) {
              deliveryTime = moment(moment(b.success.call.delivery_date, 'YYYY-MM-DD')).diff(moment().add(1, 'day'), 'days') + 1;
            }
            result.tariffs.push(commonHelper.createTariff("Вызвать курьера по телефону", commonHelper.parseFloat(b.success.call.price), deliveryTime));
          }
          if (b.success.click) {
            var deliveryTime = '';
            if (b.success.click.delivery_date) {
              deliveryTime = moment(moment(b.success.click.delivery_date, 'YYYY-MM-DD')).diff(moment().add(1, 'day'), 'days') + 1;
            }
            result.tariffs.push(commonHelper.createTariff("Вызвать курьера онлайн", commonHelper.parseFloat(b.success.click.price), deliveryTime));
          }
          if (b.success.walk) {
            var deliveryTime = '';
            if (b.success.walk.delivery_date) {
              deliveryTime = moment(moment(b.success.walk.delivery_date, 'YYYY-MM-DD')).diff(moment().add(1, 'day'), 'days') + 1;
            }
            result.tariffs.push(commonHelper.createTariff("Подготовить накладную и отправить из офиса DHL", commonHelper.parseFloat(b.success.walk.price), deliveryTime));
          }
          return callback(null, result);
        });
      }
    ], function (err, results) {
      if (results.error) {
        item.error = results.error;
      } else if (!results.tariffs.length) {
        item.error = commonHelper.getNoResultError();
      }
      item.tariffs = results.tariffs;
      callback(null, item);
    });
  }, commonHelper.randomInteger(500, 1000));
};

module.exports = function (req, cities) {
  var deliveryData = deliveryHelper.get(delivery);
  var requests = [];
  var cityObj = {};
  var timestamp = global[delivery];

  async.auto({
    getSession: function (callback) {
      var opts = deliveryData.authorizeUrl;
      opts.json = {language: 'ru'};
      async.retry(config.retryOpts, function (callback) {
        request(opts, callback)
      }, function (err, r, b) {
        console.log(b);
        if (err) {
          return callback(commonHelper.getResponseError(new Error("Сайт не загружается, попробуйте позже")));
        }
        if (!b) {
          return callback(commonHelper.getResponseError(new Error("Невозможно получить сессию. Неверный формат json")));
        }
        if (!b.success) {
          return callback(commonHelper.getResponseError(new Error("Сессия. Неверный тип данных в ответе. Отсутствует параметр success")));
        }
        if (!b.success.SessionId) {
          return callback(commonHelper.getResponseError(new Error("Сессия. Неверный тип данных в ответе. Отсутствует параметр success.SessionId")));
        }
        callback(null, b.success.SessionId);
      });
    },
    getCities: ['getSession', function (results, callback) {
      async.mapSeries(cities, function (city, callback) {
        if (!city.from || !city.to) {
          city.error = commonHelper.CITIESREQUIRED;
          return async.nextTick(function () {
            callback(null, city);
          });
        }
        if (!city.fromGooglePlaceId) {
          city.error = commonHelper.CITYFROMNOTFOUND;
          return async.nextTick(function () {
            callback(null, city);
          });
        }
        if (!city.toGooglePlaceId) {
          city.error = commonHelper.CITYTONOTFOUND;
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
        setTimeout(function () {
          if (global[delivery] > timestamp) {
            return callback({abort: true});
          }
          async.parallel([
            function (callback) {
              if (typeof  cityObj[city.from + city.countryFrom] !== 'undefined') {
                return callback(null);
              }
              var opts = {
                google_place_id: city.fromGooglePlaceId,
                language: "ru",
                purpose: 'pickup',
                session_id: results.getSession
              };
              getCity(opts, callback);
            },
            function (callback) {
              if (typeof  cityObj[city.to + city.countryTo] !== 'undefined') {
                return callback(null);
              }
              var opts = {
                google_place_id: city.toGooglePlaceId,
                language: "ru",
                purpose: 'delivery',
                session_id: results.getSession
              };
              getCity(opts, callback);
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
        console.log(item.error);
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
                  from: item.fromGooglePlaceDsc,
                  to: item.toGooglePlaceDsc,
                  countryFrom: item.countryFrom,
                  countryTo: item.countryTo,
                  fromGooglePlaceId: item.fromGooglePlaceId,
                  toGooglePlaceId: item.toGooglePlaceId
                },
                serviceReq: getServiceReq(item.fromGooglePlaceId, results.getSession),
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
        calcResults(item, results.getSession, callback);
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