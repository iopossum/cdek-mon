var responseHelper = require('../../helpers/response');
var deliveryHelper = require('../../helpers/delivery');
var commonHelper = require('../../helpers/common');
var async = require('async');
var request = commonHelper.request;
var cheerio = require('cheerio');
var config = require('../../../conf');
var _ = require('underscore');
var logger = require('../../helpers/logger');
var delivery = 'tnt';

var getReq = function (from, to) {
  from = from || {};
  to = to || {};
  return {
    locale: "ru_RU",
    quote: {
      channel: "NBT",
      collectioncountry: from.countryCode,
      collectioncountrycurrencycode: "RUB",
      collectioncountrylanguagecode: "RU",
      collectiondate: "",
      collectionpostcode: from.postcodeRangeFrom,
      collectionprovince: "",
      collectiontown: from.city,
      deliverycountry: to.countryCode,
      deliverycountrycurrencycode: "RUB",
      deliverycountrylanguagecode: "RU",
      deliverypostcode: to.postcodeRangeFrom,
      deliveryprovince: "",
      deliverytown: to.city,
      earliestcollectiontime: "00:00:00",
      latestcollectiontime: "23:59:59",
      lengthuom: "m",
      packagetype: "BOX",
      quotetype: "IND",
      receiverlocaltime: new Date(),
      senderlocaltime: new Date(),
      termsofpayment: "S",
      totalnumberofitems: 1,
      totalvolume: 0.001,
      totalweight: 1,
      volumeuom: "m3",
      weightuom: "kg"
    }
  };
};

var getRegionName = function (city) {
  var region = null;
  var splits = city.split(',');
  if (splits.length > 1) {
    region = splits[1].split(' ')[1] || splits[1].split(' ')[0];
  }
  return region;
};

var getCity = function (city, cityFull, condition, callback) {
  var deliveryData = deliveryHelper.get(delivery);
  var opts = Object.assign({}, deliveryData.citiesUrl);
  opts.uri += city;
  if (condition) {
    opts.uri += ('&' + condition);
  }
  async.retry(config.retryOpts, function (callback) {
    request(opts, callback)
  }, function (err, r, b) {
    var result = {
      city: city,
      success: false
    };
    if (err) {
      result.message = commonHelper.getResponseError(err);
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
    if (!Array.isArray(json)) {
      result.message = commonHelper.getCityJsonError(new Error("Неверный тип данных в ответе. Отсутствует массив"));
      return callback(null, result);
    }
    if (!json.length) {
      result.message = commonHelper.getCityNoResultError();
    } else if (json.length === 1) {
      result.foundCities = json;
      result.success = true;
    } else {
      var region = getRegionName(cityFull);
      var country = commonHelper.getCountryName(cityFull);
      if (country === 'Russia') {
        country = "Russian Federation";
      }
      var founds = commonHelper.findInArray(json, city, 'city', true);
      var foundsWithRegion = [];
      if (founds.length > 1) {
        if (region) {
          foundsWithRegion = commonHelper.findInArray(founds, region, 'region');
        }
        if (!foundsWithRegion.length && country) {
          foundsWithRegion = commonHelper.findInArray(founds, country, 'countryName');
        }
      }
      if (foundsWithRegion.length) {
        result.foundCities = foundsWithRegion.length > 4 ? foundsWithRegion.slice(0, 4) : foundsWithRegion;
      } else if (founds.length) {
        result.foundCities = founds.length > 4 ? founds.slice(0, 4) : founds;
      } else {
        result.foundCities = [json[0]];
      }
      result.success = true;
    }
    result.cities = json;
    callback(null, result);
  });
};

var getPackageType = function (weight) {
  weight = commonHelper.parseFloat(weight);
  var type = "";
  if (weight < 1) {
    type = "ENV";
  } else if (weight >= 1 && weight < 70) {
    type = "BOX";
  } else {
    type = "PAL";
  }
  return type;
};

var getFullCity = function (tntCity) {
  var city = tntCity.city;
  if (tntCity.region) {
    city += (', ' + tntCity.region);
  }
  if (tntCity.countryName) {
    city += (', ' + tntCity.countryName);
  }
  return city;
};

var hackCity = function (eng, trim) {
  eng = eng.replace(/shch/gi, 'sch');
  eng = eng.replace(/Ye/gi, 'e');
  eng = eng.replace(/^r-n /i, '');
  eng = eng.replace(/yo/gi, 'e');
  eng = eng.replace(/x/gi, 'ks');

  if (/рьи/.test(trim)) {
    eng = eng.replace(/ri/i, 'rji');
  }
  if (/рье/.test(trim)) {
    eng = eng.replace(/rye/i, 'rje');
  }
  if (/льск/.test(trim)) {
    eng = eng.replace(/lsk/i, "l'sk");
  }
  if (/ой/.test(trim)) {
    eng = eng.replace(/oy/i, 'oj');
  }
  if (/рьск/.test(trim)) {
    eng = eng.replace(/rsk/i, "r'sk");
  }
  if (/ий/.test(trim)) {
    eng = eng.replace(/y$/i, "ij");
    eng = eng.replace(/y /i, "ij ");
  }
  if (trim.split(' ').length < 2) {
    var splits = eng.split(' ');
    if (splits.length > 1) {
      eng = splits[0];
    }
  }
  return eng;
};

module.exports = function (req, cities) {
  var deliveryData = deliveryHelper.get(delivery);
  var requests = [];
  var cityObj = {};
  var timestamp = global[delivery];
  async.auto({
    getCities: function (callback) {
      async.mapSeries(cities, function (city, callback) {
        if (!city.from || !city.to) {
          city.error = commonHelper.CITIESREQUIRED;
          return async.nextTick(function () {
            callback(null, city);
          });
        }
        if (!city.fromEngName) {
          city.error = commonHelper.CITYFROMNOTFOUND;
          return async.nextTick(function () {
            callback(null, city);
          });
        }
        if (!city.toEngName) {
          city.error = commonHelper.CITYTONOTFOUND;
          return async.nextTick(function () {
            callback(null, city);
          });
        }
        if (city.countryFrom) {
          city.error = commonHelper.COUNTRYFROMRUSSIA;
          return async.nextTick(function () {
            callback(null, city);
          });
        }
        if (city.fromEngName) {
          city.fromEngName = hackCity(city.fromEngName, commonHelper.getCity(city.from));
        }
        if (city.toEngName) {
          city.toEngName = hackCity(city.toEngName, commonHelper.getCity(city.to));
        }
        setTimeout(function () {
          if (global[delivery] > timestamp) {
            return callback({abort: true});
          }
          async.parallel([
            function (callback) {
              if (typeof  cityObj[city.from + city.countryFrom] !== 'undefined') {
                return callback(null);
              }
              getCity(city.fromEngName, city.fromEngFullName, 'countryCode=RU', callback);
            },
            function (callback) {
              if (typeof  cityObj[city.to + city.countryTo] !== 'undefined') {
                return callback(null);
              }
              getCity(city.toEngName, city.toEngFullName, '', callback);
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
    },
    parseCities: ['getCities', function (results, callback) {
      logger.tariffsInfoLog(delivery, results.getCities, 'getCities');
      var tempRequests = [];
      results.getCities.forEach(function (item) {
        if (item.error) {
          requests = requests.concat(commonHelper.getResponseArray(req.body.weights, item, delivery, item.error));
        } else if (!item.fromJson.success) {
          item.initialCityFrom = item.from;
          item.initialCityTo = item.to;
          item.from = item.fromEngName;
          item.to = item.toEngName;
          requests = requests.concat(commonHelper.getResponseArray(req.body.weights, item, delivery, item.fromJson.message));
        } else if (!item.toJson.success) {
          item.initialCityFrom = item.from;
          item.initialCityTo = item.to;
          item.from = item.fromEngName;
          item.to = item.toEngName;
          requests = requests.concat(commonHelper.getResponseArray(req.body.weights, item, delivery, item.toJson.message));
        } else {
          item.fromJson.foundCities.forEach(function (fromCity) {
            item.toJson.foundCities.forEach(function (toCity) {
              tempRequests.push({
                city: {
                  initialCityFrom: item.from,
                  initialCityTo: item.to,
                  from: getFullCity(fromCity),
                  to: getFullCity(toCity),
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
          obj.req.quote.totalweight = weight;
          obj.req.quote.packagetype = getPackageType(weight);
          requests.push(obj);
        });
      });
      callback(null);
    }],
    requests: ['parseCities', function (results, callback) {
      async.mapLimit(requests, 2, function (item, callback) {
        if (global[delivery] > timestamp) {
          return callback({abort: true});
        }
        if (item.error) {
          return async.nextTick(function () {
            callback(null, item);
          });
        }
        var opts = _.extend({}, deliveryData.calcUrl);
        opts.json = item.req;
        setTimeout(function () {
          async.retry(config.retryOpts, function (callback) {
            request(opts, callback)
          }, function (err, r, b) {
            if (err) {
              item.error = commonHelper.getResponseError(err);
              return callback(null, item);
            }
            if (!b) {
              item.error = commonHelper.getResponseError(new Error("Пустой ответ от севрера"));
              return callback(null, item);
            }
            if (!b.quote) {
              item.error = commonHelper.getResponseError(new Error("Отсутствует обязательный параметр quote"));
              return callback(null, item);
            }
            if (!b.quote.orders) {
              item.error = commonHelper.getResponseError(new Error("Отсутствует обязательный параметр quote.orders"));
              return callback(null, item);
            }
            if (!Array.isArray(b.quote.orders)) {
              item.error = commonHelper.getResponseError(new Error("Неверный тип данных. Отсутствует массив тарифов"));
              return callback(null, item);
            }
            item.tariffs = b.quote.orders.map(function (item) {
              return commonHelper.createTariff(item.productname, commonHelper.rounded(commonHelper.parseFloat(item.price) - commonHelper.parseFloat(item.vat), 100), item.transitdaysexcludingholidays);
            });
            if (!item.tariffs.length) {
              item.error = commonHelper.getNoResultError();
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
      items: results.requests || []
    });
  });
};