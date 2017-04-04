var responseHelper = require('../../helpers/response');
var deliveryHelper = require('../../helpers/delivery');
var commonHelper = require('../../helpers/common');
var async = require('async');
var request = commonHelper.request;
var cheerio = require('cheerio');
var config = require('../../../conf');
var _ = require('underscore');

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

var parseEmsResponse = function (response) {
  var splits = response.d.split('<br/>');
  var cost = splits[0].replace(/[^0-9.]/g,'');
  return {
    message: cost === '0000' ? splits[0] : null,
    cost: cost,
    deliveryTime: splits[1] ? splits[1].replace(/[^0-9-]/g,'') : ''
  };
};

var getEMSReq = function (cities, countries, item) {
  var from = convertCityToEms(item.from),
    emsReq = {contType: 0, value: ''},
    to = convertCityToEms(item.to);
  emsReq.srcCountryID = "643";
  emsReq.targCountryID = null;
  filtered = countries.filter(function (f) {
    return new RegExp(item.countryTo, 'gi').test(f.name);
  });
  if (filtered.length && item.countryTo && item.countryTo.length) {
    emsReq.targCountryID = filtered[0].id;
  }
  if (emsReq.targCountryID) {
    emsReq.indexFrom = "101700";
    emsReq.indexTo = "101700";
    return emsReq;
  }
  var filtered = cities.filter(function (f) {
    return new RegExp(from, 'gi').test(f.name);
  });
  if (filtered.length && from.length) {
    emsReq.srcCountryID = "643";
    emsReq.targCountryID = "643";
    emsReq.indexFrom = filtered[0].id;
  }
  filtered = cities.filter(function (f) {
    return new RegExp(to, 'gi').test(f.name);
  });
  if (filtered.length && to.length) {
    emsReq.indexTo = filtered[0].id;
  }
  if (emsReq.indexFrom && emsReq.indexTo) {
    return emsReq;
  }
  return null;
};

module.exports = function (req, res) {
  var delivery = 'emspost';
  var deliveryData = deliveryHelper.get(delivery);
  var requests = [];
  var timestamp = global[delivery];
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
      var cities = [];
      var countries = [];
      options.each(function (iindex, item) {
        cities.push({id: $(item).attr('value'), name: $(item).text()});
      });
      countryOptions.each(function (index, item) {
        countries.push({id: $(item).attr('value'), name: $(item).text().trim()});
      });
      if (!cities.length && !countries.length) {
        return callback(new Error("Ошибка парсинга городов"));
      }
      req.body.cities.forEach(function (item) {
        var emsReq = getEMSReq(cities, countries, item);
        req.body.weights.forEach(function (weight) {
          requests.push({weight: weight, city: item, delivery: delivery, req: emsReq, error: emsReq ? null : 'Не найден город', tariffs: []});
        });
      });
      var opts = _.extend({}, deliveryData.calcUrl);
      async.mapSeries(requests, function (item, callback) {
        if (global[delivery] > timestamp) {
          return callback({abort: true});
        }
        if (!item.req) {
          return callback(null, item);
        }
        setTimeout(function () {
          async.retry(config.retryOpts, function (callback) {
            opts.json = item.req;
            opts.json.weight = item.weight;
            request(opts, callback)
          }, function (err, r, b) {
            item.res = b;
            if (err) {
              item.error = "Не удалось получить информацию с сайта, попробуйте позже";
            } else if (b && b.d) {
              var resp = parseEmsResponse(b);
              if (resp.message) {
                item.error = resp.message;
              } else {
                item.tariffs.push(resp);
              }
            } else {
              item.error = b.Message || "Неверные параметры запроса";
            }
            return callback(null, item);
          });
        }, commonHelper.randomInteger(500, 1000));
      }, callback);
    }]
  }, function (err, results) {
    if (err) {
      if (err.abort) {
        return false;
      }
      req.session.delivery[delivery].complete = true;
      req.session.delivery[delivery].error = err;
      req.session.save(function () {});
      return false;
    }
    req.session.delivery[delivery].complete = true;
    req.session.delivery[delivery].results = results.parseCities;
    req.session.save(function () {});
  });
};