var responseHelper = require('../../helpers/response');
var deliveryHelper = require('../../helpers/delivery');
var commonHelper = require('../../helpers/common');
var async = require('async');
var request = commonHelper.request;
var cheerio = require('cheerio');
var config = require('../../../conf');
var _ = require('underscore');
var logger = require('../../helpers/logger');
var delivery = 'dpdkz';
var directCountries = commonHelper.SNG.concat(commonHelper.RUSSIA);

'use strict';

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
    'countryOrigName': isCountryFrom ? from.name : 'Казахстан',
    'countryDestName': isCountryTo ? to.name : 'Казахстан',
    'cityOrigId': isCountryFrom ? '' : from.id,
    cityDestId: isCountryTo ? '' : to.id,
    cityPickupCountryCode: isCountryFrom ? from.id : 'KZ',
    cityDeliveryCountryCode: isCountryTo ? to.id : 'KZ',
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
    siteCountryCode: 'KZ',
    siteCurrencyCode: 'KZT',
    countryOrig: isCountryFrom ? from.id : 'KZ',
    cityOrig:  isCountryFrom ? '' : from.name,
    pickupCityType: 'Д',
    countryDest: isCountryTo ? to.id : 'KZ',
    deliveryCityType: 'Д',
    weight: 1,
    length: '',
    width: '',
    height: '',
    cost: 1,
    currency: 'kzt'
  }
};

var getServiceName = function (req, name) {
  return (!req['form.cityPickupType'] ? 'Д' : 'С') + (!req['form.cityDeliveryType'] ? 'Д' : 'С') + ': ' + name;
};

var getServiceIntName = function (req, name) {
  return (req.pickupCityType !== 'Д' ? 'C' : 'Д') + (req.deliveryCityType !== 'Д' ? 'C' : 'Д') + ': ' + name;
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

var getCity = function (city, country, isInternational, cookie, callback) {
  var deliveryData = deliveryHelper.get(delivery);
  var opts = Object.assign({}, isInternational ? deliveryData.citiesInternationalUrl : deliveryData.citiesUrl);
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
      result.message = commonHelper.getCityJsonError(err, trim);
      return callback(null, result);
    }
    var json = null;
    try {
      json = JSON.parse(b);
    } catch (e) {
      result.message = commonHelper.getCityJsonError(e, trim);
    }
    if (!json) {
      return callback(null, result);
    }
    if (!json.geonames) {
      result.message = commonHelper.getCityJsonError(new Error("Отсутствует geonames в ответе"), trim);
      return callback(null, result);
    }
    if (!Array.isArray(json.geonames)) {
      result.message = commonHelper.getCityJsonError(new Error("Неверный тип geonames в ответе"), trim);
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
      if (!founds.length && !isInternational) {
        founds = commonHelper.findInArray(json.geonames, country, 'countryName');
      }
      result.foundCities = founds.length ? founds.slice(0, 1) : json.geonames.slice(0, 1);
      result.success = true;
    }
    result.cities = json.geonames;
    callback(null, result);
  });
};

var getCalcResult = function (cookie, req, callback) {
  var deliveryData = deliveryHelper.get(delivery);
  setTimeout(function () {
    async.retry(config.retryOpts, function (callback) {
      var opts = _.extend({}, deliveryData.calcUrl);
      opts.headers.Cookie = cookie;
      opts.form = req;
      opts.followAllRedirects = true;
      request(opts, callback)
    }, function (err, r, b) {
      var item = {success: false, tariffs: []};
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
      trs.each(function (index, tr) {
        if ($(tr).hasClass('shownRows') || $(tr).hasClass('hiddenRows')) {
          var tds = $(tr).find('td');
          if (tds.length) {
            item.tariffs.push({
              service: getServiceName(req, $(tr).find('input[name="name"]').val()),
              cost: $(tr).find('input[name="cost"]').val(),
              deliveryTime: $(tr).find('input[name="days"]').val()
            });
          }
        }
      });
      if (!item.tariffs.length) {
        item.error = commonHelper.getNoResultError();
        return callback(null, item);
      }
      item.success = true;
      return callback(null, item);
    });
  }, commonHelper.randomInteger(500, 1000));
};

var getIntCalcResult = function (cookie, req, callback) {
  var deliveryData = deliveryHelper.get(delivery);
  setTimeout(function () {
    var opts = _.extend({}, deliveryData.calcInternationalUrl);
    opts.headers.Cookie = cookie;
    opts.headers['X-Requested-With'] = 'XMLHttpRequest';
    async.retry(config.retryOpts, function (callback) {
      opts.form = req;
      opts.followAllRedirects = true;
      request(opts, callback)
    }, function (err, r, b) {
      var item = {success: false, tariffs: []};
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
      trs.each(function (index, tr) {
        if (index !== 0) {
          var tds = $(tr).find('td');
          if (tds.length) {
            item.tariffs.push({
              service: getServiceIntName(req, $(tr).find('input[name="serviceName1"]').val()),
              cost: $(tr).find('input[name="serviceCost1"]').val(),
              deliveryTime: $(tr).find('input[name="serviceDays1"]').val()
            });
          }
        }
      });
      if (!item.tariffs.length) {
        item.error = commonHelper.getNoResultError();
        return callback(null, item);
      }
      item.success = true;
      return callback(null, item);
    });
  }, commonHelper.randomInteger(500, 1000));
};

module.exports = function (req, cities, callback) {
  var requests = [];
  var internationalRequests = [];
  var deliveryData = deliveryHelper.get(delivery);
  var timestamp = callback ? new Date().getTime*2 : commonHelper.getReqStored(req, delivery);
  cities.forEach(function (item) {
    item.countryFrom = item.countryFrom || 'Россия';
    item.countryTo = item.countryTo || 'Россия';
    if (item.countryTo.toLowerCase() === 'южная корея') {
      item.countryTo = 'Корея Респ.';
    }
    if (item.countryTo.toLowerCase() === 'молдавия') {
      item.countryTo = 'Молдова Респ.';
    }
    if (directCountries.indexOf(item.countryFrom.toLowerCase()) === -1) {
      item.isFromInternational = true;
    } else if (item.countryFrom.toLowerCase() === 'казахстан') {
      item.fromKz = true;
    }
    if (directCountries.indexOf(item.countryTo.toLowerCase()) === -1) {
      item.isToInternational = true;
    } else if (item.countryTo.toLowerCase() === 'казахстан') {
      item.toKz = true;
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
        if (city.isFromInternational && !countryObj[city.countryFrom.toUpperCase()]) {
          city.error = commonHelper.COUNTRYFROMNOTFOUND;
          return async.nextTick(function () {
            callback(null, city);
          });
        }
        if (city.isToInternational && !countryObj[city.countryTo.toUpperCase()]) {
          city.error = commonHelper.COUNTRYNOTFOUND;
          return async.nextTick(function () {
            callback(null, city);
          });
        }
        if (city.isFromInternational && city.isToInternational) {
          city.error = commonHelper.CITYFROMORTOKZ;
          return async.nextTick(function () {
            callback(null, city);
          });
        }
        if (city.isFromInternational && !city.toKz) {
          city.error = commonHelper.CITYFROMORTOKZ;
          return async.nextTick(function () {
            callback(null, city);
          });
        }
        if (city.isToInternational && !city.fromKz) {
          city.error = commonHelper.CITYFROMORTOKZ;
          return async.nextTick(function () {
            callback(null, city);
          });
        }
        setTimeout(function () {
          if (commonHelper.getReqStored(req, delivery) > timestamp) {
            return callback({abort: true});
          }
          //у dpd разные запросы и разные id города в разных калькуляторах
          async.series([
            function (callback) {
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
                city.cookie = cookie;
                callback();
              });
            },
            function (callback) {
              if (city.isFromInternational) {
                return callback(null, {isCountry: true, success: true, foundCities: [countryObj[city.countryFrom.toUpperCase()]]});
              }
              getCity(city.from, city.countryFrom, city.isToInternational, city.cookie, callback);
            },
            function (callback) {
              if (city.isToInternational) {
                return callback(null, {isCountry: true, success: true, foundCities: [countryObj[city.countryTo.toUpperCase()]]});
              }
              getCity(city.to, city.countryTo, city.isFromInternational, city.cookie, callback);
            }
          ], function (err, foundCities) { //ошибки быть не может
            city.fromJson = foundCities[1];
            city.toJson = foundCities[2];
            callback(null, city);
          });
        }, commonHelper.randomInteger(500, 1000));
      }, callback);
    }],
    parseCities: ['getCities', 'getCountries', function (results, callback) {
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
                  cookie: item.cookie,
                  req: getInternationalReq(fromCity, toCity, item.fromJson.isCountry, item.toJson.isCountry),
                  isFromCountry: item.fromJson.isCountry,
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
                  cookie: item.cookie,
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
        if (commonHelper.getReqStored(req, delivery) > timestamp) {
          return callback({abort: true});
        }
        if (item.error) {
          return async.nextTick(function () {
            callback(null, item);
          });
        }
        async.series([
          function (cb) {
            getCalcResult(item.cookie, item.req, cb);
          },
          function (cb) {
            var req = _.extend({}, item.req);
            req['form.cityPickupType'] = 1;
            getCalcResult(item.cookie, req, cb);
          },
          function (cb) {
            var req = _.extend({}, item.req);
            req['form.cityDeliveryType'] = 1;
            getCalcResult(item.cookie, req, cb);
          },
          function (cb) {
            var req = _.extend({}, item.req);
            req['form.cityPickupType'] = 1;
            req['form.cityDeliveryType'] = 1;
            getCalcResult(item.cookie, req, cb);
          }
        ], function (err, rslt) {
          if (rslt[0].success) {
            item.tariffs = item.tariffs.concat(rslt[0].tariffs);
          }
          if (rslt[1].success) {
            item.tariffs = item.tariffs.concat(rslt[1].tariffs);
          }
          if (rslt[2].success) {
            item.tariffs = item.tariffs.concat(rslt[2].tariffs);
          }
          if (rslt[3].success) {
            item.tariffs = item.tariffs.concat(rslt[3].tariffs);
          }
          if (!item.tariffs.length) {
            item.error = rslt[0].error || rslt[1].error || rslt[2].error || rslt[3].error || commonHelper.getNoResultError();
          }
          return callback(null, item);
        });
      }, callback);
    }],
    internationalRequests: ['parseCities', function (results, callback) {
      async.mapLimit(internationalRequests, 1, function (item, callback) {
        if (commonHelper.getReqStored(req, delivery) > timestamp) {
          return callback({abort: true});
        }
        if (item.error) {
          return async.nextTick(function () {
            callback(null, item);
          });
        }
        async.series([
          function (cb) {
            getIntCalcResult(item.cookie, item.req, cb);
          },
          function (cb) {
            var req = _.extend({}, item.req);
            if (item.isFromCountry) {
              req.deliveryCityType = 'Т';
            } else {
              req.pickupCityType = 'Т';
            }
            getIntCalcResult(item.cookie, req, cb);
          }
        ], function (err, rslt) {
          if (rslt[0].success) {
            item.tariffs = item.tariffs.concat(rslt[0].tariffs);
          }
          if (rslt[1].success) {
            item.tariffs = item.tariffs.concat(rslt[1].tariffs);
          }
          if (!item.tariffs.length) {
            item.error = rslt[0].error || rslt[1].error || commonHelper.getNoResultError();
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
      items: err ? [] : results.requests.concat(results.internationalRequests),
      callback: callback
    });
  });
};