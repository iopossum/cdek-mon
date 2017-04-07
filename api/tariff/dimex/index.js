var responseHelper = require('../../helpers/response');
var deliveryHelper = require('../../helpers/delivery');
var commonHelper = require('../../helpers/common');
var async = require('async');
var request = commonHelper.request;
var cheerio = require('cheerio');
var config = require('../../../conf');
var _ = require('underscore');
var logger = require('../../helpers/logger');
var delivery = 'dimex';

var getReq = function (from, to) {
  from = from || {};
  to = to || {};
  return {
    endselcat: 12,
    city: from.value,
    cityo: from.data,
    citypp: to.value,
    cityp: to.data,
    f_length: '',
    f_width: '',
    f_height: '',
    declarv: '',
    _: 1491551005091
  }
};

var getIntReq = function (from, to) {
  from = from || {};
  to = to || {};
  return {
    endselcat: 19,
    city: from.value,
    cityo: from.data,
    countryp: to.id,
    citypp: '',
    cityp: '',
    f_length: '',
    f_width: '',
    f_height: '',
    f_cena: '',
    declarv: 'd',
    _: 1491551005091
  }
};

var getCity = function (city, dest, callback) {
  var deliveryData = deliveryHelper.get(delivery);
  var opts = Object.assign({}, deliveryData.citiesUrl);
  var trim = commonHelper.getCity(city);
  var formData = "%5B%7B%22name%22%3A%22endselcat%22%2C%22value%22%3A%2212%22%7D%2C%7B%22name%22%3A%22sel%5B%5D%22%2C%22value%22%3A%222%22%7D%2C%7B%22name%22%3A%22sel%5B%5D%22%2C%22value%22%3A%225%22%7D%2C%7B%22name%22%3A%22sel%5B%5D%22%2C%22value%22%3A%2212%22%7D%2C%7B%22name%22%3A%22city%22%2C%22value%22%3A%22%22%7D%2C%7B%22name%22%3A%22cityo%22%2C%22value%22%3A%22%22%7D%2C%7B%22name%22%3A%22citypp%22%2C%22value%22%3A%22%22%7D%2C%7B%22name%22%3A%22cityp%22%2C%22value%22%3A%22%22%7D%2C%7B%22name%22%3A%22massa%22%2C%22value%22%3A%22%22%7D%2C%7B%22name%22%3A%22f_length%22%2C%22value%22%3A%22%22%7D%2C%7B%22name%22%3A%22f_width%22%2C%22value%22%3A%22%22%7D%2C%7B%22name%22%3A%22f_height%22%2C%22value%22%3A%22%22%7D%2C%7B%22name%22%3A%22declarv%22%2C%22value%22%3A%22%22%7D%5D";
  opts.uri += ('formdata=' + formData);
  opts.uri += ('&cityq=' + dest);
  opts.uri += ('&_=' + new Date().getTime());
  opts.uri += ('&query=' + encodeURIComponent(trim));
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
    if (!json.suggestions) {
      result.message = commonHelper.getCityJsonError(new Error("Отсутствует suggestions в ответе"));
      return callback(null, result);
    }
    if (!Array.isArray(json.suggestions)) {
      result.message = commonHelper.getCityJsonError(new Error("Неверный тип suggestions в ответе"));
      return callback(null, result);
    }
    if (!json.suggestions.length) {
      result.message = commonHelper.getCityNoResultError();
    } else if (json.suggestions.length === 1) {
      result.foundCities = json.suggestions;
      result.success = true;
    } else {
      var region = commonHelper.getRegionName(city);
      var founds = [];
      if (region) {
        json.suggestions.forEach(function (item) {
          if (new RegExp(region, 'gi').test(item.value)) {
            founds.push(item);
          }
        });
      }
      result.foundCities = founds.length ? founds : [json.suggestions[0]];
      result.success = true;
    }
    result.cities = json.suggestions;
    callback(null, result);
  });
};

var getCalcResult = function (requests, timestamp, inOpts, callback) {
  async.mapLimit(requests, 2, function (item, callback) {
    if (global[delivery] > timestamp) {
      return callback({abort: true});
    }
    if (item.error) {
      return callback(null, item);
    }
    setTimeout(function () {
      var opts = _.extend({}, inOpts);
      for (var key in item.req) {
        opts.uri += (key + '=' + encodeURIComponent(item.req[key]) + '&');
      }
      async.retry(config.retryOpts, function (callback) {
        request(opts, callback)
      }, function (err, r, b) {
        if (err) {
          item.error = commonHelper.getResponseError(err);
          return callback(null, item);
        }
        var $ = cheerio.load(b);
        var trs = $('.calcul').find('tr');
        if (trs[4]) {
          var tds = $(trs[4]).find('td');
          if (tds.length) {
            item.tariffs.push({
              service: $($(trs[2]).find('td')[1]).text(),
              cost: $(tds[8]).text(),
              deliveryTime: $(tds[0]).text()
            });
          }
        }
        if (trs[6]) {
          var service = $($(trs[6]).find('td')[0]).text();
          for (var i=6; i<trs.length; i++) {
            var tds = $(trs[i]).find('td');
            item.tariffs.push({
              service: service + ' ' + (i === 6 ? $(tds[1]).text() : $(tds[0]).text()),
              cost: $(tds[4]).text(),
              deliveryTime: ''
            });
          }
        }
        if (!item.tariffs.length) {
          item.error = commonHelper.getNoResultError();
        }
        return callback(null, item);
      });
    }, commonHelper.randomInteger(500, 1000));
  }, callback);
};

module.exports = function (req, res) {
  var deliveryData = deliveryHelper.get(delivery);
  var requests = [];
  var intRequests = [];
  var cityObj = {};
  var timestamp = global[delivery];
  async.auto({
    getCountries: function (callback) {
      var opts = Object.assign({}, deliveryData.countriesUrl);
      opts.form = 'formdata=%5B%7B%22name%22%3A%22endselcat%22%2C%22value%22%3A%2219%22%7D%2C%7B%22name%22%3A%22sel%5B%5D%22%2C%22value%22%3A%222%22%7D%2C%7B%22name%22%3A%22sel%5B%5D%22%2C%22value%22%3A%226%22%7D%2C%7B%22name%22%3A%22sel%5B%5D%22%2C%22value%22%3A%2219%22%7D%5D'
      async.retry(config.retryOpts, function (callback) {
        request(opts, callback)
      }, function (err, r, b) {
        if (err) {
          return callback(null, []);
        }
        var $ = cheerio.load(b);
        var options = $('#ccp').find('option');
        var countries = [];
        options.each(function (index, item) {
          countries.push({id: $(item).attr('value'), name: $(item).text().trim().toUpperCase(), success: true, isCountry: true});
        });
        callback(null, countries);
      });
    },
    getCities: ['getCountries', function (results, callback) {
      var countryObj = _.indexBy(results.getCountries, 'name');
      async.mapSeries(req.body.cities, function (city, callback) {
        if (!city.from) {
          city.error = commonHelper.CITYFROMREQUIRED;
          return callback(null, city);
        }
        if (!city.to && !city.countryTo) {
          city.error = commonHelper.CITYORCOUNTRYTOREQUIRED;
          return callback(null, city);
        }
        if (city.countryTo && !results.getCountries.length) {
          city.error = commonHelper.COUNTRYLISTERROR;
          return callback(null, city);
        }
        if (city.countryTo && typeof countryObj[city.countryTo.toUpperCase()] === 'undefined') {
          city.error = commonHelper.COUNTRYNOTFOUND;
          return callback(null, city);
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
              getCity(city.from, 'cityo', callback);
            },
            function (callback) {
              if (typeof  cityObj[city.to + city.countryTo] !== 'undefined') {
                return callback(null);
              }
              if (city.countryTo) {
                return callback(null, countryObj[city.countryTo.toUpperCase()]);
              }
              getCity(city.to, 'cityp', callback);
            }
          ], function (err, cities) { //ошибки быть не может
            if (typeof  cityObj[city.from + city.countryFrom] === 'undefined') {
              cityObj[city.from + city.countryFrom] = cities[0];
            }
            if (typeof  cityObj[city.to + city.countryTo] === 'undefined') {
              cityObj[city.to + city.countryTo] = cities[1];
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
      var tempIntRequests = [];
      results.getCities.forEach(function (item) {
        if (item.error) {
          requests = requests.concat(commonHelper.getResponseArray(req.body.weights, item, delivery, item.error));
        } else if (!item.fromJson.success) {
          requests = requests.concat(commonHelper.getResponseArray(req.body.weights, item, delivery, item.fromJson.message));
        } else if (!item.toJson.success) {
          requests = requests.concat(commonHelper.getResponseArray(req.body.weights, item, delivery, item.toJson.message));
        } else if (item.toJson.isCountry) {
          item.fromJson.foundCities.forEach(function (fromCity) {
            tempIntRequests.push({
              city: {
                initialCityFrom: item.from,
                initialCityTo: item.to,
                from: fromCity.name,
                to: item.to,
                countryFrom: item.countryFrom,
                countryTo: item.countryTo
              },
              req: getIntReq(fromCity, item.toJson),
              delivery: delivery,
              tariffs: []
            });
          });
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
          var obj = Object.assign({}, item);
          obj.weight = weight;
          obj.req.massa = weight;
          requests.push(obj);
        });
      });
      tempIntRequests.forEach(function (item) {
        req.body.weights.forEach(function (weight) {
          var obj = Object.assign({}, item);
          obj.weight = weight;
          obj.req.massa = weight;
          intRequests.push(obj);
        });
      });
      callback(null);
    }],
    requests: ['parseCities', function (results, callback) {
      var opts = _.extend({}, deliveryData.calcUrl);
      opts.uri += 'sel[]=2&sel[]=5&sel[]=12&';
      getCalcResult(requests, timestamp, opts, callback);
    }],
    internationalRequests: ['parseCities', function (results, callback) {
      var opts = _.extend({}, deliveryData.calcUrl);
      opts.uri += 'sel[]=2&sel[]=6&sel[]=19&';
      getCalcResult(intRequests, timestamp, opts, callback);
    }]
  }, function (err, results) {
    logger.tariffsInfoLog(delivery, results.requests, 'getTariffs');
    logger.tariffsInfoLog(delivery, results.internationalRequests, 'getTIntariffs');
    if (err) {
      if (err.abort) {
        return false;
      }
      req.session.delivery[delivery].complete = true;
      req.session.delivery[delivery].error = err.message || err.stack;
      var array = [];
      req.body.cities.forEach(function (item) {
        array = array.concat(commonHelper.getResponseArray(req.body.weights, item, delivery, err.message || err.stack))
      });
      req.session.delivery[delivery].results = array;
      req.session.save(function () {});
      return false;
    }
    req.session.delivery[delivery].complete = true;
    req.session.delivery[delivery].results = results.requests.concat(results.internationalRequests);
    req.session.save(function () {});
  });
};