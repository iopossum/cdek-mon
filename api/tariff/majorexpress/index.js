var responseHelper = require('../../helpers/response');
var deliveryHelper = require('../../helpers/delivery');
var commonHelper = require('../../helpers/common');
var async = require('async');
var request = commonHelper.request;
var cheerio = require('cheerio');
var config = require('../../../conf');
var logger = require('../../helpers/logger');
var _ = require('underscore');
var delivery = 'majorexpress';

var formData = {
  __EVENTTARGET: '',
  __EVENTARGUMENT: '',
  __VIEWSTATE: '/wEPDwUKMTM4MTQxNjY1Mg9kFgJmD2QWAgIDD2QWCAIDDzwrAAYBAA8WAh4FVmFsdWVlZGQCBQ88KwAGAQAPFgIfAGVkZAIHDzwrAAQBAA8WAh8AaGRkAgsPZBYiAgEPFCsABg8WAh8AAgFkZGQ8KwAMAQs8KwAFAQAWBB4SRW5hYmxlQ2FsbGJhY2tNb2RlaB4nRW5hYmxlU3luY2hyb25pemF0aW9uT25QZXJmb3JtQ2FsbGJhY2sgaGRkZAIDDxQrAAYPFgQfAGYeD0RhdGFTb3VyY2VCb3VuZGdkZGQ8KwAMAQsUKwAFFgQfAWcfAmhkZGQPZBAWAWYWARQrAAEWAh4PQ29sVmlzaWJsZUluZGV4ZmRkZGQCBQ8UKwAGDxYEHwBmHwNnZGRkPCsADAELFCsABRYEHwFnHwJoZGRkD2QQFgFmFgEUKwABFgIfBGZkZGRkAgcPFCsABg8WBh8AAuMqHgdFbmFibGVkZx8DZ2RkZDwrAAwBCxQrAAUWBB8BZx8CaGRkZA9kEBYBZhYBFCsAARYCHwRmZGRkZAIJDxQrAAYPFgYfAAKBAR8FZx8DZ2RkZDwrAAwBCxQrAAUWBB8BZx8CaGRkZA9kEBYBZhYBFCsAARYCHwRmZGRkZAILDzwrAAYBAA8WAh8AZWRkAg0PPCsABgEADxYCHwBlZGQCDw88KwAGAQAPFgIfAGVkZAIRDzwrAAYBAA8WAh8ABQExZGQCEw88KwAEAQAPFgIfAAUQ0KPQv9Cw0LrQvtCy0LrQsGRkAhUPPCsABgEADxYCHwBlZGQCFw8UKwAGDxYEHwACAx4HVmlzaWJsZWdkZGQ8KwAMAQs8KwAFAQAWBB8BaB8CaGRkZAIdDzwrAAQBAA8WAh8AZWRkAh8PPCsAEQMADxYCHwZoZAEQFgAWABYADBQrAABkAiEPPCsAEQMADxYGHgtfIURhdGFCb3VuZGceC18hSXRlbUNvdW50AgEfBmdkARAWABYAFgAMFCsAABYCZg9kFgZmDw8WAh8GaGRkAgEPZBYCZg9kFgJmDxUGATEHMTE0OSwxMgEwATMBIABkAgIPDxYCHwZoZGQCIw9kFgICAQ8WAh4JaW5uZXJodG1sBQI2MmQCJw9kFgQCAQ8UKwAGDxYCHwBkZGRkPCsADAELPCsABQEAFgQfAWgfAmhkZGQCAw88KwAGAQAPFgIfAGVkZBgDBR5fX0NvbnRyb2xzUmVxdWlyZVBvc3RCYWNrS2V5X18WCgUPY3RsMDAkYnRuUG9wTG9nBSdjdGwwMCRDb250ZW50UGxhY2VIb2xkZXIxJGNiUHJvZHVjdCREREQFK2N0bDAwJENvbnRlbnRQbGFjZUhvbGRlcjEkY2JDb3VudHJ5RnJvbSREREQFKWN0bDAwJENvbnRlbnRQbGFjZUhvbGRlcjEkY2JDb3VudHJ5VG8kREREBShjdGwwMCRDb250ZW50UGxhY2VIb2xkZXIxJGNiQ2l0eUZyb20kREREBSZjdGwwMCRDb250ZW50UGxhY2VIb2xkZXIxJGNiQ2l0eVRvJERERAUnY3RsMDAkQ29udGVudFBsYWNlSG9sZGVyMSRjYlBhY2thZ2UkREREBSFjdGwwMCRDb250ZW50UGxhY2VIb2xkZXIxJGJ0bkNhbGMFPmN0bDAwJENvbnRlbnRQbGFjZUhvbGRlcjEkRGVsaXZlcnlCbG9jazEkY2JEZWxpdmVyeVByb2R1Y3QkREREBTFjdGwwMCRDb250ZW50UGxhY2VIb2xkZXIxJERlbGl2ZXJ5QmxvY2sxJGJ0bkNoZWNrBSBjdGwwMCRDb250ZW50UGxhY2VIb2xkZXIxJGd2Q2FsYw88KwAMAQgCAWQFJWN0bDAwJENvbnRlbnRQbGFjZUhvbGRlcjEkZ3ZJbnRlckNhbGMPZ2Q0yJECjjhkMow8kU2O+0b/6XODRoMAN3U2dvHFg+7I1g==',
  __VIEWSTATEGENERATOR: '10DAA136',
  __PREVIOUSPAGE: 'UpjP6228i5BkwqScLwRduaAPF98l8V35XC2BfPdPsiZwUcfh7mTf_E-JIT_hWe1cBfSGqC5cWn1wkHNp6zR_36Y3j8rfp4HLlUoW7Px82IE1',
  tbPopLog_Raw: '',
  ctl00$tbPopLog: 'Логин',
  tbPopPwd_Raw: '',
  ctl00$tbPopPwd: 'Пароль',
  ctl00$chbRemember: 'U',
  ContentPlaceHolder1_cbProduct_VI: '1',
  ctl00$ContentPlaceHolder1$cbProduct: 'Экспресс-доставка',
  ContentPlaceHolder1_cbProduct_DDDWS: '0:0:-1:-10000:-10000:0:0:0:1:0:0:0',
  ContentPlaceHolder1_cbProduct_DDD_LDeletedItems: '',
  ContentPlaceHolder1_cbProduct_DDD_LInsertedItems: '',
  ContentPlaceHolder1_cbProduct_DDD_LCustomCallback: '',
  ctl00$ContentPlaceHolder1$cbProduct$DDD$L: '1',
  ContentPlaceHolder1_cbCountryFrom_VI: '0',
  ctl00$ContentPlaceHolder1$cbCountryFrom: 'Россия',
  ContentPlaceHolder1_cbCountryFrom_DDDWS: '0:0:-1:-10000:-10000:0:0:0:1:0:0:0',
  ContentPlaceHolder1_cbCountryFrom_DDD_LDeletedItems: '',
  ContentPlaceHolder1_cbCountryFrom_DDD_LInsertedItems: '',
  ContentPlaceHolder1_cbCountryFrom_DDD_LCustomCallback: '',
  ctl00$ContentPlaceHolder1$cbCountryFrom$DDD$L: '0',
  ContentPlaceHolder1_cbCountryTo_VI: '0',
  ctl00$ContentPlaceHolder1$cbCountryTo: 'Россия',
  ContentPlaceHolder1_cbCountryTo_DDDWS: '0:0:-1:-10000:-10000:0:0:0:1:0:0:0',
  ContentPlaceHolder1_cbCountryTo_DDD_LDeletedItems: '',
  ContentPlaceHolder1_cbCountryTo_DDD_LInsertedItems: '',
  ContentPlaceHolder1_cbCountryTo_DDD_LCustomCallback: '',
  ctl00$ContentPlaceHolder1$cbCountryTo$DDD$L: '0',
  ContentPlaceHolder1_cbCityFrom_VI: '5475',
  ctl00$ContentPlaceHolder1$cbCityFrom: 'jklhj',
  ContentPlaceHolder1_cbCityFrom_DDDWS: '1:1:12000:432:367:1:198:180:1:0:0:0',
  ContentPlaceHolder1_cbCityFrom_DDD_LDeletedItems: '',
  ContentPlaceHolder1_cbCityFrom_DDD_LInsertedItems: '',
  ContentPlaceHolder1_cbCityFrom_DDD_LCustomCallback: '',
  ctl00$ContentPlaceHolder1$cbCityFrom$DDD$L: '',
  ContentPlaceHolder1_cbCityTo_VI: '129',
  ctl00$ContentPlaceHolder1$cbCityTo: 'Москва',
  ContentPlaceHolder1_cbCityTo_DDDWS: '0:0:-1:-10000:-10000:0:0:0:1:0:0:0',
  ContentPlaceHolder1_cbCityTo_DDD_LDeletedItems: '',
  ContentPlaceHolder1_cbCityTo_DDD_LInsertedItems: '',
  ContentPlaceHolder1_cbCityTo_DDD_LCustomCallback: '',
  ctl00$ContentPlaceHolder1$cbCityTo$DDD$L: '129',
  ContentPlaceHolder1_tbLength_Raw: '',
  ctl00$ContentPlaceHolder1$tbLength: 'Длина (см)',
  ContentPlaceHolder1_tbWidth_Raw: '',
  ctl00$ContentPlaceHolder1$tbWidth: 'Ширина (см)',
  ContentPlaceHolder1_tbHeight_Raw: '',
  ctl00$ContentPlaceHolder1$tbHeight: 'Высота (см)',
  ContentPlaceHolder1_tbCalcWeight_Raw: '1',
  ctl00$ContentPlaceHolder1$tbCalcWeight: '1',
  ContentPlaceHolder1_tbCost_Raw: '',
  ctl00$ContentPlaceHolder1$tbCost: 'Оценочная стоимость (руб)',
  ContentPlaceHolder1_cbPackage_VI: '3',
  ctl00$ContentPlaceHolder1$cbPackage: 'Другая упаковка',
  ContentPlaceHolder1_cbPackage_DDDWS: '0:0:-1:-10000:-10000:0:0:0:1:0:0:0',
  ContentPlaceHolder1_cbPackage_DDD_LDeletedItems: '',
  ContentPlaceHolder1_cbPackage_DDD_LInsertedItems: '',
  ContentPlaceHolder1_cbPackage_DDD_LCustomCallback: '',
  ctl00$ContentPlaceHolder1$cbPackage$DDD$L: '3',
  ContentPlaceHolder1_DeliveryBlock1_cbDeliveryProduct_VI: '1',
  ctl00$ContentPlaceHolder1$DeliveryBlock1$cbDeliveryProduct: 'Экспресс-доставка',
  ContentPlaceHolder1_DeliveryBlock1_cbDeliveryProduct_DDDWS: '0:0:-1:-10000:-10000:0:0:0:1:0:0:0',
  ContentPlaceHolder1_DeliveryBlock1_cbDeliveryProduct_DDD_LDeletedItems: '',
  ContentPlaceHolder1_DeliveryBlock1_cbDeliveryProduct_DDD_LInsertedItems: '',
  ContentPlaceHolder1_DeliveryBlock1_cbDeliveryProduct_DDD_LCustomCallback: '',
  ctl00$ContentPlaceHolder1$DeliveryBlock1$cbDeliveryProduct$DDD$L: '1',
  ContentPlaceHolder1_DeliveryBlock1_InvoiceNumber_Raw: '',
  ctl00$ContentPlaceHolder1$DeliveryBlock1$InvoiceNumber: 'Введите номер накладной',
  DXScript: '1_187,1_101,1_130,1_137,1_180,1_124,1_121,1_105,1_141,1_129,1_98,1_172,1_170,1_132',
  DXCss: '1_7,1_16,1_8,1_6,1_14,1_1,styles.css',
  __CALLBACKID: 'ctl00$ContentPlaceHolder1$cbCityTo',
  __CALLBACKPARAM: 'c0:LBCRI|4;0:99;CBCF|5;jklhj;',
  __EVENTVALIDATION: '/wEdAAg+8a68xr3s0poGWclUeS1ujtVQLQrEnIbjmIO/ZtnanBURE9yPSvOSRjDl2QhdsmkuZdkoFpB4ESxdAtuiUVt8gl73xgw2NCSYTnx1Re6LhDcdrfIBD0KLYT9317mddRwD6Jh4KGw6EeOMB2EMx8q+sBBTJQXkxFp9HwpVVLmS7jW36QSP0vLTTzlJKqnaEajshG8aizhfmygvfQzYKi7N'
};

var getReq = function (from, countryFrom, to, countryTo) {
  from = from || {};
  to = to || {};
  countryFrom = countryFrom || {};
  countryTo = countryTo || {};
  return {
    countryFromId: countryFrom.id || 0,
    countryToId: countryTo.id || 0,
    countryFromName: countryFrom.name || "Россия",
    countryToName: countryTo.name || "Россия",
    cityFromId: countryTo && countryTo.useEng ? 129 : from.id,
    cityToId: to.id || undefined,
    cityFrom: countryTo && countryTo.useEng ? "Москва" : (from.name || ''),
    cityTo: to.name || ""
  }
};

var getCity = function (city, cityEng, country, callback) {
  var totalCity = city;
  if (country && country.useEng) {
    totalCity = cityEng;
  }
  var deliveryData = deliveryHelper.get(delivery);
  var opts = deliveryData.citiesUrl;
  var trim = commonHelper.getCity(totalCity);
  var splitTrim = null;
  if (country && country.useEng) {
    var splits = trim.split(" ");
    if (splits.length > 1) {
      splitTrim = splits[0];
    }
  }
  var result = {
    city: totalCity,
    cityTrim: trim,
    success: false
  };
  opts.form = Object.assign({}, formData);
  opts.form.ctl00$ContentPlaceHolder1$cbCityTo = splitTrim || trim;
  opts.form.__CALLBACKPARAM = 'c0:LBCRI|4;0:99;CBCF|' + (splitTrim ? splitTrim.length : trim.length) + ';' + (splitTrim ? splitTrim : trim) + ';';
  if (country) {
    opts.form.ContentPlaceHolder1_cbCountryTo_VI = country.id;
    opts.form.ctl00$ContentPlaceHolder1$cbCountryTo = country.name;
    opts.form.ctl00$ContentPlaceHolder1$cbCountryTo$DDD$L = country.id;
  }
  async.retry(config.retryOpts, function (callback) {
    request(opts, callback)
  }, function (err, r, b) {
    if (err) {
      result.message = commonHelper.getCityJsonError(err);
      return callback(null, result);
    }
    b = b.replace('0|/!*DX*!/(', '');
    b = b.replace('0|/*DX*/(', '');
    b = b.substring(0, b.length - 1);
    b = b.replace(/\"/g, '\\"').replace(/\'/g, '"');
    var json = null;
    try {
      json = JSON.parse(b);
    } catch (e) {
      result.message = commonHelper.getCityJsonError(e);
    }
    if (!json) {
      return callback(null, result);
    }
    if (!json.result) {
      result.message = commonHelper.getCityJsonError(new Error("Отсутствует обязательный параметр result"));
      return callback(null, result);
    }
    var array = null;
    try {
      array = JSON.parse(json.result);
    } catch (e) {
      result.message = commonHelper.getCityJsonError(new Error("Неверный формат result"));
    }
    if (!array) {
      return callback(null, result);
    }
    var cities = [];
    array.forEach(function (item, index) {
      if (typeof item === 'string') {
        cities.push({id: array[index-1], name: item});
      }
    });
    if (!cities.length) {
      result.message = commonHelper.getCityNoResultError(trim);
    } else if (cities.length === 1) {
      result.foundCities = cities;
      result.success = true;
    } else {
      var region = commonHelper.getRegionName(totalCity);
      var foundIds = [];
      if (region) {
        foundIds = commonHelper.findInArray(cities, region, 'name');
      }
      if (!foundIds.length) {
        //ищем по точному совпадению
        cities.forEach(function (item, index) {
          if (commonHelper.getCity(item.name).toUpperCase() === trim.toUpperCase()) {
            foundIds.push(item);
          }
        });
      }
      result.cities = cities;
      result.foundCities = foundIds.length ? foundIds : [cities[0]];
      result.success = true;
    }
    callback(null, result);
  });
};

module.exports = function (req, cities) {
  var deliveryData = deliveryHelper.get(delivery);
  var requests = [];
  var cityObj = {};
  var timestamp = global[delivery];

  async.auto({
    getCountries: function (callback) {

      async.retry(config.retryOpts, function (callback) {
        var nightmare = commonHelper.getNightmare();
        nightmare.goto(deliveryData.calcUrl.uri)
          .realMousedown('#ContentPlaceHolder1_cbProduct_B-1')
          .wait('#ContentPlaceHolder1_cbProduct_DDD_L_LBT')
          .realMousedown('#ContentPlaceHolder1_cbProduct_DDD_L_LBI0T0')
          .realClick('#ContentPlaceHolder1_cbProduct_DDD_L_LBI0T0')
          .wait('#ContentPlaceHolder1_cbPackage')
          .wait()
          .evaluate(function () {
            var result = {
              from: [],
              to: [],
              params: {}
            };
            var reg = /dxo\.itemsValue=(\[[0-9\-,]*\])/i;
            var containerFrom = document.querySelector('#ContentPlaceHolder1_cbCountryFrom_DDD_PWC-1');
            var containerTo = document.querySelector('#ContentPlaceHolder1_cbCountryTo_DDD_PWC-1');
            if (!containerFrom || !containerTo) {
              return result;
            }
            var matchesFrom = containerFrom.querySelector('script').innerText.match(reg);
            var matchesTo = containerTo.querySelector('script').innerText.match(reg);
            try {
              var idsFrom = JSON.parse(matchesFrom[1]);
              var idsTo = JSON.parse(matchesTo[1]);
              var labelsFrom = document.querySelector('#ContentPlaceHolder1_cbCountryFrom_DDD_L_LBT').querySelectorAll('.dxeListBoxItemRow');
              var labelsTo = document.querySelector('#ContentPlaceHolder1_cbCountryTo_DDD_L_LBT').querySelectorAll('.dxeListBoxItemRow');
              labelsFrom.forEach(function (item, index) {
                result.from.push({id: idsFrom[index], name: item.querySelector('td').innerText.trim().toLowerCase()});
              });
              labelsTo.forEach(function (item, index) {
                result.to.push({id: idsTo[index], name: item.querySelector('td').innerText.trim().toLowerCase()});
              });
            } catch (e) {}
            return result;
          })
          .end()
          .then(function (result) {
            callback(!result.from.length || !result.to.length ? commonHelper.getCountriesError(new Error("Возможно изменилась структура сайта")) : null, result);
          })
          .catch(function (error) {
            callback(error ? commonHelper.getCountriesError(error) : null, []);
          });
      }, function (err, results) {
        async.nextTick(function () {
          callback(err, results);
        });
      });

    },
    getCities: ['getCountries', function (results, callback) {
      var countryFromObj = _.indexBy(results.getCountries.from, 'name');
      var countryToObj = _.indexBy(results.getCountries.to, 'name');
      async.mapSeries(cities, function (city, callback) {
        if (!city.from || !city.to) {
          city.error = commonHelper.CITIESREQUIRED;
          return async.nextTick(function () {
            callback(null, city);
          });
        }
        if (city.countryFrom) {
          if (typeof countryFromObj[city.countryFrom.toLowerCase()] === 'undefined') {
            city.error = commonHelper.COUNTRYFROMNOTFOUND;
            return async.nextTick(function () {
              callback(null, city);
            });
          } else {
            city.countryFromTemp = countryFromObj[city.countryFrom.toLowerCase()];
          }
        }
        if (city.countryTo) {
          var found = false;
          if (typeof countryToObj[city.countryTo.toLowerCase()] !== 'undefined') {
            found = true;
            city.countryToTemp = countryToObj[city.countryTo.toLowerCase()];
          } else if (city.countryToEng && typeof countryToObj[city.countryToEng.toLowerCase()] !== 'undefined') {
            found = true;
            city.countryToTemp = countryToObj[city.countryToEng.toLowerCase()];
            city.countryToTemp.useEng = true;
          }
          if (!found) {
            city.error = commonHelper.COUNTRYNOTFOUND;
            return async.nextTick(function () {
              callback(null, city);
            });
          }
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
              getCity(city.from, city.fromEngName, city.countryFromTemp, callback);
            },
            function (callback) {
              if (typeof  cityObj[city.to + city.countryTo] !== 'undefined') {
                return callback(null);
              }
              getCity(city.to, city.toEngName, city.countryToTemp, callback);
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

      var tempRequests = [];
      results.getCities.forEach(function (item) {
        if (item.error) {
          requests = requests.concat(commonHelper.getResponseArray(req.body.weights, item, delivery, item.error));
        } else if (!item.fromJson.success) {
          requests = requests.concat(commonHelper.getResponseArray(req.body.weights, item, delivery, item.fromJson.message));
        } else if (!item.toJson.success) {
          if (item.countryToTemp && item.countryToTemp.useEng && item.toEngName) {
            item.initialCityTo = item.to;
            item.to = item.toEngName;
          }
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
                req: getReq(fromCity, item.countryFromTemp, toCity, item.countryToTemp),
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
          requests.push(obj);
        });
      });
      callback(null);
    }],
    requests: ['parseCities', function (results, callback) {

      async.mapLimit(requests, 3, function (item, callback) {
        setTimeout(function () {
          if (global[delivery] > timestamp) {
            return callback({abort: true});
          }
          if (item.error) {
            return async.nextTick(function () {
              callback(null, item);
            });
          }

          var nightmare = commonHelper.getNightmare();
          nightmare.goto(deliveryData.calcUrl.uri)
            .realMousedown('#ContentPlaceHolder1_cbProduct_B-1')
            .wait('#ContentPlaceHolder1_cbProduct_DDD_L_LBT')
            .realMousedown('#ContentPlaceHolder1_cbProduct_DDD_L_LBI0T0')
            .realClick('#ContentPlaceHolder1_cbProduct_DDD_L_LBI0T0')
            .wait('#ContentPlaceHolder1_cbPackage')
            .insert('input#ContentPlaceHolder1_tbCalcWeight_Raw', item.weight)
            .insert('input#ContentPlaceHolder1_tbCalcWeight_I', item.weight)
            .evaluate(function (item) {
              document.querySelector('input#ContentPlaceHolder1_cbCountryFrom_VI').value = item.req.countryFromId;
              document.querySelector('input#ContentPlaceHolder1_cbCountryTo_VI').value = item.req.countryToId;
              document.querySelector('input#ContentPlaceHolder1_cbCountryFrom_I').value = item.req.countryFromName;
              document.querySelector('input#ContentPlaceHolder1_cbCountryTo_I').value = item.req.countryToName;

              document.querySelector('input#ContentPlaceHolder1_cbCityFrom_I').value = item.req.cityFrom;
              document.querySelector('input#ContentPlaceHolder1_cbCityFrom_VI').value = item.req.cityFromId;
              document.querySelector('input#ContentPlaceHolder1_cbCityTo_I').value = item.req.cityTo;
              document.querySelector('input#ContentPlaceHolder1_cbCityTo_VI').value = item.req.cityToId;
              return false;
            }, item) // <-- that's how you pass parameters from Node scope to browser scope)
            .realClick('#ContentPlaceHolder1_btnCalc')
            .wait(3000)
            .wait('#ContentPlaceHolder1_cbPackage')
            //.inject('js', process.cwd() + '/node_modules/jquery/dist/jquery.js')
            //.screenshot(process.cwd() + '/temp2.png')
            .evaluate(function (item) {
              var spans = null;
              var int = false;
              try {
                spans = document.querySelector('#ContentPlaceHolder1_gvCalc').querySelector('table').querySelectorAll('span');
              } catch (e) {}
              if (!spans) {
                try {
                  spans = document.querySelector('#ContentPlaceHolder1_gvInterCalc').querySelector('table').querySelectorAll('span');
                  int = true;
                } catch (e) {
                }
              }
              if (!spans) {
                item.error = "По указанным направлениям ничего не найдено";
                return item;
              }
              item.tariffs = [{
                cost: int ? spans[2].innerText.trim() + '$' : spans[4].innerText.trim(),
                deliveryTime: int ? '' : spans[8].innerText.trim()
              }];
              return item;
            }, item)
            .end()
            .then(function (result) {
              callback(null, result);
            })
            .catch(function (error) {
              item.error = commonHelper.getResultJsonError(new Error(error));
              callback(null, item);
            });
        }, commonHelper.randomInteger(500, 1000));
      }, callback);
    }],
    nextTick: ['requests', function (results, callback) {
      async.nextTick(callback);
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