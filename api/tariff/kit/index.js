var responseHelper = require('../../helpers/response');
var deliveryHelper = require('../../helpers/delivery');
var commonHelper = require('../../helpers/common');
var async = require('async');
var request = commonHelper.request;
var cheerio = require('cheerio');
var config = require('../../../conf');
var _ = require('underscore');
var logger = require('../../helpers/logger');
var delivery = 'kit';

var getReq = function (from, to) {
  from = from || {};
  to = to || {};
  return {
    fromW: from.id === 'Y',
    toW: to.id === 'Y',
    from: from.key,
    to: to.key,
    gweight: 1,
    uweight: 0,
    gplaces: 1,
    uplaces: 0,
    frompickup: 1,
    topickup: 1,
    inscargotype: '001',
    inscompany: '',
    insprice: 1,
    'grows[0][places]': 1,
    'grows[0][weight]': 1,
    'grows[0][length]': 10,
    'grows[0][height]': 10,
    'grows[0][width]': 10,
    'grows[0][volume]':0.001,
    nocache: '',
    hash: '',
    _:new Date().getTime()
  }
};

var getServiceName = function (item) {
  var result = '';
  switch (item.FR_TYPE) {
    case "01":
      result = "Стандарт";
      break;
    case "02":
      result = "Эконом";
      break;
    case "03":
      result = "Экспресс";
      break;
    case "05":
      result = "Курьер стандарт";
      break;
    case "06":
      result = "Курьер экспресс";
      break;
  }
  return result;
};

/*var getTariff = function (costs, item) {
  return [{
    service: getServiceName(item),
    deliveryTime: commonHelper.parseInt(item.DAY_COUNT),
    cost: commonHelper.parseInt(item.FREIGHT)
  }];
};*/

//для мульти
var getTariff = function (costs, item, req) {
  var ss = null;
  var from = null;
  var to = null;
  var results = [];
  costs.forEach(function (item) {
    switch (item.ARTICLE) {
      case 'S039':
        ss = (ss || 0) + commonHelper.parseFloat(item.FREIGHT);
        break;
      case 'S040':
        ss = (ss || 0) + commonHelper.parseFloat(item.FREIGHT);
        break;
      case 'S010':
        from = (from || 0) + commonHelper.parseFloat(item.FREIGHT);
        break;
      case 'S011':
        from = (from || 0) + commonHelper.parseFloat(item.FREIGHT);
        break;
      case 'S001':
        to = (to || 0) + commonHelper.parseFloat(item.FREIGHT);
        break;
      case 'S002':
        to = (to || 0) + commonHelper.parseFloat(item.FREIGHT);
        break;
    }
  });
  var trf = {
    service: getServiceName(item),
    deliveryTime: commonHelper.parseInt(item.DAY_COUNT)
  };
  if (ss && req.fromW && req.toW) {
    var obj = Object.assign({}, trf);
    obj.service += ' СС';
    obj.cost = ss;
    if (trf.deliveryTime > 0) {
      obj.deliveryTime--;
    }
    results.push(obj);
  }
  if (from && to) {
    var obj = Object.assign({}, trf);
    obj.service += ' ДД';
    obj.cost = (ss || 0) + from + to;
    results.push(obj);
  }
  if (from && req.toW) {
    var obj = Object.assign({}, trf);
    obj.service += ' ДС';
    obj.cost = (ss || 0) + from;
    if (["05", "06"].indexOf(item.FR_TYPE) > -1) {
      obj.cost += to;
    }
    if (trf.deliveryTime > 0) {
      obj.deliveryTime--;
    }
    results.push(obj);
  }
  if (to && req.fromW) {
    var obj = Object.assign({}, trf);
    obj.service += ' СД';
    obj.cost = (ss || 0) + to;
    if (["05", "06"].indexOf(item.FR_TYPE) > -1) {
      obj.cost += from;
    }
    if (trf.deliveryTime > 0) {
      obj.deliveryTime--;
    }
    results.push(obj);
  }
  return results;
};

var getTariffs = function (array, req) {
  array = array || [];
  var results = [];
  var ar1 = array.filter(function (item) {
    return item.FR_TYPE === '01';
  });
  var ar2 = array.filter(function (item) {
    return item.FR_TYPE === '02';
  });
  var ar3 = array.filter(function (item) {
    return item.FR_TYPE === '03';
  });
  var ar4 = array.filter(function (item) {
    return item.FR_TYPE === '04';
  });
  var ar5 = array.filter(function (item) {
    return item.FR_TYPE === '05';
  });
  var ar6 = array.filter(function (item) {
    return item.FR_TYPE === '06';
  });
  if (ar1.length && ar1[0].DETAIL && ar1[0].DETAIL.item && Array.isArray(ar1[0].DETAIL.item)) {
    var trfs = getTariff(ar1[0].DETAIL.item, ar1[0], req);
    if (trfs.length) {
      results = results.concat(trfs);
    }
  }
  if (ar2.length && ar2[0].DETAIL && ar2[0].DETAIL.item && Array.isArray(ar2[0].DETAIL.item)) {
    var trfs = getTariff(ar2[0].DETAIL.item, ar2[0], req);
    if (trfs.length) {
      results = results.concat(trfs);
    }
  }
  if (ar3.length && ar3[0].DETAIL && ar3[0].DETAIL.item && Array.isArray(ar3[0].DETAIL.item)) {
    var trfs = getTariff(ar3[0].DETAIL.item, ar3[0], req);
    if (trfs.length) {
      results = results.concat(trfs);
    }
  }
  if (ar4.length && ar4[0].DETAIL && ar4[0].DETAIL.item && Array.isArray(ar4[0].DETAIL.item)) {
    var trfs = getTariff(ar4[0].DETAIL.item, ar4[0], req);
    if (trfs.length) {
      results = results.concat(trfs);
    }
  }
  if (ar5.length && ar5[0].DETAIL && ar5[0].DETAIL.item && Array.isArray(ar5[0].DETAIL.item)) {
    var trfs = getTariff(ar5[0].DETAIL.item, ar5[0], req);
    if (trfs.length) {
      results = results.concat(trfs);
    }
  }
  if (ar6.length && ar6[0].DETAIL && ar6[0].DETAIL.item && Array.isArray(ar6[0].DETAIL.item)) {
    var trfs = getTariff(ar6[0].DETAIL.item, ar6[0], req);
    if (trfs.length) {
      results = results.concat(trfs);
    }
  }
  return results;
};

var calcResults = function (item, callback) {
  var deliveryData = deliveryHelper.get(delivery);
  setTimeout(function () {
    async.waterfall([
      function (callback) {
        var opts = _.extend({}, deliveryData.calcUrl);
        opts.uri += commonHelper.getQueryString(item.req);
        async.retry(config.retryOpts, function (callback) {
          request(opts, callback)
        }, function (err, r, b) {
          if (err) {
            return callback(err);
          }
          var json = null;
          try {
            json = JSON.parse(b);
          } catch (e) {}
          if (!json) {
            return callback(commonHelper.getResponseError(new Error("Неверный формат json hash")));
          }
          if (!json.hash) {
            return callback(commonHelper.getCityJsonError(new Error("Неверный тип данных в ответе. Отсутствует параметр hash")));
          }
          return callback(null, json.hash);
        });
      },
      function (hash, callback) {
        var opts = _.extend({}, deliveryData.calcUrlAdditional);
        item.req.hash = hash;
        opts.uri += commonHelper.getQueryString(item.req);
        async.retry(config.retryOpts, function (callback) {
          request(opts, callback)
        }, function (err, r, b) {
          if (err) {
            return callback(commonHelper.getResponseError(err));
          }
          var json = null;
          try {
            json = JSON.parse(b);
          } catch (e) {}
          if (!json) {
            return callback(commonHelper.getResponseError(new Error("Неверный формат json")));
          }
          if (!json.result) {
            return callback(commonHelper.getResponseError(new Error("Неверный тип данных в ответе. Отсутствует параметр result")));
          }
          if (!json.result.ET_FREIGHT) {
            return callback(commonHelper.getResponseError(new Error("Неверный тип данных в ответе. Отсутствует параметр result.ET_FREIGHT")));
          }
          if (!json.result.ET_FREIGHT.item) {
            return callback(commonHelper.getResponseError(new Error("Неверный тип данных в ответе. Отсутствует параметр result.ET_FREIGHT.item")));
          }
          callback(null, getTariffs(json.result.ET_FREIGHT.item, item.req))
        });
      }
    ], function (err, results) {
      if (err) {
        item.error = err;
        return callback(null, item);
      }
      item.tariffs = results;
      if (!item.tariffs.length) {
        item.error = commonHelper.getNoResultError();
      }
      return callback(null, item);
    });
  }, commonHelper.randomInteger(500, 1000));
};

module.exports = function (req, cities) {
  var deliveryData = deliveryHelper.get(delivery);
  var requests = [];
  var timestamp = global[delivery];
  async.auto({
    getCities: function (callback) {
      var opts = _.extend({}, deliveryData.citiesUrl);
      opts.uri += '?_=' + new Date().getTime();
      async.retry(config.retryOpts, function (callback) {
        request(opts, callback)
      }, function (err, r, b) {
        if (err) {
          return callback(commonHelper.getResponseError(err));
        }
        var json = null;
        try {
          json = JSON.parse(b);
        } catch (e) {}
        if (!json) {
          return callback(commonHelper.getResponseError(new Error("Неверный формат json городов")));
        }
        if (!json.success) {
          return callback(commonHelper.getCityJsonError(new Error("Неверный тип данных в ответе. Отсутствует параметр success")));
        }
        if (!Array.isArray(json.success)) {
          return callback(commonHelper.getCityJsonError(new Error("Неверный тип данных в ответе. Отсутствует массив городов")));
        }
        return callback(null, json.success);
      });
    },
    parseCities: ['getCities', function (results, callback) {
      var tempRequests = [];
      cities.forEach(function (item) {
        if (!item.from || !item.to) {
          item.error = commonHelper.CITIESREQUIRED;
          requests = requests.concat(commonHelper.getResponseArray(req.body.weights, item, delivery, item.error));
        } else {
          var trimFrom = commonHelper.getCity(item.from);
          var foundsFrom = commonHelper.findInArray(results.getCities, trimFrom, 'value', true);
          var foundsFromWithRegion = [];
          if (foundsFrom.length > 1) {
            var regionFrom = commonHelper.getRegionName(item.from);
            foundsFromWithRegion = commonHelper.findInArray(foundsFrom, regionFrom, 'value');
          }
          var resultsFrom = foundsFromWithRegion.length ? foundsFromWithRegion : foundsFrom;
          var trimTo = commonHelper.getCity(item.to);
          var foundsTo = commonHelper.findInArray(results.getCities, trimTo, 'value', true);
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
            item.error = commonHelper.CITYFROMNOTFOUND;
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
                  req: getReq(fromCity, toCity),
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
          obj.req.gweight = weight;
          obj.req['grows[0][weight]'] = weight;
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
        calcResults(item, callback);
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