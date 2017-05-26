var responseHelper = require('../../helpers/response');
var deliveryHelper = require('../../helpers/delivery');
var commonHelper = require('../../helpers/common');
var async = require('async');
var request = commonHelper.request;
var cheerio = require('cheerio');
var config = require('../../../conf');
var _ = require('underscore');
var logger = require('../../helpers/logger');
var delivery = 'baikalsr';

var getReq = function (from, to) {
  from = from || {};
  to = to || {};
  if (from.guid === '0c5b2444-70a0-4932-980c-b4dc0d3f02b5') {//Москва
    from.streetId = 'b30b63a1-c2be-4efc-9d0c-c9b6d7438e15';
    from.streetTitle = "Арбат ул";
    from.house = 1;
  } else if (from.guid === 'c2deb16a-0330-4f05-821f-1d09c93331e6') {//Спб
    from.streetId = 'f88e9ba3-ac55-4e4a-a164-b7e3a47b6ff4';
    from.streetTitle = "Садовая ул";
    from.house = 56;
  }
  if (to.guid === '0c5b2444-70a0-4932-980c-b4dc0d3f02b5') {//Москва
    to.streetId = 'b30b63a1-c2be-4efc-9d0c-c9b6d7438e15';
    to.streetTitle = "Арбат ул";
    to.house = 1;
  } else if (from.guid === 'c2deb16a-0330-4f05-821f-1d09c93331e6') {//Спб
    from.streetId = 'f88e9ba3-ac55-4e4a-a164-b7e3a47b6ff4';
    from.streetTitle = "Садовая ул";
    from.house = 56;
  }
  return {
    fromType: from.type,
    toType: to.type,
    id: new Date().getTime(),
    'from[guid]': from.guid,
    'from[title]': from.title,
    'from[delivery]':1,
    'from[street]': from.streetId || '',
    'from[street_title]': from.streetTitle || '',
    'from[house]': from.house || '',
    'from[housing]': '',
    'from[building]': '',
    'from[apartment]': '',
    'from[loading]':0,
    'from[night]':0,
    'to[guid]': to.guid,
    'to[title]': to.title,
    'to[delivery]':1,
    'to[street]': to.streetId || '',
    'to[street_title]': to.streetTitle || '',
    'to[house]': to.house || '',
    'to[housing]': '',
    'to[building]': '',
    'to[apartment]': '',
    'to[loading]':0,
    'to[night]':0,
    'to[fixed]':0,
    'cargo[0][type]':'Личные вещи',
    'cargo[0][weight]':1,
    'cargo[0][volume]':'0.01',
    'cargo[0][length]': '',
    'cargo[0][width]': '',
    'cargo[0][height]': '',
    'cargo[0][oversized]':0,
    'cargo[0][units]':1,
    'cargo[0][pack][crate]':0,
    'cargo[0][pack][pallet]':0,
    'cargo[0][pack][sealed_pallet]':0,
    'cargo[0][pack][bubble_wrap]':0,
    'cargo[0][pack][big_bag]':0,
    'cargo[0][pack][small_bag]':0,
    'cargo[0][pack][medium_bag]':0,
    insurance:0,
    return_docs:0,
    no_cache:0,
    mto:0
  };
};

var getCityName = function (city) {
  var result = '';
  if (city.title) {
    result += city.title;
  }
  if (city.parents) {
    result +=  ', ' + city.parents;
  }
  return result;
};

var getCity = function (city, country, callback) {
  var deliveryData = deliveryHelper.get(delivery);
  var opts = Object.assign({}, deliveryData.citiesUrl);
  var trim = commonHelper.getCity(city);
  opts.uri += encodeURIComponent(trim);
  opts.headers['X-Requested-With'] = 'XMLHttpRequest';
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
    if (!b) {
      result.message = commonHelper.getResponseError(new Error("Неверный тип данных в ответе"));
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
      result.message = commonHelper.getCityJsonError(new Error("Неверный формат ответа, отсутствует массив"));
      return callback(null, result);
    }
    if (country) {
      json = commonHelper.findInArray(json, country, 'parents');
    }
    if (!json.length) {
      result.message = commonHelper.getCityNoResultError(trim);
    } else if (json.length === 1) {
      result.foundCities = json;
      result.success = true;
    } else {
      var region = commonHelper.getRegionName(city);
      var founds = [];
      if (region) {
        founds = commonHelper.findInArray(json, region, 'parents');
      }
      result.foundCities = founds.length ? founds : [json[0]];
      result.success = true;
    }
    result.cities = json;
    callback(null, result);
  });
};

var calcResult = function (req, type, callback) {
  var deliveryData = deliveryHelper.get(delivery);
  var opts = _.extend({}, deliveryData.calcUrl);
  opts.form = req;
  opts.headers['X-Requested-With'] = 'XMLHttpRequest';
  setTimeout(function () {
    async.retry(config.retryOpts, function (callback) {
      request(opts, callback)
    }, function (err, r, b) {
      var result = {};
      if (err) {
        result.error = commonHelper.getResponseError(err);
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
      if (!json.total) {
        result.error = commonHelper.getResultJsonError(new Error("Отсутствует total"));
        return callback(null, result);
      }
      if (!json.total.int) {
        result.error = commonHelper.getResultJsonError(new Error("Отсутствует total.int"));
        return callback(null, result);
      }
      var time = '';
      if (json.transit && typeof json.transit.int !== 'undefined') {
        time = json.transit.int;
      }
      result.tariff = commonHelper.createTariff(type, json.total.int, time);
      return callback(null, result);
    });
  }, commonHelper.randomInteger(200, 500));
};

var calcRequests = function (item, callback) {
  setTimeout(function () {
    async.series([
      function (callback) {
        if (item.req.fromType === "4") {
          return callback(null, {error: item.req.fromType});
        }
        var copy = _.clone(item.req);
        copy['from[delivery]'] = 0;
        copy['to[delivery]'] = 0;
        calcResult(copy, "СС", callback);
      },
      function (callback) {
        if (item.req.toType === "4") {
          return callback(null, {error: item.req.fromType});
        }
        var copy = _.clone(item.req);
        copy['from[delivery]'] = 1;
        copy['to[delivery]'] = 0;
        calcResult(copy, "ДС", callback);
      },
      function (callback) {
        if (item.req.fromType === "4") {
          return callback(null, {error: item.req.fromType});
        }
        var copy = _.clone(item.req);
        copy['from[delivery]'] = 0;
        copy['to[delivery]'] = 1;
        calcResult(copy, "СД", callback);
      },
      function (callback) {
        var copy = _.clone(item.req);
        copy['from[delivery]'] = 1;
        copy['to[delivery]'] = 1;
        calcResult(copy, "ДД", callback);
      }
    ], function (err, results) {
      if (!results[0].error) {
        item.tariffs.push(results[0].tariff);
      }
      if (!results[1].error) {
        item.tariffs.push(results[1].tariff);
      }
      if (!results[2].error) {
        item.tariffs.push(results[2].tariff);
      }
      if (!results[3].error) {
        item.tariffs.push(results[3].tariff);
      }
      if (!item.tariffs.length) {
        item.error = commonHelper.getNoResultError();
      }
      callback(null, item);
    });
  }, commonHelper.randomInteger(500, 1000));
};


module.exports = function (req, cities, callback) {
  var deliveryData = deliveryHelper.get(delivery);
  var requests = [];
  var cityObj = {};
  var timestamp = callback ? new Date().getTime*2 : global[delivery];
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
          obj.req['cargo[0][weight]'] = weight;
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
        calcRequests(item, callback);
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