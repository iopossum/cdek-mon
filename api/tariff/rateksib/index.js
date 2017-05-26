var responseHelper = require('../../helpers/response');
var deliveryHelper = require('../../helpers/delivery');
var commonHelper = require('../../helpers/common');
var async = require('async');
var request = commonHelper.request;
var cheerio = require('cheerio');
var config = require('../../../conf');
var _ = require('underscore');
var logger = require('../../helpers/logger');
var delivery = 'rateksib';

var getReq = function (from, to) {
  from = from || {};
  to = to || {};
  return {
    from: from.name,
    fromcode: from.LocationId,
    'to[]': to.name,
    'tocode[]': to.LocationId,
    weight: 1,
    volume: '0,001',
    price: 1,
    length: '0,01',
    width: '0,01',
    height: '0,01',
    negabarit: 0,
    needpick: true,
    needdrop: true
  }
};

var getCityName = function (city) {
  var result = '';
  if (city.name) {
    result += city.name;
  }
  if (city.namefull) {
    result += ', ' + city.namefull;
  }
  return result;
};

var getCity = function (city, callback) {
  var deliveryData = deliveryHelper.get(delivery);
  var opts = Object.assign({}, deliveryData.citiesUrl);
  var trim = commonHelper.getCity(city);
  var trimSplit = null;
  if (trim.split(' ').length > 1) {
    trimSplit = trim[0];
  }
  opts.form = {
    pattern: trimSplit || trim
  };
  opts.headers = {'X-Requested-With': 'XMLHttpRequest'};
  async.retry(config.retryOpts, function (callback) {
    request(opts, callback)
  }, function (err, r, b) {
    var result = {
      city: city,
      cityTrim: trim,
      success: false
    };
    if (err) {
      result.message = commonHelper.getCityJsonError(err);
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
    if (!json.items) {
      result.message = commonHelper.getCityJsonError(new Error("Отсутствует обязательный параметр items"));
      return callback(null, result);
    }
    if (!Array.isArray(json.items)) {
      result.message = commonHelper.getCityJsonError(new Error("Неверный формат items"));
      return callback(null, result);
    }
    if (trimSplit) {
      json.items = commonHelper.findInArray(json.items, trim, 'name');
    }
    if (!json.items.length) {
      result.message = commonHelper.getCityNoResultError(trim);
    } else if (json.items.length === 1) {
      result.foundCities = json.items;
      result.success = true;
    } else {
      var region = commonHelper.getRegionName(city);
      var founds = [];
      if (region) {
        founds = json.items.filter(function (item) {
          var str = item.namefull || item.name;
          return str.match(new RegExp(region, 'gi'));
        });
      }
      result.foundCities = founds.length ? founds : [json.items[0]];
      result.success = true;
    }
    result.cities = json.items;
    callback(null, result);
  });
};

var createTrf = function (service, time, cost) {
  return {
    service: service,
    deliveryTime: time,
    cost: cost
  };
};

var getTariffs = function ($, type, item) {
  var trs = $(item).find('tr');
  var cost = 0;
  var deliveryTime = '';
  var from = 0;
  var to = 0;
  var fromW = true;
  var toW = true;
  trs.each(function (index, tr) {
    if (/время доставки/i.test($(tr).text())){
      deliveryTime = $(tr).text().replace(commonHelper.DELIVERYTIMEREG, "");
    } else if (/Оплата согласно/i.test($(tr).text())){
      cost += commonHelper.parseInt($(tr).find('.cur-rub').text());
    } else if (/маркировку/i.test($(tr).text())){
      cost += commonHelper.parseInt($(tr).find('.cur-rub').text());
    } else if (/Забор/i.test($(tr).text())){
      from = commonHelper.parseInt($(tr).find('.cur-rub').text());
    } else if (/Доставка/i.test($(tr).text())){
      to = commonHelper.parseInt($(tr).find('.cur-rub').text());
    }
    if (/Из города-отправителя до терминала/i.test($(tr).text())) {
      fromW = false;
    }
    if (/От терминала до города-получателя/i.test($(tr).text())) {
      toW = false;
    }
  });
  var tariffs = [createTrf(type + ' ДД', deliveryTime, cost + from + to)];
  if (fromW && toW) {
    tariffs.push(createTrf(type + ' СС', deliveryTime, cost));
    if (to) {
      tariffs.push(createTrf(type + ' СД', deliveryTime, cost + to));
    }
    if (from) {
      tariffs.push(createTrf(type + ' ДС', deliveryTime, cost + from));
    }
  } else if (to) {
    tariffs.push(createTrf(type + ' ДC', deliveryTime, cost));
  } else if (from) {
    tariffs.push(createTrf(type + ' CД', deliveryTime, cost));
  }
  return tariffs;
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
              getCity(city.from, callback);
            },
            function (callback) {
              if (typeof  cityObj[city.to + city.countryTo] !== 'undefined') {
                return callback(null);
              }
              getCity(city.to, callback);
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
          obj.req.weight = weight;
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
        opts.headers = {'X-Requested-With': 'XMLHttpRequest'};
        setTimeout(function () {
          async.retry(config.retryOpts, function (callback) {
            request(opts, callback)
          }, function (err, r, b) {
            if (err) {
              item.error = commonHelper.getResponseError(err);
              return callback(null, item);
            }
            var $ = cheerio.load(b);
            var results = $('.calc_results');
            var tariffs = [];
            results.each(function (index, item) {
              var type = $(item).prev().text();
              tariffs = tariffs.concat(getTariffs($, type, item));
            });
            item.tariffs = tariffs;
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