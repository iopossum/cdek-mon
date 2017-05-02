var responseHelper = require('../../helpers/response');
var deliveryHelper = require('../../helpers/delivery');
var commonHelper = require('../../helpers/common');
var async = require('async');
var request = commonHelper.request;
var cheerio = require('cheerio');
var config = require('../../../conf');
var _ = require('underscore');
var logger = require('../../helpers/logger');
var delivery = 'pecom';

var getReq = function (from, to, departments) {
  from = from || {};
  to = to || {};
  var warehouseFrom = departments.filter(function (item) {
    var int = commonHelper.parseInt(item.cityTakeId);
    return int > 0 && int === from.id;
  });
  var warehouseTo = departments.filter(function (item) {
    var int = commonHelper.parseInt(item.cityDelivId);
    return int > 0 && int === to.id;
  });
  return [
    'places[0][]=0.01&places[0][]=0.01&places[0][]=0.01&places[0][]=0.01&places[0][]=1&places[0][]=0&places[0][]=0',
    'take[town]=' + from.id,
    'take[street]=',
    'take[house]=',
    'take[tent]=0',
    'take[gidro]=0',
    'take[manip]=0',
    'take[speed]=0',
    'take[moscow]=0',
    'take[branch][code]=МВ',
    'take[region]=false',
    'deliver[town]=' + to.id,
    'deliver[street]=',
    'deliver[house]=',
    'deliver[tent]=0',
    'deliver[gidro]=0',
    'deliver[manip]=0',
    'deliver[speed]=0',
    'deliver[moscow]=0',
    'deliver[branch][code]=НБ',
    'deliver[region]=false',
    'zone_from_id=',
    'milage_from=0',
    'zone_to_id=',
    'milage_to=0',
    'plombir=0',
    'strah=0',
    'ashan=0',
    'night=0',
    'pal=0',
    'pallets=0',
    'ju=false',
    'neg=false',
    'need_take=0',
    'need_deliv=0',
    'transport=auto',
    'max_dimension=0.01',
    'total_volume=0.01',
    'total_length=0.01',
    'total_width=0.01',
    'total_height=0.01',
    'dop_departments_from[0][id]=' + (warehouseFrom[0] ? warehouseFrom[0].warehouseTakeId : ''),
    'dop_departments_from[0][cost]=0',
    'dop_departments_from[0][division_id]=' + (warehouseFrom[0] ? warehouseFrom[0].warehouseTakeId : ''),
    'dop_departments_from[1][id]=' + (warehouseFrom[1] ? warehouseFrom[1].warehouseTakeId : ''),
    'dop_departments_from[1][cost]=0',
    'dop_departments_from[1][division_id]=' + (warehouseFrom[1] ? warehouseFrom[1].warehouseTakeId : ''),
    'dop_departments_from[2][id]=' + (warehouseFrom[2] ? warehouseFrom[2].warehouseTakeId : ''),
    'dop_departments_from[2][cost]=0',
    'dop_departments_from[2][division_id]=' + (warehouseFrom[2] ? warehouseFrom[2].warehouseTakeId : ''),
    'dop_departments_from[3][id]=' + (warehouseFrom[3] ? warehouseFrom[3].warehouseTakeId : ''),
    'dop_departments_from[3][cost]=0',
    'dop_departments_from[3][division_id]=' + (warehouseFrom[3] ? warehouseFrom[3].warehouseTakeId : ''),
    'dop_departments_from[4][id]=' + (warehouseFrom[4] ? warehouseFrom[4].warehouseTakeId : ''),
    'dop_departments_from[4][cost]=0',
    'dop_departments_from[4][division_id]=' + (warehouseFrom[4] ? warehouseFrom[4].warehouseTakeId : ''),
    'dop_departments_from[5][id]=' + (warehouseFrom[5] ? warehouseFrom[5].warehouseTakeId : ''),
    'dop_departments_from[5][cost]=0',
    'dop_departments_from[5][division_id]=' + (warehouseFrom[5] ? warehouseFrom[5].warehouseTakeId : ''),
    'dop_departments_from[6][id]=' + (warehouseFrom[6] ? warehouseFrom[6].warehouseTakeId : ''),
    'dop_departments_from[6][cost]=0',
    'dop_departments_from[6][division_id]=' + (warehouseFrom[6] ? warehouseFrom[6].warehouseTakeId : ''),
    'dop_departments_to[0][id]=' + (warehouseTo[0] ? warehouseTo[0].warehouseDelivId : ''),
    'dop_departments_to[0][cost]=0',
    'dop_departments_to[0][division_id]=' + (warehouseTo[0] ? warehouseTo[0].warehouseDelivId : ''),
    'dop_departments_to[1][id]=' + (warehouseTo[1] ? warehouseTo[1].warehouseDelivId : ''),
    'dop_departments_to[1][cost]=0',
    'dop_departments_to[1][division_id]=' + (warehouseTo[1] ? warehouseTo[1].warehouseDelivId : ''),
    'dop_departments_to[2][id]=' + (warehouseTo[2] ? warehouseTo[2].warehouseDelivId : ''),
    'dop_departments_to[2][cost]=0',
    'dop_departments_to[2][division_id]=' + (warehouseTo[2] ? warehouseTo[2].warehouseDelivId : ''),
    'dop_departments_to[3][id]=' + (warehouseTo[3] ? warehouseTo[3].warehouseDelivId : ''),
    'dop_departments_to[3][cost]=0',
    'dop_departments_to[3][division_id]=' + (warehouseTo[3] ? warehouseTo[3].warehouseDelivId : ''),
    'selected_department_from=' + (warehouseFrom[0] ? warehouseFrom[0].warehouseTakeId : ''),
    'selected_department_to=' + (warehouseTo[0] ? warehouseTo[0].warehouseDelivId : ''),
    'all_inclusive=false'
  ]
};

var getServicePreffix = function (type) {
  var result = '';
  switch (type) {
    case 'avia':
      result = 'Авиа ';
      break;
    case 'auto':
      result = 'Авто ';
      break;
  }
  return result;
};

var parseDeliveryTime = function (type, json) {
  if (type === 'auto') {
    return json.periods_days || '';
  }
  json.aperiods = json.aperiods || '';
  var splits = json.aperiods.split('span');
  return splits[1] ? splits[1].replace(commonHelper.DELIVERYTIMEREG, '') : '';
};

var getTariffs = function (type, json) {
  var deliveryCost = commonHelper.parseFloat(json[type][2]);
  json.take = json.take || [];
  json.deliver = json.deliver || [];
  var deliveryTime = parseDeliveryTime(type, json);
  var tariffs = [{
      service: getServicePreffix(type) + 'ДД',
      cost: commonHelper.parseFloat(json.take[2]) + commonHelper.parseFloat(json.deliver[2]) + deliveryCost,
      deliveryTime: deliveryTime
    },
    {
      service: getServicePreffix(type) + 'ДС',
      cost: commonHelper.parseFloat(json.take[2]) + deliveryCost,
      deliveryTime: deliveryTime
    },
    {
      service: getServicePreffix(type) + 'СД',
      cost: commonHelper.parseFloat(json.deliver[2]) + deliveryCost,
      deliveryTime: deliveryTime
    },
    {
      service: getServicePreffix(type) + 'СС',
      cost: deliveryCost,
      deliveryTime: deliveryTime
    }
  ];
  return tariffs;
};

module.exports = function (req, cities) {
  var deliveryData = deliveryHelper.get(delivery);
  var requests = [];
  var timestamp = global[delivery];
  async.auto({
    getCities: function (callback) {
      async.retry(config.retryOpts, function (callback) {
        var nightmare = commonHelper.getNightmare();
        nightmare.goto(deliveryData.citiesUrl.uri)
          .wait('.calc')
          .evaluate(function () {
            return {
              regions: window.regions || [],
              departments: window.warehousesCityLinks || []
            };
          })
          .end()
          .then(function (result) {
            callback(!result.regions.length ? new Error(commonHelper.getResponseError()) : null, result);
          })
          .catch(function (error) {
            callback(new Error(commonHelper.getResponseError(error)), []);
          });
      }, function (err, results) {
        async.nextTick(function () {
          callback(err, results || []);
        });
      });
    },
    parseCities: ['getCities', function (results, callback) {
      var tempRequests = [];
      cities.forEach(function (item) {
        if (!item.from || !item.to) {
          item.error = commonHelper.CITIESREQUIRED;
          requests = requests.concat(commonHelper.getResponseArray(req.body.weights, item, delivery, item.error));
        } else if (item.countryFrom && ['казахстан'].indexOf(item.countryFrom.toLowerCase()) === -1) {
          item.error = commonHelper.COUNTRYFROMRUSSIA;
          requests = requests.concat(commonHelper.getResponseArray(req.body.weights, item, delivery, item.error));
        } if (item.countryTo && ['казахстан'].indexOf(item.countryTo.toLowerCase()) === -1) {
          item.error = commonHelper.COUNTRYFROMRUSSIA;
          requests = requests.concat(commonHelper.getResponseArray(req.body.weights, item, delivery, item.error));
        } else {
          var trimFrom = commonHelper.getCity(item.from);
          var foundsFrom = commonHelper.findInArray(results.getCities.regions, trimFrom, 'value', true);
          var foundsFromWithRegion = [];
          if (foundsFrom.length > 1) {
            var regionFrom = commonHelper.getRegionName(item.from);
            foundsFromWithRegion = commonHelper.findInArray(foundsFrom, regionFrom, 'value');
          }
          var resultsFrom = foundsFromWithRegion.length ? foundsFromWithRegion : foundsFrom;
          var trimTo = commonHelper.getCity(item.to);
          var foundsTo = commonHelper.findInArray(results.getCities.regions, trimTo, 'value', true);
          var foundsToWithRegion = [];
          if (foundsTo.length > 1) {
            var regionTo = commonHelper.getRegionName(item.to);
            foundsToWithRegion = commonHelper.findInArray(foundsTo, regionTo, 'value');
          }
          var resultsTo = foundsToWithRegion.length ? foundsToWithRegion : foundsTo;
          if (!resultsFrom.length) {
            item.error = commonHelper.CITYFROMNOTFOUND;
            requests = requests.concat(commonHelper.getResponseArray(req.body.weights, item, delivery, item.error));
          } else if (!resultsTo.length) {
            item.error = commonHelper.CITYTONOTFOUND;
            requests = requests.concat(commonHelper.getResponseArray(req.body.weights, item, delivery, item.error));
          } else {
            resultsFrom.forEach(function (fromCity) {
              resultsTo.forEach(function (toCity) {
                tempRequests.push({
                  city: {
                    initialCityFrom: item.from,
                    initialCityTo: item.to,
                    from: fromCity.value,
                    to: toCity.value,
                    countryFrom: item.countryFrom,
                    countryTo: item.countryTo
                  },
                  req: getReq(fromCity, toCity, results.getCities.departments),
                  delivery: delivery,
                  tariffs: []
                });
              });
            });
          }
        }
      });
      tempRequests.forEach(function (item) {
        req.body.weights.forEach(function (weight) {
          var obj = Object.assign({}, item);
          obj.weight = weight;
          obj.req.push('total_weight=' + weight);
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
        item.req.forEach(function (r) {
          opts.uri += encodeURIComponent(r) + '%26';
        });
        //opts.uri = opts.uri.replace(/%3D/g, '=');
        setTimeout(function () {
          async.retry(config.retryOpts, function (callback) {
            request(opts, callback)
          }, function (err, r, b) {
            if (err) {
              item.error = commonHelper.getResponseError(err);
              return callback(null, item);
            }
            var json = null;
            try {
              json = JSON.parse(b);
            } catch (e) {
              item.error = commonHelper.getResponseError(e);
            }
            if (!json) {
              return callback(null, item);
            }
            if (json.auto && json.auto.length) {
              item.tariffs = item.tariffs.concat(getTariffs('auto', json));
            }
            if (json.avia && json.avia.length) {
              item.tariffs = item.tariffs.concat(getTariffs('avia', json));
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
      items: results.requests || []
    });
  });
};