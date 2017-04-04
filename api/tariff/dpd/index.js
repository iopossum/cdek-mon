var responseHelper = require('../../helpers/response');
var deliveryHelper = require('../../helpers/delivery');
var commonHelper = require('../../helpers/common');
var async = require('async');
var request = commonHelper.request;
var cheerio = require('cheerio');
var config = require('../../../conf');
var _ = require('underscore');
var logger = require('../../helpers/logger');

var getReq = function (from, to, weight) {
  from = from || {};
  to = to || {};
  from.foundCity = from.foundCity || {};
  to.foundCity = to.foundCity || {};
  return {
    method: 'calc:',
    direction: '',
    'form.cityPickupId': from.foundCity.id,
    'form.cityDeliveryId': to.foundCity.id,
    'form.cityPickupCountryCode': from.foundCity.countryCode ? from.foundCity.countryCode.toLowerCase() : '',
    'form.cityDeliveryCountryCode': to.foundCity.countryCode ? to.foundCity.countryCode.toLowerCase() : '',
    'form.cityPickupNameFull': /*'г. Новосибирск',*/from.foundCity.name,
    'form.cityDeliveryNameFull': to.foundCity.name,
    'form.cityPickupNameTotal': /*'г. Новосибирск, (Новосибирская обл.)',*/ from.foundCity.name,
    'form.cityDeliveryNameTotal': to.foundCity.name,
    'serverCountryCode': 'ru',
    'form.cityPickupName': from.foundCity.name,
    'form.cityPickupType': 0,
    'form.cityDeliveryName': to.foundCity.name,
    'form.cityDeliveryType': 0,
    'form.weightStr': weight,
    'form.volumeStr': '',
    'form.parcelLimits.maxLength': 350,
    'form.parcelLimits.maxWidth': 160,
    'form.parcelLimits.maxHeight': 180,
    'form.parcelLimits.maxWeight': 1000,
    'form.declaredCostStr': '',
    'form.maxDeclaredCost': 30000000,
    'form.deliveryPeriodId': 191696130
  }
};

var getInternationalReq = function (from, to, weight) {
  from = from || {};
  to = to || {};
  from.foundCity = from.foundCity || {};
  to.foundCity = to.foundCity || {};
  return {
    'countryOrigName': from.name || 'Россия',
    'countryDestName': to.name || 'Россия',
    'cityOrigId': from.foundCity.id || '',
    cityDestId: to.foundCity.id || '',
    cityPickupCountryCode: from.id || 'RU',
    cityDeliveryCountryCode: to.id || 'RU',
    cityPickupNameFull: from.foundCity.name || '',
    cityPickupNameTotal: from.foundCity.name || '',
    cityDeliveryNameFull: to.foundCity.name || '',
    cityDeliveryNameTotal: to.foundCity.name || '',
    costRUB: 1,
    costEUR: 0,
    payWeight: weight,
    euro: 59.8953,
    koeffDPE: 250.0,
    koeffDPI: 250.0,
    siteCountryCode: 'RU',
    siteCurrencyCode: 'RUB',
    countryOrig: from.id || 'RU',
    cityOrig: from.foundCity.name || '',
    pickupCityType: 'Д',
    countryDest: to.id || 'RU',
    deliveryCityType: 'Д',
    weight: weight,
    length: '',
    width: '',
    height: '',
    cost: 1,
    currency: 'rub'
  }
};

var getCity = function (city, opts, callback) {
  var trim = commonHelper.getCity(city);
  async.retry(config.retryOpts, function (callback) {
    opts.form = {
      name_startsWith: trim,
      country: 'RU',
      selectedCountry: 'RU'
    };
    request(opts, callback)
  }, function (err, r, b) {
    var result = {
      city: city,
      cityTrim: trim,
      success: false
    };
    if (err) {
      result.message = "Не удалось получить города с сайта. " + (err.message ? 'Ошибка: ' + err.message : '');
      return callback(null, result);
    }
    var json = null;
    try {
      json = JSON.parse(b);
    } catch (e) {
      result.message = "Не удалось получить города с сайта. Неверный ответ от сервера. " + (e.message ? 'Ошибка: ' + e.message : '');
    }
    if (!json) {
      return callback(null, result);
    }
    if (!json.geonames) {
      result.message = "Не удалось получить города с сайта. Неверный ответ от сервера - озможно поменялся формат ответа.";
      return callback(null, result);
    }
    if (!json.geonames.length) {
      result.message = "Не удалось получить города с сайта. Такого города нет в БД сайта.";
    } else if (json.geonames.length === 1) {
      result.foundCity = json.geonames[0];
      result.success = true;
    } else {
      var region = commonHelper.getRegionName(city);
      var founds = [];
      if (region) {
        json.geonames.forEach(function (item) {
          if (new RegExp(region, 'gi').test(item)) {
            founds.push(item);
          }
        });
      }
      result.foundCity = founds[0] || json.geonames[0];
      result.success = true;
    }
    result.cities = json.geonames;
    callback(null, result);
  });
};

var getCalcResult = function (requests, delivery, timestamp, opts, callback) {
  async.mapLimit(requests, 3, function (item, callback) {
    if (global[delivery] > timestamp) {
      return callback({abort: true});
    }
    if (item.error) {
      return callback(null, item);
    }
    setTimeout(function () {
      async.retry(config.retryOpts, function (callback) {
        opts.form = item.req;
        request(opts, callback)
      }, function (err, r, b) {
        if (err) {
          item.error = "Не удалось получить информацию с сайта, попробуйте позже";
          return callback(null, item);
        }
        var $ = cheerio.load(b);
        if ($('#calc_noservices_message_container').length) {
          item.error = "По указанным направлениям ничего не найдено";
          return callback(null, item);
        }
        var trs = $('table#calc_result_table').find('tr');
        var tariffs = [];
        trs.each(function (index, tr) {
          if (index !== 0) {
            var tds = $(tr).find('td');
            if (tds.length) {
              tariffs.push({
                service: $(tr).find('input[name="serviceName1"]').val(),
                cost: $(tr).find('input[name="serviceCost1"]').val(),
                deliveryTime: $(tr).find('input[name="serviceDays1"]').val()
              });
            }
          }
        });
        if (!tariffs.length) {
          item.error = "По указанным направлениям ничего не найдено";
        }
        item.tariffs = tariffs;
        return callback(null, item);
      });
    }, commonHelper.randomInteger(500, 1000));
  }, callback);
};

//logger.tariffsInfoLog(delivery, {asd: ['fdsfsf']}, 'asdsad');
module.exports = function (req, res) {
  var delivery = 'dpd';
  var deliveryData = deliveryHelper.get(delivery);
  var requests = [];
  var internationalRequests = [];
  var cityObj = {};
  var cityInternationalObj = {};
  var timestamp = global[delivery];
  req.body.cities.forEach(function (item) {
    if (!item.from && !item.to) {
      requests = requests.concat(commonHelper.getResponseArray(req.body.weights, item, delivery, 'Должен быть указан хотя бы 1 город'));
    } else if (!item.from && !item.countryFrom) {
      requests = requests.concat(commonHelper.getResponseArray(req.body.weights, item, delivery, 'В направлении "откуда" должен быть указан либо город, либо страна'));
    } else if (!item.to && !item.countryTo) {
      requests = requests.concat(commonHelper.getResponseArray(req.body.weights, item, delivery, 'В направлении "куда" должен быть указан либо город, либо страна'));
    } else if (item.from && item.countryTo) { //international
      cityInternationalObj[item.from] = true;
    } else if (item.to && item.countryFrom) { //international
      cityInternationalObj[item.to] = true;
    } else {
      if (item.from) {
        cityObj[item.from] = true;
      }
      if (item.to) {
        cityObj[item.to] = true;
      }
    }
  });
  async.auto({
    getCities: function (callback) {
      async.mapLimit(_.keys(cityObj), 3, function (city, callback) {
          setTimeout(function () {
            if (global[delivery] > timestamp) {
              return callback({abort: true});
            }
            var opts = Object.assign({}, deliveryData.citiesUrl);
            getCity(city, opts, callback);
          }, commonHelper.randomInteger(500, 1000));
      }, callback);
    },
    getInternationalCities: function (callback) {
      async.mapLimit(_.keys(cityInternationalObj), 3, function (city, callback) {
        setTimeout(function () {
          if (global[delivery] > timestamp) {
            return callback({abort: true});
          }
          var opts = Object.assign({}, deliveryData.citiesInternationalUrl);
          getCity(city, opts, callback);
        }, commonHelper.randomInteger(500, 1000));
      }, callback);
    },
    getCountries: function (callback) {
      var opts = _.extend({}, deliveryData.countriesUrl);
      async.retry(config.retryOpts, function (callback) {
          request(opts, callback)
        }, function (err, r, b) {
        var countries = [];
        if (err) {
          return callback(null, countries);
        }
        var $ = cheerio.load(b);
        var items = $('#sender_detail').find('.pseudo_selections').find('a');
        items.each(function (index, item) {
          countries.push({id: $(item).attr('value'), name: $(item).text().toUpperCase()});
        });
        callback(null, countries);
      });
    },
    parseCities: ['getCities', 'getInternationalCities', 'getCountries', function (results, callback) {
      logger.tariffsInfoLog(delivery, results.getCities, 'getCities');
      logger.tariffsInfoLog(delivery, results.getInternationalCities, 'getInternationalCities');
      logger.tariffsInfoLog(delivery, results.getCountries, 'getCountries');
      var countryObj = _.indexBy(results.getCountries, 'name');
      var cityObj = _.indexBy(results.getCities, 'city');
      var cityInternationalObj = _.indexBy(results.getInternationalCities, 'city');
      req.body.cities.forEach(function (item) {
        if (!item.from && !item.to) {
        } else if (!item.from && !item.countryFrom) {
        } else if (!item.to && !item.countryTo) {
        } else if (item.from && item.countryTo) { //international
          req.body.weights.forEach(function (weight) {
            var deliveryReq = getInternationalReq(cityInternationalObj[item.from], countryObj[item.countryTo.toUpperCase()], weight);
            internationalRequests.push({
              weight: weight,
              city: item,
              delivery: delivery,
              req: deliveryReq,
              error: !cityInternationalObj[item.from].success || !countryObj[item.countryTo.toUpperCase()] ? (cityInternationalObj[item.from].message || 'Страна не найдена') : null,
              tariffs: []
            });
          });
        } else if (item.to && item.countryFrom) { //international
          req.body.weights.forEach(function (weight) {
            var deliveryReq = getInternationalReq(countryObj[item.countryFrom.toUpperCase()], cityInternationalObj[item.to], weight);
            internationalRequests.push({
              weight: weight,
              city: item,
              delivery: delivery,
              req: deliveryReq,
              error: !cityInternationalObj[item.to].success || !countryObj[item.countryFrom.toUpperCase()] ? (cityInternationalObj[item.to].message || 'Страна не найдена') : null,
              tariffs: []
            });
          });
        } else {
          req.body.weights.forEach(function (weight) {
            var deliveryReq = getReq(cityObj[item.from], cityObj[item.to], weight);
            requests.push({
              weight: weight,
              city: item,
              delivery: delivery,
              req: deliveryReq,
              error: !cityObj[item.from].success || !cityObj[item.to].success ? (cityObj[item.from].message || cityObj[item.to].message) : null,
              tariffs: []
            });
          });
        }
      });
      callback(null);
    }],
    requests: ['parseCities', function (results, callback) {
      var opts = _.extend({}, deliveryData.calcUrl);
      getCalcResult(requests, delivery, timestamp, opts, callback);
    }],
    internationalRequests: ['parseCities', function (results, callback) {
      var opts = _.extend({}, deliveryData.calcInternationalUrl);
      getCalcResult(internationalRequests, delivery, timestamp, opts, callback);
    }]
  }, function (err, results) {
    logger.tariffsInfoLog(delivery, results.requests, 'requests');
    logger.tariffsInfoLog(delivery, results.internationalRequests, 'internationalRequests');
    if (err) {
      if (err.abort) {
        return false;
      }
      req.session.delivery[delivery].complete = true;
      req.session.delivery[delivery].error = err.message || err.stack;
      var array = [];
      req.body.cities.forEach(function (item) {
        array = array.concat(commonHelper.getResponseArray(req.body.weights, item, delivery, err.message || err.stack))
      });
      req.session.delivery[delivery].results = array;
      req.session.save(function () {});
      return false;
    }
    req.session.delivery[delivery].complete = true;
    req.session.delivery[delivery].results = results.requests.concat(results.internationalRequests);
    req.session.save(function () {});
  });
};