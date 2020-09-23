var responseHelper = require('../../helpers/response');
var deliveryHelper = require('../../helpers/delivery');
var commonHelper = require('../../helpers/common');
var async = require('async');
var request = commonHelper.request;
var cheerio = require('cheerio');
var config = require('../../../conf');
var _ = require('underscore');
var logger = require('../../helpers/logger');
var iconv = require("iconv-lite");
var delivery = 'rikakz';

var getReq = function (from, to, session, isInternational) {
  from = from || {};
  to = to || {};
  var query = {
    go: 'yes',
    sessid: session,
    city_from_input: from.name,
    city_from: from.id,
    city_to_input: to.name,
    city_to: to.id,
    massa: 1,
    size_1: '',
    size_2: '',
    size_3: '',
    vmassa2: 0,
    submit: 'Расчитать стоимость доставки'
  };
  if (isInternational) {
    query.world_type = 'post';
  }
  return query;
};

var getCities = function (isCountry, callback) {
  var deliveryData = deliveryHelper.get(delivery);
  var opts = Object.assign({}, isCountry ? deliveryData.countriesUrl : deliveryData.citiesUrl);
  opts.followAllRedirects = true;
  async.retry(config.retryOpts, function (callback) {
    request(opts, callback)
  }, function (err, r, b) {
    var result = {
      from: [],
      to: []
    };
    if (err) {
      return callback(commonHelper.getCityJsonError(err));
    }
    var $ = cheerio.load(b);
    $('#city_from_resul').find('.asd_si_result_item').each(function (index, item) {
      result.from.push({id: $(item).attr('id').replace(/[^0-9]/g, ""), name: $(item).text().trim()});
    });
    $('#city_to_resul').find('.asd_si_result_item').each(function (index, item) {
      result.to.push({id: $(item).attr('id').replace(/[^0-9]/g, ""), name: $(item).text().trim()});
    });
    result.session = $('#sessid').val();
    callback(null, result);
  });
};

var filterCity = function (city, array) {
  var trim = commonHelper.getCity(city);
  var region = commonHelper.getRegionName(city);
  var founds = commonHelper.findInArray(array, trim, 'name', true);
  var foundsWithRegion = [];
  if (region) {
    foundsWithRegion = commonHelper.findInArray(founds.length ? founds : array, region, 'name');
  }
  return foundsWithRegion.length ? foundsWithRegion.splice(0, 3) : founds.splice(0, 3);
};

module.exports = function (req, cities, callback) {
  var deliveryData = deliveryHelper.get(delivery);
  var requests = [];
  var timestamp = callback ? new Date().getTime*2 : commonHelper.getReqStored(req, delivery);
  cities.forEach(function (item) {
    item.countryFrom = item.countryFrom || 'Россия';
    item.countryTo = item.countryTo || 'Россия';
    if (item.countryFrom.toLowerCase() === 'казахстан') {
      item.fromKz = true;
    }
    if (item.countryTo.toLowerCase() === 'казахстан') {
      item.toKz = true;
    }
  });
  async.auto({
    getCities: function (callback) {
      getCities(false, callback);
    },
    getCountries: function (callback) {
      getCities(true, callback);
    },
    parseCities: ['getCities', 'getCountries', function (results, callback) {
      for (var i=0; i<cities.length; i++) {
        if (!cities[i].fromKz) {
          cities[i].error = commonHelper.CITYFROMKZ;
          requests = requests.concat(commonHelper.getResponseArray(req.body.weights, cities[i], delivery, cities[i].error));
          continue;
        }
        var foundsFrom = [];
        var foundsTo = [];
        if (cities[i].toKz) {
          foundsFrom = filterCity(cities[i].from, results.getCities.from);
          foundsTo = filterCity(cities[i].to, results.getCities.to);
        } else {
          foundsFrom = filterCity(cities[i].countryFrom, results.getCountries.from);
          foundsTo = filterCity(cities[i].countryTo, results.getCountries.to);
        }

        if (!foundsFrom.length) {
          cities[i].error = commonHelper.CITYFROMNOTFOUND;
          requests = requests.concat(commonHelper.getResponseArray(req.body.weights, cities[i], delivery, cities[i].error));
          continue;
        }

        if (!foundsTo.length) {
          cities[i].error = cities[i].toKz ? commonHelper.CITYTONOTFOUND : commonHelper.COUNTRYNOTFOUND;
          requests = requests.concat(commonHelper.getResponseArray(req.body.weights, cities[i], delivery, cities[i].error));
          continue;
        }

        var tempRequests = [];
        foundsFrom.forEach(function (fromCity) {
          foundsTo.forEach(function (toCity) {
            tempRequests.push({
              city: {
                initialCityFrom: cities[i].from,
                initialCityTo: cities[i].to,
                from: fromCity.name,
                to: toCity.name,
                countryFrom: cities[i].countryFrom,
                countryTo: cities[i].countryTo
              },
              isInternational: !cities[i].toKz,
              req: getReq(fromCity, toCity, results.getCities.session, !cities[i].toKz),
              delivery: delivery,
              tariffs: []
            });
          });
        });

        tempRequests.forEach(function (item) {
          req.body.weights.forEach(function (weight) {
            var obj = commonHelper.deepClone(item);
            obj.weight = weight;
            obj.req['massa'] = weight;
            requests.push(obj);
          });
        });
      }

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
        var opts = _.extend({}, item.isInternational ? deliveryData.calcInternationalUrl : deliveryData.calcUrl);
        opts.form = item.req;
        setTimeout(function () {
          async.retry(config.retryOpts, function (callback) {
            request(opts, callback)
          }, function (err, r, b) {
            if (err) {
              item.error = commonHelper.getResponseError(err);
              return callback(null, item);
            }
            var $ = cheerio.load(b);
            var contentContainer = $('.center_content');
            contentContainer.find('h2').remove();
            contentContainer.find('table').remove();
            contentContainer.find('form').remove();
            contentContainer.find('p').remove();
            var str = contentContainer.html().replace(/\s/g, "");
            var splits = str.split('<br>');
            var cost = 0;
            if (splits[1]) {
              cost = cheerio.load(splits[1]).text().replace(commonHelper.COSTREG, "")
            }
            item.tariffs.push({
              service: splits[0],
              cost: cost,
              deliveryTime: ''
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
    commonHelper.saveResults(req, err, {
      delivery: delivery,
      timestamp: timestamp,
      cities: cities,
      items: results.requests || [],
      callback: callback
    });
  });
};