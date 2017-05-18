var responseHelper = require('../../helpers/response');
var deliveryHelper = require('../../helpers/delivery');
var commonHelper = require('../../helpers/common');
var async = require('async');
var request = commonHelper.request;
var cheerio = require('cheerio');
var config = require('../../../conf');
var _ = require('underscore');
var logger = require('../../helpers/logger');
var delivery = 'expressauto';

var getReq = function (from, to) {
  from = from || {};
  to = to || {};
  return {
    act: 'getPrice',
    cfId: from.id,
    ctId: to.id,
    weight: 2,
    volume: 0
  }
};

module.exports = function (req, cities) {
  var deliveryData = deliveryHelper.get(delivery);
  var requests = [];
  var timestamp = global[delivery];
  async.auto({
    getCities: function (callback) {
      var opts = Object.assign({}, deliveryData.citiesUrl);
      opts.form = {
        act: 'getCalc'
      };
      opts.headers = {
        'X-Requested-With': 'XMLHttpRequest'
      };
      async.retry(config.retryOpts, function (callback) {
        request(opts, callback)
      }, function (err, r, b) {
        if (err) {
          return callback(commonHelper.getResponseError(new Error("Сайт не загружается, попробуйте позже")));
        }
        var result = {
          citiesFrom: [],
          citiesTo: []
        };
        var $ = cheerio.load(b);
        var fromOpts = $('select.c_from_with_partners').find('option');
        var toOpts = $('select.c_to_with_partners').find('option');
        fromOpts.each(function (index, item) {
          result.citiesFrom.push({id: $(item).attr('value'), name: $(item).text().trim().toLowerCase()});
        });
        toOpts.each(function (index, item) {
          result.citiesTo.push({id: $(item).attr('value'), name: $(item).text().trim().toLowerCase()});
        });
        callback(null, result);
      });
    },
    parseCities: ['getCities', function (results, callback) {
      logger.tariffsInfoLog(delivery, results.getCities, 'getCities');
      var tempRequests = [];
      cities.forEach(function (item) {
        if (!item.from || !item.to) {
          item.error = commonHelper.CITIESREQUIRED;
          requests = requests.concat(commonHelper.getResponseArray(req.body.weights, item, delivery, item.error));
        } else {
          var trimFrom = commonHelper.getCity(item.from);
          var foundsFrom = commonHelper.findInArray(results.getCities.citiesFrom, trimFrom, 'name', true);
          var trimTo = commonHelper.getCity(item.to);
          var foundsTo = commonHelper.findInArray(results.getCities.citiesTo, trimTo, 'name', true);
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
        opts.headers = {
          'X-Requested-With': 'XMLHttpRequest'
        };
        setTimeout(function () {
          async.retry(config.retryOpts, function (callback) {
            request(opts, callback)
          }, function (err, r, b) {
            if (err) {
              item.error = commonHelper.getResponseError(err);
              return callback(null, item);
            }
            var cost = commonHelper.parseFloat(b);
            if (!cost) {
              item.error = commonHelper.getNoResultError();
            }
            item.tariffs.push({
              service: '',
              deliveryTime: '',
              cost: cost
            });
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