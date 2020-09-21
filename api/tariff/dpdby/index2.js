var responseHelper = require('../../helpers/response');
var deliveryHelper = require('../../helpers/delivery');
var commonHelper = require('../../helpers/common');
var async = require('async');
var request = commonHelper.request;
var cheerio = require('cheerio');
var config = require('../../../conf');
var _ = require('underscore');
var logger = require('../../helpers/logger');
var delivery = 'dpdby';
var directCountries = commonHelper.SNG.concat(commonHelper.RUSSIA);

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
  var opts = Object.assign({}, deliveryData.citiesUrl);
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
      if (!founds.length) {
        founds = commonHelper.findInArray(json.geonames, country, 'countryName');
      }
      result.foundCities = founds.length ? founds.slice(0, 1) : json.geonames.slice(0, 1);
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
          if ($(tr).hasClass('shownRows') || $(tr).hasClass('hiddenRows')) {
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

module.exports = function (req, cities, callback) {
  var deliveryData = deliveryHelper.get(delivery);
  var requests = [];
  var internationalRequests = [];
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
    getCities: ['getCookie', function (results, callback) {
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
        if (directCountries.indexOf(city.countryFrom.toLowerCase()) === -1) {
          city.error = /*commonHelper.COUNTRYFROMNOTFOUND*/"Международная доставка недоступна";
          return async.nextTick(function () {
            callback(null, city);
          });
        }
        if (directCountries.indexOf(city.countryTo.toLowerCase()) === -1) {
          city.error = /*commonHelper.COUNTRYNOTFOUND*/"Международная доставка недоступна";
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
                if (!cookie) {
                  return callback();
                }
                city.cookie = cookie;
                callback(null);
              });
            },
            function (callback) {
              getCity(city.from, city.countryFrom, city.cookie, callback);
            },
            function (callback) {
              getCity(city.to, city.countryTo, city.cookie, callback);
            }
          ], function (err, foundCities) { //ошибки быть не может
            city.fromJson = foundCities[1];
            city.toJson = foundCities[2];
            callback(null, city);
          });
        }, commonHelper.randomInteger(500, 1000));
      }, callback);
    }],
    parseCities: ['getCities', function (results, callback) {
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
        var opts = _.extend({}, deliveryData.calcUrl);
        opts.headers.Cookie = item.cookie;
        getCalcResult(item, opts, callback);
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
        var opts = _.extend({}, deliveryData.calcInternationalUrl);
        opts.headers.Cookie = results.getCookie;
        opts.headers['X-Requested-With'] = 'XMLHttpRequest';
        getIntCalcResult(item, opts, callback);
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

/*
module.exports = function (req, cities, callback) {
  var deliveryData = deliveryHelper.get(delivery);
  var results = [];
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
  });
  async.mapSeries(cities, function (city, callback) {
    if (!city.from && !city.to) {
      city.error = commonHelper.CITIESREQUIRED;
      results = results.concat(commonHelper.getResponseArray(req.body.weights, city, delivery, city.error));
      return async.nextTick(function () {
        callback(null, city);
      });
    }
    if (!city.from && !city.countryFrom) {
      city.error = commonHelper.CITYORCOUNTRYFROMREQUIRED;
      results = results.concat(commonHelper.getResponseArray(req.body.weights, city, delivery, city.error));
      return async.nextTick(function () {
        callback(null, city);
      });
    }
    if (!city.to && !city.countryTo) {
      city.error = commonHelper.CITYORCOUNTRYTOREQUIRED;
      results = results.concat(commonHelper.getResponseArray(req.body.weights, city, delivery, city.error));
      return async.nextTick(function () {
        callback(null, city);
      });
    }
    if (directCountries.indexOf(city.countryFrom.toLowerCase()) === -1) {
      city.error = /!*commonHelper.COUNTRYFROMNOTFOUND*!/"Международная доставка недоступна";
      results = results.concat(commonHelper.getResponseArray(req.body.weights, city, delivery, city.error));
      return async.nextTick(function () {
        callback(null, city);
      });
    }
    if (directCountries.indexOf(city.countryTo.toLowerCase()) === -1) {
      city.error = /!*commonHelper.COUNTRYNOTFOUND*!/"Международная доставка недоступна";
      results = results.concat(commonHelper.getResponseArray(req.body.weights, city, delivery, city.error));
      return async.nextTick(function () {
        callback(null, city);
      });
    }
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
          city.cookie = cookie;
          callback(null, cookie);
        });
      },
      getCities: ['getCookie', function (rslt, callback) {
        async.series([
          function (callback) {
            setTimeout(function () {
              getCity(city.from, city.countryFrom, city.cookie, callback);
            }, commonHelper.randomInteger(500, 1000));
          },
          function (callback) {
            setTimeout(function () {
              getCity(city.to, city.countryTo, city.cookie, callback);
            }, commonHelper.randomInteger(500, 1000));
          }
        ], function (err, foundCities) { //ошибки быть не может
          city.fromJson = foundCities[0];
          city.toJson = foundCities[1];
          if (!city.fromJson.success || !city.toJson.success) {
            results = results.concat(commonHelper.getResponseArray(req.body.weights, city, delivery, city.fromJson.message || city.toJson.message));
            return async.nextTick(function () {
              callback(null, city);
            });
          }
          var requests = [];
          city.fromJson.foundCities.forEach(function (fromCity) {
            city.toJson.foundCities.forEach(function (toCity) {
              requests.push({
                city: {
                  initialCityFrom: city.from,
                  initialCityTo: city.to,
                  from: getCityName(fromCity),
                  to: getCityName(toCity),
                  countryFrom: city.countryFrom,
                  countryTo: city.countryTo
                },
                cookie: city.cookie,
                req: getReq(fromCity, toCity),
                delivery: delivery,
                tariffs: []
              });
            });
          });
          requests.forEach(function (item) {
            req.body.weights.forEach(function (weight) {
              item.weight = weight;
              item.req['form.weightStr'] = weight;
            });
          });
          callback(null, requests);
        });
      }],
      requests: ['getCities', function (rslt, callback) {
        async.mapLimit(rslt.getCities, 1, function (item, callback) {
          if (commonHelper.getReqStored(req, delivery) > timestamp) {
            return callback({abort: true});
          }
          var opts = _.extend({}, deliveryData.calcUrl);
          opts.headers.Cookie = item.cookie;
          getCalcResult(item, opts, callback);
        }, function (err, rslt) {
          results = results.concat(rslt);
          callback();
        });
      }]
    }, callback);
  }, function (err) {
    commonHelper.saveResults(req, err, {
      delivery: delivery,
      timestamp: timestamp,
      cities: cities,
      items: err ? [] : results,
      callback: callback
    });
  });
};*/
