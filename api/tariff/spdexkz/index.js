var responseHelper = require('../../helpers/response');
var deliveryHelper = require('../../helpers/delivery');
var commonHelper = require('../../helpers/common');
var async = require('async');
var request = commonHelper.request;
var cheerio = require('cheerio');
var config = require('../../../conf');
var _ = require('underscore');
var logger = require('../../helpers/logger');
var delivery = 'spdexkz';

var getReq = function (from, to) {
  from = from || {};
  to = to || {};
  return {}
};

var filterCity = function (city, array) {
  var trim = commonHelper.getCity(city);
  var region = commonHelper.getRegionName(city);
  var founds = commonHelper.findInArray(array, trim, 'name', true);
  var foundsWithRegion = [];
  if (region) {
    foundsWithRegion = commonHelper.findInArray(founds.length ? founds : array, region, 'region');
  }
  return foundsWithRegion.length ? foundsWithRegion.splice(0, 3) : founds.splice(0, 3);
};

module.exports = function (req, cities, callback) {
  var requests = [];
  var timestamp = callback ? new Date().getTime*2 : commonHelper.getReqStored(req, delivery);
  cities.forEach(function (item) {
    item.countryFrom = item.countryFrom || 'Россия';
    item.countryTo = item.countryTo || 'Россия';
    if (item.countryFrom.toLowerCase() === 'казахстан') {
      item.fromKz = true;
    }
    if (item.countryTo.toLowerCase() === 'казахстан') {
      item.toKz = true;
    }
  });
  async.auto({
    getCities: function (callback) {
      var deliveryData = deliveryHelper.get(delivery);
      var opts = Object.assign({}, deliveryData.citiesUrl);
      opts.json = true;
      async.retry(config.retryOpts, function (callback) {
        request(opts, callback)
      }, function (err, r, b) {
        if (err || !b) {
          return callback(new Error(commonHelper.getCityJsonError(err)));
        }
        if (!Array.isArray(b)) {
          return callback(new Error(commonHelper.getCityJsonError(new Error("Неверный ответ. Отсутствует массив городов"))));
        }
        callback(null, b);
      });
    },
    parseCities: ['getCities', function (results, callback) {
      for (var i=0; i<cities.length; i++) {
        if (!cities[i].from || !cities[i].to) {
          cities[i].error = commonHelper.CITIESREQUIRED;
          requests = requests.concat(commonHelper.getResponseArray(req.body.weights, cities[i], delivery, cities[i].error));
          continue;
        }
        if (!cities[i].fromKz || !cities[i].toKz) {
          cities[i].error = "Международные отправления недоступны";
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
        var deliveryData = deliveryHelper.get(delivery);
        async.retry(config.retryOpts, function (callback) {
          var nightmare = commonHelper.getNightmare();
          nightmare.goto(deliveryData.calcUrl.uri)
            .wait(2000)
            .insert('[ng-model="vm.weight"]', item.weight)
            .realClick('[sb-model="vm.selectedCityFrom"] input')
            .wait('.dropdown')
            .evaluate(function (item) {
              var list = Array.from(document.querySelectorAll('.dropdown')).filter(function (item) {
                return !/ng-hide/gi.test(item.className);
              });
              Array.from(list[0].querySelectorAll('.item')).forEach(function (div) {
                if (new RegExp(item.city.from, 'gi').test(div.innerText)) {
                  div.click();
                }
              });
              return false;
            }, item)
            .realClick('[sb-model="vm.selectedCityTo"] input')
            .wait('.dropdown')
            .evaluate(function (item) {
              var list = Array.from(document.querySelectorAll('.dropdown')).filter(function (item) {
                return !/ng-hide/gi.test(item.className);
              });
              Array.from(list[0].querySelectorAll('.item')).forEach(function (div) {
                if (new RegExp(item.city.to, 'gi').test(div.innerText)) {
                  div.click();
                }
              });
              return false;
            }, item)
            .realClick('.external.green')
            .wait('[ng-show="showTable"]')
            .wait(1000)
            .evaluate(function (item) {
              Array.from( document.querySelector('tbody').querySelectorAll('tr')).forEach(function (tr) {
                var tds = Array.from(tr.querySelectorAll('td'));
                item.tariffs.push({
                  cost: tds[1].innerText.trim(),
                  deliveryTime: '',
                  service: tds[0].innerText.trim()
                });
              });
              return item;
            }, item)
            .end()
            .then(function (result) {
              callback(null, result);
            })
            .catch(function (error) {
              callback(error, item);
            });
        }, function (err, r) {
          if (err) {
            item.error = commonHelper.getResultJsonError(new Error(err));
            return callback(null, item);
          }
          callback(null, r);
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