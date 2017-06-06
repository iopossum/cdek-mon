var responseHelper = require('../../helpers/response');
var deliveryHelper = require('../../helpers/delivery');
var commonHelper = require('../../helpers/common');
var async = require('async');
var request = commonHelper.request;
var cheerio = require('cheerio');
var config = require('../../../conf');
var _ = require('underscore');
var logger = require('../../helpers/logger');
var delivery = 'cse';

var getReq = function (from, countryFrom, to, countryTo, opts) {
  from = from || {};
  to = to || {};
  countryFrom = countryFrom || {};
  countryTo = countryTo || {};
  opts = opts || {};
  return {
    'ctl00$ContentPlaceHolderMain$DropDownListFromCountry': countryFrom.id,
    'ctl00$ContentPlaceHolderMain$TextBoxFrom': from.name,
    'ctl00$ContentPlaceHolderMain$TextBoxFrom_value': '',
    'ctl00$ContentPlaceHolderMain$HiddenFieldFromGUID': from.id,
    'ctl00$ContentPlaceHolderMain$HiddenFieldFromControlGUID': from.id,
    'ctl00$ContentPlaceHolderMain$DropDownListToCountry': countryTo.id,
    'ctl00$ContentPlaceHolderMain$TextBoxTo': to.name,
    'ctl00$ContentPlaceHolderMain$TextBoxTo_value': '',
    'ctl00$ContentPlaceHolderMain$HiddenFieldToGUID': to.id,
    'ctl00$ContentPlaceHolderMain$HiddenFieldToControlGUID': to.id,
    'ctl00$ContentPlaceHolderMain$DropDownListTypeOfCargo': '4aab1fc6-fc2b-473a-8728-58bcd4ff79ba',
    'ctl00$ContentPlaceHolderMain$TextBoxWeight': 1,
    'ctl00$ContentPlaceHolderMain$TextBoxLength': '',
    'ctl00$ContentPlaceHolderMain$TextBoxWidth': '',
    'ctl00$ContentPlaceHolderMain$TextBoxHeight': '',
    'ctl00$ContentPlaceHolderMain$TextBoxVolumeWeight': '0.000',
    'ctl00$ContentPlaceHolderMain$ButtonCalc': 'Расчёт',

    '__VIEWSTATE': opts.__VIEWSTATE,
    __VIEWSTATEGENERATOR: opts.__VIEWSTATEGENERATOR,
    __EVENTVALIDATION: opts.__EVENTVALIDATION
  }
};

var parseCity = function (string, divider) {
  string = string || '';
  var result = {};
  var splits = string.split(divider);
  result.id = splits[splits.length - 1];
  result.name = splits[0];
  if (splits.length === 3 && splits[1] && splits[1].length) {
    result.name += ', ' + splits[1];
  }
  return result;
};

var getCity = function (city, country, callback) {
  var deliveryData = deliveryHelper.get(delivery);
  var opts = Object.assign({}, deliveryData.citiesUrl);
  var trim = commonHelper.getCity(city);
  opts.uri += ('text=' + escape(trim));
  opts.uri += ('&country=' + country.id);
  async.retry(config.retryOpts, function (callback) {
    request(opts, callback)
  }, function (err, r, b) {
    var result = {
      city: city,
      country: country,
      cityTrim: trim,
      success: false
    };
    if (err) {
      result.message = commonHelper.getCityJsonError(err, trim);
      return callback(null, result);
    }
    var $ = cheerio.load(b);
    var items = $('li');
    var cities = [];
    items.each(function (index, item) {
      cities.push(parseCity($(item).text(), $(item).find('.locationDivider').text()));
    });
    cities = commonHelper.findInArray(cities, trim, 'name', true);
    if (!cities.length) {
      result.message = commonHelper.getCityNoResultError();
    } else if (cities.length === 1) {
      result.foundCities = cities;
      result.success = true;
    } else {
      var region = commonHelper.getRegionName(city);
      var founds = [];
      if (region) {
        founds = commonHelper.findInArray(cities, region, 'name');
      }
      result.foundCities = founds.length ? founds : [cities[0]];
      result.success = true;
    }
    result.cities = cities;
    callback(null, result);
  });
};

module.exports = function (req, cities, callback) {
  var deliveryData = deliveryHelper.get(delivery);
  var requests = [];
  var cityObj = {};
  var timestamp = callback ? new Date().getTime*2 : commonHelper.getReqStored(req, delivery);
  async.auto({
    getCountries: function (callback) {
      /*async.retry(config.retryOpts, function (callback) {
        var nightmare = commonHelper.getNightmare();
        nightmare.goto(deliveryData.countriesUrl.uri)
          .wait('#cusel-scroll-ctl00_ContentPlaceHolderMain_DropDownListFromCountry')
          .evaluate(function () {
            var container = document.querySelector('#cusel-scroll-ctl00_ContentPlaceHolderMain_DropDownListFromCountry');
            var result = {
              countries: []
            };
            if (!container) {
              return result;
            }
            var spans = container.querySelectorAll('span');
            spans.forEach(function (item, index) {
              result.countries.push({id: item.getAttribute('val'), name: item.innerText.trim().replace(' - ', '').toLowerCase(), success: true, isCountry: true});
            });
            result.__VIEWSTATE = document.querySelector('#__VIEWSTATE').value;
            result.__VIEWSTATEGENERATOR = document.querySelector('#__VIEWSTATEGENERATOR').value;
            result.__EVENTVALIDATION = document.querySelector('#__EVENTVALIDATION').value;
            return result;
          })
          .end()
          .then(function (result) {
            callback(!result.countries.length ? new Error(commonHelper.getCountriesError()) : null, result);
          })
          .catch(function (error) {
            callback(new Error(commonHelper.getCountriesError(error)), []);
          });
      }, function (err, results) {
        async.nextTick(function () {
          callback(err, results || []);
        });
      });*/
      var opts = Object.assign({}, deliveryData.countriesUrl);
      async.retry(config.retryOpts, function (callback) {
        request(opts, callback)
      }, function (err, r, b) {
        var result = {
          countries: []
        };
        if (err) {
          return callback(null, result);
        }
        var $ = cheerio.load(b);
        var spans = $('select').find('option');
        spans.each(function (index, item) {
          result.countries.push({id: $(item).attr('value'), name: $(item).text().trim().replace(' - ', '').toLowerCase(), success: true, isCountry: true});
        });
        result.__VIEWSTATE = $('#__VIEWSTATE').val();
        result.__VIEWSTATEGENERATOR = $('#__VIEWSTATEGENERATOR').val();
        result.__EVENTVALIDATION = $('#__EVENTVALIDATION').val();
        callback(null, result);
      });
    },
    getCities: ['getCountries', function (results, callback) {
      var countryObj = _.indexBy(results.getCountries.countries, 'name');
      async.mapSeries(cities, function (city, callback) {
        if (!city.from || !city.to) {
          city.error = commonHelper.CITIESREQUIRED;
          return async.nextTick(function () {
            callback(null, city);
          });
        }
        if (city.from && !city.countryFrom) {
          city.countryFrom = "россия";
        }
        if (city.to && !city.countryTo) {
          city.countryTo = "россия";
        }
        if (city.countryFrom && typeof countryObj[city.countryFrom.toLowerCase()] === 'undefined') {
          city.error = commonHelper.COUNTRYFROMNOTFOUND;
          return async.nextTick(function () {
            callback(null, city);
          });
        }
        if (city.countryTo && typeof countryObj[city.countryTo.toLowerCase()] === 'undefined') {
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
              if (typeof  cityObj[city.from + city.countryFrom] !== 'undefined') {
                return callback(null);
              }
              getCity(city.from, countryObj[city.countryFrom.toLowerCase()], callback);
            },
            function (callback) {
              if (typeof  cityObj[city.to + city.countryTo] !== 'undefined') {
                return callback(null);
              }
              getCity(city.to, countryObj[city.countryTo.toLowerCase()], callback);
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
                  from: fromCity.name,
                  to: toCity.name,
                  countryFrom: item.countryFrom,
                  countryTo: item.countryTo
                },
                req: getReq(fromCity, item.fromJson.country, toCity, item.toJson.country, results.getCountries),
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
          obj.req['ctl00$ContentPlaceHolderMain$TextBoxWeight'] = weight;
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
        setTimeout(function () {
          async.retry(config.retryOpts, function (callback) {
            request(opts, callback)
          }, function (err, r, b) {
            delete item.req.__VIEWSTATE;
            delete item.req.__EVENTVALIDATION;
            if (err) {
              item.error = commonHelper.getResponseError(err);
              return callback(null, item);
            }
            var $ = cheerio.load(b);
            var trs = $('#ctl00_ContentPlaceHolderMain_infoBlock').find('tr');
            while (trs.length) {
              var isSpecial = $(trs[1]).find('.urgencyDescription').length;
              var multiple = $(trs[isSpecial ? 3 : 2]).find('td').length === 1;
              if (!multiple) {
                var temp = trs.splice(0, isSpecial ? 5 : 4);
                if (temp.length >= 3) {
                  item.tariffs.push({
                    service: $(temp[0]).text(),
                    cost: $($(temp[isSpecial ? 3 : 2]).find('td')[1]).text().replace(commonHelper.COSTREG, ''),
                    deliveryTime: $($(temp[isSpecial ? 2 : 1]).find('td')[1]).text().replace(commonHelper.DELIVERYTIMEREG, '')
                  });
                }
              } else {
                var temp = trs.splice(0, isSpecial ? 7 : 6);
                if (temp.length >= 3) {
                  item.tariffs.push({
                    service: $(temp[0]).text() + ' ' + $($(temp[isSpecial ? 4 : 3]).find('td')[0]).text(),
                    cost: $($(temp[isSpecial ? 4 : 3]).find('td')[1]).text().replace(commonHelper.COSTREG, ''),
                    deliveryTime: $($(temp[isSpecial ? 2 : 1]).find('td')[1]).text().replace(commonHelper.DELIVERYTIMEREG, '')
                  });
                  item.tariffs.push({
                    service: $(temp[0]).text() + ' ' + $($(temp[isSpecial ? 5 : 4]).find('td')[0]).text(),
                    cost: $($(temp[isSpecial ? 5 : 4]).find('td')[1]).text().replace(commonHelper.COSTREG, ''),
                    deliveryTime: $($(temp[isSpecial ? 2 : 1]).find('td')[1]).text().replace(commonHelper.DELIVERYTIMEREG, '')
                  });
                }
              }
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