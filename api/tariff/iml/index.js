var responseHelper = require('../../helpers/response');
var deliveryHelper = require('../../helpers/delivery');
var commonHelper = require('../../helpers/common');
var async = require('async');
var request = commonHelper.request;
var cheerio = require('cheerio');
var config = require('../../../conf');
var _ = require('underscore');
var logger = require('../../helpers/logger');
var delivery = 'iml';

var getReq = function (from, to, pickpoint) {
  from = from || '';
  to = to || '';
  pickpoint = pickpoint || '';
  return {
    'from_type':'list',
    'to_type':'list',
    'use_login':0,
    'login':'',
    'password':'',
    'delivery':3,
    'payment':2,
    'from':from,
    'from-index':'',
    'to':to,
    'to-index':'',
    'pickpoint':pickpoint,
    'address':'',
    'weight':1,
    'width':'',
    'height':'',
    'depth':'',
    'places':1,
    'price':0,
    'cod':0,
    'shipment':''
  }
};

var parseJsonVariable = function (strScript, varName) {
  strScript = strScript || '';
  if(strScript.search(varName) < 0)
    return '';
  var chopFront = strScript.substring(strScript.search(varName) + varName.length, strScript.length);
  if(chopFront.search(";") < 0)
    return chopFront;

  var result = chopFront.substring(0, chopFront.search("}];") + "}]".length);
  return result;
};

var pickpoints = []; // все возможные ПВЗ в системе iml
var openRegionsTo = []; // только доступные для выбора города получения
var c2cRegions = []; // тут хранятся города отправления
var fillAllCitiesFromIml = function (callback) {
    var deliveryData = deliveryHelper.get(delivery);
    var opts = Object.assign({}, deliveryData.citiesUrl);

    async.retry(config.retryOpts, function (callback) {
        request(opts, callback)
    }, function (err, r, body) {
        var result = {
            success: false
        };
        if (err) {
            result.message = commonHelper.getResponseError(err);
            return callback(null, result);
        }
        var $ = cheerio.load(body);

        var text = $($('script')).text();
        var findAndClean = parseJsonVariable(text, "var pickpoints =");
        pickpoints = JSON.parse(findAndClean); // все возможные ПВЗ в системе iml

        var findExceptReg = parseJsonVariable(text, "var exceptRegions =");
        var exceptRegions = JSON.parse(findExceptReg); // ПВЗ исключения в системе iml

        /* следующие строки взяты из логики которая зашита в iml.ru */
        var newExceptRegions = [];
        for (var i = 0; i < exceptRegions.length; i++) {
            var region = exceptRegions[i];
            if (newExceptRegions[region.RegionCode] == undefined) {
                newExceptRegions[region.RegionCode] = [];
            }
            newExceptRegions[region.RegionCode].push(region);
        }
        exceptRegions = newExceptRegions; // ПВЗ исключения сгруппированные по городам

        /* следующие строки взяты из логики которая зашита в iml.ru */
        var newPickpoints = [];
        var pickpointRegions = []; // тут хранятся все города получения
        for (var i = 0; i < pickpoints.length; i++) {
            var point = pickpoints[i];
            if (point.RegionCode == '')
                continue;
            if ((new Date(point.OpeningDate)) >= (new Date()))
                continue;
            if (pickpointRegions.indexOf(point.RegionCode) < 0)
                pickpointRegions.push(point.RegionCode);
            if (newPickpoints[point.RegionCode] == undefined)
                newPickpoints[point.RegionCode] = [];
            newPickpoints[point.RegionCode].push(point);
            if (point.ReceiptOrder == 2 && c2cRegions.indexOf(point.RegionCode) < 0)
                c2cRegions.push(point.RegionCode);
        }
        pickpoints = newPickpoints; // итоговый список ПВЗ, сгруппированный по городам
        //еще одна скопированная логика с iml
        var jobs = [];
        jobs.push('С24');
        loop1: for (var i = 0; i < pickpointRegions.length; i++) {
            var region = pickpointRegions[i];
            if (exceptRegions[region] != undefined) {
                loop2: for (var j = 0; j < exceptRegions[region].length; j++) {
                    var except = exceptRegions[region][j];
                    var open = new Date(except.Open);
                    var end = new Date(except.End);
                    var now = new Date();
                    if (open > now || end < now)
                        continue;
                    if (jobs.indexOf(except.JobNo) >= 0)
                        continue loop1;
                }
            }
            openRegionsTo.push(region);
        }
        result.success = true;
        result.openRegionsTo = openRegionsTo;
        result.c2cRegions = c2cRegions;
        result.pickpoints = pickpoints;
        return callback(null, result);
    });
};
/** смотрим есть ли в выгруженных из iml городах получателя или отправителя интересующий нас город.
 * isCityTo - показывает в каком списке искать город. 0-отправителя, иначе получателя  */
var getCity = function (city, cities, callback) {
    var result = {
        city: city,
        success: false
    };

    var foundCity = cities.find(function (item) {
        return item.toUpperCase() === city.toUpperCase();
    });
    var currPickPoint = '';
    if (typeof foundCity === 'undefined') {
      result.message = commonHelper.getCityNoResultError(city);
    } else {
      result.foundCities = [foundCity];
      result.success = true;
      /* если вытаскиваем город получателя, то необходимо сразу вытащить и ПВЗ */
      var pointList = pickpoints[foundCity];
      if (typeof pointList !== 'undefined') {
          if (pointList.length > 0) {
              currPickPoint = pointList[pointList.length - 1].Code;
          }
      }
    }
    result.pickpoint = currPickPoint;
    result.cities = [foundCity];
    callback(null, result);
};

var calcResult = function (req, type, callback) {
  var deliveryData = deliveryHelper.get(delivery);
  var opts = _.extend({}, deliveryData.calcUrl);
  opts.form = req;
  setTimeout(function () {
    async.retry(config.retryOpts, function (callback) {
      request(opts, callback)
    }, function (err, r, body) {
      var response = {};
      if (err) {
        response.error = commonHelper.getResponseError(err);
        return callback(null, response);
      }
      var result = {};
      try {
        result = JSON.parse(body);
      } catch (err) {
        response.error = commonHelper.getResponseError(err);
        return callback(null, response);
      }
      if (result.error) {
        response.error = commonHelper.getResponseError(new Error(result.error));
        return callback(null, response);
      }
      if (!result.sum) {
        response.error = commonHelper.getResponseError(new Error("Отсутствует sum в ответе"));
        return callback(null, response);
      }
      if (!result.date) {
        response.error = commonHelper.getResponseError(new Error("Отсутствует date в ответе"));
        return callback(null, response);
      }
      var delivTime;
      try {
        delivTime = new Date(result.date);
      } catch (err) {
        response.error = commonHelper.getResponseError(new Error("Неверный формат date в ответе"));
      }
      if (!delivTime) {
        return callback(null, response);
      }
      var time = delivTime.getTime();
      if (!time) {
        response.error = commonHelper.getResponseError(new Error("Неверный формат date в ответе"));
        return callback(null, response);
      }
      var timeDiff = Math.abs(time - (new Date()).getTime());
      var diffDays = Math.ceil(timeDiff / (1000 * 3600 * 24));
      response.tariff = commonHelper.createTariff(type, result.sum, diffDays);
      return callback(null, response);
    });
  }, commonHelper.randomInteger(200, 500));
};

var calcRequests = function (item, callback) {
  setTimeout(function () {
    async.series([
      function (callback) {
        var copy = _.clone(item.req);
        copy.delivery = 1;
        copy.payment = 1;
        calcResult(copy, "Курьерская доставка (для юр. лиц)", callback);
      },
      function (callback) {
        var copy = _.clone(item.req);
        copy.delivery = 2;
        copy.payment = 1;
        calcResult(copy, "Самовывоз (для юр. лиц)", callback);
      },
      function (callback) {
        var copy = _.clone(item.req);
        copy.delivery = 3;
        calcResult(copy, "Отправления физических лиц", callback);
      }
    ], function (err, results) {
      if (!results[0].error) {
        item.tariffs.push(results[0].tariff);
      }
      if (!results[1].error) {
        item.tariffs.push(results[1].tariff);
      }
      if (!results[2].error) {
        item.tariffs.push(results[2].tariff);
      }
      if (!item.tariffs.length) {
        item.error = commonHelper.getNoResultError();
      }
      callback(null, item);
    });
  }, commonHelper.randomInteger(500, 1000));
};

module.exports = function (req, cities, callback) {
  var deliveryData = deliveryHelper.get(delivery);
  var requests = [];
  var cityObjFrom = {};
  var cityObjTo = {};
  var timestamp = callback ? new Date().getTime*2 : commonHelper.getReqStored(req, delivery);
  async.auto({
    getCitiesFromIml : function (callback) {
        fillAllCitiesFromIml(function(err, result) {
            callback(null, result);
        }); // вытаскиваем с сайта iml данные по городам.
    },
    getCities: ['getCitiesFromIml', function (results, callback) {
      async.mapSeries(cities, function (city, callback) {
        if (!city.from || !city.to) {
          city.error = commonHelper.CITIESREQUIRED;
          return async.nextTick(function () {
            callback(null, city);
          });
        }
        if (!city.countryFrom) {
            city.countryFrom = "россия";
        }
        if (!city.countryTo) {
            city.countryTo = "россия";
        }
        if (city.countryFrom != "россия") {
            city.error = commonHelper.COUNTRYFROMNOTFOUND;
            return async.nextTick(function () {
                callback(null, city);
            });
        }
        if (city.countryTo != "россия") {
            city.error = commonHelper.COUNTRYNOTFOUND;
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
              if (typeof cityObjFrom[city.from] !== 'undefined') {
                return callback(null);
              }
              getCity(city.from, results.getCitiesFromIml.c2cRegions, callback);
            },
            function (callback) {
              if (typeof  cityObjTo[city.to] !== 'undefined') {
                return callback(null);
              }
              getCity(city.to, results.getCitiesFromIml.openRegionsTo, callback);
            }
          ], function (err, foundCities) { //ошибки быть не может
            if (typeof  cityObjFrom[city.from] === 'undefined') {
              cityObjFrom[city.from] = foundCities[0];
            }
            if (typeof  cityObjTo[city.to] === 'undefined') {
              cityObjTo[city.to] = foundCities[1];
            }
            city.fromJson = cityObjFrom[city.from];
            city.toJson = cityObjTo[city.to];
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
          requests = requests.concat(commonHelper.getResponseArray(req.body.weights, item, delivery, 'Город отправления не найден. ' + item.fromJson.message));
        } else if (!item.toJson.success) {
          requests = requests.concat(commonHelper.getResponseArray(req.body.weights, item, delivery, 'Город получения не найден. ' + item.toJson.message));
        } else {
          item.fromJson.foundCities.forEach(function (fromCity) {
            item.toJson.foundCities.forEach(function (toCity) {
              tempRequests.push({
                city: {
                  initialCityFrom: item.from,
                  initialCityTo: item.to,
                  from: fromCity, //.name
                  to: toCity
                },
                req: getReq(fromCity, toCity, item.toJson.pickpoint),
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
          obj.req['weight'] = weight;
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
        calcRequests(item, callback);
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