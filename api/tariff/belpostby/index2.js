var responseHelper = require('../../helpers/response');
var deliveryHelper = require('../../helpers/delivery');
var commonHelper = require('../../helpers/common');
var async = require('async');
var request = commonHelper.request;
var cheerio = require('cheerio');
var config = require('../../../conf');
var _ = require('underscore');
var logger = require('../../helpers/logger');
var delivery = 'belpostby';

var getReq = function (from, to) {
  from = from || {};
  to = to || {};
  return {
    who: 'fiz',
    where: 'office', //office
    what: 'goods',
    from: from.id,
    sendFrom: from.name,
    to: to.id,
    sendTo: to.name,
    weight: 1000,
    group0: 'inday_after',
    group1: 'none',
    declared: ''
  };
};

var getIntReq = function (country) {
  country = country || {};
  return {
    who: 'fiz',
    type: 'goods',
    to: country.id,
    weight: 1000,
    declared: ''
  }
};

var getCalcResult = function (requests, isInternational, callback) {
  var deliveryData = deliveryHelper.get(delivery);
  async.mapLimit(requests, 1, function (item, cb) {
    setTimeout(function () {
      var opts = _.extend({}, isInternational ? deliveryData.calcInternationalUrl : deliveryData.calcUrl);
      opts.method = 'POST';
      opts.form = item.req;
      async.retry(config.retryOpts, function (callback) {
        request(opts, callback)
      }, function (err, r, b) {
        var result = {};
        if (err) {
          result.error = commonHelper.getResponseError(err);
          return cb(null, result);
        }
        var $ = cheerio.load(b);
        var blocks = $('.context h1');
        if (blocks.length < 2) {
          result.error = commonHelper.getNoResultError();
        } else {
          var text = $(blocks[1]).text().trim();
          if (/сумма/gi.test(text)) {
            result.tariff = {
              cost: text.replace(commonHelper.COSTREGDOT, '').replace(/\.$/, ''),
              deliveryTime: '',
              service: item.service
            }
          } else {
            result.error = text;
          }
        }
        return cb(null, result);
      });
    }, commonHelper.randomInteger(500, 1000));
  }, function (err, results) {
    var tariffs = [];
    var error = null;
    results.forEach(function (rst) {
      if (rst.tariff) {
        tariffs.push(rst.tariff);
      }
    });
    if (!tariffs.length) {
      error = results[0].error;
    }
    callback(error, tariffs);
  });
};

module.exports = function (req, cities, callback) {
  var deliveryData = deliveryHelper.get(delivery);
  var requests = [];
  var intRequests = [];
  var timestamp = callback ? new Date().getTime*2 : commonHelper.getReqStored(req, delivery);
  var services = [
    {id: 'inday_after', name: 'с доставкой в течении рабочего дня, следующего за днем приема'},
    {id: 'before', name: 'с доставкой до 10 часов рабочего дня, следующего за днем приема'},
    {id: 'intime', name: 'с доставкой в указанное время рабочего дня, следующего за днем приема'},
    {id: 'inday', name: 'с доставкой в день приема'}
  ];
  async.auto({
    getCountries: function (callback) {
      var opts = Object.assign({}, deliveryData.calcInternationalUrl);
      async.retry(config.retryOpts, function (callback) {
        request(opts, callback)
      }, function (err, r, b) {
        if (err) {
          return callback(null, []);
        }
        var $ = cheerio.load(b);
        var options = $('select[name="to"] option');
        var countries = [];
        options.each(function (index, item) {
          var name = $(item).text().trim().toUpperCase();
          if (name.length) {
            countries.push({id: $(item).attr('value'), name: name});
          }
        });
        callback(null, countries);
      });
    },
    getCities: function (callback) {
      var opts = Object.assign({}, deliveryData.calcUrl);
      async.retry(config.retryOpts, function (callback) {
        request(opts, callback)
      }, function (err, r, b) {
        if (err) {
          return callback(null, []);
        }
        var $ = cheerio.load(b);
        var options = $('select[name="from"] option');
        var cities = [];
        options.each(function (index, item) {
          var name = $(item).text().trim().toUpperCase();
          if (name.length) {
            cities.push({id: $(item).attr('value'), name: name});
          }
        });
        callback(null, cities);
      });
    },
    parseCities: ['getCountries', 'getCities', function (results, callback) {
      var tempRequests = [];
      var tempIntRequests = [];
      cities.forEach(function (item) {
        if (!item.countryTo) {
          item.toRu = true;
        }
        item.countryFrom = item.countryFrom || 'Россия';
        item.countryTo = item.countryTo || 'Россия';
        if (commonHelper.BY.indexOf(item.countryFrom.toLowerCase()) > -1) {
          item.fromBy = true;
        }
        if (commonHelper.BY.indexOf(item.countryTo.toLowerCase()) > -1) {
          item.toBy = true;
        }
        if (!item.fromBy && item.toBy) {
          item.error = commonHelper.CITYFROMBY;
          requests = requests.concat(commonHelper.getResponseArray(req.body.weights, item, delivery, commonHelper.CITYFROMBY));
        } else if (item.toBy) {
          var trimFrom = commonHelper.getCity(item.from);
          var foundsFrom = commonHelper.findInArray(results.getCities, trimFrom, 'name', true);
          var foundsFromWithRegion = [];
          if (foundsFrom.length > 1) {
            var regionFrom = commonHelper.getRegionName(item.from);
            if (regionFrom) {
              foundsFromWithRegion = commonHelper.findInArray(foundsFrom, regionFrom, 'name');
            }
          }
          var resultsFrom = foundsFromWithRegion.length ? foundsFromWithRegion : foundsFrom;
          var trimTo = commonHelper.getCity(item.to);
          var foundsTo = commonHelper.findInArray(results.getCities, trimTo, 'name', true);
          var foundsToWithRegion = [];
          if (foundsTo.length > 1) {
            var regionTo = commonHelper.getRegionName(item.to);
            if (regionTo) {
              foundsToWithRegion = commonHelper.findInArray(foundsTo, regionTo, 'value');
            }
          }
          var resultsTo = foundsToWithRegion.length ? foundsToWithRegion : foundsTo;
          if (!results.getCities.length) {
            item.error = commonHelper.getCityJsonError(new Error('Пустой массив городов'));
            requests = requests.concat(commonHelper.getResponseArray(req.body.weights, item, delivery, item.error));
          } else if (!resultsFrom.length) {
            item.error = commonHelper.getCityNoResultError(item.from);
            requests = requests.concat(commonHelper.getResponseArray(req.body.weights, item, delivery, item.error));
          } else if (!resultsTo.length) {
            item.error = commonHelper.getCityNoResultError(item.to);
            requests = requests.concat(commonHelper.getResponseArray(req.body.weights, item, delivery, item.error));
          } else {
            resultsFrom.forEach(function (fromCity) {
              resultsTo.forEach(function (toCity) {
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
        } else {
          var founds = commonHelper.findInArray(results.getCountries, item.countryTo, 'name');
          if (!results.getCountries.length) {
            item.error = commonHelper.getCountriesError(new Error('Пустой массив стран'));
            requests = requests.concat(commonHelper.getResponseArray(req.body.weights, item, delivery, item.error));
          } else if (!founds.length) {
            item.error = commonHelper.getCountryNoResultError(item.countryTo);
            requests = requests.concat(commonHelper.getResponseArray(req.body.weights, item, delivery, item.error));
          } else {
            var foundCities = [];
            if (item.toRu) {
              var cityTrim = commonHelper.getCity(item.to);
              foundCities = commonHelper.findInArray(results.getCountries, cityTrim, 'name');
            }
            tempIntRequests.push({
              city: {
                initialCityFrom: item.from,
                initialCityTo: item.to,
                from: item.from,
                to: foundCities.length ? foundCities[0].name : founds[0].name,
                countryFrom: item.countryFrom,
                countryTo: item.countryTo
              },
              req: getIntReq(foundCities[0] || founds[0]),
              delivery: delivery,
              tariffs: []
            });
          }
        }
      });
      tempRequests.forEach(function (item) {
        req.body.weights.forEach(function (weight) {
          var obj = commonHelper.deepClone(item);
          obj.weight = weight;
          obj.req.weight = weight * 1000;
          requests.push(obj);
        });
      });
      tempIntRequests.forEach(function (item) {
        req.body.weights.forEach(function (weight) {
          var obj = commonHelper.deepClone(item);
          obj.weight = weight;
          obj.req.weight = weight * 1000;
          intRequests.push(obj);
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
        var inReqs = [];
        services.forEach(function (srv) {
          if (item.weight <= 10) {
            var obj = commonHelper.deepClone(item);
            obj.service = srv.name + ' (документы)';
            obj.req.what = 'doc';
            inReqs.push(obj);
          }
          var obj2 = commonHelper.deepClone(item);
          obj2.service = srv.name;
          inReqs.push(obj2);
        });
        getCalcResult(inReqs, false, function (err, results) {
          if (err) {
            item.error = err;
          } else {
            item.tariffs = results;
          }
          callback(null, item);
        });
      }, callback);
    }],
    internationalRequests: ['parseCities', function (results, callback) {
      async.mapLimit(intRequests, 2, function (item, callback) {
        if (commonHelper.getReqStored(req, delivery) > timestamp) {
          return callback({abort: true});
        }
        if (item.error) {
          return async.nextTick(function () {
            callback(null, item);
          });
        }
        var inReqs = [];
        if (item.weight <= 10) {
          var obj = commonHelper.deepClone(item);
          obj.service = 'международная доставка (документы)';
          obj.req.type = 'docs';
          inReqs.push(obj);
        }
        item.service = 'международная доставка';
        inReqs.push(item);
        getCalcResult(inReqs, true, function (err, results) {
          if (err) {
            item.error = err;
          } else {
            item.tariffs = results;
          }
          callback(null, item);
        });
      }, callback);
    }]
  }, function (err, results) {
    commonHelper.saveResults(req, err, {
      delivery: delivery,
      timestamp: timestamp,
      cities: cities,
      items: err ? [] : results.requests.concat(results.internationalRequests),
      callback: callback
    });
  });
};