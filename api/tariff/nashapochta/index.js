var responseHelper = require('../../helpers/response');
var deliveryHelper = require('../../helpers/delivery');
var commonHelper = require('../../helpers/common');
var async = require('async');
var request = commonHelper.request;
var cheerio = require('cheerio');
var config = require('../../../conf');
var _ = require('underscore');
var logger = require('../../helpers/logger');
var delivery = 'nashapochta';

var getReq = function (from, to) {
  from = from || {};
  to = to || {};
  return {
    'city_ot[name]': from.label,
    'city_ot[id]': from.id,
    'city_do[name]': to.label,
    'city_do[id]': to.id,
    length: '0,01',
    width: '0,01',
    height: '0,01',
    sender: 15,
    delivery: 'OTD_OTD',
    kind: 1531,
    cod: '',
    declared: '',
    submit: 'Рассчитать стоимость'
  };
};

var getServiceName = function (service) {
  var result = '';
  switch (service) {
    case 'OTD_OTD':
      result = 'СС';
      break;
    case 'OTD_DV':
      result = 'СД';
      break;
    case 'DV_OTD':
      result = 'ДС';
      break;
    case 'DV_DV':
      result = 'ДД';
      break;
  }
  return result;
};

var filterArray = function (array, value, key) {
  key = key || 'name';
  array = array || [];
  var reg = new RegExp("(^|-[^_0-9a-zA-Zа-яёА-ЯЁ])" + value + "([^_0-9a-zA-Zа-яёА-ЯЁ-]|$)", "i");
  var ar = commonHelper.findInArray(array, value, key, true);
  return ar.filter(function (item) {
    if (!item[key]) {
      return false;
    }
    return item[key].match(reg);
  });
};

var calcResults = function (req, service, callback) {
  var deliveryData = deliveryHelper.get(delivery);
  var opts = _.extend({}, deliveryData.calcUrl);
  setTimeout(function () {
    async.retry(config.retryOpts, function (callback) {
      opts.form = _.extend({}, req);
      opts.form.delivery = service;
      opts.rejectUnauthorized = false;
      request(opts, callback)
    }, function (err, r, b) {
      var result = {};
      if (err) {
        result.error = commonHelper.getResponseError(err);
        return callback(null, result);
      }
      var $ = cheerio.load(b);
      if (!$('.result-sum').length) {
        result.error = commonHelper.getNoResultError();
        return callback(null, result);
      }
      result.tariff = {
        cost: $('.result-sum').text().trim().replace(commonHelper.COSTREGDOT, '').replace(/\.$/, ''),
        deliveryTime: '',
        service: getServiceName(service)
      };
      return callback(null, result);
    });
  }, commonHelper.randomInteger(500, 1000));
};

module.exports = function (req, cities, callback) {
  var deliveryData = deliveryHelper.get(delivery);
  var requests = [];
  var timestamp = callback ? new Date().getTime*2 : commonHelper.getReqStored(req, delivery);
  async.auto({
    getCities: function (callback) {
      async.retry(config.retryOpts, function (callback) {
        var opts = _.extend({}, deliveryData.citiesUrl);
        opts.rejectUnauthorized = false;
        request(opts, callback);
      }, function (err, r, b) {
        if (err) {
          return callback(commonHelper.getCityJsonError(err));
        }
        var json = null;
        try {
          json = JSON.parse(b);
        } catch (e) {}

        if (!json) {
          return callback(commonHelper.getCityJsonError(new Error("Неверный ответ от сервера, нет городов")));
        }
        callback(null, json);
      });
    },
    parseCities: ['getCities', function (results, callback) {
      var tempRequests = [];
      cities.forEach(function (item) {
        if (!item.from || !item.to) {
          item.error = commonHelper.CITIESREQUIRED;
          requests = requests.concat(commonHelper.getResponseArray(req.body.weights, item, delivery, item.error));
        } else if (item.countryFrom && commonHelper.BY.indexOf(item.countryFrom.toLowerCase()) === -1) {
          item.error = commonHelper.CITIESBY;
          requests = requests.concat(commonHelper.getResponseArray(req.body.weights, item, delivery, item.error));
        } else if (item.countryTo && commonHelper.BY.indexOf(item.countryTo.toLowerCase()) === -1) {
          item.error = commonHelper.CITIESBY;
          requests = requests.concat(commonHelper.getResponseArray(req.body.weights, item, delivery, item.error));
        } else {
          var trimFrom = commonHelper.getCity(item.from);
          var foundsFrom = filterArray(results.getCities, trimFrom, 'label');
          foundsFrom.splice(4, foundsFrom.length);
          var trimTo = commonHelper.getCity(item.to);
          var foundsTo = filterArray(results.getCities, trimTo, 'label');
          foundsTo.splice(4, foundsTo.length);
          if (!foundsFrom.length) {
            item.error = commonHelper.CITYFROMNOTFOUND;
            requests = requests.concat(commonHelper.getResponseArray(req.body.weights, item, delivery, item.error));
          } else if (!foundsTo.length) {
            item.error = commonHelper.CITYTONOTFOUND;
            requests = requests.concat(commonHelper.getResponseArray(req.body.weights, item, delivery, item.error));
          } else {
            foundsFrom.forEach(function (fromCity) {
              foundsTo.forEach(function (toCity) {
                tempRequests.push({
                  city: {
                    initialCityFrom: item.from,
                    initialCityTo: item.to,
                    from: fromCity.type + " " + fromCity.label,
                    to: toCity.type + " " + toCity.label,
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
      async.mapLimit(requests, 1, function (item, callback) {
        if (commonHelper.getReqStored(req, delivery) > timestamp) {
          return callback({abort: true});
        }
        if (item.error) {
          return async.nextTick(function () {
            callback(null, item);
          });
        }
        setTimeout(function () {
          async.parallel([
            function (callback) {
              calcResults(item.req, 'OTD_OTD', callback);
            },
            function (callback) {
              calcResults(item.req, 'OTD_DV', callback);
            },
            function (callback) {
              calcResults(item.req, 'DV_OTD', callback);
            },
            function (callback) {
              calcResults(item.req, 'DV_DV', callback);
            }
          ], function (err, results) {
            if (results[0].tariff) {
              item.tariffs.push(results[0].tariff);
            }
            if (results[1].tariff) {
              item.tariffs.push(results[1].tariff);
            }
            if (results[2].tariff) {
              item.tariffs.push(results[2].tariff);
            }
            if (results[3].tariff) {
              item.tariffs.push(results[3].tariff);
            }
            if (!item.tariffs.length) {
              item.error = results[0].error || results[1].error || results[2].error || results[3].error;
            }
            callback(null, item);
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