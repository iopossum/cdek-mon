var responseHelper = require('../../helpers/response');
var deliveryHelper = require('../../helpers/delivery');
var commonHelper = require('../../helpers/common');
var async = require('async');
var request = commonHelper.request;
var cheerio = require('cheerio');
var config = require('../../../conf');
var _ = require('underscore');
var logger = require('../../helpers/logger');
var delivery = 'postexpresskz';

var getReq = function (from, to) {
  from = from || {};
  to = to || {};
  return {
    countryFrom: from.countryId,
    countryTo: to.countryId,
    cityFrom: from.id,
    cityTo: to.id,
    contentType: 'd63c7d7b-8ab3-11e5-80e5-0cc47a30d628',
    ves: 1,
    tarif: '',
    addService: ''
  }
};

var filterCity = function (city, engCity, array) {
  var trim = commonHelper.getCity(city);
  var founds = commonHelper.findInArray(array, trim, 'name', true);
  if (!founds.length && engCity) {
    trim = commonHelper.getCity(engCity);
    founds = commonHelper.findInArray(array, trim, 'name', true);
  }
  return founds;
};

var getCalcResult = function (item, service, callback) {
  setTimeout(function () {
    var copyReq = _.extend({}, item.req);
    copyReq.tarif = service.id;
    var deliveryData = deliveryHelper.get(delivery);
    var opts = _.extend({}, deliveryData.calcUrl);
    opts.form = copyReq;
    async.retry(config.retryOpts, function (callback) {
      opts.followAllRedirects = true;
      request(opts, callback)
    }, function (err, r, b) {
      var result = {
        success: false
      };
      if (err) {
        result.error = commonHelper.getResultJsonError(err);
        return callback(null, result);
      }
      if (!b) {
        result.error = commonHelper.getNoResultError();
        return callback(null, result);
      }
      var intValue = parseInt(b, 10);
      if (isNaN(intValue) || !intValue) {
        result.error = commonHelper.getNoResultError();
        return callback(null, result);
      }
      result.tariff = {
        service: service.name,
        cost: b,
        deliveryTime: ''
      };
      result.success = true;
      return callback(null, result);
    });
  }, commonHelper.randomInteger(500, 1000));
};

module.exports = function (req, cities, callback) {
  var deliveryData = deliveryHelper.get(delivery);
  var requests = [];
  var timestamp = callback ? new Date().getTime*2 : commonHelper.getReqStored(req, delivery);
  cities.forEach(function (item) {
    item.countryFrom = item.countryFrom || 'Россия';
    item.countryTo = item.countryTo || 'Россия';
  });
  async.auto({
    getCities: function (callback) {
      var deliveryData = deliveryHelper.get(delivery);
      var opts = Object.assign({}, deliveryData.citiesUrl);
      async.retry(config.retryOpts, function (callback) {
        request(opts, callback)
      }, function (err, r, b) {
        if (err) {
          return callback(new Error(commonHelper.getCityJsonError(err)));
        }
        var json = null;
        try {
          json = JSON.parse(b);
        } catch (e) {
        }
        if (!json) {
          return callback(new Error(commonHelper.getCityJsonError(err)));
        }
        if (!Array.isArray(json)) {
          return callback(new Error(commonHelper.getCityJsonError(new Error("Неверный ответ. Отсутствует массив"))));
        }

        callback(null, json);
      });
    },
    parseCities: ['getCities', function (results, callback) {
      var countryObj = _.indexBy(results.getCities.cities, 'value');
      for (var i=0; i<cities.length; i++) {
        if (!cities[i].from || !cities[i].to) {
          cities[i].error = commonHelper.CITIESREQUIRED;
          requests = requests.concat(commonHelper.getResponseArray(req.body.weights, cities[i], delivery, cities[i].error));
          continue;
        }
        if (!countryObj[cities[i].countryFrom.toUpperCase()]) {
          cities[i].error = commonHelper.COUNTRYFROMNOTFOUND;
          requests = requests.concat(commonHelper.getResponseArray(req.body.weights, cities[i], delivery, cities[i].error));
          continue;
        }
        if (!countryObj[cities[i].countryTo.toUpperCase()]) {
          cities[i].error = commonHelper.COUNTRYNOTFOUND;
          requests = requests.concat(commonHelper.getResponseArray(req.body.weights, cities[i], delivery, cities[i].error));
          continue;
        }
        if (!countryObj[cities[i].countryFrom.toUpperCase()].cities.length) {
          cities[i].error = commonHelper.CITYFROMNOTFOUND;
          requests = requests.concat(commonHelper.getResponseArray(req.body.weights, cities[i], delivery, cities[i].error));
          continue;
        }
        if (!countryObj[cities[i].countryTo.toUpperCase()].cities.length) {
          cities[i].error = commonHelper.CITYTONOTFOUND;
          requests = requests.concat(commonHelper.getResponseArray(req.body.weights, cities[i], delivery, cities[i].error));
          continue;
        }
        var foundsFrom = filterCity(cities[i].from, cities[i].fromEngName, countryObj[cities[i].countryFrom.toUpperCase()].cities);
        var foundsTo = filterCity(cities[i].to, cities[i].toEngName, countryObj[cities[i].countryTo.toUpperCase()].cities);

        if (!foundsFrom.length) {
          cities[i].error = commonHelper.CITYFROMNOTFOUND;
          requests = requests.concat(commonHelper.getResponseArray(req.body.weights, cities[i], delivery, cities[i].error));
          continue;
        }

        if (!foundsTo.length) {
          cities[i].error = commonHelper.CITYTONOTFOUND;
          requests = requests.concat(commonHelper.getResponseArray(req.body.weights, cities[i], delivery, cities[i].error));
          continue;
        }

        var tempRequests = [];
        foundsFrom.forEach(function (fromCity) {
          foundsTo.forEach(function (toCity) {
            tempRequests.push({
              city: {
                initialCityFrom: cities[i].from,
                initialCityTo: cities[i].to,
                from: fromCity.name,
                to: toCity.name,
                countryFrom: cities[i].countryFrom,
                countryTo: cities[i].countryTo
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
            obj.req['ves'] = weight;
            requests.push(obj);
          });
        });
      }

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
        async.mapLimit(results.getCities.services, 2, function (service, cb) {
          getCalcResult(item, service, cb);
        }, function (err, tariffs) {
          var errors = [];
          tariffs.forEach(function (trf) {
            if (trf.success) {
              item.tariffs.push(trf.tariff);
            } else {
              errors.push(trf.error);
            }
          });
          if (!item.tariffs.length) {
            item.error = errors[0];
          }
          return callback(null, item);
        });
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