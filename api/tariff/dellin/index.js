var responseHelper = require('../../helpers/response');
var deliveryHelper = require('../../helpers/delivery');
var commonHelper = require('../../helpers/common');
var async = require('async');
var moment = require('moment');
var request = commonHelper.request;
var cheerio = require('cheerio');
var config = require('../../../conf');
var _ = require('underscore');
var logger = require('../../helpers/logger');
var delivery = 'dellin';

var getReq = function (from, to) {
  from = from || {};
  to = to || {};
  return {
    requestType: 'cargo-single',
    delivery_type: 1,
    length: 0.10,
    width: 0.1,
    height: 0.1,
    sized_weight: 1,
    sized_volume: 0.01,
    max_length: '',
    max_width: '',
    max_height: '',
    max_weight: '',
    quantity: '',
    total_weight: '',
    oversized_weight: '',
    total_volume: '',
    oversized_volume: '',
    cargoUID: '',
    packedUID: '',
    stated_value: 0.00,
    derival_point: encodeURIComponent(from.label),
    derival_point_code: from.code,
    derival_variant: 'terminal',
    derival_terminal_city_code: from.code,
    derival_terminal_id: '',
    derival_worktime_start: '09:00',
    derival_worktime_end: '17:00',
    arrival_point: encodeURIComponent(to.label),
    arrival_point_code: to.code,
    arrival_variant: 'terminal',
    arrival_terminal_city_code: to.code,
    arrival_terminal_id: '',
    arrival_worktime_start: '09:00',
    arrival_worktime_end: '17:00',
    produceDate: moment().add(7, 'days').format('DD.MM.YYYY'),
    //derival_loading_unloading_parameters[0xadf1fc002cb8a9954298677b22dbde12]:
    //derival_loading_unloading_parameters[0x9a0d647ddb11ebbd4ddaaf3b1d9f7b74]:
    oversized_weight_avia: '',
    oversized_volume_avia: '',
    //arrival_loading_unloading_parameters[0xadf1fc002cb8a9954298677b22dbde12]:
    //arrival_loading_unloading_parameters[0x9a0d647ddb11ebbd4ddaaf3b1d9f7b74]:
    derival_point_noSendDoor: 0
  };
};

var getCity = function (city, callback) {
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
    if (!Array.isArray(json)) {
      result.message = commonHelper.getCityJsonError(new Error("Неверный тип данных в ответе"));
      return callback(null, result);
    }
    if (!json.length) {
      result.message = commonHelper.getCityNoResultError();
    } else if (json.length === 1) {
      result.foundCities = json;
      result.success = true;
    } else {
      var region = commonHelper.getRegionName(city);
      var founds = commonHelper.findInArray(json, trim, 'fullName', true);
      var byRegions = [];
      if (region) {
        byRegions = commonHelper.findInArray(founds.length ? founds : json, region, 'fullName');
      }
      if (byRegions.length) {
        result.foundCities = byRegions;
      } else {
        result.foundCities = founds.length ? [founds[0]] : [json[0]];
      }
      result.success = true;
    }
    result.cities = json;
    callback(null, result);
  });
};

var getTerminal = function (item, type, callback) {
  var deliveryData = deliveryHelper.get(delivery);
  var opts = _.extend({}, deliveryData.terminalsUrl);
  opts.uri += 'requestType=cargo-single&';
  opts.uri += 'direction=' + type + '&';
  opts.uri += 'closestTerminal=1&';
  opts.uri += ('derival_point_code=' + item.fromJson.code + '&');
  opts.uri += ('arrival_point_code=' + item.toJson.code);
  setTimeout(function () {
    async.retry(config.retryOpts, function (callback) {
      request(opts, callback)
    }, function (err, r, b) {
      var result = {};
      if (err) {
        return callback(null, result);
      }
      var json = null;
      try {
        json = JSON.parse(b);
      } catch (e) {}

      if (!json) {
        return callback(null, result);
      }

      if (!Array.isArray(json)) {
        return callback(null, result);
      }

      result = json[0] || {};

      return callback(null, result);
    });
  }, commonHelper.randomInteger(500, 1000));
};

var getDeliveryTimeKey = function (type) {
  return type === 'intercity' ? '' : '_' + type;
};

var getServicePreffix = function (type) {
  var result = '';
  switch (type) {
    case 'intercity':
      break;
    case 'avia':
      result = 'Авиа ';
      break;
    case 'express':
      result = 'Экспресс ';
      break;
  }
  return result;
};

var getTariffs = function (type, json) {
  var deliveryCost = commonHelper.parseFloat(json.insurance) + commonHelper.parseFloat(json[type]) + commonHelper.parseFloat(json.fatal_informing);
  var tariffs = [{
      service: getServicePreffix(type) + 'ДД',
      cost: commonHelper.parseFloat(json.derivalToDoor) + commonHelper.parseFloat(json.arrivalToDoor) + deliveryCost,
      deliveryTime: json['period_door_door' + getDeliveryTimeKey(type)] || ''
    },
    {
      service: getServicePreffix(type) + 'ДС',
      cost: commonHelper.parseFloat(json.derivalToDoor) + commonHelper.parseFloat(json.arrival_terminal_price) + deliveryCost,
      deliveryTime: json['period_door_terminal' + getDeliveryTimeKey(type)] || ''
    },
    {
      service: getServicePreffix(type) + 'СД',
      cost: commonHelper.parseFloat(json.arrivalToDoor) + commonHelper.parseFloat(json.derival_terminal_price) + deliveryCost,
      deliveryTime: json['period_terminal_door' + getDeliveryTimeKey(type)] || ''
    },
    {
      service: getServicePreffix(type) + 'СС',
      cost: commonHelper.parseFloat(json.derival_terminal_price) + commonHelper.parseFloat(json.arrival_terminal_price) + deliveryCost,
      deliveryTime: json['period_terminal_terminal' + getDeliveryTimeKey(type)] || ''
    }
  ];
  return tariffs;
};

var getCityName = function (city) {
  var result = '';
  if (city.nameString) {
    result += city.nameString;
  }
  if (city.uString) {
    result +=  ', ' + city.uString;
  }
  if (city.regionString) {
    result += ', ' + city.regionString;
  }
  return result;
};

module.exports = function (req, cities, callback) {
  var deliveryData = deliveryHelper.get(delivery);
  var requests = [];
  var cityObj = {};
  var timestamp = callback ? new Date().getTime*2 : global[delivery];
  async.auto({
    getCities: function (callback) {
      async.mapSeries(cities, function (city, callback) {
        if (!city.from || !city.to) {
          city.error = commonHelper.CITIESREQUIRED;
          return async.nextTick(function () {
            callback(null, city);
          });
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
              getCity(city.from, callback);
            },
            function (callback) {
              if (typeof  cityObj[city.to + city.countryTo] !== 'undefined') {
                return callback(null);
              }
              getCity(city.to, callback);
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
                fromJson: fromCity,
                toJson: toCity,
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
          obj.req['sized_weight'] = weight;
          requests.push(obj);
        });
      });
      callback(null);
    }],
    getTerminals: ['parseCities', function (results, callback) {
      var cityCodeObj = {};
      async.mapSeries(requests, function (item, callback) {
        if (global[delivery] > timestamp) {
          return callback({abort: true});
        }
        if (item.error) {
          return async.nextTick(function () {
            callback(null, item);
          });
        }
        async.parallel([
          function (callback) {
            if (typeof  cityCodeObj[item.fromJson.code] !== 'undefined') {
              return callback(null);
            }
            getTerminal(item, 'derrival', callback);
          },
          function (callback) {
            if (typeof  cityCodeObj[item.toJson.code] !== 'undefined') {
              return callback(null);
            }
            getTerminal(item, 'arrival', callback);
          }
        ], function (err, terminals) {
          if (typeof  cityCodeObj[item.fromJson.code] === 'undefined') {
            cityCodeObj[item.fromJson.code] = terminals[0];
          }
          if (typeof  cityCodeObj[item.toJson.code] === 'undefined') {
            cityCodeObj[item.toJson.code] = terminals[1];
          }
          item.req.derival_terminal_id = cityCodeObj[item.fromJson.code].id || '';
          item.req.arrival_terminal_id = cityCodeObj[item.toJson.code].id || '';
          callback(null, item);
        });
      }, callback);
    }],
    requests: ['getTerminals', function (results, callback) {
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
        for (var key in item.req) {
          opts.uri += (key + '=' + item.req[key] + '&');
        }
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

            if (json.intercity) {
              item.tariffs = item.tariffs.concat(getTariffs('intercity', json));
            }
            if (json.avia) {
              item.tariffs = item.tariffs.concat(getTariffs('avia', json));
            }
            if (json.express) {
              item.tariffs = item.tariffs.concat(getTariffs('express', json));
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