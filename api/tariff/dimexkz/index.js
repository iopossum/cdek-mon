var responseHelper = require('../../helpers/response');
var deliveryHelper = require('../../helpers/delivery');
var commonHelper = require('../../helpers/common');
var async = require('async');
var request = commonHelper.request;
var cheerio = require('cheerio');
var config = require('../../../conf');
var _ = require('underscore');
var logger = require('../../helpers/logger');
var delivery = 'dimexkz';

var getReq = function (from, to, service) {
  from = from || {};
  to = to || {};
  var req = {
    city: from.value,
    cityo: from.data,
    citypp: to.value,
    cityp: to.data,
    f_length: '',
    f_width: '',
    f_height: '',
    declarv: 'n',
    _: new Date().getTime()
  };
  if (service) {
    req['sel[]'] = service;
  }
  return req;
};

var getIntReq = function (from, country, to) {
  from = from || {};
  to = to || {};
  return {
    city: from.value,
    cityo: from.data,
    countryp: country ? country.id : '',
    citypp: to ? to.value : '',
    cityp: to ? to.data : '',
    f_length: '',
    f_width: '',
    f_height: '',
    f_cena: '',
    declarv: 'n',
    _: new Date().getTime()
  }
};

var getCity = function (city, dest, country, callback) {
  var deliveryData = deliveryHelper.get(delivery);
  var opts = Object.assign({}, deliveryData.citiesUrl);
  var trim = commonHelper.getCity(city);
  var formData = "%5B%7B%22name%22%3A%22sel%5B%5D%22%2C%22value%22%3A%2262%22%7D%2C%7B%22name%22%3A%22sel%5B%5D%22%2C%22value%22%3A%2266%22%7D%2C%7B%22name%22%3A%22sel%5B%5D%22%2C%22value%22%3A%2281%22%7D%2C%7B%22name%22%3A%22city%22%2C%22value%22%3A%22%22%7D%2C%7B%22name%22%3A%22cityo%22%2C%22value%22%3A%22%22%7D%2C%7B%22name%22%3A%22countryp%22%2C%22value%22%3A%22%22%7D%2C%7B%22name%22%3A%22citypp%22%2C%22value%22%3A%22%22%7D%2C%7B%22name%22%3A%22cityp%22%2C%22value%22%3A%22%22%7D%2C%7B%22name%22%3A%22massa%22%2C%22value%22%3A%22%22%7D%2C%7B%22name%22%3A%22declarv%22%2C%22value%22%3A%22d%22%7D%2C%7B%22name%22%3A%22f_length%22%2C%22value%22%3A%22%22%7D%2C%7B%22name%22%3A%22f_width%22%2C%22value%22%3A%22%22%7D%2C%7B%22name%22%3A%22f_height%22%2C%22value%22%3A%22%22%7D%2C%7B%22name%22%3A%22f_cena%22%2C%22value%22%3A%22%22%7D%5D";
  opts.uri += ('formdata=' + formData);
  if (dest) {
    opts.uri += ('&cityq=' + dest);
  }
  if (country) {
    opts.uri += ('&country=' + country.id);
  }
  opts.uri += ('&_=' + new Date().getTime());
  opts.uri += ('&query=' + encodeURIComponent(trim));
  opts.headers['Accept-Language'] = 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7';
  opts.headers['Connection'] = 'keep-alive';
  opts.headers['DNT'] = '1';
  opts.headers['Host'] = 'kzh.tech-dimex.ru';
  opts.headers['Origin'] = 'http://kazakhstan.dimex.ws';
  opts.headers['Referer'] = 'http://kazakhstan.dimex.ws/kalkulyator/?lng=rus';
  async.retry(config.retryOpts, function (callback) {
    request(opts, callback)
  }, function (err, r, b) {
    var result = {
      city: city,
      cityTrim: trim,
      success: false
    };
    if (err) {
      result.message = commonHelper.getCityJsonError(err, trim);
      return callback(null, result);
    }
    var json = null;
    try {
      json = JSON.parse(b);
    } catch (e) {
      result.message = commonHelper.getCityJsonError(e, trim);
    }
    if (!json) {
      return callback(null, result);
    }
    if (!json.suggestions) {
      result.message = commonHelper.getCityJsonError(new Error("Отсутствует suggestions в ответе"), trim);
      return callback(null, result);
    }
    if (!Array.isArray(json.suggestions)) {
      result.message = commonHelper.getCityJsonError(new Error("Неверный тип suggestions в ответе"), trim);
      return callback(null, result);
    }
    if (!json.suggestions.length) {
      result.message = commonHelper.getCityNoResultError(trim);
    } else if (json.suggestions.length === 1) {
      result.foundCities = json.suggestions;
      result.success = true;
    } else {
      var region = commonHelper.getRegionName(city);
      var founds = [];
      if (region) {
        founds = commonHelper.findInArray(json.suggestions, region, 'value');
      }
      result.foundCities = founds.length ? founds : json.suggestions.slice(0,2);
      result.success = true;
    }
    result.country = country;
    callback(null, result);
  });
};

var getCalcResult = function (requests, req, timestamp, isInternational, callback) {
  var deliveryData = deliveryHelper.get(delivery);
  async.mapLimit(requests, 2, function (item, callback) {
    if (commonHelper.getReqStored(req, delivery) > timestamp) {
      return callback({abort: true});
    }
    if (item.error) {
      return async.nextTick(function () {
        callback(null, item);
      });
    }
    setTimeout(function () {
      var opts = _.extend({}, deliveryData.calcUrl);
      if (isInternational) {
        opts.uri += 'sel[]=62&sel[]=66&sel[]=81&';
      } else if (item.city.from === item.city.to) {
        opts.uri += 'sel[]=62&sel[]=64&sel[]=69&';
      } else {
        opts.uri += 'sel[]=62&sel[]=65&sel[]=75&';
      }
      for (var key in item.req) {
        opts.uri += (key + '=' + encodeURIComponent(item.req[key]) + '&');
      }
      opts.headers['Accept-Language'] = 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7';
      opts.headers['Connection'] = 'keep-alive';
      opts.headers['DNT'] = '1';
      opts.headers['Host'] = 'kzh.tech-dimex.ru';
      opts.headers['Origin'] = 'http://kazakhstan.dimex.ws';
      opts.headers['Referer'] = 'http://kazakhstan.dimex.ws/kalkulyator/?lng=rus';
      async.retry(config.retryOpts, function (callback) {
        request(opts, callback)
      }, function (err, r, b) {
        if (err) {
          item.error = commonHelper.getResponseError(err);
          return callback(null, item);
        }
        var $ = cheerio.load(b);
        var trs = $('table').find('tr');
        if (trs[4]) {
          var tds = $(trs[4]).find('td');
          if (tds.length) {
            item.tariffs.push({
              service: $($(trs[2]).find('td')[1]).text() + (item.service ? ' ' + item.service : ''),
              cost: $(tds[8]).text().replace(" ", ""),
              deliveryTime: $(tds[0]).text()
            });
          }
        }
        if (trs[6]) {
          var service = $($(trs[6]).find('td')[0]).text();
          for (var i=6; i<trs.length; i++) {
            var tds = $(trs[i]).find('td');
            if (tds.length > 4) {
              service = $($(trs[i]).find('td')[0]).text();
            }
            item.tariffs.push({
              service: service + ' ' + (tds.length > 4 ? $(tds[1]).text() : $(tds[0]).text()) + (item.service ? ' ' + item.service : ''),
              cost: $(tds[tds.length > 4 ? 4 : 3]).text().replace(" ", ""),
              deliveryTime: ''
            });
          }
        }
        delete item.service;
        if (!item.tariffs.length) {
          item.error = commonHelper.getNoResultError();
        }
        return callback(null, item);
      });
    }, commonHelper.randomInteger(500, 1000));
  }, callback);
};

module.exports = function (req, cities, callback) {
  var deliveryData = deliveryHelper.get(delivery);
  var requests = [];
  var intRequests = [];
  var cityServices = [{id: 72, name: 'В течении 3-5 часов'}, {id: 73, name: 'В течении 24 часов'}];
  var timestamp = callback ? new Date().getTime*2 : commonHelper.getReqStored(req, delivery);
  async.auto({
    getCountries: function (callback) {
      var opts = Object.assign({}, deliveryData.countriesUrl);
      opts.form = 'formdata=%5B%7B%22name%22%3A%22sel%5B%5D%22%2C%22value%22%3A%2262%22%7D%2C%7B%22name%22%3A%22sel%5B%5D%22%2C%22value%22%3A%2266%22%7D%2C%7B%22name%22%3A%22sel%5B%5D%22%2C%22value%22%3A%2281%22%7D%5D';
      opts.headers['Accept-Language'] = 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7';
      opts.headers['Connection'] = 'keep-alive';
      opts.headers['Content-Length'] = '198';
      opts.headers['Content-Type'] = 'application/x-www-form-urlencoded; charset=UTF-8';
      opts.headers['DNT'] = '1';
      opts.headers['Host'] = 'kzh.tech-dimex.ru';
      opts.headers['Origin'] = 'http://kazakhstan.dimex.ws';
      opts.headers['Referer'] = 'http://kazakhstan.dimex.ws/kalkulyator/?lng=rus';
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
          var name = $(item).text().trim().toUpperCase();
          if (['казахстан'].indexOf(name.toLowerCase()) === -1) {
            countries.push({id: $(item).attr('value'), name: name, success: true, isCountry: true});
          }
        });
        callback(null, countries);
      });
    },
    getCities: ['getCountries', function (results, callback) {
      var countryObj = _.indexBy(results.getCountries, 'name');
      async.mapSeries(cities, function (city, callback) {
        city.countryFrom = city.countryFrom || 'Россия';
        city.countryTo = city.countryTo || 'Россия';
        if (city.countryFrom.toLowerCase() === 'казахстан') {
          city.fromKz = true;
        }
        if (city.countryTo.toLowerCase() === 'казахстан') {
          city.toKz = true;
        }
        if (!city.from) {
          city.error = commonHelper.CITYFROMREQUIRED;
          return async.nextTick(function () {
            callback(null, city);
          });
        }
        if (!city.fromKz) {
          city.error = commonHelper.CITYFROMKZ;
          return async.nextTick(function () {
            callback(null, city);
          });
        }
        if (!city.toKz && !results.getCountries.length) {
          city.error = commonHelper.COUNTRYLISTERROR;
          return async.nextTick(function () {
            callback(null, city);
          });
        }
        if (!city.toKz) {
          city.countryTo = deliveryHelper.dimexCountryChanger(city.countryTo);
          if (typeof countryObj[city.countryTo.toUpperCase()] === 'undefined') {
            city.error = commonHelper.COUNTRYNOTFOUND;
            return async.nextTick(function () {
              callback(null, city);
            });
          }
        }
        setTimeout(function () {
          if (commonHelper.getReqStored(req, delivery) > timestamp) {
            return callback({abort: true});
          }
          async.parallel([
            function (callback) {
              getCity(city.from, 'cityo', false, callback);
            },
            function (callback) {
              if (!city.to && countryObj[city.countryTo.toUpperCase()]) {
                return callback(null, {country: countryObj[city.countryTo.toUpperCase()]});
              }
              getCity(city.to, !city.toKz ? 'cityp' : false, countryObj[city.countryTo.toUpperCase()], callback);
            }
          ], function (err, foundCities) {
            city.fromJson = foundCities[0];
            city.toJson = foundCities[1];
            callback(null, city);
          });
        }, commonHelper.randomInteger(500, 1000));
      }, callback);
    }],
    parseCities: ['getCities', function (results, callback) {
      var tempRequests = [];
      var tempIntRequests = [];
      results.getCities.forEach(function (item) {
        if (item.error) {
          requests = requests.concat(commonHelper.getResponseArray(req.body.weights, item, delivery, item.error));
        } else if (!item.fromJson.success) {
          requests = requests.concat(commonHelper.getResponseArray(req.body.weights, item, delivery, item.fromJson.message));
        } else if (!item.toJson.success && !item.toJson.country) {
          requests = requests.concat(commonHelper.getResponseArray(req.body.weights, item, delivery, item.toJson.message));
        } else if (item.toJson.country) {
          item.fromJson.foundCities.forEach(function (fromCity) {
            if (item.toJson.foundCities) {
              item.toJson.foundCities.forEach(function (toCity) {
                tempIntRequests.push({
                  city: {
                    initialCityFrom: item.from,
                    initialCityTo: item.to,
                    from: fromCity.value,
                    to: toCity.value,
                    countryFrom: item.countryFrom,
                    countryTo: item.countryTo
                  },
                  req: getIntReq(fromCity, item.toJson.country, toCity),
                  delivery: delivery,
                  tariffs: []
                });
              });
            } else {
              tempIntRequests.push({
                city: {
                  initialCityFrom: item.from,
                  initialCityTo: item.to,
                  from: fromCity.value,
                  to: item.countryTo,
                  countryFrom: item.countryFrom,
                  countryTo: item.countryTo
                },
                req: getIntReq(fromCity, item.toJson.country),
                delivery: delivery,
                tariffs: []
              });
            }
          });
        } else {
          item.fromJson.foundCities.forEach(function (fromCity) {
            item.toJson.foundCities.forEach(function (toCity) {
              if (item.from === item.to) {
                cityServices.forEach(function (service) {
                  tempRequests.push({
                    city: {
                      initialCityFrom: item.from,
                      initialCityTo: item.to,
                      from: fromCity.value,
                      to: toCity.value,
                      countryFrom: item.countryFrom,
                      countryTo: item.countryTo
                    },
                    req: getReq(fromCity, toCity, service.id),
                    service: service.name,
                    delivery: delivery,
                    tariffs: []
                  });
                });
              } else {
                tempRequests.push({
                  city: {
                    initialCityFrom: item.from,
                    initialCityTo: item.to,
                    from: fromCity.value,
                    to: toCity.value,
                    countryFrom: item.countryFrom,
                    countryTo: item.countryTo
                  },
                  req: getReq(fromCity, toCity),
                  delivery: delivery,
                  tariffs: []
                });
              }
            });
          });
        }
      });
      tempRequests.forEach(function (item) {
        req.body.weights.forEach(function (weight) {
          var obj = commonHelper.deepClone(item);
          obj.weight = weight;
          obj.req.massa = weight;
          requests.push(obj);
        });
      });
      tempIntRequests.forEach(function (item) {
        req.body.weights.forEach(function (weight) {
          var obj = commonHelper.deepClone(item);
          obj.weight = weight;
          obj.req.massa = weight;
          intRequests.push(obj);
        });
      });
      callback(null);
    }],
    requests: ['parseCities', function (results, callback) {
      getCalcResult(requests, req, timestamp, false, callback);
    }],
    internationalRequests: ['parseCities', function (results, callback) {
      getCalcResult(intRequests, req, timestamp, true, callback);
    }]
  }, function (err, results) {
    commonHelper.saveResults(req, err, {
      delivery: delivery,
      timestamp: timestamp,
      cities: cities,
      items: err ? [] : results.requests.concat(results.internationalRequests),
      callback: callback
    });
  });
};