var responseHelper = require('../../helpers/response');
var deliveryHelper = require('../../helpers/delivery');
var commonHelper = require('../../helpers/common');
var async = require('async');
var request = commonHelper.request;
var cheerio = require('cheerio');
var config = require('../../../conf');
var logger = require('../../helpers/logger');
var _ = require('underscore');

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

module.exports = function (req, cities) {
  var delivery = 'majorexpress';
  var deliveryData = deliveryHelper.get(delivery);
  var requests = [];
  var tempRequests = [];
  var cityObj = {};
  var timestamp = global[delivery];
  cities.forEach(function (item) {
    if (item.from) {
      if (typeof cityObj[item.from] === 'undefined') {
        cityObj[item.from] = item.countryFrom || '';
      }
    }
    if (item.to) {
      if (typeof cityObj[item.to] === 'undefined') {
        cityObj[item.to] = item.countryTo || '';
      }
    }
    if (!item.from && !item.to) {
      tempRequests.push({cityFrom: item.from, cityTo: item.to, countryFrom: item.countryFrom, countryTo: item.countryTo, delivery: delivery, tariffs: [], error: 'Должны быть указаны оба города'});
    }
  });

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
            var reg = /dxo\.itemsValue=(\[[0-9\-,]*\])/i;
            var container = document.querySelector('#ContentPlaceHolder1_cbCountryTo_DDD_PWC-1');
            if (!container) {
              return [];
            }
            var matches = container.querySelector('script').innerText.match(reg);
            var countries = [];
            try {
              var ids = JSON.parse(matches[1]);
              var labels = document.querySelector('#ContentPlaceHolder1_cbCountryTo_DDD_L_LBT').querySelectorAll('.dxeListBoxItemRow');
              labels.forEach(function (item, index) {
                countries.push({id: ids[index], name: item.querySelector('td').innerText.trim()});
              });
            } catch (e) {}
            return countries;
          })
          .end()
          .then(function (result) {
            callback(!result.length ? 'Не удалось получить страны' : null, result);
          })
          .catch(function (error) {
            callback(error, []);
          });
      }, function (err, results) {
        async.nextTick(function () {
          callback(null, results || []);
        });
      });

    },
    getCities: ['getCountries', function (results, callback) {
      async.mapLimit(_.keys(cityObj), 3, function (city, callback) {
        if (global[delivery] > timestamp) {
          return callback({abort: true});
        }
        var opts = deliveryData.citiesUrl;
        var trim = commonHelper.getCity(city);
        opts.form = Object.assign({}, formData);
        opts.form.ctl00$ContentPlaceHolder1$cbCityTo = trim;
        opts.form.__CALLBACKPARAM = 'c0:LBCRI|4;0:99;CBCF|' + trim.length + ';' + trim + ';';
        if (cityObj[city].length && results.getCountries.length) {
          var filtered = results.getCountries.filter(function (item) {
            return item.name.toUpperCase() === cityObj[city].toUpperCase();
          });
          if (filtered.length) {
            opts.form.ContentPlaceHolder1_cbCountryTo_VI = filtered[0].id;
            opts.form.ctl00$ContentPlaceHolder1$cbCountryTo = filtered[0].name;
            opts.form.ctl00$ContentPlaceHolder1$cbCountryTo$DDD$L = filtered[0].id;
          }
        }
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
            return callback(null, result);
          }
          b = b.replace('0|/*DX*/(', '');
          b = b.substring(0, b.length - 1);
          b = b.replace(/\"/g, '\\"').replace(/\'/g, '"');
          var json = null;
          try {
            json = JSON.parse(b);
          } catch (e) {
            result.message = "Не удалось получить города с сайта. Неверный ответ от сервера. " + (e.message ? 'Ошибка: ' + e.message : '');
          }
          if (!json) {
            return callback(null, result);
          }
          if (!json.result) {
            result.message = "Не удалось получить города с сайта. Неверный ответ от сервера.";
            return callback(null, result);
          }
          var array = null;
          try {
            array = JSON.parse(json.result);
          } catch (e) {
            result.message = "Не удалось получить города с сайта. Неверный ответ от сервера. " + (e.message ? 'Ошибка: ' + e.message : '');
          }
          if (!array) {
            return callback(null, result);
          }
          if (!array.length) {
            result.message = "Не удалось получить города с сайта. Такого города нет в БД сайта.";
          } else if (array.length === 2) {
            result.ids = [{id: array[0], name: array[1]}];
            result.success = true;
          } else {
            var region = commonHelper.getRegionName(city);
            var foundIds = [];
            if (region) {
              array.forEach(function (item, index) {
                if (typeof item === 'string') {
                  if (new RegExp(region, 'gi').test(item)) {
                    foundIds.push({id: array[index-1], name: item});
                  }
                }
              });
            }
            if (!region || !foundIds.length) {
              //ищем по точному совпадению
              array.forEach(function (item, index) {
                if (typeof item !== 'string' && array[index+1] && commonHelper.getCity(array[index+1]).toUpperCase() === trim.toUpperCase()) {
                  foundIds.push({id: item, name: array[index+1]});
                }
              });
              //ищем хоть что-то
              if (!foundIds.length) {
                array.forEach(function (item, index) {
                  if (typeof item !== 'string') {
                    foundIds.push({id: item, name: array[index+1]});
                  }
                });
              }
            }
            result.cities = [];
            array.forEach(function (item, index) {
              if (typeof item !== 'string') {
                result.cities.push({id: item, name: array[index+1]});
              }
            });
            result.ids = foundIds;
            result.success = true;
          }
          callback(null, result);
        });
      }, callback);
    }],
    parseCities: ['getCities', function (results, callback) {
      //todo: save ids to mongo
      var respCityObj = _.indexBy(results.getCities, 'city');
      cities.forEach(function (item) {
        if (item.from && item.to) {
          var obj = {
            city: {
              initialCityFrom: item.from,
              initialCityTo: item.to,
              from: item.from,
              to: item.to,
              countryFrom: item.countryFrom,
              countryTo: item.countryTo
            },
            delivery: delivery,
            tariffs: []
          };
          if (respCityObj[item.from].success && respCityObj[item.to].success) {
            for (var i=0; i<respCityObj[item.from].ids.length; i++) {
              for (var j=0; j<respCityObj[item.to].ids.length; j++) {
                var copy = _.clone(obj);
                copy.city = _.clone(obj.city);
                copy.city.from = respCityObj[item.from].ids[i].name;
                copy.city.to = respCityObj[item.to].ids[j].name;
                copy.req = {
                  cityFromId: respCityObj[item.from].ids[i].id || undefined,
                  cityToId: respCityObj[item.to].ids[j].id || undefined,
                  cityFrom: respCityObj[item.from].ids[i].name || item.from,
                  cityTo: respCityObj[item.to].ids[j].name || item.to
                };
                tempRequests.push(copy);
              }
            }
          } else if (!respCityObj[item.from].success) {
            var copy = Object.assign({}, obj);
            copy.error = respCityObj[item.from].message;
            tempRequests.push(copy);
          } else if (!respCityObj[item.to].success) {
            var copy = Object.assign({}, obj);
            copy.error = respCityObj[item.to].message;
            tempRequests.push(copy);
          }
        }
      });
      tempRequests.forEach(function (item) {
        req.body.weights.forEach(function (weight) {
          var obj = Object.assign({}, item);
          obj.weight = weight;
          requests.push(obj);
        });
      });
      async.mapLimit(requests, 3, function (item, callback) {
        if (global[delivery] > timestamp) {
          return callback({abort: true});
        }
        if (!item.req || item.error) {
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
            document.querySelector('input#ContentPlaceHolder1_cbCityFrom_I').value = item.req.cityFrom;
            document.querySelector('input#ContentPlaceHolder1_cbCityFrom_VI').value = item.req.cityFromId;
            document.querySelector('input#ContentPlaceHolder1_cbCityTo_I').value = item.req.cityTo;
            document.querySelector('input#ContentPlaceHolder1_cbCityTo_VI').value = item.req.cityToId;
            return false;
          }, item) // <-- that's how you pass parameters from Node scope to browser scope)
          .realClick('#ContentPlaceHolder1_btnCalc')
          .wait(2000)
          .wait('#ContentPlaceHolder1_cbPackage')
          //.inject('js', process.cwd() + '/node_modules/jquery/dist/jquery.js')
          //.screenshot(process.cwd() + '/temp2.png')
          .evaluate(function (item) {
            var spans = null;
            try {
              spans = document.querySelector('#ContentPlaceHolder1_gvCalc').querySelector('table').querySelectorAll('span');
            } catch (e) {}
            if (!spans) {
              item.error = "По запросу ничего не найдено";
              return item;
            }
            item.tariffs = [{
              cost: spans[4].innerText.trim(),
              deliveryTime: spans[8].innerText.trim()
            }];
            return item;
          }, item)
          .end()
          .then(function (result) {
            callback(null, result);
          })
          .catch(function (error) {
            item.error = error;
            callback(null, item);
          });

      }, callback);
    }],
    nextTick: ['parseCities', function (results, callback) {
      async.nextTick(callback);
    }]

  }, function (err, results) {
    logger.tariffsInfoLog(delivery, results.parseCities, 'getTariffs');
    commonHelper.saveResults(req, err, {
      delivery: delivery,
      timestamp: timestamp,
      cities: cities,
      items: results.parseCities || []
    });
  });
};