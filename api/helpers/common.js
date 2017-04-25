var request = require('request');
var Nightmare = require('nightmare');
var realMouse = require('nightmare-real-mouse');
var _ = require('underscore');

// add the plugin
realMouse(Nightmare);
request.defaults({ timeout : 5000 });

exports.CITIESREQUIRED = 'Должен быть указан город отправления и город назначения';
exports.CITYORCOUNTRYREQUIRED = 'Должен быть указан город отправления и назначения или страна отправления и назначения';
exports.CITYFROMREQUIRED = 'Должен быть указан город отправления';
exports.CITYORCOUNTRYFROMREQUIRED = 'Должен быть указан город или страна отправления';
exports.CITYORCOUNTRYTOREQUIRED = 'Должен быть указан город или страна назначения';
exports.COUNTRYLISTERROR = 'Не удалось получить список стран. Попробуйте позже.';
exports.COUNTRYFROMNOTFOUND = 'Страна отправления отстуствует в списке доступных';
exports.COUNTRYNOTFOUND = 'Страна назначения отстуствует в списке доступных';
exports.CITYFROMNOTFOUND = 'Город назначения отстуствует в списке доступных';
exports.CITYTONOTFOUND = 'Город назначения отстуствует в списке доступных';
exports.COUNTRYFROMRUSSIA = 'Отправления возможны только из России';

exports.DATEFORMATREG = /^\s*((0?[1-9]|[12][0-9]|3[01])\.(0?[1-9]|1[012])\.\d{4})([\d\D]*)/;
exports.COSTREG = /[^0-9,]/g;
exports.DELIVERYTIMEREG = /[^0-9-]/g;

exports.SNG = ['Казахстан'];

exports.randomInteger = function (min, max) {
  var rand = min - 0.5 + Math.random() * (max - min + 1);
  rand = Math.round(rand);
  return rand;
};

exports.parseFloat = function (value) {
  value = value || 0;
  value = parseFloat(value);
  if (isNaN(value)) {
    value = 0;
  }
  return value;
};

exports.parseInt = function (value) {
  value = value || 0;
  value = parseInt(value, 10);
  if (isNaN(value)) {
    value = 0;
  }
  return value;
};

exports.getNightmare = function () {
  var nightmare = new Nightmare({
    executionTimeout: 30000,
    loadTimeout: 30000,
    gotoTimeout: 30000,
    waitTimeout: 30000,
    //show: true,
    //openDevTools: true
  });
  nightmare.viewport(1000, 1000)
    .useragent("Mozilla/5.0 (Windows NT 6.3; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/38.0.2125.111 Safari/537.36");
  return nightmare;
};

exports.getCity = function (city) {
  return city.split(',')[0].trim();
};

exports.getRegionName = function (city) {
  var region = null;
  var splits = city.split(',');
  if (splits.length === 2) {
    region = splits[1].split(' ')[1] || splits[1].split(' ')[0];
  } else if (splits.length > 3) {
    region = splits[2].split(' ')[1] || splits[2].split(' ')[0];
  }
  return region;
};

exports.getResponseArray = function (weights, cityItem, delivery, error) {
  return weights.map(function (weight) {
    return exports.getResponseObject(cityItem, delivery, weight, error);
  });
};

exports.getResponseObject = function (cityItem, delivery, weight, error) {
  return {
    city: _.clone(cityItem),
    delivery: delivery,
    weight: weight,
    tariffs: [],
    error: error
  }
};

exports.findInArray = function (array, value, key, exactly) {
  key = key || 'name';
  array = array || [];
  var reg = new RegExp(value, 'gi');
  return array.filter(function (item) {
    if (!item[key]) {
      return false;
    }
    if (exactly) {
      var match = item[key].match(reg);
      return match ? true : false;
    } else {
      return reg.test(item[key]);
    }
  });
};

exports.getServicesError = function (err) {
  err = err || {};
  return "Не удалось получить услуги с сайта. " + (err.message ? 'Ошибка: ' + err.message : '');
};

exports.getResponseError = function (err) {
  err = err || {};
  return "Не удалось получить города с сайта. " + (err.message ? 'Ошибка: ' + err.message : '');
};

exports.getCityJsonError = function (err) {
  return "Не удалось получить города с сайта. Неверный ответ от сервера. " + (err.message ? 'Ошибка: ' + err.message : '');
};

exports.getCountriesError = function (err) {
  return "Не удалось получить страны с сайта. " + (err.message ? 'Ошибка: ' + err.message : '');
};

exports.getResultJsonError = function (err) {
  return "Не удалось получить информацию с сайта, попробуйте позже. " + (err.message ? 'Ошибка: ' + err.message : '');
};

exports.getCityNoResultError = function () {
  return "Не удалось получить города с сайта. Такого города нет в БД сайта.";
};

exports.getCountryNoResultError = function () {
  return "Не удалось получить страны с сайта. Такой страны нет в БД сайта.";
};

exports.getNoResultError = function () {
  return "По указанным направлениям ничего не найдено";
};

exports.cloneArray = function (array) {
  return _.map(array, _.clone);
};

exports.cloneArray = function (array) {
  return _.map(array, _.clone);
};

exports.saveResults = function (req, err, opts) {
  if (global[opts.delivery] > opts.timestamp) {
    return false;
  }
  if (err) {
    if (err.abort) {
      return false;
    }
    req.session.delivery[opts.delivery].complete = true;
    req.session.delivery[opts.delivery].error = err.message || err.stack;
    var array = [];
    opts.cities.forEach(function (item) {
      array = array.concat(exports.getResponseArray(req.body.weights, item, delivery, err.message || err.stack))
    });
    req.session.delivery[opts.delivery].results = array;
  } else {
    req.session.delivery[opts.delivery].complete = true;
    req.session.delivery[opts.delivery].results = opts.items;
  }
  req.session.save(function () {});
};

exports.request = request;