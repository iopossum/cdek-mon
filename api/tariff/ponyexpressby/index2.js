var responseHelper = require('../../helpers/response');
var deliveryHelper = require('../../helpers/delivery');
var commonHelper = require('../../helpers/common');
var async = require('async');
var request = commonHelper.request;
var cheerio = require('cheerio');
var config = require('../../../conf');
var _ = require('underscore');
var logger = require('../../helpers/logger');
var delivery = 'ponyexpressby';

var getReq = function (from, to, countryFrom, countryTo) {
  return {
    'send_to_email': 1,
    'tips[tips_iblock_code]': 'form_tips',
    'tips[tips_section_code]': 'pegas_by',
    'order[currency_code]': 'BYN',
    'order[mode]': 'Calculation',
    'order[sender][region]': commonHelper.getRegionName(from) || '',
    'order[sender][district]': commonHelper.getDistrictName(from) || '',
    'order[recipient][region]': commonHelper.getRegionName(to) || '',
    'order[recipient][district]': commonHelper.getDistrictName(to) || '',
    'order[cargo][0][weight]': 1,
    'order[cargo][0][description]': '-',
    'order[cargo][0][packing]': 'Envelope',
    'order[cargo][0][dimensions][length]': '0.1',
    'order[cargo][0][dimensions][width]': '0.1',
    'order[cargo][0][dimensions][height]': '0.1',
    'order[cargo][0][cost]': '',
    'order[cargo][0][is_oversized]': 0,
    'order[cargo][0][is_dangerous]': 0,
    'order[sender][country]': countryFrom,
    'order[sender][city]': commonHelper.getCity(from),
    'order[recipient][country]': countryTo,
    'order[recipient][city]': commonHelper.getCity(to),
    'order[hascargo]': 1,
    'box-select': 'Box',
    'order[documents][warranty_letter]': 0,
    'order[payment_type]': 'Cash',
    'order[payment_contract]': '',
    'order[payment_mode]': 'Sender',
    'order[sender][persons][0][name]': '',
    'order[sender][company]': '',
    'order[sender][persons][0][emails][0]': '',
    'order[sender][persons][0][phones][0]': '',
    'order[sender][street_type]': 'ул.',
    'order[sender][street]': '',
    'order[sender][house]': '',
    'order[sender][housing]': '',
    'order[sender][building]': '',
    'order[sender][flat]': '',
    'order[sender][postcode]': '',
    'order[recipient][persons][0][name]': '',
    'order[recipient][company]': '',
    'order[recipient][persons][0][emails][0]': '',
    'order[recipient][persons][0][phones][0]': '',
    'order[recipient][street_type]': 'ул.',
    'order[recipient][street]': '',
    'order[recipient][house]': '',
    'order[recipient][housing]': '',
    'order[recipient][building]': '',
    'order[recipient][flat]': '',
    'order[recipient][postcode]': '',
    'order[description]': ''
  }
};

var getDeliveryTime = function (json) {
  var result = '';
  json = json || {};
  if (!json.MinTerm && !json.MaxTerm) {
    return result;
  }
  if (json.MinTerm == json.MaxTerm) {
    result = json.MinTerm;
  } else {
    result = json.MinTerm + '-' + json.MaxTerm;
  }
  return result;
};

var getCost = function (json) {
  var result = null;
  json = json || {};
  if (!json.Sum) {
    return result;
  }
  var float = parseFloat(json.Sum);
  if (isNaN(float)) {
    return result;
  }
  result = float;
  if (json.VAT) {
    float = parseFloat(json.VAT);
    if (!isNaN(float)) {
      result += float;
    }
  }
  result = (result).toFixed(2);
  return result;
};

var findCities = function (array, term) {
  var found = array.filter(function (item) {
    return new RegExp("^" + term + "$", "i").test(item);
  });
  return found.length ? found : array.filter(function (item) {
    return new RegExp("(^|[^_0-9a-zA-Zа-яёА-ЯЁ])" + term + "([^_0-9a-zA-Zа-яёА-ЯЁ-]|$)", "i").test(item);
  });
};

var getCity = function (city, country, callback) {
  var deliveryData = deliveryHelper.get(delivery);
  var opts = Object.assign({}, deliveryData.citiesUrl);
  var trim = commonHelper.getCity(city);
  opts.uri += encodeURIComponent(trim);
  async.retry(config.retryOpts, function (callback) {
    request(opts, callback)
  }, function (err, r, b) {
    var result = {
      city: city,
      cityTrim: trim,
      foundCities: [trim],
      success: true
    };
    if (err) {
      return callback(null, result);
    }
    b = b.substring(1, b.length);
    var json = null;
    try {
      json = JSON.parse(b);
    } catch (e) {
    }
    if (!json) {
      return callback(null, result);
    }
    if (!Array.isArray(json)) {
      return callback(null, result);
    }
    if (!json.length || !json[0]) {

    } else if (json.length === 1) {
      result.foundCities = json;
      result.success = true;
    } else {
      var region = commonHelper.getRegionName(city);
      json = findCities(json, trim);
      var foundsByCountry = findCities(json, country);
      var foundsByRegion = [];
      if (region) {
        if (foundsByCountry.length) {
          foundsByRegion = findCities(foundsByCountry, region);
        } else {
          foundsByRegion = findCities(json, region);
        }
      }
      var totally = foundsByRegion.length ? foundsByRegion : foundsByCountry;
      result.foundCities = totally.length ? totally.slice(0, 2) : json.slice(0, 2);
      result.success = true;
    }
    callback(null, result);
  });
};

module.exports = function (req, cities, callback) {
  var deliveryData = deliveryHelper.get(delivery);
  var requests = [];
  var cityObj = {};
  var timestamp = callback ? new Date().getTime*2 : commonHelper.getReqStored(req, delivery);
  var sng = commonHelper.SNG.concat(commonHelper.RUSSIA).concat(['азербайджан', 'армения', 'беларусь', 'казахстан', 'кыргызстан', 'молдавия', 'молдова', 'узбекистан', 'украина', 'латвия', 'литва', 'эстония', 'грузия']);
  cities.forEach(function (item) {
    item.countryFrom = item.countryFrom || 'Россия';
    item.countryTo = item.countryTo || 'Россия';
    if (sng.indexOf(item.countryFrom.toLowerCase()) === -1) {
      item.isFromInternational = true;
    } else if (commonHelper.BY.indexOf(item.countryFrom.toLowerCase()) > -1) {
      item.fromBy = true;
    }
    if (sng.indexOf(item.countryTo.toLowerCase()) === -1) {
      item.isToInternational = true;
    } else if (commonHelper.BY.indexOf(item.countryTo.toLowerCase()) > -1) {
      item.toBy = true;
    }
  });
  async.auto({
    getCities: [function (callback) {
      async.mapSeries(cities, function (city, callback) {
        if (!city.from) {
          city.error = commonHelper.CITYFROMREQUIRED;
          return async.nextTick(function () {
            callback(null, city);
          });
        }
        if (!city.to) {
          city.error = commonHelper.CITYTOREQUIRED;
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
              if (typeof cityObj[city.from + city.countryFrom] !== 'undefined') {
                return callback(null);
              }
              getCity(city.from, city.countryFrom, callback);
            },
            function (callback) {
              if (typeof cityObj[city.to + city.countryTo] !== 'undefined') {
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
                  from: fromCity,
                  to: toCity,
                  countryFrom: item.countryFrom,
                  countryTo: item.countryTo
                },
                req: getReq(fromCity, toCity, item.countryFrom, item.countryTo, item.fromBy, item.toBy),
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
          obj.req['order[cargo][0][weight]'] = weight * 1000;
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
        opts.followAllRedirects = true;
        opts.headers['X-Requested-With'] = 'XMLHttpRequest';
        setTimeout(function () {
          async.retry(config.retryOpts, function (callback) {
            request(opts, callback)
          }, function (err, r, json) {
            json = json || {};
            if (err) {
              item.error = commonHelper.getResponseError(err);
              return callback(null, item);
            }
            if (!json.result) {
              item.error = commonHelper.getResponseError(new Error("Неверный тип данных в ответе. Отсутствует параматер result"));
              return callback(null, item);
            }
            if (typeof json.result.DeliveryRateSet === 'undefined') {
              item.error = commonHelper.getResponseError(new Error("Неверный тип данных в ответе. Отсутствует параматер DeliveryRateSet"));
              return callback(null, item);
            }
            if (!json.result.DeliveryRateSet) {
              item.error = commonHelper.getNoResultError();
              return callback(null, item);
            }
            for (var key in json.result.DeliveryRateSet) {
              var cost = getCost(json.result.DeliveryRateSet[key]);
              if (cost) {
                item.tariffs.push({
                  service: json.result.DeliveryRateSet[key].Description,
                  cost: cost,
                  deliveryTime: getDeliveryTime(json.result.DeliveryRateSet[key])
                });
              }
            }
            if (!item.tariffs.length) {
              item.error = commonHelper.getNoResultError();
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