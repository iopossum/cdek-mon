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
    "route": {
      "from": from,
      "to": to
    },
    "tos":{
      "from":"doors",
      "to":"doors"
    },
    "load":"parcel",
    "rate":"standart",
    "type":"tare",
    "fizjur":"fiz",
    "clientId":"",
    "length":5,
    "width":5,
    "height":5,
    "weight":1,
    "volumetric":0.025,
    "estimated":1,
    "declared":10000,
    "parts":1,
    "zone":0,
    "service":5
  }
};

var getServiceName = function (req, name) {
  var result = '';
  if (req.tos.from === 'doors' && req.tos.to === 'doors') {
    result = 'ДД: ';
  } else if (req.tos.from === 'doors' && req.tos.to === 'office') {
    result = 'ДC: ';
  } else if (req.tos.from === 'office' && req.tos.to === 'doors') {
    result = 'CД: ';
  } else {
    result = 'СC: ';
  }
  return result + name;
};

var getCityName = function (city) {
  var result = city.display || '';
  if (city.region) {
    result += (', ' + city.region);
  }
  return result;
};

var getPrice = function (req, response) {
  var c = {
    base: 0,
    extra: 0,
    insure: 0,
    total: 0,
    maxdeliverydays: 0,
    zone: 0
  };
  if(typeof response.individual_rates === 'undefined'){ //Нет индивидуальных тарифов - считаем стандартно
    c.insure = Math.round(.007 * req.declared); // Комиссия
    c.base = Number(response.price); // Стоимость отправки
    c.fuelSurcharge = Math.round(response.price * 0.1); // Топливный сбор
    c.total = Number(c.insure) + Number(c.base) + Number(c.fuelSurcharge);
    c.discount = 0;
  }
  else { // Есть индивидуальные тарифы - считаем по ним
    var indRates = response.individual_rates;
    var estimated = 1;
    var topliv_international = Number(response.price)*indRates.index_topliv_international;
    var topliv_local = estimated <= 30 ? Number(response.price)*indRates.index_topliv_local: 0;
    var topliv_freight = estimated > 30 ? Math.round(Number(response.price)*indRates.index_topliv_freight) : 0;
    var declared_stoim = Math.round(req.declared*indRates.index_declared_stoim);
    var discount = Math.round(Number(Number(response.price)+topliv_international+topliv_local+declared_stoim+topliv_freight)*indRates.index_discount);
    var OC = Number(response.price)+(topliv_international+topliv_local+declared_stoim+topliv_freight)-discount;
    c.insure = declared_stoim; // Комиссия
    c.base = Number(response.price); // Стоимость отправки
    c.fuelSurcharge = Math.round(estimated <= 30 ? topliv_local : topliv_freight) // Топливный сбор
    c.total = Math.round(OC);
    c.discount = discount
  }
  return c.total;
};

var filterCity = function (city, array) {
  var trim = commonHelper.getCity(city);
  var region = commonHelper.getRegionName(city);
  var founds = commonHelper.findInArray(array, trim, 'value', true);
  var foundsWithRegion = [];
  if (region) {
    foundsWithRegion = commonHelper.findInArray(founds.length ? founds : array, region, 'region');
  }
  return foundsWithRegion.length ? foundsWithRegion.splice(0, 3) : founds.splice(0, 3);
};

var getCalcResult = function (req, service, callback) {
  setTimeout(function () {
    var deliveryData = deliveryHelper.get(delivery);
    var opts = _.extend({}, deliveryData.calcUrl);
    opts.json = req;
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
      if (b.result !== 'success') {
        result.error = commonHelper.getResultJsonError(new Error("result отличный от success: " + b.result));
        return callback(null, result);
      }
      result.tariff = {
        service: getServiceName(req, service.name),
        cost: getPrice(req, b),
        deliveryTime: b.maxdeliverydays || ''
      };
      result.success = true;
      return callback(null, result);
    });
  }, commonHelper.randomInteger(500, 1000));
};

module.exports = function (req, cities, callback) {
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
      for (var i=0; i<cities.length; i++) {
        if (!cities[i].from || !cities[i].to) {
          cities[i].error = commonHelper.CITIESREQUIRED;
          requests = requests.concat(commonHelper.getResponseArray(req.body.weights, cities[i], delivery, cities[i].error));
          continue;
        }
        var foundsFrom = filterCity(cities[i].from, results.getCities);
        var foundsTo = filterCity(cities[i].to, results.getCities);

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
                from: getCityName(fromCity),
                to: getCityName(toCity),
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
            obj.req['weight'] = weight;
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
        var services = [
          {rate: "standart", name: "Стандарт"},
          {rate: "express", name: "Экспресс"}
        ];
        async.mapLimit(services, 2, function (service, cb) {
          async.parallel([
            function (cb) {
              var copy = commonHelper.deepClone(item.req);
              copy.service = service.rate === 'standart' ? 5 : 6;
              getCalcResult(copy, service, cb);
            },
            function (cb) {
              if (!item.req.route.from.office) {
                return cb(null, {});
              }
              var copy = commonHelper.deepClone(item.req);
              copy.tos.from = 'office';
              copy.service = service.rate === 'standart' ? 3 : 4;
              getCalcResult(copy, service, cb);
            },
            function (cb) {
              if (!item.req.route.to.office) {
                return cb(null, {});
              }
              var copy = commonHelper.deepClone(item.req);
              copy.tos.to = 'office';
              copy.service = service.rate === 'standart' ? 3 : 4;
              getCalcResult(copy, service, cb);
            },
            function (cb) {
              if (!item.req.route.from.office && !item.req.route.to.office) {
                return cb(null, {});
              }
              var copy = commonHelper.deepClone(item.req);
              copy.tos.from = 'office';
              copy.tos.to = 'office';
              copy.service = service.rate === 'standart' ? 1 : 2;
              getCalcResult(copy, service, cb);
            }
          ], cb);
        }, function (err, tariffs) {
          var errors = [];
          tariffs.forEach(function (srvTariffs) {
            srvTariffs.forEach(function (trf) {
              if (trf.success) {
                item.tariffs.push(trf.tariff);
              } else {
                errors.push(trf.error);
              }
            });
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