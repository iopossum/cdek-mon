var responseHelper = require('../../helpers/response');
var deliveryHelper = require('../../helpers/delivery');
var commonHelper = require('../../helpers/common');
var async = require('async');
var request = commonHelper.request;
var cheerio = require('cheerio');
var config = require('../../../conf');
var _ = require('underscore');
var logger = require('../../helpers/logger');
var delivery = 'cityexpress';

var getReq = function (from, to, opts) {
  from = from || {};
  to = to || {};
  opts = opts || {};
  return {
    'ctl00$Content$ScriptManager': 'ctl00$Content$UpdatePanel|ctl00$Content$CalculateButton',
    '__EVENTTARGET': '',
    '__EVENTARGUMENT': '',
    ctl00$Content$cityFrom: from.name,
    ctl00$Content$cityFromValue: from.id,
    ctl00$Content$cityTo: to.name,
    ctl00$Content$cityToValue: to.id,
    ctl00$Content$weight: 1,
    ctl00$Content$length: 5,
    ctl00$Content$width: 5,
    ctl00$Content$height: 5,
    ctl00$Content$volumeWeight: 0.025,
    ctl00$Content$quantity: 1,
    ctl00$Content$DispatchTypeComboBox: 'Товары',
    hiddenInputToUpdateATBuffer_CommonToolkitScripts: 1,
    __ASYNCPOST: false,
    ctl00$Content$CalculateButton: 'Рассчитать стоимость',

    '__VIEWSTATE': opts.__VIEWSTATE,
    __VIEWSTATEGENERATOR: opts.__VIEWSTATEGENERATOR
  }
};

var parseCity = function (string) {
  var json = null;
  try {
    json = JSON.parse(string);
  } catch (e) {}
  if (!json) {
    return json;
  }
  if (json.Second === 'none') {
    return null;
  }
  return {
    id: json.Second || '',
    name: json.First || ''
  };
};

var getCity = function (city, country, callback) {
  var deliveryData = deliveryHelper.get(delivery);
  var opts = Object.assign({}, deliveryData.citiesUrl);
  var trim = country;
  if (!trim) {
    trim = commonHelper.getCity(city);
  }
  async.retry(config.retryOpts, function (callback) {
    opts.json = {
      contextKey: "City",
      count: 20,
      prefixText: trim
    };
    request(opts, callback)
  }, function (err, r, b) {
    var result = {
      city: city,
      country: country,
      trim: trim,
      success: false
    };
    if (err) {
      result.message = commonHelper.getCityJsonError(err, trim);
      return callback(null, result);
    }
    if (!b) {
      result.message = commonHelper.getCityJsonError(new Error("Неверный тип данных в ответе"), trim);
      return callback(null, result);
    }
    if (!b.d) {
      result.message = commonHelper.getCityJsonError(new Error("Неверный тип данных в ответе. Отсутствует параметр d"), trim);
      return callback(null, result);
    }
    if (!Array.isArray(b.d)) {
      result.message = commonHelper.getCityJsonError(new Error("Неверный тип данных в ответе"), trim);
      return callback(null, result);
    }
    b.d = b.d.map(function (item) {
      return parseCity(item);
    }).filter(function (item) {
      return item !== null;
    });
    b.d = commonHelper.findInArray(b.d, trim, 'name', true);
    if (!b.d.length) {
      result.message = commonHelper.getCityNoResultError();
    } else if (b.d.length === 1) {
      result.foundCities = b.d;
      result.success = true;
    } else {
      var region = commonHelper.getRegionName(city);
      var founds = [];
      if (region) {
        founds = commonHelper.findInArray(b.d, region, 'name');
      }
      if (trim.toLowerCase() === 'новосибирск') {
        result.foundCities = founds.length ? founds : [b.d[1]];
      } else {
        result.foundCities = founds.length ? founds : [b.d[0]];
      }
      result.success = true;
    }
    result.cities = b.d;
    callback(null, result);
  });
};

var getCost = function (string) {
  var reg = /= ([0-9,]*)/;
  var result = string.match(reg);
  return result ? result[1] : '';
};

module.exports = function (req, cities, callback) {
  var deliveryData = deliveryHelper.get(delivery);
  var requests = [];
  var cityObj = {};
  var timestamp = callback ? new Date().getTime*2 : commonHelper.getReqStored(req, delivery);
  async.auto({
    getInitial: function (callback) {
      var opts = Object.assign({}, deliveryData.calcUrl);
      opts.method = 'GET';
      async.retry(config.retryOpts, function (callback) {
        request(opts, callback)
      }, function (err, r, b) {
        if (err) {
          return callback(new Error(commonHelper.getResultJsonError(err)));
        }
        var result = {};
        var $ = cheerio.load(b);
        result.__VIEWSTATE = $('#__VIEWSTATE').val();
        result.__VIEWSTATEGENERATOR = $('#__VIEWSTATEGENERATOR').val();
        result.__EVENTVALIDATION = $('#__EVENTVALIDATION').val();
        callback(null, result);
      });
    },
    getCities: ['getInitial', function (results, callback) {
      async.mapSeries(cities, function (city, callback) {
        if (!city.from && !city.to && !city.countryFrom) {
          city.error = commonHelper.CITYORCOUNTRYREQUIRED;
          return async.nextTick(function () {
            callback(null, city);
          });
        }
        if (!city.from && !city.to && !city.countryTo) {
          city.error = commonHelper.CITYORCOUNTRYREQUIRED;
          return async.nextTick(function () {
            callback(null, city);
          });
        }
        setTimeout(function () {
          if (commonHelper.getReqStored(req, delivery) > timestamp) {
            return callback({abort: true});
          }
          async.parallel([
            function (callback) {
              if (typeof  cityObj[city.from + city.countryFrom] !== 'undefined') {
                return callback(null);
              }
              getCity(city.from, city.countryFrom, callback);
            },
            function (callback) {
              if (typeof  cityObj[city.to + city.countryTo] !== 'undefined') {
                return callback(null);
              }
              getCity(city.to, city.countryTo, callback);
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
    }],
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
      });
      tempRequests.forEach(function (item) {
        req.body.weights.forEach(function (weight) {
          var obj = commonHelper.deepClone(item);
          obj.weight = weight;
          obj.req['ctl00$Content$weight'] = weight;
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
        var opts = _.extend({}, deliveryData.calcUrl);
        opts.form = item.req;
        setTimeout(function () {
          async.retry(config.retryOpts, function (callback) {
            request(opts, callback)
          }, function (err, r, b) {
            delete item.req.__VIEWSTATE;
            delete item.req.__EVENTVALIDATION;
            if (err) {
              item.error = commonHelper.getResponseError(err);
              return callback(null, item);
            }
            var $ = cheerio.load(b);
            var trs = $('.inform-table').find('tr');
            if (trs.length <= 1) {
              item.error = commonHelper.getNoResultError();
            } else {
              trs.each(function (index, tr) {
                if (index !== 0) {
                  item.tariffs.push({
                    service: $(tr).find('#Span1').text().trim(),
                    cost: getCost($(tr).find('#Span2').text().trim()),
                    deliveryTime: $(tr).find('#Span5').text().trim()
                  });
                }
              });
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