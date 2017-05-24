var responseHelper = require('../../helpers/response');
var deliveryHelper = require('../../helpers/delivery');
var commonHelper = require('../../helpers/common');
var async = require('async');
var request = commonHelper.request;
var cheerio = require('cheerio');
var config = require('../../../conf');
var _ = require('underscore');
var logger = require('../../helpers/logger');
var delivery = 'dpd';

var getReq = function (from, to) {
  from = from || {};
  to = to || {};
  return {
    'method:calc': '',
    direction: '',
    'form.cityPickupId': from.id,
    'form.cityDeliveryId': to.id,
    'form.cityPickupCountryCode': from.countryCode ? from.countryCode.toLowerCase() : '',
    'form.cityDeliveryCountryCode': to.countryCode ? to.countryCode.toLowerCase() : '',
    'form.cityPickupNameFull': from.name,
    'form.cityDeliveryNameFull': to.name,
    'form.cityPickupNameTotal': from.name,
    'form.cityDeliveryNameTotal': to.name,
    'serverCountryCode': 'ru',
    'form.cityPickupName': from.name,
    'form.cityPickupType': 0,
    'form.cityDeliveryName': to.name,
    'form.cityDeliveryType': 0,
    'form.weightStr': 1,
    'form.volumeStr': '',
    'form.parcelLimits.maxLength': 350,
    'form.parcelLimits.maxWidth': 160,
    'form.parcelLimits.maxHeight': 180,
    'form.parcelLimits.maxWeight': 1000,
    'form.declaredCostStr': '',
    'form.maxDeclaredCost': 30000000,
    'form.deliveryPeriodId': 191696130
  };
};

var getInternationalReq = function (from, to, isCountryFrom, isCountryTo) {
  from = from || {};
  to = to || {};
  return {
    'countryOrigName': isCountryFrom ? from.name : 'Россия',
    'countryDestName': isCountryTo ? to.name : 'Россия',
    'cityOrigId': isCountryFrom ? '' : from.id,
    cityDestId: isCountryTo ? '' : from.id,
    cityPickupCountryCode: isCountryFrom ? from.id : 'RU',
    cityDeliveryCountryCode: isCountryTo ? to.id : 'RU',
    cityPickupNameFull: isCountryFrom ? '' : from.name,
    cityPickupNameTotal: isCountryFrom ? '' : from.name,
    cityDeliveryNameFull: isCountryTo ? '' : from.name,
    cityDeliveryNameTotal: isCountryTo ? '' : from.name,
    costRUB: 1,
    costEUR: 0,
    payWeight: 1,
    euro: 59.8953,
    koeffDPE: 250.0,
    koeffDPI: 250.0,
    siteCountryCode: 'RU',
    siteCurrencyCode: 'RUB',
    countryOrig: isCountryFrom ? from.id : 'RU',
    cityOrig:  isCountryFrom ? '' : from.name,
    pickupCityType: 'Д',
    countryDest: isCountryTo ? to.id : 'RU',
    deliveryCityType: 'Д',
    weight: 1,
    length: '',
    width: '',
    height: '',
    cost: 1,
    currency: 'rub'
  }
};

var getCityName = function (city) {
  var result = '';
  if (city.abbr) {
    result += city.abbr + '. ';
  }
  if (city.name) {
    result += city.name;
  }
  if (city.dist) {
    result += ', ' + city.dist;
  }
  if (city.reg) {
    result += ', ' + city.reg;
  }
  return result;
};

var getCity = function (city, country, cookie, callback) {
  var deliveryData = deliveryHelper.get(delivery);
  var opts = Object.assign({}, country ? deliveryData.citiesInternationalUrl : deliveryData.citiesUrl);
  opts.headers.Cookie = cookie;
  var trim = commonHelper.getCity(city);
  async.retry(config.retryOpts, function (callback) {
    opts.form = {
      name_startsWith: trim.toLowerCase(),
      country: 'RU',
      //selectedCountry: 'RU'
    };
    request(opts, callback)
  }, function (err, r, b) {
    var result = {
      city: city,
      cityTrim: trim,
      success: false
    };
    if (err) {
      result.message = commonHelper.getCityJsonError(err);
      return callback(null, result);
    }
    var json = null;
    try {
      json = JSON.parse(b);
    } catch (e) {
      result.message = commonHelper.getCityJsonError(e);
    }
    if (!json) {
      return callback(null, result);
    }
    if (!json.geonames) {
      result.message = commonHelper.getCityJsonError(new Error("Отсутствует geonames в ответе"));
      return callback(null, result);
    }
    if (!Array.isArray(json.geonames)) {
      result.message = commonHelper.getCityJsonError(new Error("Неверный тип geonames в ответе"));
      return callback(null, result);
    }
    json.geonames = commonHelper.findInArray(json.geonames, trim, 'name', true);
    if (!json.geonames.length) {
      result.message = commonHelper.getCityNoResultError(trim);
    } else if (json.geonames.length === 1) {
      result.foundCities = json.geonames;
      result.success = true;
    } else {
      var region = commonHelper.getRegionName(city);
      var founds = [];
      if (region) {
        founds = commonHelper.findInArray(json.geonames, region, 'reg');
      }
      result.foundCities = founds.length ? founds : [json.geonames[0]];
      result.success = true;
    }
    result.cities = json.geonames;
    callback(null, result);
  });
};

var getCalcResult = function (item, opts, callback) {
    setTimeout(function () {
      async.retry(config.retryOpts, function (callback) {
        opts.form = item.req;
        opts.followAllRedirects = true;
        request(opts, callback)
      }, function (err, r, b) {
        if (err) {
          item.error = commonHelper.getResultJsonError(err);
          return callback(null, item);
        }
        var $ = cheerio.load(b);
        if ($('#calc_noservices_message_container').length && $('#calc_noservices_message_container').css('display') !== 'none') {
          item.error = commonHelper.getNoResultError();
          return callback(null, item);
        }
        var trs = $('table#calc_result_table').find('tr');
        var tariffs = [];
        trs.each(function (index, tr) {
          if (index !== 0 && index !== trs.length - 1) {
            var tds = $(tr).find('td');
            if (tds.length) {
              tariffs.push({
                service: $(tr).find('input[name="name"]').val(),
                cost: $(tr).find('input[name="cost"]').val(),
                deliveryTime: $(tr).find('input[name="days"]').val()
              });
            }
          }
        });
        if (!tariffs.length) {
          item.error = commonHelper.getNoResultError();
        }
        item.tariffs = tariffs;
        return callback(null, item);
      });
    }, commonHelper.randomInteger(500, 1000));
};

var getIntCalcResult = function (item, opts, callback) {
  setTimeout(function () {
    async.retry(config.retryOpts, function (callback) {
      opts.form = item.req;
      opts.followAllRedirects = true;
      request(opts, callback)
    }, function (err, r, b) {
      if (err) {
        item.error = commonHelper.getResultJsonError(err);
        return callback(null, item);
      }
      var $ = cheerio.load(b);
      if ($('#calc_noservices_message_container').length && $('#calc_noservices_message_container').css('display') !== 'none') {
        item.error = commonHelper.getNoResultError();
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
        item.error = commonHelper.getNoResultError();
      }
      item.tariffs = tariffs;
      return callback(null, item);
    });
  }, commonHelper.randomInteger(500, 1000));
};

module.exports = function (req, cities) {
  var deliveryData = deliveryHelper.get(delivery);
  var requests = [];
  var internationalRequests = [];
  var cityObj = {};
  var cityIntObj = {};
  var timestamp = global[delivery];
  cities.forEach(function (item) {
    if (item.countryFrom && commonHelper.SNG.indexOf(item.countryFrom.toLowerCase()) > -1) {
      item.countryFromTemp = item.countryFrom;
      item.countryFrom = '';
    }
    if (item.countryTo) {
      if (commonHelper.SNG.indexOf(item.countryTo.toLowerCase()) > -1) {
        item.countryToTemp = item.countryTo;
        item.countryTo = '';
      }
      if (item.countryTo.toLowerCase() === 'южная корея') {
        item.countryTo = 'Корея Респ.';
      }
      if (item.countryTo.toLowerCase() === 'молдавия') {
        item.countryTo = 'Молдова Респ.';
      }
    }
  });
  async.auto({
    getCookie: function (callback) {
      var opts = _.extend({}, deliveryData.calcUrl);
      async.retry(config.retryOpts, function (callback) {
        request(opts, callback)
      }, function (err, r, b) {
        if (err) {
          return callback(err);
        }
        var cookie = '';
        try {
          cookie = r.headers['set-cookie'][0].split(';')[0];
        } catch (e) {}
        if (!cookie) {
          return callback(commonHelper.getResultJsonError(new Error('Не удалось получить cookie.')));
        }
        callback(null, cookie);
      });
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
    getCities: ['getCookie', 'getCountries', function (results, callback) {
      var countryObj = _.indexBy(results.getCountries, 'name');
      async.mapSeries(cities, function (city, callback) {
        if (!city.from && !city.to) {
          city.error = commonHelper.CITIESREQUIRED;
          return async.nextTick(function () {
            callback(null, city);
          });
        }
        if (!city.from && !city.countryFrom) {
          city.error = commonHelper.CITYORCOUNTRYFROMREQUIRED;
          return async.nextTick(function () {
            callback(null, city);
          });
        }
        if (!city.to && !city.countryTo) {
          city.error = commonHelper.CITYORCOUNTRYTOREQUIRED;
          return async.nextTick(function () {
            callback(null, city);
          });
        }
        if (city.countryFrom && !countryObj[city.countryFrom.toUpperCase()]) {
          city.error = commonHelper.COUNTRYFROMNOTFOUND;
          return async.nextTick(function () {
            callback(null, city);
          });
        }
        if (city.countryTo && !countryObj[city.countryTo.toUpperCase()]) {
          city.error = commonHelper.COUNTRYNOTFOUND;
          return async.nextTick(function () {
            callback(null, city);
          });
        }
        setTimeout(function () {
          if (global[delivery] > timestamp) {
            return callback({abort: true});
          }
          //у dpd разные запросы и разные id города в разных калькуляторах
          async.parallel([
            function (callback) {
              if (city.countryFrom || city.countryTo) {
                if (typeof  cityIntObj[city.from + city.countryFrom] !== 'undefined') {
                  return callback(null);
                }
              } else {
                if (typeof  cityObj[city.from + city.countryFrom] !== 'undefined') {
                  return callback(null);
                }
              }
              if (city.countryFrom) {
                return callback(null, {isCountry: true, success: true, foundCities: [countryObj[city.countryFrom.toUpperCase()]]});
              }
              getCity(city.from, city.countryFrom || city.countryTo, results.getCookie, callback);
            },
            function (callback) {
              if (city.countryFrom || city.countryTo) {
                if (typeof  cityIntObj[city.to + city.countryTo] !== 'undefined') {
                  return callback(null);
                }
              } else {
                if (typeof  cityObj[city.to + city.countryTo] !== 'undefined') {
                  return callback(null);
                }
              }
              if (city.countryTo) {
                return callback(null, {isCountry: true, success: true, foundCities: [countryObj[city.countryTo.toUpperCase()]]});
              }
              getCity(city.to, city.countryFrom || city.countryTo, results.getCookie, callback);
            }
          ], function (err, foundCities) { //ошибки быть не может
            if (city.countryFrom || city.countryTo) {
              if (typeof  cityIntObj[city.from + city.countryFrom] === 'undefined') {
                cityIntObj[city.from + city.countryFrom] = foundCities[0];
              }
              if (typeof  cityIntObj[city.to + city.countryTo] === 'undefined') {
                cityIntObj[city.to + city.countryTo] = foundCities[1];
              }
              city.fromJson = cityIntObj[city.from + city.countryFrom];
              city.toJson = cityIntObj[city.to + city.countryTo];
            } else {
              if (typeof  cityObj[city.from + city.countryFrom] === 'undefined') {
                cityObj[city.from + city.countryFrom] = foundCities[0];
              }
              if (typeof  cityObj[city.to + city.countryTo] === 'undefined') {
                cityObj[city.to + city.countryTo] = foundCities[1];
              }
              city.fromJson = cityObj[city.from + city.countryFrom];
              city.toJson = cityObj[city.to + city.countryTo];
            }
            callback(null, city);
          });
        }, commonHelper.randomInteger(500, 1000));
      }, callback);
    }],
    parseCities: ['getCities', 'getCountries', function (results, callback) {
      logger.tariffsInfoLog(delivery, results.getCities, 'getCities');
      logger.tariffsInfoLog(delivery, results.getCountries, 'getCountries');
      var tempRequests = [];
      var tempIntRequests = [];
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
              if (item.fromJson.isCountry || item.toJson.isCountry) {
                tempIntRequests.push({
                  city: {
                    initialCityFrom: item.from,
                    initialCityTo: item.to,
                    from: fromCity.name,
                    to: toCity.name,
                    countryFrom: item.countryFrom,
                    countryTo: item.countryTo
                  },
                  req: getInternationalReq(fromCity, toCity, item.fromJson.isCountry, item.toJson.isCountry),
                  delivery: delivery,
                  tariffs: []
                });
              } else {
                tempRequests.push({
                  city: {
                    initialCityFrom: item.from,
                    initialCityTo: item.to,
                    from: getCityName(fromCity),
                    to: getCityName(toCity),
                    countryFrom: item.countryFrom,
                    countryTo: item.countryTo
                  },
                  req: getReq(fromCity, toCity),
                  delivery: delivery,
                  tariffs: []
                });
              }
            });
          });
        }
      });
      tempRequests.forEach(function (item) {
        req.body.weights.forEach(function (weight) {
          var obj = commonHelper.deepClone(item);
          obj.weight = weight;
          obj.req['form.weightStr'] = weight;
          requests.push(obj);
        });
      });
      tempIntRequests.forEach(function (item) {
        req.body.weights.forEach(function (weight) {
          var obj = commonHelper.deepClone(item);
          obj.weight = weight;
          obj.req.payWeight = weight;
          obj.req.weight = weight;
          internationalRequests.push(obj);
        });
      });
      callback(null);
    }],
    requests: ['parseCities', function (results, callback) {
      async.mapLimit(requests, 1, function (item, callback) {
        if (global[delivery] > timestamp) {
          return callback({abort: true});
        }
        if (item.error) {
          return async.nextTick(function () {
            callback(null, item);
          });
        }
        var opts = _.extend({}, deliveryData.calcUrl);
        opts.headers.Cookie = results.getCookie;
        getCalcResult(item, opts, callback);
      }, callback);
    }],
    internationalRequests: ['parseCities', function (results, callback) {
      async.mapLimit(internationalRequests, 1, function (item, callback) {
        if (global[delivery] > timestamp) {
          return callback({abort: true});
        }
        if (item.error) {
          return async.nextTick(function () {
            callback(null, item);
          });
        }
        var opts = _.extend({}, deliveryData.calcInternationalUrl);
        opts.headers.Cookie = results.getCookie;
        opts.headers['X-Requested-With'] = 'XMLHttpRequest';
        getIntCalcResult(item, opts, callback);
      }, callback);
    }]
  }, function (err, results) {
    logger.tariffsInfoLog(delivery, results.requests, 'requests');
    logger.tariffsInfoLog(delivery, results.internationalRequests, 'internationalRequests');
    commonHelper.saveResults(req, err, {
      delivery: delivery,
      timestamp: timestamp,
      cities: cities,
      items: err ? [] : results.requests.concat(results.internationalRequests)
    });
  });
};