var responseHelper = require('../../helpers/response');
var deliveryHelper = require('../../helpers/delivery');
var commonHelper = require('../../helpers/common');
var async = require('async');
var request = commonHelper.request;
var cheerio = require('cheerio');
var config = require('../../../conf');
var _ = require('underscore');
var logger = require('../../helpers/logger');
var delivery = 'emspost';

var convertCityToEms = function (city) {
  var splits = city.split(',');
  var result = null;
  switch (splits.length) {
    case 1:
      result = city.toUpperCase();
      break;
    case 2:
      var temp = splits[1].split(' ');
      result = temp[1].toUpperCase();
      break;
    case 3:
      var temp = splits[2].split(' ');
      result = temp[1].toUpperCase();
      break;
  }
  return result;
};

//old
/*var parseEmsResponse = function (response) {
  var splits = response.d.split('<br/>');
  var cost = splits[0].replace(/[^0-9.]/g,'');
  return {
    message: cost === '0000' ? splits[0] : null,
    cost: cost,
    deliveryTime: splits[1] ? splits[1].replace(/[^0-9-]/g,'') : ''
  };
};*/

var parseEmsResponse = function (response) {
  var json;
  var result = {};
  try {
    json = JSON.parse(response.d);
  } catch (e) {
    result.message = commonHelper.getResultJsonError(e);
  }
  if (!json) {
    return result;
  }
  if (!json.success) {
    result.message = response.d;
    return result;
  }
  var splits = json.conditions.split('<br/>');
  var cost = splits[0].replace(/[^0-9.]/g,'');
  cost = commonHelper.parseFloat(cost);
  return {
    message: cost === '0000' ? splits[0] : null,
    cost: cost,
    deliveryTime: splits[1] ? splits[1].replace(/[^0-9-]/g,'') : ''
  };
};

var getEMSReq = function (cities, countries, item) {
  var from = convertCityToEms(item.from),
    emsReq = {contType: 0, value: '', declaredValue: '', mark: new Date().getTime()},
    to = convertCityToEms(item.to),
    countriesObj = _.indexBy(countries, 'name'),
    citiesObj = _.indexBy(cities, 'name');
  emsReq.srcCountryID = "643";
  emsReq.targCountryID = null;
  filtered = commonHelper.findInArray(countries, item.countryTo, 'name', true);
  if (filtered.length && item.countryTo && item.countryTo.length) {
    emsReq.targCountryID = filtered[0].id;
    emsReq.targID = filtered[0].id;
  }
  if (item.countryTo && countriesObj[item.countryTo.toUpperCase()]) {
    emsReq.targCountryID = countriesObj[item.countryTo.toUpperCase()].id;
    emsReq.targID = countriesObj[item.countryTo.toUpperCase()].id;
  }
  if (emsReq.targCountryID) {
    emsReq.indexFrom = "101700";
    emsReq.indexTo = "101700";
    emsReq.fromName = "Россия";
    emsReq.toName = filtered[0] ? filtered[0].name : countriesObj[item.countryTo.toUpperCase()].name;
    return emsReq;
  }
  var filtered = commonHelper.findInArray(cities, from, 'name');
  if (filtered.length && from.length) {
    emsReq.srcCountryID = "643";
    emsReq.targCountryID = "643";
    emsReq.indexFrom = filtered[0].id;
    emsReq.fromName = filtered[0].name;
  }
  if (from && citiesObj[from.toUpperCase()]) {
    emsReq.srcCountryID = "643";
    emsReq.targCountryID = "643";
    emsReq.indexFrom = citiesObj[from.toUpperCase()].id;
    emsReq.fromName = citiesObj[from.toUpperCase()].name;
  }
  filtered = commonHelper.findInArray(cities, to, 'name');
  if (filtered.length && to.length) {
    emsReq.indexTo = filtered[0].id;
    emsReq.toName = filtered[0].name;
  }
  if (to && citiesObj[to.toUpperCase()]) {
    emsReq.indexTo = citiesObj[to.toUpperCase()].id;
    emsReq.toName = citiesObj[to.toUpperCase()].name;
  }
  if (emsReq.indexFrom && emsReq.indexTo) {
    return emsReq;
  }
  return null;
};

module.exports = function (req, cities, callback) {
  var deliveryData = deliveryHelper.get(delivery);
  var requests = [];
  var timestamp = callback ? new Date().getTime*2 : commonHelper.getReqStored(req, delivery);
  async.auto({
    getCities: function (callback) {
      var opts = deliveryData.citiesUrl;
      async.retry(config.retryOpts, function (callback) {
        request(opts, callback)
      }, callback);
    },
    parseCities: ['getCities', function (results, callback) {
      var $ = cheerio.load(results.getCities[1]);
      var options = $('#selFrom').find('option');
      var countryOptions = $('#countriesTo').find('option');
      var foundCities = [];
      var countries = [];
      options.each(function (iindex, item) {
        foundCities.push({id: $(item).attr('value'), name: $(item).text()});
      });
      countryOptions.each(function (index, item) {
        countries.push({id: $(item).attr('value'), name: $(item).text().trim()});
      });
      if (!foundCities.length && !countries.length) {
        return callback(commonHelper.getCityJsonError(new Error("Не удалось получить список городов")));
      }
      cities.forEach(function (item) {
        if (item.countryTo) {
          if (item.countryTo.toLowerCase() === 'южная корея') {
            item.countryTo = 'Корея (республика)';
          }
          if (item.countryTo.toLowerCase() === 'белоруссия') {
            item.countryTo = 'Беларусь';
          }
          if (item.countryTo.toLowerCase() === 'молдавия') {
            item.countryTo = 'Молдова';
          }
        }
        var emsReq = getEMSReq(foundCities, countries, item);
        item.initialCityFrom = item.from;
        item.initialCityTo = item.to;
        if (emsReq) {
          item.from = emsReq.fromName;
          item.to = emsReq.toName;
        }
        req.body.weights.forEach(function (weight) {
          requests.push({
            weight: weight,
            city: item,
            delivery: delivery,
            req: emsReq,
            error: emsReq ? null : item.countryFrom || item.countryTo ? 'Не найдена страна' : 'Не найден город',
            tariffs: []
          });
        });
      });
      async.mapSeries(requests, function (item, callback) {
        if (commonHelper.getReqStored(req, delivery) > timestamp) {
          return callback({abort: true});
        }
        if (!item.req) {
          return async.nextTick(function () {
            callback(null, item);
          });
        }
        var opts = _.extend({}, item.req.targID ? deliveryData.calcInternationalUrl : deliveryData.calcUrl);
        setTimeout(function () {
          async.retry(config.retryOpts, function (callback) {
            opts.json = item.req;
            opts.json.weight = item.weight;
            request(opts, callback)
          }, function (err, r, b) {
            item.res = b;
            if (err) {
              item.error = commonHelper.getResultJsonError(err);
            } else if (b && b.d) {
              var resp = parseEmsResponse(b);
              if (resp.message) {
                item.error = commonHelper.getResultJsonError(new Error(resp.message));
              } else {
                item.tariffs.push(resp);
              }
            } else {
              item.error = commonHelper.getResultJsonError(new Error(b.Message || "Неверные параметры запроса"));
            }
            return callback(null, item);
          });
        }, commonHelper.randomInteger(500, 1000));
      }, callback);
    }]
  }, function (err, results) {
    logger.tariffsInfoLog(delivery, results.parseCities, 'parseCities');
    commonHelper.saveResults(req, err, {
      delivery: delivery,
      timestamp: timestamp,
      cities: cities,
      items: results.parseCities || [],
      callback: callback
    });
  });
};