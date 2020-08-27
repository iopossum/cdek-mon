const { get } = require('../../helpers/delivery');
const {
  COUNTRYFROMRUSSIA,
  CITYFROMREQUIRED,
  CITIESREQUIRED,
  CITYFROMNOTFOUND,
  CITYTONOTFOUND,
  DELIVERYTIMEREG,
  CITYORCOUNTRYTOREQUIRED,
  COSTREG,
  request,
  requestWrapper,
  getCityJsonError,
  getCity,
  allResultsError,
  getBrowser,
  newPage,
  closeBrowser,
  closePage,
  waitForWrapper,
  getContentChangedMessage,
  findInArray,
  createTariff,
  getJSONChangedMessage,
  getRegionName,
  getNoResultError
} = require('../../helpers/common');
const Store = require('../../helpers/store');
const async = require('promise-async');
const cheerio = require('cheerio');
const config = require('../../../conf');
const _ = require('underscore');
const logger = require('../../helpers/logger');

function decimalAdjust(e, t, n) {
  return void 0 === n || 0 == +n ? Math[e](t) : (t = +t, n = +n, isNaN(t) || "number" != typeof n || n % 1 != 0 ? NaN : (t = t.toString().split("e"), t = Math[e](+(t[0] + "e" + (t[1] ? +t[1] - n : -n))), +((t = t.toString().split("e"))[0] + "e" + (t[1] ? +t[1] + n : n))))
}

function roundToTen(e, t) {
  return decimalAdjust("ceil", e, t)
}

var formatPrice = function(e) {
  e || (e = 0);
  if (-1 !== e.toString().indexOf("–")) {
    var t = e.split("–");
    return formatCostWithRounding(t[0]) + "–" + formatCostWithRounding(t[1])
  }
  return e = _.isNumber(e) ? e : parseFloat(e.replace(",", ".").replace(" ", "")), e = e.toFixed(2), e = e.toString().split("."), e[0] = e[0].split("").reverse().join("").replace(/(\d{3})/g, "$1 ").split("").reverse().join(""), e[0] + "," + e[1]
};
var formatCostWithRounding = function(e) {
  var t = _.isNumber(e) ? e : parseFloat(e.replace(",", ".").replace(" ", "")),
    n = (t = t.toFixed(0).split("."))[0] % 100,
    a = Math.abs(50 - n) > 0 && 0 != n && t[0] > 500 ? 50 : 10;
  return t = Math.ceil(t[0] / a) * a
};

var getBasicReq = function (city) {
  return {
    calculationEntity: {
      destination: {
        city: city.to || "",
        country: city.countryTo || "Россия",
        district: "",
        region: ""
      },
      origin: {
        city: city.from,
        country: "Россия",
        district: "",
        region: ""
      },
      sendingType: 'PACKAGE'
    }
  }
};

var getStReq = function (city) {
  if (!city.isGroundAvailable && city.countryToCode) {
    return {
      costCalculationEntity: {},
      skip: true
    };
  }
  var req = getBasicReq(city);
  req.costCalculationEntity = {
    countryTo: city.countryToCode,
    parcelKind: "STANDARD",
    postalCodesFrom: [city.postcodeFrom],
    postalCodesTo: [city.postcodeTo],
    postingCategory:  "ORDINARY",
    postingKind: "PARCEL",
    postingType: city.countryToCode ? "MPO" : "VPO",
    wayForward: "EARTH",
    zipCodeFrom: city.postcodeFrom,
    zipCodeTo: city.postcodeTo
  };
  return req;
};

var getEmsReq = function (city) {
  var req = getBasicReq(city);
  req.sendingType = 'PACKAGE_AVIA';
  if (!city.countryToCode) {
    req.costCalculationEntity = {
      postalCodesFrom: [city.postcodeFrom],
      postalCodesTo: [city.postcodeTo],
      postingCategory: "ORDINARY",
      postingKind: "EMS",
      postingType: "VPO",
      zipCodeFrom: city.postcodeFrom,
      zipCodeTo: city.postcodeTo
    }
  } else {
    req.costCalculationEntity = {
      countryTo: city.countryToCode,
      postalCodesFrom: [city.postcodeFrom],
      postalCodesTo: [],
      postingCategory: "WITH_GOODS",
      postingKind: "EMS",
      postingType: "MPO",
      wayForward: "AVIA",
      zipCodeFrom: "",
      zipCodeTo: ""
    }
  }
  return req;
};

var getIntReq = function (city) {
  if (!city.countryToCode) {
    return {
      costCalculationEntity: {},
      skip: true
    };
  }
  var req = getBasicReq(city);
  req.sendingType = 'PACKAGE_AVIA';
  req.costCalculationEntity = {
    countryTo: city.countryToCode,
      postalCodesFrom: [city.postcodeFrom],
      postalCodesTo: [],
      postingCategory: "SIMPLE",
      postingKind: "SMALL_PACKAGE",
      postingType: "MPO",
      wayForward: "AVIA",
      zipCodeFrom: "",
      zipCodeTo: ""
  };
  return req;
};

var calcResults = function (req, service, callback) {
  var deliveryData = deliveryHelper.get(delivery);
  var opts = _.extend({}, deliveryData.calcUrl);
  opts.body = req;
  opts.json = true;
  opts.headers['X-Requested-With'] = 'XMLHttpRequest';
  async.retry(config.retryOpts, function (callback) {
    request(opts, callback)
  }, function (err, r, b) {
    var result = {};
    if (err || !b) {
      result.error = commonHelper.getResponseError(err);
      return callback(null, result);
    }
    if (!b.data) {
      result.error = commonHelper.getResultJsonError(new Error("Отсутствует поле data в ответе"));
      return callback(null, result);
    }
    if (b.status !== '200') {
      result.error = commonHelper.getResultJsonError(new Error("Ошибочный статус в ответе, статус: " + b.status));
      return callback(null, result);
    }
    if (b.data.errors && b.data.errors.length) {
      result.error = commonHelper.getResultJsonError(new Error("Неверный ответ, " + b.data.errors.join(', ')));
      return callback(null, result);
    }
    if (!b.data.costEntity) {
      result.error = commonHelper.getResultJsonError(new Error("Отсутствует поле data.costEntity в ответе"));
      return callback(null, result);
    }
    if (b.data.costEntity.errors && b.data.costEntity.errors.length) {
      result.error = commonHelper.getResultJsonError(new Error("Внутренняя ошибка api сайта, " + b.data.costEntity.errors.join(', ')));
      return callback(null, result);
    }
    b.data.timeEntity = b.data.timeEntity || {};
    var deliveryTime = b.data.timeEntity.deliveryTime || "";
    if (service === 'Курьерский') {
      deliveryTime = b.data.timeEntity.emsDeliveryTimeRange || "";
    } else if (service === 'Ускоренный') {
      deliveryTime = b.data.timeEntity.firstClassTime || "";
    }
    result.tariff = {
      service: service,
      cost: formatPrice(b.data.costEntity.costRange),
      deliveryTime: deliveryTime
    };
    return callback(null, result);
  });
};

const CityItem = function (success, items) {
  this.success = success || false;
  this.items = items || [];
};

const _getCity = async ({ city, country, isTo, isCountry, delivery, req }) => {
  const trim = getCity(isCountry ? country : city);
  try {
    const opts = { ...delivery.citiesUrl, body: {
      fromBound: "CITY",
      limit: 5,
      query: `Россия ${trim}`,
      toBound: "HOUSE"
    }};
    if (isTo) {
      opts.body.excludeAddressTypes = ["REGION", "AREA"];
      opts.body.fromBound = "COUNTRY";
      opts.body.query = trim;
      opts.body.toBound = "SETTLEMENT";
    }
    opts.headers = {
      ...opts.headers,
      ':authority': 'www.pochta.ru',
      ':method': 'POST',
      ':path': '/suggestions/v1/suggestion.find-addresses',
      ':scheme': 'https',
      'content-type': 'application/json;charset=UTF-8',
      dnt: 1,
      origin: 'https://www.pochta.ru',
      referer: 'https://www.pochta.ru/parcels?courier=true&utm_source=emspost&restore=true',
      'sec-fetch-dest': 'empty',
      'sec-fetch-mode': 'cors',
      'sec-fetch-site': 'same-origin',
      'cookie': 'ANALYTICS_UUID=cea94e57-c1a4-48d7-9f2f-171db24b4359; GUEST_LANGUAGE_ID=ru_RU; COOKIE_SUPPORT=true; _gcl_au=1.1.438395234.1594956213; _ga=GA1.2.1626865898.1594956213; _ym_d=1594956213; _ym_uid=1594956213447208242; tmr_lvid=9a58b048364f82bc847463f0959f4229; tmr_lvidTS=1594956213570; _fbp=fb.1.1594956213797.145529952; HeaderBusinessTooltip=showed; _gid=GA1.2.302582955.1598326168; _gaexp=GAX1.2.ZC4yjmE7R1q7K-xOFXEn2A.18549.1; _ym_isad=1; tmr_detect=1%7C1598430450287; sputnik_session=1598432922694|0; tmr_reqNum=88; JSESSIONID=FAB375FEB384C5109F38E3BDBBFE25E3'
    };
    opts.validateHeaderValue = () => false;
    // opts.json = true;
    const result = await requestWrapper({ req, ...opts });
    console.log(result.body)
  } catch(e) {
    console.log(e)
    return new CityItem();
  }
};

const getCities = async (cities, delivery, req) => {
  const cityObj = {};
  return await async.mapSeries(cities, async (item, callback) => {
    const city = {...item};
    if (!city.from) {
      city.error = CITYFROMREQUIRED;
      return callback(null, city);
    }
    if (city.countryFrom) {
      city.error = COUNTRYFROMRUSSIA;
      return callback(null, city);
    }
    if (!city.to && !city.countryTo) {
      city.error = CITYORCOUNTRYTOREQUIRED;
      return callback(null, city);
    }
    const fromKey = city.from + city.countryFrom;
    if (cityObj[fromKey]) {
      city.fromJSON = cityObj[fromKey];
    } else {
      const result = await _getCity({city: city.from, country: city.countryFrom, delivery});
      cityObj[fromKey] = result;
      city.fromJSON = result;
    }
    const toKey = city.to + city.countryTo;
    if (cityObj[toKey]) {
      city.toJSON = cityObj[toKey];
    } else {
      let result = new CityItem();
      if (city.to) {
        result = await _getCity({city: city.to, country: city.countryTo, isTo: true, delivery, req});
      }
      if (!result.success && city.countryTo) {
        result = await _getCity({city: city.to, country: city.countryTo, isTo: true, isCountry: true, delivery, req});
      }
      cityObj[toKey] = result;
      city.toJSON = result;
    }
    callback(null, city);
  });
};

module.exports = async function ({ deliveryKey, weights, cities, req}) {
  const delivery = get(deliveryKey);
  let requests = [];

  await getCities(cities, delivery, req);
  return false;

  const countriesObj = {};
  async.auto({
    getCities: [function (callback) {
      async.mapSeries(cities, function (city, callback) {
        if (!city.from) {
          city.error = commonHelper.CITYFROMREQUIRED;
          return async.nextTick(function () {
            callback(null, city);
          });
        }
        if (city.countryFrom && commonHelper.RUSSIA.indexOf(city.countryFrom.toLowerCase()) === -1) {
          city.error = commonHelper.COUNTRYFROMRUSSIA;
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
        if (city.countryTo && commonHelper.RUSSIA.indexOf(city.countryTo.toLowerCase()) > -1) {
          city.countryTo = "";
        }
        if (!city.countryTo) {
          return callback(null, city);
        }
        if (countriesObj[city.countryTo.toUpperCase()]) {
          city.countryToCode = countriesObj[city.countryTo.toUpperCase()].code;
          return callback(null, city);
        }
        var deliveryData = deliveryHelper.get(delivery);
        var opts = _.extend({}, deliveryData.citiesUrl);
        opts.uri += encodeURIComponent(city.countryTo);
        opts.headers['Accept'] = 'application/json';
        async.retry(config.retryOpts, function (callback) {
          request(opts, callback)
        }, function (err, r, b) {
          if (err || !b) {
            city.error = commonHelper.getCountriesError(err, city.countryTo);
            return callback(null, city);
          }
          var json = null;
          try {
            json = JSON.parse(b);
          } catch (e) {
            city.error = commonHelper.getCountriesError(e, city.countryTo);
          }
          if (!json) {
            return callback(null, city);
          }
          if (!json.code) {
            city.error = commonHelper.getCountriesError(new Error("Отсутствует поле code в ответе"), city.countryTo);
            return callback(null, city);
          }
          city.countryToCode = json.code;
          city.isGroundAvailable = json.isGroundAvailable;
          countriesObj[city.countryTo.toUpperCase()] = json;
          callback(null, city);
        });
      }, callback);
    }],
    parseCities: ['getCities', function (results, callback) {
      var tempRequests = [];
      results.getCities.forEach(function (item) {
        if (item.error) {
          requests = requests.concat(commonHelper.getResponseArray(req.body.weights, item, delivery, item.error));
        } else {
          tempRequests.push({
            city: {
              initialCityFrom: item.from,
              initialCityTo: item.to,
              from: item.from,
              to: item.to,
              countryFrom: item.countryFrom,
              countryTo: item.countryTo
            },
            isInternational: item.countryToCode > 0,
            req: getStReq(item),
            reqEms: getEmsReq(item),
            reqInt: getIntReq(item),
            delivery: delivery,
            tariffs: []
          });
        }
      });
      tempRequests.forEach(function (item) {
        req.body.weights.forEach(function (weight) {
          var obj = commonHelper.deepClone(item);
          obj.weight = weight;
          if (weight <= 1) {
            obj.req.costCalculationEntity.weightRange = [100, 1000];
            obj.reqEms.costCalculationEntity.weightRange = [100, 1000];
            obj.reqInt.costCalculationEntity.weightRange = [100, 1000];
            obj.reqInt.costCalculationEntity.postingCategory = "SIMPLE";
            obj.reqInt.costCalculationEntity.postingKind = "SMALL_PACKAGE";
            if (item.isInternational) {
              obj.req.costCalculationEntity.postingCategory = "SIMPLE";
              obj.req.costCalculationEntity.postingKind = "SMALL_PACKAGE";
            }
          } else if (weight > 1 && weight <= 2) {
            obj.req.costCalculationEntity.weightRange = [1000, 2000];
            obj.reqEms.costCalculationEntity.weightRange = [1000, 2000];
            obj.reqInt.costCalculationEntity.weightRange = [1000, 2000];
          } else if (weight > 2 && weight <= 5) {
            obj.req.costCalculationEntity.weightRange = [2000, 5000];
            obj.reqEms.costCalculationEntity.weightRange = [2000, 5000];
            obj.reqInt.costCalculationEntity.weightRange = [2000, 5000];
          } else if (weight > 5 && weight <= 10) {
            obj.req.costCalculationEntity.weightRange = [5000, 10000];
            obj.reqEms.costCalculationEntity.weightRange = [5000, 10000];
            obj.reqInt.costCalculationEntity.weightRange = [5000, 10000];
          } else if (weight > 10 && weight <= 50) {
            obj.req.costCalculationEntity.weightRange = [10000, 50000];
            obj.reqEms.costCalculationEntity.weightRange = [10000, 50000];
            obj.reqInt.costCalculationEntity.weightRange = [10000, 50000];
          } else {
            obj.req.costCalculationEntity.weightRange = [50000, 100000];
            obj.reqEms.costCalculationEntity.weightRange = [50000, 100000];
            obj.reqInt.costCalculationEntity.weightRange = [50000, 100000];
          }
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
        setTimeout(function () {
          async.parallel([
            function (callback) {
              calcResults(item.reqEms, "Курьерский", callback);
            },
            function (callback) {
              if (item.req.skip) {
                return callback(null);
              }
              calcResults(item.req, "Обычный", callback);
            },
            function (callback) {
              if (item.reqInt.skip) {
                return callback(null);
              }
              calcResults(item.reqInt, "Ускоренный", callback);
            }
          ], function (err, results) {
            if (results[0].tariff) {
              item.tariffs.push(results[0].tariff);
            }
            if (results[1] && results[1].tariff) {
              item.tariffs.push(results[1].tariff);
            }
            if (results[2] && results[2].tariff) {
              item.tariffs.push(results[2].tariff);
            }
            if (!item.tariffs.length) {
              item.error = results[0].error || results[1].error || results[2].error;
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