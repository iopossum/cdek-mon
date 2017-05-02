var responseHelper = require('../../helpers/response');
var deliveryHelper = require('../../helpers/delivery');
var commonHelper = require('../../helpers/common');
var async = require('async');
var request = commonHelper.request;
var cheerio = require('cheerio');
var config = require('../../../conf');
var _ = require('underscore');
var moment = require('moment');
var logger = require('../../helpers/logger');
var delivery = 'vozovoz';

var getReq = function (typeFrom, typeTo, service, from, to) {
  return {
    service: service,
    "session_id": (new Date().getTime()/1000).toFixed(0),
    "gateway": {
      "dispatch":{
        "location":{
          "id": from.guid,
          "value": from.name
        },
        "accesspoint":{
          "type": typeFrom,
          "address":{"id":"","value":""},
          "terminal":{
            "id":"",
            "value":""
          },
          "shippingterm":{
            "date":"",
            "date_submit":"",
            "timestart":{"id":"","value":""},
            "timeend":{"id":"","value":""}
          },
          "driverComment":""
        }
      },
      "destination":{
        "location":{
          "id": to.guid,
          "value": to.name
        },
        "accesspoint":{
          "type": typeTo,
          "address":{"id":"","value":""},
          "terminal":{
            "id":"",
            "value":""
          },
          "shippingterm":{
            "date":"",
            "date_submit":"",
            "express":false,
            "timestart":{"id":"","value":""},
            "timeend":{"id":"","value":""}
          },
          "driverComment":""
        }
      }
    },
    "cargo":{
      "type":{
        "cargo":true,
        "correspondence":false
      },
      "cargotype":"dimensions",
      "category":{
        "id":"",
        "value":"Выбор категории груза"
      },
      "dimensions":{
        "volume":"0.1",
        "weight":"1",
        "place":"1",
        "standardDims":true,
        "length":0.1,
        "width":0.1,
        "height":0.1,
        "mass":0.1
      },
      "wrapping":{
        "hardBoxVolume":{
          "used":false,
            "value":"0.1"
        },
        "hardPackageVolume":{
          "used":false,
            "value":"0.1"
        },
        "palletCollar":{
          "used":false,
            "value":"0.1"
        },
        "extraPackageVolume":{
          "used":false,
            "value":"0.1"
        },
        "bubbleFilmVolume":{
          "used":false,
            "value":"0.1"
        },
        "box1":{
          "used":false,
            "value":"1"
        },
        "box2":{
          "used":false,
            "value":"1"
        },
        "box3":{
          "used":false,
            "value":"1"
        },
        "box4":{
          "used":false,
            "value":"1"
        },
        "bag1":{
          "used":false,
            "value":"1"
        },
        "bag2":{
          "used":false,
            "value":"1"
        },
        "safePackage":{
          "used":false,
            "value":"1"
        }
      },
      "parcel":{
        "package":"box1",
          "weight":"0.9"
      },
      "insurance":"",
        "yourID":"",
        "insurance_ndv":{
        "insurance_ndv":false,
          "insurance_ndv_shadow":"false"
      }
  },
    "needLoading":{
    "dispatch":{
      "using":false,
        "loading_floor_checkbox":false,
        "floor":"",
        "has_lift":false
    },
    "destination":{
      "using":false,
        "unloading_floor_checkbox":false,
        "floor":"",
        "has_lift":false
    }
  },
    "additional":{
    "specificLoading":{
      "using":false,
        "dispatch":{},
      "destination":{}
    },
    "retrieveAD":{
      "using":false,
      "location":{
        "id": from.guid,
        "value": from.name
      },
      "accesspoint":{
        "type": typeFrom,
        "address":{"id":"","value":""},
        "terminal":{
          "id":"",
          "value":""
        }
      }
    }
  },
    "customer":{
    "dispatch":{
      "type":"individual",
        "phone":["","",""],
        "email":"",
        "name":"",
        "fullname":"",
        "inn":"",
        "kpp":"",
        "sendcode":false
    },
    "destination":{
      "type":"individual",
        "phone":["","",""],
        "email":"",
        "name":"",
        "fullname":"",
        "inn":"",
        "kpp":"",
        "sendcode":true
    }
  },
    "payer":{
    "type":"dispatch",
      "text":"Отправитель () ",
      "type_payer":"individual",
      "phone":["","",""],
      "email":"",
      "name":"",
      "fullname":"",
      "inn":"",
      "kpp":""
  },
    "sendSms":{"checkCode":"","checkPhoneNumber":{"id":"","value":""}},"promocode":""
  };
};

var getDispatchReq = function (req) {
  return {
    "dispatch":{
      "location": req.gateway.dispatch.location.id,
      "accessPoint": req.gateway.dispatch.accesspoint.type,
      "terminal": req.gateway.dispatch.accesspoint.terminal.id || "ac98cb8f-f590-11e5-80e7-00155d903d0a",
      "date": moment().add(1, 'days').format('DD.MM.YYYY'),
      "timeFrom":"10:00",
      "timeTo":"15:00",
      "dateChange":false
    },
    "destination":{
      "location": req.gateway.destination.location.id,
      "accessPoint": req.gateway.destination.accesspoint.type,
      "terminal": req.gateway.destination.accesspoint.terminal.id || "30b8e091-3c6b-11e6-80e9-00155d903d0a",
      "date": moment().add(2, 'days').format('DD.MM.YYYY'),
      "timeFrom":"14:00",
      "timeTo":"19:00"
    },
    "session_id":"1493191772"//req.session_id
  }
};

var getReqs = function (from, to) {
  from = from || {};
  to = to || {};
  var results = [getReq('address', 'address', 'ДД', from, to)];
  if (from.has_terminals === "1" && to.has_terminals === "1") {
    results.push(getReq('terminal', 'terminal', 'СC', from, to));
  }
  if (from.has_terminals === "1") {
    results.push(getReq('terminal', 'address', 'СД', from, to));
  }
  if (to.has_terminals === "1") {
    results.push(getReq('address', 'terminal', 'ДС', from, to));
  }
  return results;
};

var getCity = function (city, token, callback) {
  var deliveryData = deliveryHelper.get(delivery);
  var opts = Object.assign({}, deliveryData.citiesUrl);
  var trim = commonHelper.getCity(city);
  opts.form = {
    q: trim,
    params: JSON.stringify({"filter":{},"order":{"sort_index":"DESC","has_terminals":"DESC","name":"ASC"},"limit":100})
  };
  opts.headers = {
    'X-CSRF-Token': token.token,
    'Cookie': token.cookie
  };
  async.retry(config.retryOpts, function (callback) {
    request(opts, callback)
  }, function (err, r, b) {
    var result = {
      city: city,
      cityTrim: trim,
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
      result.message = commonHelper.getCityJsonError(new Error("Неверный формат ответа, отсутствует массив"));
      return callback(null, result);
    }
    if (!json.length) {
      result.message = commonHelper.getCityNoResultError(trim);
    } else if (json.length === 1) {
      result.foundCities = json;
      result.success = true;
    } else {
      var region = commonHelper.getRegionName(city);
      var founds = [];
      if (region) {
        founds = commonHelper.findInArray(json, region, 'region');
      }
      result.foundCities = founds.length ? founds : [json[0]];
      result.success = true;
    }
    result.cities = json;
    callback(null, result);
  });
};

var calcResults = function (item, token, callback) {
  var deliveryData = deliveryHelper.get(delivery);
  setTimeout(function () {
    async.mapSeries(item.req, function (req, callback) {
      req.session_id = token.sessionId;
      async.parallel([
        function (callback) {
          var opts = _.extend({}, deliveryData.calcUrl);
          req.cargo.dimensions.weight = item.weight;
          opts.form = {
            params: JSON.stringify(req)
          };
          opts.headers = {
            'X-CSRF-Token': token.token,
            'Cookie': token.cookie,
            'X-Requested-With': 'XMLHttpRequest'
          };
          async.retry(config.retryOpts, function (callback) {
            request(opts, callback)
          }, function (err, r, b) {
            var result = {
              service: req.service
            };
            if (err) {
              result.error = commonHelper.getResponseError(err);
              return callback(null, result);
            }
            var json = null;
            try {
              json = JSON.parse(b);
            } catch (e) {
              result.error = commonHelper.getResultJsonError(e);
            }
            if (!json) {
              return callback(null, result);
            }
            if (!json.layer) {
              result.error = commonHelper.getResultJsonError(new Error("Отсутствует поле layer в ответе"));
              return callback(null, result);
            }
            var $ = cheerio.load(json.price);
            $('.sub-price').remove();
            result.cost = $('#total-sum').text().replace(commonHelper.COSTREG, '');
            return callback(null, result);
          });
        },
        function (callback) {
          var opts = _.extend({}, deliveryData.calcUrlAdditional);
          opts.form = {
            params: JSON.stringify(getDispatchReq(req))
          };
          opts.headers = {
            'X-CSRF-Token': token.token,
            'Cookie': token.cookie,
            'X-Requested-With': 'XMLHttpRequest'
          };
          async.retry(config.retryOpts, function (callback) {
            request(opts, callback)
          }, function (err, r, b) {
            var result = {};
            if (err) {
              result.error = commonHelper.getResponseError(err);
              return callback(null, result);
            }
            var json = null;
            try {
              json = JSON.parse(b);
            } catch (e) {
              result.error = commonHelper.getResultJsonError(e);
            }
            if (!json) {
              return callback(null, result);
            }
            if (!json.traffic || !json.dispatch || !json.destination) {
              result.error = commonHelper.getResultJsonError(new Error("Отсутствует поле traffic в ответе"));
              return callback(null, result);
            }
            result.deliveryTime = moment(moment(json.destination.date, 'YYYY-MM-DD')).diff(moment(json.dispatch.date, 'YYYY-MM-DD'), 'days') + 1;
            return callback(null, result);
          });
        }
      ], function (err, results) {
        var result = _.extend(results[0], results[1]);
        callback(null, result);
      });
    }, function (err, tariffs) {
      item.tariffs = tariffs;
      if (!item.tariffs.length) {
        item.error = commonHelper.getNoResultError();
      }
      callback(null, item);
    });
  }, commonHelper.randomInteger(500, 1000));
};

module.exports = function (req, cities) {
  var deliveryData = deliveryHelper.get(delivery);
  var requests = [];
  var cityObj = {};
  var timestamp = global[delivery];
  async.auto({
    getToken: function (callback) {
      var opts = Object.assign({}, deliveryData.tokenUrl);
      async.retry(config.retryOpts, function (callback) {
        request(opts, callback)
      }, function (err, r, b) {
        if (err) {
          return callback(null, null);
        }
        var $ = cheerio.load(b);
        callback(null, {
          cookie:  r.headers['set-cookie'][0].split(';')[0] + '; lt_uid=a892d43b-a3e2-4710-a555-b3a7d118e12c',
          sessionId: $('[data-block="session_id"]').find('input').val(),
          token: $('input[name="_csrf"]').val()
        });
      });
    },
    getCities: ['getToken', function (results, callback) {
      if (!results.getToken) {
        return callback(new Error("Не удалось получить токен"));
      }
      async.mapSeries(cities, function (city, callback) {
        if (!city.from || !city.to) {
          city.error = commonHelper.CITIESREQUIRED;
          return async.nextTick(function () {
            callback(null, city);
          });
        }
        if (city.countryFrom && commonHelper.SNG.indexOf(city.countryFrom.toLowerCase()) === -1) {
          city.error = commonHelper.COUNTRYFROMNOTFOUND;
          return async.nextTick(function () {
            callback(null, city);
          });
        }
        if (city.countryTo && commonHelper.SNG.indexOf(city.countryTo.toLowerCase()) === -1) {
          city.error = commonHelper.COUNTRYNOTFOUND;
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
              getCity(city.from, results.getToken, callback);
            },
            function (callback) {
              if (typeof  cityObj[city.to + city.countryTo] !== 'undefined') {
                return callback(null);
              }
              getCity(city.to, results.getToken, callback);
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
                  from: fromCity.name + ', ' + fromCity.region,
                  to: toCity.name + ', ' + toCity.region,
                  countryFrom: item.countryFrom,
                  countryTo: item.countryTo
                },
                req: getReqs(fromCity, toCity),
                delivery: delivery,
                tariffs: []
              });
            });
          });
        }
      });
      tempRequests.forEach(function (item) {
        req.body.weights.forEach(function (weight) {
          var obj = Object.assign({}, item);
          obj.weight = weight;
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
        calcResults(item, results.getToken, callback);
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