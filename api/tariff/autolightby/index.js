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
var delivery = 'autolightby';

var getReq = function (from, to) {
  from = from || {};
  to = to || {};
  var req = {
    postform: 'do',
    from_itog: 'blr',
    to_itog: 'blr',
    from_country: '',
    from_blr: '',
    from_rus: '',
    from_rus_region: '',
    from_other: '',
    to_country: '',
    to_blr: '',
    to_rus: '',
    to_rus_region: '',
    to_other: '',
    type_cargo:2,
    vas_doc: '',
    col_name: '',
    'ves[]':0,
    'length[]': '',
    'height[]': '',
    'width[]': '',
    'valume[]': '',
    additional:1,
    valume_calc:0.004
  };
  req.from_country = from.id;
  if (from.isFromBy) {
    req.from_blr = from.name;
  } else if (from.isFromRu) {
    req.from_rus = from.name;
  } else {
    req.from_other = from.name;
  }
  req.to_country = to.id;
  if (to.isFromBy) {
    req.to_blr = to.name;
  } else if (to.isFromRu) {
    req.to_rus = to.name;
  } else {
    req.to_other = to.name;
  }
  return req;
};

var getServiceName = function (service) {
  var result = '';
  switch (service) {
    case 1:
      result = 'ДД';
      break;
    case 2:
      result = 'ДС';
      break;
    case 3:
      result = 'СД';
      break;
    case 4:
      result = 'СС';
      break;
  }
  return result;
};

var getCity = function (city, country, isFromBy, callback) {
  var deliveryData = deliveryHelper.get(delivery);
  var opts = Object.assign({}, deliveryData.citiesUrl);
  var trim = commonHelper.getCity(city);
  var isCountry = false;
  var countryQueryString = 'country=';
  if (isFromBy) {
    countryQueryString += 'blr';
  } else if (!country) {
    countryQueryString += 'rus';
  } else {
    countryQueryString += 'outher';
    trim = country;
    isCountry = true;
  }
  opts.uri += ('queryString=' + require('urlencode')(trim, 'cp1251') + '&' + countryQueryString);
  opts.encoding = 'binary';
  async.retry(config.retryOpts, function (callback) {
    request(opts, callback)
  }, function (err, r, b) {
    var result = {
      city: city,
      cityTrim: trim,
      isCountry: isCountry,
      success: false
    };
    if (err) {
      result.message = isCountry ? commonHelper.getCountriesError(err, trim) : commonHelper.getCityJsonError(err, trim);
      return callback(null, result);
    }
    b = iconv.encode(iconv.decode(new Buffer (b, 'binary'), 'win1251'), 'utf8');
    var $ = cheerio.load(b);
    var li = $('.suggestionList').find('li');
    if (!li.length) {
      result.message = isCountry ? commonHelper.getCountryNoResultError(trim) : commonHelper.getCityNoResultError(trim);
      return callback(null, result);
    }
    var items = [];
    li.each(function (i, item) {
      items.push({id: $(item).data('id'), name: $(item).data('value')});
    });
    if (!items.length) {
      result.message = isCountry ? commonHelper.getCountryNoResultError(trim) : commonHelper.getCityNoResultError(trim);
    } else if (items.length === 1) {
      result.foundCities = items;
      result.success = true;
    } else {
      var region = commonHelper.getRegionName(city);
      var founds = [];
      if (region) {
        founds = commonHelper.findInArray(items, region, 'name');
      }
      result.foundCities = founds.length ? founds : items;
      result.success = true;
    }
    result.isFromBy = isFromBy;
    result.isFromRu = !isFromBy && !country;
    result.cities = items;
    callback(null, result);
  });
};

var calcResults = function (req, service, callback) {
  var deliveryData = deliveryHelper.get(delivery);
  var opts = _.extend({}, deliveryData.calcUrl);
  setTimeout(function () {
    async.retry(config.retryOpts, function (callback) {
      opts.form = _.extend({}, req);
      opts.form.additional = service;
      opts.encoding = 'binary';
      opts.headers.Cookie = 'openstat_test=1; BX_USER_ID=c062c9df6e21319654fe8a414abacb2f; _ym_uid=1504413480878612895; jv_enter_ts_E1B2xlLhj0=1504413483225; jv_visits_count_E1B2xlLhj0=1; jv_refer_E1B2xlLhj0=http%3A%2F%2Fautolight.by%2Fautolight_express%2Finfocentr%2F; jv_utm_E1B2xlLhj0=; PHPSESSID=ef2f060ec4de5079b1eec99008455b65; _ga=GA1.2.492668296.1504413480; _gid=GA1.2.294407433.1504413480; _ym_isad=1; _ym_visorc_30010589=w; jv_pages_count_E1B2xlLhj0=4';
      opts.headers['Content-Type'] = 'application/x-www-form-urlencoded; charset=UTF-8';
      opts.headers['X-Requested-With'] = 'XMLHttpRequest';
      opts.headers['Accept'] = 'text/html, */*; q=0.01';
      request(opts, callback)
    }, function (err, r, b) {
      var result = {};
      if (err) {
        result.error = commonHelper.getResponseError(err);
        return callback(null, result);
      }
      b = iconv.encode(iconv.decode(new Buffer (b, 'binary'), 'win1251'), 'utf8');
      var $ = cheerio.load(b);
      var trs = $('.result').find('tr');
      if (!trs.length) {
        result.error = commonHelper.getNoResultError();
        return callback(null, result);
      }
      result.tariffs = [];
      trs.each(function (i, item) {
        if ($(item).find('input').length) {
          var price = $(item).find('.red_price').length ? $(item).find('.red_price') : $(item).find('.red_text');
          result.tariffs.push({
            cost: price.text().trim().replace(commonHelper.COSTREGDOT, '').replace(/\.$/, ''),
            deliveryTime: '',
            service: getServiceName(service) + ': ' + $(item).find('.label').text().trim()
          });
        }
      });
      if (!result.tariffs.length) {
        result.error = commonHelper.getNoResultError();
      }
      return callback(null, result);
    });
  }, commonHelper.randomInteger(500, 1000));
};

module.exports = function (req, cities, callback) {
  var deliveryData = deliveryHelper.get(delivery);
  var requests = [];
  var cityObj = {};
  var timestamp = callback ? new Date().getTime*2 : commonHelper.getReqStored(req, delivery);
  cities.forEach(function (item) {
    if (item.countryFrom && commonHelper.BY.indexOf(item.countryFrom.toLowerCase()) > -1) {
      item.fromBy = true;
    }
    if (item.countryTo && commonHelper.BY.indexOf(item.countryTo.toLowerCase()) > -1) {
      item.toBy = true;
    }
  });
  async.auto({
    getCities: function (callback) {
      async.mapSeries(cities, function (city, callback) {
        if (!city.fromBy && !city.toBy) {
          city.error = commonHelper.getNoResultError();
          return async.nextTick(function () {
            callback(null, city);
          });
        }
        if (!city.from && !city.countryFrom) {
          city.error = commonHelper.CITYORCOUNTRYFROMREQUIRED;
          return async.nextTick(function () {
            callback(null, city);
          });
        }
        if (!city.to && !city.countryTo) {
          city.error = commonHelper.CITYORCOUNTRYTOREQUIRED;
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
              getCity(city.from, city.countryFrom, city.fromBy, callback);
            },
            function (callback) {
              if (typeof  cityObj[city.to + city.countryTo] !== 'undefined') {
                return callback(null);
              }
              getCity(city.to, city.countryTo, city.toBy, callback);
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
              fromCity.isFromBy = item.fromJson.isFromBy;
              fromCity.isFromRu = item.fromJson.isFromRu;
              toCity.isFromBy = item.toJson.isFromBy;
              toCity.isFromRu = item.toJson.isFromRu;
              tempRequests.push({
                city: {
                  initialCityFrom: item.from,
                  initialCityTo: item.to,
                  from: fromCity.name,
                  to: toCity.name,
                  countryFrom: item.countryFrom,
                  countryTo: item.countryTo,
                  isFromBy: item.fromJson.isFromBy,
                  isToBy: item.toJson.isFromBy
                },
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
          obj.req['ves[]'] = weight;
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
        opts.headers = {'X-Requested-With': 'XMLHttpRequest'};
        setTimeout(function () {
          async.parallel([
            function (callback) {
              calcResults(item.req, 1, callback);
            },
            function (callback) {
              if (item.city.isFromBy && item.city.isToBy) {
                return calcResults(item.req, 2, callback);
              }
              callback(null, {});
            },
            function (callback) {
              if (item.city.isFromBy && item.city.isToBy) {
                return calcResults(item.req, 3, callback);
              }
              callback(null, {});
            },
            function (callback) {
              if (item.city.isFromBy && item.city.isToBy) {
                return calcResults(item.req, 4, callback);
              }
              callback(null, {});
            }
          ], function (err, results) {
            if (results[0].tariffs) {
              item.tariffs = item.tariffs.concat(results[0].tariffs);
            }
            if (results[1].tariffs) {
              item.tariffs = item.tariffs.concat(results[1].tariffs);
            }
            if (results[2].tariffs) {
              item.tariffs = item.tariffs.concat(results[2].tariffs);
            }
            if (results[3].tariffs) {
              item.tariffs = item.tariffs.concat(results[3].tariffs);
            }
            if (!item.tariffs.length) {
              item.error = results[0].error || results[1].error || results[2].error || results[3].error;
            }
            callback(null, item);
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