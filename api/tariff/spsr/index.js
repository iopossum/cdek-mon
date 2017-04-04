var responseHelper = require('../../helpers/response');
var deliveryHelper = require('../../helpers/delivery');
var commonHelper = require('../../helpers/common');
var async = require('async');
var request = commonHelper.request;
var cheerio = require('cheerio');
var config = require('../../../conf');
var _ = require('underscore');

var getReq = function (from, to, weight, form_build_id) {
  from.foundCity = from.foundCity || {};
  to.foundCity = to.foundCity || {};
  return {
    from_ship_region_id: '',
    form_build_id: form_build_id,
    form_id: 'spsr_calculator_form',
    from_ship: from.foundCity.label,
    from_ship_id: from.foundCity.id,
    from_ship_owner_id: '',
    to_send: to.foundCity.label,
    to_send_id: to.foundCity.id,
    to_send_owner_id: '',
    weight: weight,
    EncloseType: 15
  }
};

module.exports = function (req, res) {
  var delivery = 'spsr';
  var deliveryData = deliveryHelper.get(delivery);
  var requests = [];
  var cityObj = {};
  var timestamp = global[delivery];
  req.body.cities.forEach(function (item) {
    if (item.from) {
      if (typeof cityObj[item.from] === 'undefined') {
        cityObj[item.from] = true;
      }
    }
    if (item.to) {
      if (typeof cityObj[item.to] === 'undefined') {
        cityObj[item.to] = true;
      }
    }
    if (!item.from || !item.to) {
      requests.push({cityFrom: item.from, cityTo: item.to, countryFrom: item.countryFrom, countryTo: item.countryTo, delivery: delivery, tariffs: [], error: 'Должен быть указан хотя бы 1 город'});
    }
  });
  async.auto({
    getCities: function (callback) {
      async.mapLimit(_.keys(cityObj), 3, function (city, callback) {
          setTimeout(function () {
            if (global[delivery] > timestamp) {
              return callback({abort: true});
            }
            var opts = Object.assign({}, deliveryData.citiesUrl);
            var trim = commonHelper.getCity(city);
            opts.uri += encodeURIComponent(trim);
            async.retry(config.retryOpts, function (callback) {
              request(opts, callback)
            }, function (err, r, b) {
              var result = {
                city: city,
                cityTrim: trim,
                success: false
              };
              if (err) {
                result.message = "Не удалось получить города с сайта. " + (err.message ? 'Ошибка: ' + err.message : '');
                cityObj[city] = result;
                return callback(null, result);
              }
              var array = null;
              try {
                array = JSON.parse(b);
              } catch (e) {
                result.message = "Не удалось получить города с сайта. Неверный ответ от сервера. " + (e.message ? 'Ошибка: ' + e.message : '');
              }
              if (!array) {
                cityObj[city] = result;
                return callback(null, result);
              }
              if (!array.length) {
                result.message = "Не удалось получить города с сайта. Такого города нет в БД сайта.";
              } else if (array.length === 1) {
                result.foundCity = array[0];
                result.success = true;
              } else {
                var region = commonHelper.getRegionName(city);
                var founds = [];
                if (region) {
                  array.forEach(function (item) {
                    if (new RegExp(region, 'gi').test(item)) {
                      founds.push(item);
                    }
                  });
                }
                result.foundCity = founds[0] || array[0];
                result.success = true;
              }
              result.cities = array;
              cityObj[city] = result;
              callback(null, result);
            });
          }, commonHelper.randomInteger(500, 1000));
      }, callback);
    },
    getFormBuildId: function (callback) {
      var opts = deliveryData.calcGetUrl;
      async.retry(config.retryOpts, function (callback) {
        request(opts, callback)
      }, function (err, r, b) {
        if (err) {
          return callback(e);
        }
        var $ = cheerio.load(b);
        var formBuildId = $('input[name="form_build_id"]').val();
        if (!formBuildId) {
          return callback(new Error("Внутренняя ошибка сайта. Попробуйте позже. Отсутствует form_build_id"));
        }
        callback(null, formBuildId)
      });
    },
    parseCities: ['getCities', 'getFormBuildId', function (results, callback) {
      req.body.cities.forEach(function (item) {
        if (item.from && item.to) {
          req.body.weights.forEach(function (weight) {
            var spsrReq = getReq(cityObj[item.from], cityObj[item.to], weight, results.getFormBuildId);
            requests.push({
              weight: weight,
              city: item,
              delivery: delivery,
              req: spsrReq,
              error: !cityObj[item.from].success || !cityObj[item.to].success ? (cityObj[item.from].message || cityObj[item.to].message) : null,
              tariffs: []
            });
          });
        }
      });
      var opts = _.extend({}, deliveryData.calcUrl);
      async.mapSeries(requests, function (item, callback) {
        if (global[delivery] > timestamp) {
          return callback({abort: true});
        }
        if (item.error) {
          return callback(null, item);
        }
        setTimeout(function () {
          async.retry(config.retryOpts, function (callback) {
            opts.form = item.req;
            request(opts, callback)
          }, function (err, r, b) {
            if (err) {
              item.error = "Не удалось получить информацию с сайта, попробуйте позже";
              return callback(null, item);
            }
            var json = null;
            try {
              json = JSON.parse(b);
            } catch (e) {
              item.error = "Не удалось получить информацию с сайта, попробуйте позже. " + (e.message ? 'Ошибка: ' + e.message : '');
            }
            if (!json) {
              return callback(null, item);
            }
            if (!Array.isArray(json)) {
              item.message = "Не удалось получить информацию с сайта, неверный ответ. Попробуйте позже.";
              item.res = json;
              return callback(null, item);
            }
            var filtered = json.filter(function (item) {
              return item.command === 'insert' && !item.method;
            });
            if (!filtered.length) {
              item.message = "Не удалось получить информацию с сайта. Попробуйте позже.";
              item.res = json;
              return callback(null, item);
            }
            if (!filtered[0].data) {
              item.message = "Не удалось получить информацию с сайта. Попробуйте позже.";
              item.res = json;
              return callback(null, item);
            }
            var $ = cheerio.load(filtered[0].data);
            var trs = $('table.style_table').find('tr');
            var tariffs = [];
            trs.each(function (index, tr) {
              if (index !== 0) {
                var tds = $(tr).find('td');
                if (tds.length) {
                  tariffs.push({
                    service: $(tds[0]).text(),
                    cost: $(tds[1]).text(),
                    deliveryTime: $(tds[2]).text()
                  });
                }
              }
            });
            if (!tariffs.length) {
              item.error = "По направлениям ничего не найдено";
            }
            item.tariffs = tariffs;
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