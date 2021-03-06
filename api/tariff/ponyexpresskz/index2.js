var responseHelper = require('../../helpers/response');
var deliveryHelper = require('../../helpers/delivery');
var commonHelper = require('../../helpers/common');
var async = require('async');
var request = commonHelper.request;
var cheerio = require('cheerio');
var config = require('../../../conf');
var _ = require('underscore');
var logger = require('../../helpers/logger');
var delivery = 'ponyexpresskz';

var getReq = function (from, to, isCountry) {
  return {
    'parcel[currency_id]': 6,
    'parcel[tips_iblock_code]': 'form_tips',
    'parcel[tips_section_code]': 'pegas_kz',
    'parcel[direction]': isCountry ? 'outer' : 'inner',
    'parcel[from_country]': isCountry ? from : '',
    'parcel[from_city]': !isCountry ? from : '',
    'parcel[to_country]': isCountry ? to : '',
    'parcel[to_city]': !isCountry ? to : '',
    'parcel[weight]': 1,
    b_volume_l: '',
    b_volume_h: '',
    b_volume_w: '',
    c_volume_l: '',
    c_volume_d: '',
    t_volume_h: '',
    t_volume_b: '',
    t_volume_a: '',
    t_volume_c: '',
    'parcel[usecurrentdt]': 0,
    'parcel[kgo]': 0,
    'parcel[og]': 0,
    'parcel[isdoc]':0
  }
};

var getCity = function (city, isCountry, callback) {
  var deliveryData = deliveryHelper.get(delivery);
  var opts = Object.assign({}, isCountry ? deliveryData.countriesUrl : deliveryData.citiesUrl);
  var trim = commonHelper.getCity(city);
  opts.uri += encodeURIComponent(trim);
  async.retry(config.retryOpts, function (callback) {
    request(opts, callback)
  }, function (err, r, b) {
    var result = {
      city: city,
      cityTrim: trim,
      isCountry: isCountry,
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
      //result.message = isCountry ? commonHelper.getCountryNoResultError() : commonHelper.getCityNoResultError();
    } else if (json.length === 1) {
      result.foundCities = json;
      result.success = true;
    } else {
      var region = commonHelper.getRegionName(city);
      var founds = [];
      if (region) {
        json.forEach(function (item) {
          if (new RegExp(region, 'gi').test(item)) {
            founds.push(item);
          }
        });
      }
      result.foundCities = founds.length ? founds : [json[0]];
      result.success = true;
    }
    result.cities = json;
    callback(null, result);
  });
};

module.exports = function (req, cities, callback) {
  var deliveryData = deliveryHelper.get(delivery);
  var requests = [];
  var cityObj = {};
  var cityIntObj = {};
  var timestamp = callback ? new Date().getTime*2 : commonHelper.getReqStored(req, delivery);
  var sng = commonHelper.SNG.concat(commonHelper.RUSSIA).concat(['азербайджан', 'армения', 'беларусь', 'казахстан', 'кыргызстан', 'молдавия', 'молдова', 'узбекистан', 'украина', 'латвия', 'литва', 'эстония', 'грузия']);
  cities.forEach(function (item) {
    item.countryFrom = item.countryFrom || 'Россия';
    item.countryTo = item.countryTo || 'Россия';
    if (sng.indexOf(item.countryFrom.toLowerCase()) === -1) {
      item.isFromInternational = true;
    } else if (item.countryFrom.toLowerCase() === 'казахстан') {
      item.fromKz = true;
    }
    if (sng.indexOf(item.countryTo.toLowerCase()) === -1) {
      item.isToInternational = true;
    } else if (item.countryTo.toLowerCase() === 'казахстан') {
      item.toKz = true;
    }
  });
  async.auto({
    getCities: [function (callback) {
      async.mapSeries(cities, function (city, callback) {
        if (!city.from && !city.countryFrom && !city.countryTo) {
          city.error = commonHelper.CITYORCOUNTRYFROMREQUIRED;
          return async.nextTick(function () {
            callback(null, city);
          });
        }
        if (!city.to && !city.countryTo && !city.countryFrom) {
          city.error = commonHelper.CITYORCOUNTRYTOREQUIRED;
          return async.nextTick(function () {
            callback(null, city);
          });
        }
        if (!city.countryFrom && !city.countryTo) {
          if (!city.from && !city.to) {
            city.error = commonHelper.CITYORCOUNTRYREQUIRED;
            return async.nextTick(function () {
              callback(null, city);
            });
          }
        }
        setTimeout(function () {
          if (commonHelper.getReqStored(req, delivery) > timestamp) {
            return callback({abort: true});
          }
          var cityOpts = {
            from: city.from,
            to: city.to,
            isCountry: false
          };
          if (city.isFromInternational || city.isToInternational) {
            cityOpts.from = city.countryFrom || "Россия";
            cityOpts.to = city.countryTo || "Россия";
            cityOpts.isCountry = true;
          }
          async.parallel([
            function (callback) {
              if (cityOpts.isCountry) {
                if (typeof cityIntObj[city.from + city.countryFrom] !== 'undefined') {
                  return callback(null);
                }
              } else if (typeof cityObj[city.from + city.countryFrom] !== 'undefined') {
                return callback(null);
              }
              getCity(cityOpts.from, cityOpts.isCountry, callback);
            },
            function (callback) {
              if (cityOpts.isCountry) {
                if (typeof cityIntObj[city.to + city.countryTo] !== 'undefined') {
                  return callback(null);
                }
              } else if (typeof cityObj[city.to + city.countryTo] !== 'undefined') {
                return callback(null);
              }
              getCity(cityOpts.to, cityOpts.isCountry, callback);
            }
          ], function (err, foundCities) { //ошибки быть не может
            if (cityOpts.isCountry) {
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
            };
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
                req: getReq(fromCity, toCity, item.fromJson.isCountry),
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
          obj.req['parcel[weight]'] = weight;
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
          }, function (err, r, b) {
            if (err) {
              item.error = commonHelper.getResponseError(err);
              return callback(null, item);
            }
            var json = null;
            try {
              json = JSON.parse(b);
            } catch (e) {
              item.error = commonHelper.getResponseError(e);
            }
            if (!json) {
              return callback(null, item);
            }
            if (!json.result) {
              item.error = commonHelper.getResponseError(new Error("Неверный тип данных в ответе. Отсутствует параматер result"));
              return callback(null, item);
            }
            if (typeof json.result.calculation !== 'undefined' && !json.result.calculation) {
              item.error = commonHelper.getNoResultError();
              return callback(null, item);
            }
            for (var key in json.result) {
              item.tariffs.push({
                service: json.result[key].servise,
                cost: json.result[key].tariff,
                deliveryTime: json.result[key].delivery
              });
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