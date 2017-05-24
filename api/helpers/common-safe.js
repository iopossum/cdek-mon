var moment = require('moment');
var _ = require('underscore');

exports.CITIESREQUIRED = 'Должен быть указан город отправления и город назначения';
exports.CITYORCOUNTRYREQUIRED = 'Должен быть указан город отправления и назначения или страна отправления и назначения';
exports.CITYFROMREQUIRED = 'Должен быть указан город отправления';
exports.CITYORCOUNTRYFROMREQUIRED = 'Должен быть указан город или страна отправления';
exports.CITYORCOUNTRYTOREQUIRED = 'Должен быть указан город или страна назначения';
exports.COUNTRYLISTERROR = 'Не удалось получить список стран. Попробуйте позже.';
exports.COUNTRYFROMNOTFOUND = 'Страна отправления отстуствует в списке доступных';
exports.COUNTRYNOTFOUND = 'Страна назначения отстуствует в списке доступных';
exports.CITYFROMNOTFOUND = 'Город отправления отстуствует в списке доступных';
exports.CITYTONOTFOUND = 'Город назначения отстуствует в списке доступных';
exports.COUNTRYFROMRUSSIA = 'Отправления возможны только из России';
exports.POSTCODEFROMNOTFOUND = 'Не удалось получить индекс города отправления';
exports.POSTCODETONOTFOUND = 'Не удалось получить индекс города получения';

exports.DATEFORMATREG = /^\s*((0?[1-9]|[12][0-9]|3[01])\.(0?[1-9]|1[012])\.\d{4})([\d\D]*)/;
exports.COSTREG = /[^0-9,]/g;
exports.DELIVERYTIMEREG = /[^0-9-]/g;

exports.RUSSIA = ['россия', 'российская', 'рф', 'russia'];
exports.SNG = ['казахстан', 'армения', 'беларусь', 'белоруссия', 'кыргызстан', 'киргизия'];

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

exports.rounded = function (number, count) {
  return Math.round(number*count)/count;
};

exports.parseInt = function (value) {
  value = value || 0;
  value = parseInt(value, 10);
  if (isNaN(value)) {
    value = 0;
  }
  return value;
};

exports.getCity = function (city) {
  return city.split(',')[0].trim();
};

exports.getDistrictName = function (city) {
  var region = null;
  var splits = city.split(',');
  if (splits.length >= 3) {
    region = splits[2].split(' ')[1] || splits[2].split(' ')[0];
  }
  return region;
};

exports.getRegionName = function (city) {
  var region = null;
  var splits = city.split(',');
  if (splits.length === 2) {
    region = splits[1].split(' ')[1] || splits[1].split(' ')[0];
  } else if (splits.length >= 3) {
    region = splits[2].split(' ')[1] || splits[2].split(' ')[0];
  }
  return region;
};

exports.getCountryName = function (city) {
  var country = null;
  var splits = city.split(',');
  if (splits.length > 1) {
    country = splits[splits.length - 1];
  }
  if (country) {
    country = country.replace(/^ /, "");
  }
  return country;
};

exports.getResponseArray = function (weights, cityItem, delivery, error) {
  return weights.map(function (weight) {
    return exports.getResponseObject(cityItem, delivery, weight, error);
  });
};

exports.getResponseObject = function (cityItem, delivery, weight, error) {
  delete cityItem.fromJson;
  delete cityItem.toJson;
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
  var reg = exactly ? new RegExp("(^|[^_0-9a-zA-Zа-яёА-ЯЁ])" + value + "([^_0-9a-zA-Zа-яёА-ЯЁ-]|$)", "i") : new RegExp(value, 'gi');
  return array.filter(function (item) {
    if (!item[key]) {
      return false;
    }
    return item[key].match(reg);
  });
};

exports.getServicesError = function (err) {
  err = err || {};
  return "Не удалось получить услуги с сайта. " + (err.message ? 'Ошибка: ' + err.message : '');
};

exports.getResponseError = function (err) {
  err = err || {};
  return "Не удалось получить информацию с сайта. " + (err.message ? 'Ошибка: ' + err.message : '');
};

exports.getCityJsonError = function (err) {
  return "Не удалось получить города с сайта. Неверный ответ от сервера. " + (err.message ? 'Ошибка: ' + err.message : '');
};

exports.getCountriesError = function (err) {
  return "Не удалось получить страны с сайта. " + (err.message ? 'Ошибка: ' + err.message : '');
};

exports.getResultJsonError = function (err) {
  err = err || {};
  return "Не удалось получить информацию с сайта, попробуйте позже. " + (err.message ? 'Ошибка: ' + err.message : '');
};

exports.getCityNoResultError = function (city) {
  city = city || '';
  return "Не удалось получить города с сайта. Такого города " + city.toUpperCase() + " нет в БД сайта.";
};

exports.getCountryNoResultError = function () {
  return "Не удалось получить страны с сайта. Такой страны нет в БД сайта.";
};

exports.getNoResultError = function () {
  return "По указанным направлениям ничего не найдено";
};

exports.getUnavailableError = function (err) {
  err = err || {};
  return "Калькулятор недоступен, попробуйте позже. " + (err.message ? 'Ошибка: ' + err.message : '');
};

exports.getNewsError = function (delivery, err) {
  return "Не удалось получить новости c сайта " + delivery.toUpperCase() + ". Попробуйте позже. " + (err ? 'Ошибка: ' + err.message : '');
};

exports.getNewsPartError = function (delivery) {
  return "Не удалось получить часть новостей c сайта " + delivery.toUpperCase() + ". Попробуйте позже.";
};

exports.getNewsWrongResponse = function (delivery) {
  return "Не удалось получить часть новостей c сайта " + delivery.toUpperCase() + ". Возможно изменалась структура сайта.";
};

exports.cloneArray = function (array) {
  return _.map(array, _.clone);
};

exports.deepClone = function (obj) {
  return JSON.parse(JSON.stringify(obj));
};

exports.getQueryString = function (req) {
  var str = "";
  for (var key in req) {
    str += (key + "=" + req[key] + "&");
  }
  return str;
};

exports.createTariff = function (service, cost, deliveryTime) {
  return {
    cost: cost,
    service: service,
    deliveryTime: deliveryTime
  };
};

exports.createNews = function (title, date, link, delivery, description) {
  return {
    title: title,
    date: date,
    link: link,
    description: description,
    delivery: delivery
  };
};

exports.sortNews = function (items) {
  return _.sortBy(items, function (item) {
    return -moment(item.date, 'DD MMMM YYYY', 'ru');
  });
};

exports.newsResponse = function (items, warning) {
  return {
    items: items,
    warning: warning
  };
};

exports.addZero = function (number) {
  if (number < 10) {
    number = ('0' + number);
  }
  return number;
};