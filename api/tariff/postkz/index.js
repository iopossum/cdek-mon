var responseHelper = require('../../helpers/response');
var deliveryHelper = require('../../helpers/delivery');
var commonHelper = require('../../helpers/common');
var async = require('async');
var request = commonHelper.request;
var cheerio = require('cheerio');
var config = require('../../../conf');
var _ = require('underscore');
var logger = require('../../helpers/logger');
var delivery = 'postkz';

var getResult = function (nightmare, next, service) {
  var args = {
    next: next,
    service: service
  };
  return nightmare
    .wait(function () {
      return $('.pkz-preloader_active').css('display') === 'none';
    })
    .evaluate(function (args) {
      var trs = $('.calc__block__2__options').find('tbody').find('tr');
      var tariffs = [];
      trs.each(function (i, tr) {
        if (!$(tr).hasClass('ng-hide')) {
          var tds = $(tr).find('td');
          tariffs.push({
            service: $(tds[1]).text().trim() + (args.service ? ' (' + args.service + ')' : ''),
            cost: $(tds[2]).text().trim(),
            deliveryTime: $(tds[3]).text().trim()
          });
        }
      });
      if (args.next !== null) {
        $($('.calc__radios__item')[args.next]).click();
      }
      return tariffs;
    }, args);
};

var getMaxWeights = function (nightmare) {
  var result = {};
  return nightmare
    .wait(function () {
      return $('.pkz-preloader_active').css('display') === 'none';
    })
    .evaluate(function () {
      var input = $('.calc__weight__input');
      return input.attr('max');
    })
    .then(function (value) {
      result.parcel = parseFloat(value);
      return nightmare
        .evaluate(function () {
          $($('.calc__radios__item')[0]).click();
        })
        .wait(function () {
          return $('.pkz-preloader_active').css('display') === 'none';
        })
        .evaluate(function () {
          var input = $('.calc__weight__input');
          return input.attr('max');
        });
    })
    .then(function (value) {
      result.doc = parseFloat(value);
      return nightmare
        .evaluate(function () {
          var links = $('.calc__breadcrumb__item');
          $(links[1]).click();
          return false;
        })
        .wait(function () {
          return $('.pkz-preloader_active').css('display') === 'none';
        })
        .evaluate(function () {
          var input = $('.calc__weight__input');
          return input.attr('max');
        });
    })
    .then(function (value) {
      result.docInt = parseFloat(value);
      return nightmare
        .evaluate(function () {
          $($('.calc__radios__item')[1]).click();
        })
        .wait(function () {
          return $('.pkz-preloader_active').css('display') === 'none';
        })
        .evaluate(function () {
          var input = $('.calc__weight__input');
          return input.attr('max');
        });
    })
    .then(function (value) {
      result.parcelInt = parseFloat(value);
      return nightmare
        .evaluate(function () {
          var links = $('.calc__breadcrumb__item');
          $(links[0]).click();
          return false;
        });
    })
    .then(function () {
      return Promise.resolve(result);
    });
};

module.exports = function (req, cities, callback) {
  var deliveryData = deliveryHelper.get(delivery);
  var requests = [];
  var timestamp = callback ? new Date().getTime*2 : commonHelper.getReqStored(req, delivery);
  var maxWeights = null;
  var q = async.queue(function(task, callback) {
    if (commonHelper.getReqStored(req, delivery) > timestamp) {
      return callback({abort: true});
    }
    var nightmare = commonHelper.getNightmare();
    var item = _.extend(task);
    item.fromTrim = commonHelper.getCity(item.city.from);
    item.toTrim = item.city.toKz ? commonHelper.getCity(item.city.to) : commonHelper.getCity(item.city.countryTo);
    var parcelKey = !item.city.toKz ? 'parcelInt' : 'parcel';
    var docKey = !item.city.toKz ? 'docInt' : 'doc';
    nightmare.goto(deliveryData.calcUrl.uri)
      .wait('.calc__block')
      .wait(function () {
        return $('.pkz-preloader_active').css('display') === 'none';
      })
      .then(function () {
        if (!maxWeights) {
          return getMaxWeights(nightmare);
        } else {
          return Promise.resolve();
        }
      })
      .then(function (max) {
        if (max) {
          maxWeights = max;
        }
        if (!task.city.toKz) {
          return nightmare.evaluate(function () {
            var links = $('.calc__breadcrumb__item');
            $(links[1]).click();
            return false;
          })
        } else {
          return Promise.resolve();
        }
      })
      .then(function () {
        return nightmare
          .wait(function () {
            return $('.pkz-preloader_active').css('display') === 'none';
          })
          .evaluate(function (item) {
            var selects = $('.ui-select-container');
            var found = false;
            $(selects[0]).find('.ui-select-toggle').click();
            $(selects[0]).find('.ui-select-search').focus();
            $(selects[0]).find('.ui-select-choices-row').each(function (i, li) {
              if (!found) {
                var text = $(li).find('span').text().trim();
                if (new RegExp(item.fromTrim, 'gi').test(text)) {
                  found = true;
                  $(li).click();
                }
              }
            });
            return found;
        }, item)
      })
      .then(function (result) {
        if (!result) {
          return nightmare
            .end()
            .then(function () {
              return Promise.reject({message: commonHelper.getCityNoResultError(item.fromTrim), manual: true});
            });
        }
        return nightmare
          .wait(function () {
            return $('.pkz-preloader_active').css('display') === 'none';
          })
          .evaluate(function (item) {
            var selects = $('.ui-select-container');
            var found = false;
            $(selects[1]).find('.ui-select-toggle').click();
            $(selects[1]).find('.ui-select-search').focus();
            $(selects[1]).find('.ui-select-choices-row').each(function (i, li) {
              if (!found) {
                var text = $(li).find('span').text().trim();
                if (new RegExp(item.toTrim, 'gi').test(text)) {
                  found = true;
                  $(li).click();
                }
              }
            });
            return found;
          }, item)
      })
      .then(function (result) {
        if (!result) {
          return nightmare
            .end()
            .then(function () {
              return Promise.reject({message: commonHelper.getCityNoResultError(item.toTrim), manual: true});
            });
        }
        if (task.weight > maxWeights[parcelKey]) {
          return nightmare
            .end()
            .then(function () {
              delete task.req;
              return Promise.reject({message: "Максимальный вес " + maxWeights[parcelKey], manual: true});
            });
        }
        return nightmare
          .wait(function () {
            return $('.pkz-preloader_active').css('display') === 'none';
          })
          .evaluate(function (item) {
            $('.calc__weight__input').focus();
            $('.calc__weight__input').val("");
            $('.calc__weight__input').keypress();
          }, item)
          .type('.calc__weight__input', task.weight)
          .wait(function () {
            return $('.pkz-preloader_active').css('display') === 'none';
          })
          .evaluate(function () {
            $($('.calc__radios__item')[2]).click();
          })
          .wait(function () {
            return $('.pkz-preloader_active').css('display') === 'none';
          })
          .evaluate(function () {
            $($('.calc__radios__item')[1]).click();
          });
      })
      .then(function () {
        if (task.weight > maxWeights[docKey]) {
          return getResult(nightmare, 3)
            .then(function (tariffs) {
              task.tariffs = task.tariffs.concat(tariffs);
              return getResult(nightmare, item.city.toKz ? 4 : null);
            })
            .then(function (tariffs) {
              task.tariffs = task.tariffs.concat(tariffs);
              if (item.city.toKz) {
                return getResult(nightmare, null);
              } else {
                return Promise.resolve([]);
              }
            })
        } else {
          return getResult(nightmare, 0)
            .then(function (tariffs) {
              task.tariffs = task.tariffs.concat(tariffs);
              return getResult(nightmare, 3, 'документы');
            })
            .then(function (tariffs) {
              task.tariffs = task.tariffs.concat(tariffs);
              return getResult(nightmare, 1, 'документы');
            })
            .then(function (tariffs) {
              task.tariffs = task.tariffs.concat(tariffs);
              return getResult(nightmare, item.city.toKz ? 4 : null);
            })
            .then(function (tariffs) {
              task.tariffs = task.tariffs.concat(tariffs);
              if (item.city.toKz) {
                return getResult(nightmare, null);
              } else {
                return Promise.resolve([]);
              }
            })
        }
      })
      .then(function (tariffs) {
        task.tariffs = task.tariffs.concat(tariffs);
        if (!task.tariffs.length) {
          task.error = commonHelper.getNoResultError();
        }
        requests.push(task);
        callback();
        return nightmare.end();
      })
      .catch(function (error) {
        task.error = error.message || "Внутренняя ошибка nightmare";
        requests.push(task);
        callback();
        return nightmare.end();
      });

  }, 1);

  q.drain = function() {
    commonHelper.saveResults(req, null, {
      delivery: delivery,
      timestamp: timestamp,
      cities: cities,
      items: requests,
      callback: callback
    });
  };

  cities.forEach(function (item) {
    item.countryFrom = item.countryFrom || 'Российская федерация';
    item.countryTo = item.countryTo || 'Российская федерация';
    if (item.countryFrom.toLowerCase() === 'казахстан') {
      item.fromKz = true;
    }
    if (item.countryTo.toLowerCase() === 'казахстан') {
      item.toKz = true;
    }
    if (!item.fromKz) {
      requests = requests.concat(commonHelper.getResponseArray(req.body.weights, item, delivery, commonHelper.CITYFROMKZ));
    } else {
      req.body.weights.forEach(function (weight) {
        var city = commonHelper.deepClone(item);
        var obj = {};
        obj.weight = weight;
        obj.tariffs = [];
        obj.city = city;
        obj.city.initialCityFrom = item.from;
        obj.city.initialCityTo = item.to;
        obj.delivery = delivery;
        obj.req = {
          weight: weight
        };
        q.push(obj);
      });
    }
  });
};