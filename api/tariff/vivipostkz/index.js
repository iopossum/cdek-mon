var responseHelper = require('../../helpers/response');
var deliveryHelper = require('../../helpers/delivery');
var commonHelper = require('../../helpers/common');
var async = require('async');
var request = commonHelper.request;
var cheerio = require('cheerio');
var config = require('../../../conf');
var _ = require('underscore');
var logger = require('../../helpers/logger');
var delivery = 'vivipostkz';

var getReq = function (from, to, service) {
  from = from || {};
  to = to || {};
  return {
    actionType: 'calculate',
    deliveryItemID: 55,
    ServiceItemID: service.id,
    uf_otkudaID: from.id,
    uf_kudaID: to.id,
    destWeight:1,
    tariffID: 0,
    L:10,
    H:10,
    W:10
  };
};

var getDeliveryTime = function (json) {
  var result = '';
  if (json.res_time_interval) {
    result = json.res_time_interval.replace(commonHelper.DELIVERYTIMEREG, "");
    if (/час/gi.test(json.res_time_interval)) {
      result = 1;
    }
  }
  return result;
};

var findCity = function (city, array) {
  var trim = commonHelper.getCity(city);
  var founds = commonHelper.findInArray(array, trim, 'name', true);
  var foundsWithRegion = [];
  if (founds.length > 1) {
    var region = commonHelper.getRegionName(city);
    if (region) {
      foundsWithRegion = commonHelper.findInArray(founds, region, 'name');
    }
  }
  return foundsWithRegion.length ? foundsWithRegion : founds;
};

var isFromAlmaty = function (city) {
  var result = false;
  if (!city) {
    return result;
  }
  var trim = commonHelper.getCity(city);
  if (trim && /алматы/gi.test(trim)) {
    result = true;
  }
  return result;
};

module.exports = function (req, cities, callback) {
  var deliveryData = deliveryHelper.get(delivery);
  var requests = [];
  var timestamp = callback ? new Date().getTime*2 : commonHelper.getReqStored(req, delivery);
  var errMessage = "Доставка осуществляетяс только из Алматы или в Алматы";
  cities.forEach(function (item) {
    if (!item.countryFrom) {
      item.fromRu = true;
    } else if (item.countryFrom.toLowerCase() === 'казахстан') {
      item.fromAlmaty = isFromAlmaty(item.from);
      item.fromKz = true;
    }
    if (!item.countryTo) {
      item.toRu = true;
    } else if (item.countryTo.toLowerCase() === 'казахстан') {
      item.toAlmaty = isFromAlmaty(item.to);
      item.toKz = true;
    }
    if (!item.fromRu && !item.fromKz) {
      item.error = commonHelper.CITYFROMNOTFOUND;
    } else if (!item.toRu && !item.toKz) {
      item.error = commonHelper.CITYTONOTFOUND;
    } else if (!item.fromAlmaty && !item.toAlmaty) {
      item.error = errMessage;
    }
  });
  var services = [
    {
      id: 56,
      name: 'Доставка по городу',
      from: [],
      to: [],
      services: []
    },
    {
      id: 57,
      name: 'Доставка по Алматинской области (в пределах 100 км от Алматы)',
      from: [],
      to: [],
      services: []
    },
    {
      id: 58,
      name: 'Доставка в областные центры',
      from: [],
      to: [],
      services: []
    },
    {
      id: 59,
      name: 'Доставка в удаленные районы',
      from: [],
      to: [],
      services: []
    },
    {
      id: 60,
      name: 'Доставка в города России',
      from: [],
      to: [],
      services: []
    }
  ];
  var serviceObj = _.indexBy(services, 'id');
  async.auto({
    getCities: function (callback) {
      async.eachSeries(services, function (service, cb) {
        setTimeout(function () {
          var opts = _.extend({}, deliveryData.apiUrl);
          opts.form = {
            actionType: 'serviceItem',
            ServiceItemID: service.id
          };
          async.retry(config.retryOpts, function (callback) {
            request(opts, callback)
          }, function (err, r, b) {
            if (err) {
              service.error = commonHelper.getCityJsonError(err);
              return cb();
            }
            var json = null;
            try {
              json = JSON.parse(b);
            } catch (e) {
              service.error = commonHelper.getCityJsonError(e);
            }
            if (!json) {
              return cb();
            }
            var $ = cheerio.load(json.res_Uf_Otkuda);
            $('option').each(function (index, item) {
              service.from.push({id: $(item).attr('value'), name: $(item).text().trim()});
            });
            $ = cheerio.load(json.res_Uf_Kuda);
            $('option').each(function (index, item) {
              service.to.push({id: $(item).attr('value'), name: $(item).text().trim()});
            });
            $ = cheerio.load(json.res_resultRates);
            $('.rate').each(function (index, item) {
              service.services.push({id: $(item).attr('data-tariff-id'), name: $(item).text().trim()});
            });
            cb();
          });
        }, commonHelper.randomInteger(500, 1000));
      }, callback);
    },
    parseCities: ['getCities', function (results, callback) {
      for (var i=0; i<cities.length; i++) {
        if (!cities[i].from || !cities[i].to) {
          cities[i].error = commonHelper.CITIESREQUIRED;
          requests = requests.concat(commonHelper.getResponseArray(req.body.weights, cities[i], delivery, cities[i].error));
          continue;
        }
        if (cities[i].error) {
          requests = requests.concat(commonHelper.getResponseArray(req.body.weights, cities[i], delivery, cities[i].error));
          continue;
        }
        cities[i].success = false;
        var tempRequests = [];
        services.forEach(function (service) {
          var foundsFrom = findCity(cities[i].from, service.from);
          var foundsTo = findCity(cities[i].to, service.to);
          if (foundsFrom.length && foundsTo.length) {
            if (cities[i].fromAlmaty && cities[i].toAlmaty) {
              if (service.id === 56) {
                cities[i].success = true;
                tempRequests.push({
                  city: {
                    initialCityFrom: cities[i].from,
                    initialCityTo: cities[i].to,
                    from: foundsFrom[0].name,
                    to: foundsTo[0].name,
                    countryFrom: cities[i].countryFrom,
                    countryTo: cities[i].countryTo,
                    fromAlmaty: cities[i].fromAlmaty,
                    toAlmaty: cities[i].toAlmaty
                  },
                  req: getReq(foundsFrom[0], foundsTo[0], service),
                  service: service,
                  delivery: delivery,
                  tariffs: []
                });
              }
            } else {
              cities[i].success = true;
              tempRequests.push({
                city: {
                  initialCityFrom: cities[i].from,
                  initialCityTo: cities[i].to,
                  from: foundsFrom[0].name,
                  to: foundsTo[0].name,
                  countryFrom: cities[i].countryFrom,
                  countryTo: cities[i].countryTo,
                  fromAlmaty: cities[i].fromAlmaty,
                  toAlmaty: cities[i].toAlmaty
                },
                req: getReq(foundsFrom[0], foundsTo[0], service),
                service: service,
                delivery: delivery,
                tariffs: []
              });
            }
          }
        });
        if (!cities[i].success) {
          cities[i].error = "Такой связки городов нет ни в одной услуге";
          requests = requests.concat(commonHelper.getResponseArray(req.body.weights, cities[i], delivery, cities[i].error));
          continue;
        }

        tempRequests.forEach(function (item) {
          req.body.weights.forEach(function (weight) {
            var obj = commonHelper.deepClone(item);
            obj.weight = weight;
            obj.req['destWeight'] = weight;
            requests.push(obj);
          });
        });

      }
      callback();
    }],
    requests: ['parseCities', function (results, callback) {
      async.mapLimit(requests, 1, function (item, callback) {
        if (commonHelper.getReqStored(req, delivery) > timestamp) {
          return callback({abort: true});
        }
        if (item.error) {
          return async.nextTick(function () {
            callback(null, item);
          });
        }
        async.waterfall([
          function (cb) {
            var result = {
              success: false,
              services: []
            };
            if ([56, 57].indexOf(item.req.ServiceItemID) > -1) {
              result.success = true;
              result.services = serviceObj[item.req.ServiceItemID].services;
              return cb(null, result);
            }
            var opts = _.extend({}, deliveryData.apiUrl);
            opts.form = {
              actionType: item.city.fromAlmaty ? 'changeCityKuda' :'changeCityOtkuda',
              ServiceItemID: item.req.ServiceItemID,
              uf_otkudaID: item.req.uf_otkudaID
            };
            if (item.city.fromAlmaty) {
              opts.form.uf_KudaID = item.req.uf_kudaID;
            }
            async.retry(config.retryOpts, function (callback) {
                opts.followAllRedirects = true;
                request(opts, callback)
              }, function (err, r, b) {
              var result = {
                success: false,
                services: []
              };
              if (err) {
                result.error = commonHelper.getServicesError(err);
                return cb(null, result);
              }
              var json = null;
              try {
                json = JSON.parse(b);
              } catch (e) {
                result.error = commonHelper.getServicesError(e);
              }
              if (!json) {
                return cb(null, result);
              }
              var $ = cheerio.load(json.res_resultRates);
              var services = [];
              $('.rate').each(function (index, item) {
                services.push({id: $(item).attr('data-tariff-id'), name: $(item).text().trim()});
              });
              result.success = true;
              result.services = services.length ? services : serviceObj[item.req.ServiceItemID].services;
              cb(null, result);
            });
          },
          function (trf, cb) {
            if (!trf.success) {
              return cb(null, [trf]);
            }
            async.mapSeries(trf.services, function (service, cb) {
              setTimeout(function () {
                var opts = _.extend({}, deliveryData.apiUrl);
                var copyReq = _.extend({}, item.req);
                copyReq.tariffID = service.id;
                opts.form = copyReq;
                async.retry(config.retryOpts, function (callback) {
                  opts.followAllRedirects = true;
                  request(opts, callback)
                }, function (err, r, b) {
                  var result = {
                    success: false
                  };
                  if (err) {
                    result.error = commonHelper.getResultJsonError(err);
                    return cb(null, result);
                  }
                  var json = null;
                  try {
                    json = JSON.parse(b);
                  } catch (e) {
                    result.error = commonHelper.getResultJsonError(e);
                  }
                  if (!json) {
                    return cb(null, result);
                  }
                  if (!json.res_finish) {
                    result.error = commonHelper.getResultJsonError(new Error("Отсутствует параметр res_finish"));
                    return cb(null, result);
                  }
                  result.tariff = {
                    service: serviceObj[item.req.ServiceItemID].name + ': ' + service.name,
                    cost: json.res_finish,
                    deliveryTime: getDeliveryTime(json)
                  };
                  result.success = true;
                  return cb(null, result);
                });
              }, commonHelper.randomInteger(500, 1000));
            }, cb);
          }
        ], function (err, tariffs) {
          var errors = [];
          tariffs.forEach(function (trf) {
            if (trf.success) {
              item.tariffs.push(trf.tariff);
            } else {
              errors.push(trf.error);
            }
          });
          if (!item.tariffs.length) {
            item.error = errors[0];
          }
          return callback(null, item);
        });
      }, callback);
    }]
  }, function (err, results) {
    commonHelper.saveResults(req, err, {
      delivery: delivery,
      timestamp: timestamp,
      cities: cities,
      items: err ? [] : results.requests,
      callback: callback
    });
  });
};