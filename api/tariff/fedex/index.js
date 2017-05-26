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
var delivery = 'fedex';

var getReq = function (item) {
  item = item || {};
  return {
    /*input: {
      recipient: {
        address: {
          city: commonHelper.getCity(item.from),
          countryCode: item.countryFromEngShort,
          postalCode: item.postcodeFrom,
          residential: false,
          stateOrProvinceCode: ""
        }
      },
      sender: {
        city: commonHelper.getCity(item.to),
        countryCode: item.countryToEngShort,
        postalCode: item.postcodeTo,
        residential: false,
        stateOrProvinceCode: ""
      },
      shipDate: '',
      systemOfMeasureType: '"IMPERIAL"'
    }*/
    BuildTimeStamp: new Date(),
    transitTime:false,
    doEdt:false,
    locId: 'express',
    originSelected: 'N',
    destSelected: 'N',
    origState: '',
    pricingOptionDisplayed: false,
    cmdcResponse: '',
    zipField: '',
    currentPage: 'rfsshipfromto',
    outlookAddressType: '',
    outLookResult: '',
    origCountry: item.countryFromEngShort,
    origZip: item.postcodeFrom,
    origCity: commonHelper.getCity(item.from),
    destCountry: item.countryToEngShort,
    destZip: item.postcodeTo,
    destCity: commonHelper.getCity(item.to),
    pricingOption: 'FEDEX_STANDARD_RATE',
    totalNumberOfPackages: 1,
    isPackageIdentical: 'NO',
    perPackageWeight: 1,
    weightUnit: 'kgs',
    receivedAtCode: 1,
    shipDate: moment().add(7, 'days').format('MM/DD/YYYY'),
    shipCalendarDate: moment().add(7, 'days').format('MM/DD/YYYY')
  };
};

module.exports = function (req, cities, callback) {
  var deliveryData = deliveryHelper.get(delivery);
  var requests = [];
  var timestamp = callback ? new Date().getTime*2 : global[delivery];
  async.auto({
    getCountries: function (callback) {
      var opts = Object.assign({}, deliveryData.countriesUrl);
      async.retry(config.retryOpts, function (callback) {
        request(opts, callback)
      }, function (err, r, b) {
        var result = {
          countriesFrom: [],
          countriesTo: [],
          cookie: ''
        };
        if (err) {
          return callback(null, result);
        }
        try {
          result.cookie = r.headers['set-cookie'][2].split(';')[0];
        } catch (e) {}
        if (!result.cookie) {
          return callback('Не удалось получить cookie.');
        }
        var $ = cheerio.load(b);
        var fromOpts = $('#origCountryId').find('option');
        var toOpts = $('#destCountryId').find('option');
        fromOpts.each(function (index, item) {
          if ($(item).attr('value')) {
            result.countriesFrom.push({
              id: $(item).attr('value'),
              name: $(item).text().trim().toLowerCase()
            });
          }
        });
        toOpts.each(function (index, item) {
          if ($(item).attr('value')) {
            result.countriesTo.push({
              id: $(item).attr('value'),
              name: $(item).text().trim().toLowerCase()
            });
          }
        });
        callback(null, result);
      });
    },
    getCities: ['getCountries', function (results, callback) {
      var countryFromObj = _.indexBy(results.getCountries.countriesFrom, 'name');
      var countryToObj = _.indexBy(results.getCountries.countriesTo, 'name');
      async.mapSeries(cities, function (city, callback) {
        if (!city.from || !city.to) {
          city.error = commonHelper.CITIESREQUIRED;
          return async.nextTick(function () {
            callback(null, city);
          });
        }
        if (!city.postcodeFrom) {
          city.error = commonHelper.POSTCODEFROMNOTFOUND;
          return async.nextTick(function () {
            callback(null, city);
          });
        }
        if (!city.postcodeTo) {
          city.error = commonHelper.POSTCODETONOTFOUND;
          return async.nextTick(function () {
            callback(null, city);
          });
        }
        if (!city.countryFrom) {
          city.countryFrom = "российская федерация";
        }
        if (!city.countryTo) {
          city.countryTo = "российская федерация";
        }
        if (typeof countryFromObj[city.countryFrom.toLowerCase()] === 'undefined') {
          city.error = commonHelper.COUNTRYFROMNOTFOUND;
          return async.nextTick(function () {
            callback(null, city);
          });
        }
        if (typeof countryToObj[city.countryTo.toLowerCase()] === 'undefined') {
          city.error = commonHelper.COUNTRYNOTFOUND;
          return async.nextTick(function () {
            callback(null, city);
          });
        }
        callback(null, city);
      }, callback);
    }],
    parseCities: ['getCities', function (results, callback) {
      logger.tariffsInfoLog(delivery, results.getCities, 'getCities');
      var tempRequests = [];
      results.getCities.forEach(function (item) {
        if (item.error) {
          requests = requests.concat(commonHelper.getResponseArray(req.body.weights, item, delivery, item.error));
        } else {
          var copy = _.clone(item);
          copy.initialCityFrom = item.from;
          copy.initialCityTo = item.to;
          copy.from = item.from;
          copy.to = item.to;
          copy.countryFrom = item.countryFrom;
          copy.countryTo = item.countryTo;
          tempRequests.push({
            city: copy,
            req: getReq(item),
            delivery: delivery,
            tariffs: []
          });
        }
      });
      tempRequests.forEach(function (item) {
        req.body.weights.forEach(function (weight) {
          var obj = commonHelper.deepClone(item);
          obj.weight = weight;
          obj.req.perPackageWeight = weight;
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
        opts.headers.Cookie = results.getCountries.cookie + '; fdx_locale=ru_RU; tracking_locale=ru_RU; countryPath=ratefinder; s_cc=true; siteDC=edc;';
        setTimeout(function () {
          async.retry(config.retryOpts, function (callback) {
            request(opts, callback)
          }, function (err, r, b) {
            if (err) {
              item.error = commonHelper.getResponseError(err);
              return callback(null, item);
            }
            var $ = cheerio.load(b);
            var trs = $('.tablebold').find('tr');
            trs.each(function (index, tr) {
              if ([0,1].indexOf(index) === -1) {
                var service = $($(tr).find('td')[2]).text().trim();
                var time = $($(tr).find('td')[1]).text().trim();
                if (/Невозможно определить/.test(time)) {
                  time = '';
                } else {
                  var splits = time.split(' ');
                  var date = [splits[0], splits[1], splits[2], splits[3]].join(' ');
                  var momentDate = moment(date, 'dd MMMM D, YYYY', 'ru');
                  if (momentDate.isValid()) {
                    time = momentDate.diff(moment().add(7, 'days'), 'days') + 1;
                  }
                }
                var cost = $($(tr).find('td')[3]).text().trim();
                item.tariffs.push(commonHelper.createTariff(service, cost + '$', time));
              }
            });
            if ($('.contentsmall').find('.error').length) {
              item.error = $('.contentsmall').find('.error').text().trim();
            } else if (!item.tariffs.length) {
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