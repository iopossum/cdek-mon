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
var getCity = function (city, isCityTo, callback) {
    var result = {
        city: city,
        success: false
    };

    var cities = isCityTo === 0 ? c2cRegions : openRegionsTo;
    var foundCity = cities.find(function (item) {
        return item.toUpperCase() === city.toUpperCase();
    });
    var currPickPoint = '';
    if (typeof foundCity === 'undefined') {
      result.message = commonHelper.getCityNoResultError();
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

module.exports = function (req, cities) {
  var deliveryData = deliveryHelper.get(delivery);
  var requests = [];
  var cityObj = {};
  var timestamp = global[delivery];
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
        if(city.countryFrom != "россия") {
            city.error = commonHelper.COUNTRYFROMNOTFOUND;
            return async.nextTick(function () {
                callback(null, city);
            });
        }
        if(city.countryTo != "россия") {
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
              if (typeof cityObj[city.from] !== 'undefined') {
                return callback(null);
              }
              getCity(city.from, 0, callback);
            },
            function (callback) {
              if (typeof  cityObj[city.to] !== 'undefined') {
                return callback(null);
              }
              getCity(city.to, 1, callback);
            }
          ], function (err, foundCities) { //ошибки быть не может
            if (typeof  cityObj[city.to] === 'undefined') {
              cityObj[city.to] = foundCities[1];
            }
            if (typeof  cityObj[city.from] === 'undefined') {
              cityObj[city.from] = foundCities[0];
            }
            city.fromJson = cityObj[city.from];
            city.toJson = cityObj[city.to];
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
          var obj = Object.assign({}, item);
          obj.weight = weight;
          obj.req['weight'] = weight;
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
        opts.form = item.req;
        setTimeout(function () {
          async.retry(config.retryOpts, function (callback) {
            request(opts, callback)
          }, function (err, r, body) {
            if (err) {
              item.error = commonHelper.getResponseError(err);
              return callback(null, item);
            }
            var result = {};
            try {
                result = JSON.parse(body);
            } catch (err) {
                item.error = commonHelper.getResponseError(err);
                return callback(null, item);
            }
            if(result.error) {
                item.error = commonHelper.getResponseError({message : result.error});
                return callback(null, item);
            }
            if(!result.date || !result.sum) {
                item.error = commonHelper.getResponseError({message : 'response is incorrect'});
                return callback(null, item);
            }
            var delivTime;
            try {
                delivTime = new Date(result.date);
            } catch (err) {
                item.error = commonHelper.getResponseError({message : 'cannot get date from response'});
                return callback(null, item);
            }
            if(!delivTime) {
                item.error = commonHelper.getCityJsonError({message : 'cannot get date from response'});
                return callback(null, item);
            }
            var time = delivTime.getTime();
            if(!time) {
                item.error = commonHelper.getCityJsonError({message : 'cannot get date from response'});
                return callback(null, item);
            }
            var timeDiff = Math.abs(time - (new Date()).getTime());
            var diffDays = Math.ceil(timeDiff / (1000 * 3600 * 24));
            item.tariffs.push({
                service: 'доставка',
                cost: result.sum,
                deliveryTime: diffDays
            });
            return callback(null, item);
          });
        }, commonHelper.randomInteger(500, 1000));
      }, callback);
    }]
  }, function (err, results) {
    logger.tariffsInfoLog(delivery, results.requests, 'getTariffs');
    if (err) {
      if (err.abort) {
        return false;
      }
      req.session.delivery[delivery].complete = true;
      req.session.delivery[delivery].error = err.message || err.stack;
      var array = [];
      cities.forEach(function (item) {
        array = array.concat(commonHelper.getResponseArray(req.body.weights, item, delivery, err.message || err.stack))
      });
      req.session.delivery[delivery].results = array;
      req.session.save(function () {});
      return false;
    }
    req.session.delivery[delivery].complete = true;
    req.session.delivery[delivery].results = results.requests;
    req.session.save(function () {});
  });
};