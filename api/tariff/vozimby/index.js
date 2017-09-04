var responseHelper = require('../../helpers/response');
var deliveryHelper = require('../../helpers/delivery');
var commonHelper = require('../../helpers/common');
var async = require('async');
var request = commonHelper.request;
var cheerio = require('cheerio');
var config = require('../../../conf');
var _ = require('underscore');
var logger = require('../../helpers/logger');
var delivery = 'vozimby';

var getReq = function (from, to) {
  return {
    form: 'calculation',
    'client-type':0,
    calculation:2,
    rule: '',
    length:1,
    width:1,
    height:1,
    weight:0,
    'good-cost': '',
    'locality-from': from,
    'locality-to': to
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

var filterArray = function (array, value) {
  array = array || [];
  var reg = new RegExp("(^|-[^_0-9a-zA-Zа-яёА-ЯЁ])" + value + "([^_0-9a-zA-Zа-яёА-ЯЁ-]|$)", "i");
  return array.filter(function (item) {
    return item.match(reg);
  });
};

module.exports = function (req, cities, callback) {
  var deliveryData = deliveryHelper.get(delivery);
  var requests = [];
  var timestamp = callback ? new Date().getTime*2 : commonHelper.getReqStored(req, delivery);
  async.auto({
    getCities: function (callback) {
      async.retry(config.retryOpts, function (callback) {
        var opts = _.extend({}, deliveryData.citiesUrl);
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
        } else if (item.countryFrom && commonHelper.BY.indexOf(item.countryFrom.toLowerCase()) === -1 || !item.countryFrom) {
          item.error = commonHelper.CITIESBY;
          requests = requests.concat(commonHelper.getResponseArray(req.body.weights, item, delivery, item.error));
        } else if (item.countryTo && commonHelper.BY.indexOf(item.countryTo.toLowerCase()) === -1 || !item.countryTo) {
          item.error = commonHelper.CITIESBY;
          requests = requests.concat(commonHelper.getResponseArray(req.body.weights, item, delivery, item.error));
        } else {
          var trimFrom = commonHelper.getCity(item.from);
          var foundsFrom = filterArray(results.getCities, trimFrom);
          foundsFrom.splice(4, foundsFrom.length);
          var trimTo = commonHelper.getCity(item.to);
          var foundsTo = filterArray(results.getCities, trimTo);
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
          var deliveryData = deliveryHelper.get(delivery);
          var opts = _.extend({}, deliveryData.calcUrl);
          async.retry(config.retryOpts, function (callback) {
            opts.form = item.req;
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
              item.error = commonHelper.getResponseError(err);
            }

            if (!json) {
              return callback(null, item);
            }
            for (var key in json) {
              if (['custom', 'minimal'].indexOf(key) === -1 && json[key].enabled) {
                item.tariffs.push({
                  cost: json[key].cost,
                  deliveryTime: '',
                  service: ''
                });
              }
            }
            return callback(null, result);
          });
        }, commonHelper.randomInteger(500, 1000));
      }, callback);
    }]
  }, function (err, results) {
    console.log(results.requests);
    commonHelper.saveResults(req, err, {
      delivery: delivery,
      timestamp: timestamp,
      cities: cities,
      items: results.requests || [],
      callback: callback
    });
  });
};