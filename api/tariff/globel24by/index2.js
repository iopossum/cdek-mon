var responseHelper = require('../../helpers/response');
var deliveryHelper = require('../../helpers/delivery');
var commonHelper = require('../../helpers/common');
var async = require('async');
var request = commonHelper.request;
var cheerio = require('cheerio');
var config = require('../../../conf');
var _ = require('underscore');
var logger = require('../../helpers/logger');
var delivery = 'globel24by';

var getReq = function (from, to) {
  from = from || {};
  to = to || {};
  return {
    pvt_max:15,
    cityMatrixID:28,
    extRatesID:29,
    maxWeightAgreements:100,
    'form-FROM': from.id,
    'form-WHERE': to.id,
    'form-WEIGHT':0,
    'form-COST': '',
    submit: 'Рассчитать'
  };
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
        var $ = cheerio.load(b);
        if (!$('#form-FROM').length) {
          return callback(commonHelper.getCityJsonError(new Error("Неверный ответ от сервера, нет городов")));
        }
        if (!$('#form-WHERE').length) {
          return callback(commonHelper.getCityJsonError(new Error("Неверный ответ от сервера, нет городов")));
        }
        var result = {from: [], to: []};
        $('#form-FROM').find('option').each(function (i, item) {
          result.from.push({id: $(item).attr('value'), name: $(item).text().trim()});
        });
        $('#form-WHERE').find('option').each(function (i, item) {
          result.to.push({id: $(item).attr('value'), name: $(item).text().trim()});
        });
        callback(null, result);
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
          var foundsFrom = commonHelper.findInArray(results.getCities.from, trimFrom, 'name', true);
          var trimTo = commonHelper.getCity(item.to);
          var foundsTo = commonHelper.findInArray(results.getCities.to, trimTo, 'name', true);
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
        }
      });
      tempRequests.forEach(function (item) {
        req.body.weights.forEach(function (weight) {
          var obj = commonHelper.deepClone(item);
          obj.weight = weight;
          obj.req['form-WEIGHT'] = weight;
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
        setTimeout(function () {
          var opts = _.extend({}, deliveryData.calcUrl);
          async.retry(config.retryOpts, function (callback) {
            opts.form = item.req;
            request(opts, callback)
          }, function (err, r, b) {
            if (err || !b) {
              item.error = commonHelper.getResponseError(err);
              return callback(null, item);
            }
            var $ = cheerio.load(b);
            if (!$('.sum').length) {
              item.error = commonHelper.getNoResultError();
              return callback(null, item);
            }
            var sum = $($('.sum')[0]).text().trim().replace(commonHelper.COSTREGDOT, '').replace(/\.$/, '');
            if (sum.length) {
              item.tariffs.push({
                cost: sum,
                deliveryTime: '',
                service: 'ДС'
              })
            }
            sum = $($('.sum')[1]).text().trim().replace(commonHelper.COSTREGDOT, '').replace(/\.$/, '');
            if (sum.length) {
              item.tariffs.push({
                cost: sum,
                deliveryTime: '',
                service: 'ДД'
              })
            }
            if (!item.tariffs.length) {
              item.error = commonHelper.getNoResultError();
              return callback(null, item);
            }
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