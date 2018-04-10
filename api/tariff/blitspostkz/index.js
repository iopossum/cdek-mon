var responseHelper = require('../../helpers/response');
var deliveryHelper = require('../../helpers/delivery');
var commonHelper = require('../../helpers/common');
var async = require('async');
var request = commonHelper.request;
var cheerio = require('cheerio');
var config = require('../../../conf');
var _ = require('underscore');
var logger = require('../../helpers/logger');
var delivery = 'blitspostkz';

var getReq = function (from, to, service) {
  from = from || {};
  to = to || {};
  return {
    origin_id: from.id,
    destination_id: to.id,
    service: service,
    w: 0,
    l: 0,
    h: 0,
    weight:1
  };
};

var getCity = function (city, country, callback) {
  var deliveryData = deliveryHelper.get(delivery);
  var opts = _.extend({}, deliveryData.citiesUrl);
  var cityTrim = commonHelper.getCity(city);
  opts.uri += encodeURIComponent(cityTrim);
  opts.uri += ('&_=' + new Date().getTime());
  setTimeout(function () {
    async.retry(config.retryOpts, function (callback) {
      request(opts, callback)
    }, function (err, r, json) {
      var result = {
        success: false
      };
      if (err || !json) {
        result.message = commonHelper.getCityJsonError(err || new Error("Неверный формат json"));
        return callback(null, result);
      }
      if (!json.regions) {
        result.message = commonHelper.getCityJsonError(new Error("Отсутствует обязательный параметр regions."), cityTrim);
        return callback(null, result);
      }
      if (!Array.isArray(json.regions)) {
        result.message = commonHelper.getCityJsonError(new Error("Неверный формат regions."), cityTrim);
        return callback(null, result);
      }
      if (!json.regions.length) {
        result.message = commonHelper.getCityNoResultError(cityTrim);
      } else if (json.regions.length === 1) {
        result.foundCities = json.regions;
        result.success = true;
      } else {
        var region = commonHelper.getRegionName(city);
        var founds = [];
        if (region) {
          founds = commonHelper.findInArray(json.regions, region, 'cached_path');
        }
        result.foundCities = founds.length ? founds : json.regions;
        result.success = true;
      }
      callback(null, result);
    });
  }, commonHelper.randomInteger(500, 1000));
};

var getCost = function (obj) {
  return (obj.fuel_surplus || 0) + (obj.price || 0) + 150;
};

var getDeliveryTime = function (obj) {
  var min = parseInt(obj.min, 10);
  var max = parseInt(obj.max, 10);
  var result = '-';
  if (!isNaN(min)) {
    result = min;
    if (!isNaN(max)) {
      result += ' - ' + max;
    }
  }
  return result;
};

module.exports = function (req, cities, callback) {
  var deliveryData = deliveryHelper.get(delivery);
  var services = [
    {id: 'express', name: 'Блиц-Экспресс'},
    {id: 'blits12', name: 'Блиц-12'},
    {id: 'econom', name: 'Блиц-Эконом'}
  ];
  var requests = [];
  var timestamp = callback ? new Date().getTime*2 : commonHelper.getReqStored(req, delivery);
  var cityObj = {};
  var q = async.queue(function(task, callback) {
    if (commonHelper.getReqStored(req, delivery) > timestamp) {
      return callback({abort: true});
    }
    var taskRequests = [];
    async.auto({
      getCityFrom: function (callback) {
        if (cityObj[task.from + task.countryFrom]) {
          return callback(null, cityObj[task.from + task.countryFrom]);
        }
        getCity(task.from, task.countryFrom, callback);
      },
      getCityTo: function (callback) {
        if (cityObj[task.to + task.countryTo]) {
          return callback(null, cityObj[task.to + task.countryTo]);
        }
        getCity(task.to, task.countryTo, callback);
      },
      parseCities: ['getCityFrom', 'getCityTo', function (results, callback) {
        if (!cityObj[task.from + task.countryFrom] && results.getCityFrom.success) {
          cityObj[task.from + task.countryFrom] = results.getCityFrom;
        }
        if (!cityObj[task.to + task.countryTo] && results.getCityTo.success) {
          cityObj[task.to + task.countryTo] = results.getCityTo;
        }
        if (!results.getCityFrom.success || !results.getCityTo.success) {
          task.error = results.getCityFrom.message || results.getCityTo.message;
          taskRequests = taskRequests.concat(commonHelper.getResponseArray(req.body.weights, task, delivery, task.error));
          return callback();
        }
        var tempRequests = [];
        results.getCityFrom.foundCities.forEach(function (fromCity) {
          results.getCityTo.foundCities.forEach(function (toCity) {
            tempRequests.push({
              city: {
                initialCityFrom: task.from,
                initialCityTo: task.to,
                from: fromCity.title + ' (' + fromCity.cached_path + ')',
                to: toCity.title + ' (' + toCity.cached_path + ')',
                countryFrom: task.countryFrom,
                countryTo: task.countryTo
              },
              req: getReq(fromCity, toCity),
              delivery: delivery,
              tariffs: []
            });
          });
        });
        tempRequests.forEach(function (item) {
          req.body.weights.forEach(function (weight) {
            var obj = commonHelper.deepClone(item);
            obj.weight = weight;
            obj.req['weight'] = weight;
            taskRequests.push(obj);
          });
        });
        callback();
      }],
      requests: ['parseCities', function (results, callback) {
        async.mapLimit(taskRequests, 2, function (item, callback) {
          if (commonHelper.getReqStored(req, delivery) > timestamp) {
            return callback({abort: true});
          }
          if (item.error) {
            return async.nextTick(function () {
              callback(null, item);
            });
          }
          async.mapLimit(services, 2, function (service, callback) {
            var opts = _.extend({}, deliveryData.calcUrl);
            var req = _.extend(item.req);
            req.service = service.id;
            opts.uri += commonHelper.getQueryString(req);
            setTimeout(function () {
              async.retry(config.retryOpts, function (callback) {
                request(opts, callback)
              }, function (err, r, json) {
                var result = {};
                if (err || !json) {
                  result.error = commonHelper.getResponseError(err || "Неверный формат json");
                  return callback(null, result);
                }
                if (!json.calculation) {
                  result.error = commonHelper.getResultJsonError(new Error("Неверный формат ответа, отсутствует параметр calculation"));
                  return callback(null, result);
                }
                result.tariff = {
                  service: service.name,
                  cost: getCost(json.calculation),
                  deliveryTime: getDeliveryTime(json.calculation)
                };
                return callback(null, result);
              });
            }, commonHelper.randomInteger(500, 1000));
          }, function (err, tariffs) {
            tariffs.forEach(function (trf) {
              if (trf.tariff) {
                item.tariffs.push(trf.tariff);
              }
            });
            if (!item.tariffs.length) {
              item.error = commonHelper.getNoResultError();
            }
            callback(null, item);
          });
        }, callback);
      }]
    }, function (err, results) {
      requests = requests.concat(results.requests);
      callback();
    });
  }, 1);

  q.drain = function() {
    commonHelper.saveResults(req, null, {
      delivery: delivery,
      timestamp: timestamp,
      cities: cities,
      items: requests,
      callback: callback
    });
  };

  cities.forEach(function (item) {
    item.countryFrom = item.countryFrom || 'Россия';
    item.countryTo = item.countryTo || 'Россия';
    if (item.countryFrom.toLowerCase() === 'казахстан') {
      item.fromKz = true;
    }
    if (item.countryTo.toLowerCase() === 'казахстан') {
      item.toKz = true;
    }
    q.push(item);
  });
};