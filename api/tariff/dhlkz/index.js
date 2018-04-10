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
var delivery = 'dhlkz';
var date = [0, 6].indexOf(moment().weekday()) > -1 ? moment().add(2, 'days') : moment();

var getReq = function (from, to, cFrom, cTo) {
  return {
    dtbl: 'N',
    declVal: '',
    declValCur: 'KZT',
    wgtUom: 'kg',
    dimUom: 'cm',
    noPce: 1,
    wgt0: 1,
    w0: '',
    l0: '',
    h0: '',
    shpDate: date.format('YYYY-MM-DD'),
    orgCtry: cFrom,
    orgCity: '',
    orgSub: '',
    orgZip: from.postcode,
    dstCtry: cTo,
    dstCity: '',
    dstSub: '',
    dstZip: to.postcode
  }
};

var getCityReq = function (city, country) {
  return {
    start: 0,
    max: 1000,
    queryBy: 1,
    cntryCd: country,
    cityNmStart: city,
    t: new Date().getTime()
  }
};

var getDeliveryTime = function (obj) {
  obj = obj || {};
  if (!obj.estDeliv) {
    return '';
  }
  var mDate = moment(obj.estDeliv, 'DD MMM YYYY');
  if (!mDate.isValid()) {
    return '';
  }
  return mDate.startOf('day').diff(date.startOf('day'), 'days');
};

var getCity = function (city, country, callback) {
  var deliveryData = deliveryHelper.get(delivery);
  var opts = _.extend({}, deliveryData.citiesUrl);
  var cityTrim = commonHelper.getCity(city);
  cityTrim = cityTrim.replace(/[0-9]/g, '').trim();
  if (cityTrim && cityTrim.toLowerCase() === 'karagandy') {
    cityTrim = 'karaganda';
  }
  opts.uri += commonHelper.getQueryString(getCityReq(cityTrim, country));
  setTimeout(function () {
    async.retry(config.retryOpts, function (callback) {
      request(opts, callback)
    }, function (err, r, json) {
      var result = {
        success: false
      };
      if (err || !json) {
        result.message = commonHelper.getCityJsonError(err || new Error("Неверный формат json"));
        return callback(null, result);
      }
      if (json.errorMessage) {
        result.message = json.errorMessage;
        return callback(null, result);
      }
      if (!json.postalLocationList) {
        result.message = commonHelper.getCityJsonError(new Error("Отсутствует обязательный параметр postalLocationList."), cityTrim);
        return callback(null, result);
      }
      if (!json.postalLocationList.postalLocation) {
        result.message = commonHelper.getCityJsonError(new Error("Отсутствует обязательный параметр postalLocationList.postalLocation. "), cityTrim);
        return callback(null, result);
      }
      if (!Array.isArray(json.postalLocationList.postalLocation)) {
        result.message = commonHelper.getCityJsonError(new Error("Неверный формат postalLocation."), cityTrim);
        return callback(null, result);
      }
      if (!json.postalLocationList.postalLocation.length) {
        result.message = commonHelper.getCityNoResultError(cityTrim);
      } else if (json.postalLocationList.postalLocation.length === 1) {
        result.foundCities = json.postalLocationList.postalLocation;
        result.success = true;
      } else {
        var region = commonHelper.getRegionName(city);
        var founds = [];
        if (region) {
          founds = commonHelper.findInArray(json.postalLocationList.postalLocation, region, 'cityName');
        }
        result.foundCities = founds.length ? [founds[0]] : [json.postalLocationList.postalLocation[0]];
        result.success = true;
      }
      callback(null, result);
    });
  }, commonHelper.randomInteger(500, 1000));
};

var getCountries = function (callback) {
  var deliveryData = deliveryHelper.get(delivery);
  var opts = _.extend({}, deliveryData.countriesUrl);
  opts.uri += '&t=' + new Date().getTime();
  async.retry(config.retryOpts, function (callback) {
    request(opts, callback)
  }, function (err, r, json) {
    if (err || !json) {
      return callback(commonHelper.getCountriesError(err));
    }
    if (!json.dhlCountryList) {
      return callback(commonHelper.getCountriesError(new Error("Неверный формат ответа, отсутствует параметр dhlCountryList")));
    }
    if (!json.dhlCountryList.dhlCountry) {
      return callback(commonHelper.getCountriesError(new Error("Неверный формат ответа, отсутствует параметр dhlCountryList.dhlCountry")));
    }
    if (!Array.isArray(json.dhlCountryList.dhlCountry)) {
      return callback(commonHelper.getCountriesError(new Error("Неверный формат ответа, dhlCountry не массив")));
    }
    return callback(null, json.dhlCountryList.dhlCountry);
  });
};

var getResult = function (task, callback) {
  var deliveryData = deliveryHelper.get(delivery);
  var opts = _.extend({}, deliveryData.calcUrl);
  opts.uri += commonHelper.getQueryString(task.req);
  async.retry(config.retryOpts, function (callback) {
    request(opts, callback)
  }, function (err, r, json) {
    if (err || !json) {
      return callback(commonHelper.getResultJsonError(err));
    }
    if (json.errorMessage) {
      return callback(commonHelper.getResultJsonError(new Error(json.errorMessage)));
    }
    if (!json.quotationList) {
      return callback(commonHelper.getResultJsonError(new Error("Неверный формат ответа, отсутствует параметр quotationList")));
    }
    if (!json.quotationList.quotation) {
      return callback(commonHelper.getResultJsonError(new Error("Неверный формат ответа, отсутствует параметр quotationList.quotation")));
    }
    if (!Array.isArray(json.quotationList.quotation)) {
      return callback(commonHelper.getResultJsonError(new Error("Неверный формат ответа, quotation не массив")));
    }
    var tariffs = json.quotationList.quotation.map(function (item) {
      return {
        service: item.prodNm,
        deliveryTime: getDeliveryTime(item),
        cost: item.estTotPrice ? item.estTotPrice.replace(commonHelper.COSTREGDOT, '') : ''
      }
    });
    if (!tariffs.length) {
      return callback(commonHelper.getNoResultError());
    }
    return callback(null, tariffs);
  });
};

module.exports = function (req, cities, callback) {
  var deliveryData = deliveryHelper.get(delivery);
  var requests = [];
  var timestamp = callback ? new Date().getTime*2 : commonHelper.getReqStored(req, delivery);
  var cityObj = {};
  var q = async.queue(function(task, callback) {
    if (commonHelper.getReqStored(req, delivery) > timestamp) {
      return callback({abort: true});
    }
    var taskRequests = [];
    async.auto({
      getCityFrom: function (callback) {
        if (cityObj[task.from + task.countryFrom]) {
          return callback(null, cityObj[task.from + task.countryFrom]);
        }
        getCity(task.fromEngName, task.countryFromEngShort, callback);
      },
      getCityTo: function (callback) {
        if (cityObj[task.to + task.countryTo]) {
          return callback(null, cityObj[task.to + task.countryTo]);
        }
        getCity(task.toEngName, task.countryToEngShort, callback);
      },
      parseCities: ['getCityFrom', 'getCityTo', function (results, callback) {
        if (!cityObj[task.from + task.countryFrom] && results.getCityFrom.success) {
          cityObj[task.from + task.countryFrom] = results.getCityFrom;
        }
        if (!cityObj[task.to + task.countryTo] && results.getCityTo.success) {
          cityObj[task.to + task.countryTo] = results.getCityTo;
        }
        if (!results.getCityFrom.success || !results.getCityTo.success) {
          task.error = results.getCityFrom.message || results.getCityTo.message;
          taskRequests = taskRequests.concat(commonHelper.getResponseArray(req.body.weights, task, delivery, task.error));
          return callback();
        }
        var tempRequests = [];
        results.getCityFrom.foundCities.forEach(function (fromCity) {
          results.getCityTo.foundCities.forEach(function (toCity) {
            tempRequests.push({
              city: {
                initialCityFrom: task.from,
                initialCityTo: task.to,
                from: fromCity.cityName + ' (' + fromCity.postcode + ')',
                to: toCity.cityName + ' (' + toCity.postcode + ')',
                countryFrom: task.countryFrom,
                countryTo: task.countryTo
              },
              req: getReq(fromCity, toCity, task.countryFromEngShort, task.countryToEngShort),
              delivery: delivery,
              tariffs: []
            });
          });
        });
        tempRequests.forEach(function (item) {
          req.body.weights.forEach(function (weight) {
            var obj = commonHelper.deepClone(item);
            obj.weight = weight;
            obj.req['wgt0'] = weight;
            taskRequests.push(obj);
          });
        });
        callback();
      }],
      requests: ['parseCities', function (results, callback) {
        async.mapLimit(taskRequests, 2, function (item, callback) {
          if (commonHelper.getReqStored(req, delivery) > timestamp) {
            return callback({abort: true});
          }
          if (item.error) {
            return async.nextTick(function () {
              callback(null, item);
            });
          }
          getResult(item, function (err, tariffs) {
            if (err) {
              item.error = err;
            } else {
              item.tariffs = tariffs;
            }
            callback(null, item);
          });
        }, callback);
      }]
    }, function (err, results) {
      requests = requests.concat(results.requests);
      callback();
    });
  }, 1);

  cities.forEach(function (item) {
    if (item.countryFrom.toLowerCase() === 'казахстан') {
      item.fromKz = true;
    }
    if (item.countryTo.toLowerCase() === 'казахстан') {
      item.toKz = true;
    }
    if (!item.fromKz && !item.toKz) {
      requests = requests.concat(commonHelper.getResponseArray(req.body.weights, item, delivery, commonHelper.CITYFROMORTOKZ));
    } else if (!item.fromEngName || !item.toEngName) {
      requests = requests.concat(commonHelper.getResponseArray(req.body.weights, item, delivery, item.toEngName ? commonHelper.POSTCODEFROMNOTFOUND : commonHelper.POSTCODETONOTFOUND));
    } else {
      q.push(item);
    }
  });

  q.drain = function() {
    commonHelper.saveResults(req, null, {
      delivery: delivery,
      timestamp: timestamp,
      cities: cities,
      items: requests,
      callback: callback
    });
  };
};