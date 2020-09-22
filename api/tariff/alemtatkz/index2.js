var responseHelper = require('../../helpers/response');
var deliveryHelper = require('../../helpers/delivery');
var commonHelper = require('../../helpers/common');
var async = require('async');
var request = commonHelper.request;
var cheerio = require('cheerio');
var config = require('../../../conf');
var _ = require('underscore');
var logger = require('../../helpers/logger');
var delivery = 'alemtatkz';

var getService = function (city) {
  var service = {};
  if (city.fromKz && city.toKz) {
    service.code = 'E';
    service.name = 'Экспресс-отправления по РК';
  } else if (new RegExp("москва", 'gi').test(city.to)) {
    service.code = 'MOW';
    service.name = 'Доставка в г. Москва';
  } else {
    service.code = 'CIS';
    service.name = 'Ближнее зарубежье';
  }
  return service;
};

var getReq = function (from, to, service) {
  from = from || {};
  to = to || {};
  return {
    Path: 'calc',
    Controller: 'getAmountV2',
    FromCountryCode: from.CountryLocalCode,
    FromLocalCode: from.LocalCode,
    ToCountryCode: to.CountryLocalCode,
    ToLocalCode: to.LocalCode,
    ServiceLocalCode: service,
    Weight:1
  };
};

var getIndex = function ($LocalCode) {
  var index1 = 44;

  switch ( $LocalCode )
  {
    case "000003": // АЛМАТЫ
      index1 = 0;
      break;

    case "000008": // АКТАУ
      index1 = 1;
      break;

    case "000009": // АКСАЙ
      index1 = 2;
      break;

    case "000011": // АКТОБЕ
      index1 = 3;
      break;

    case "000006": // АСТАНА
      index1 = 4;
      break;

    case "000078": // АТБАСАР
      index1 = 5;
      break;

    case "000004": // АТЫРАУ
      index1 = 6;
      break;

    case "000106": // БАЛХАШ
      index1 = 7;
      break;

    case "000064": // ЖЕЗКАЗГАН
      index1 = 8;
      break;

    case "000005": // КАРАГАНДА
      index1 = 9;
      break;

    case "000014": // КОКШЕТАУ
      index1 = 10;
      break;

    case "000016": // КОСТАНАЙ
      index1 = 11;
      break;

    case "000010": // КЫЗЫЛОРДА
      index1 = 12;
      break;

    case "000017": // ПАВЛОДАР
      index1 = 13;
      break;

    case "000018": // ПЕТРОПАВЛОВСК
      index1 = 14;
      break;

    case "000020": // СЕМЕЙ
      index1 = 15;
      break;

    case "000055": // ТАЛДЫКОРГАН
      index1 = 16;
      break;

    case "000015": // ТАРАЗ
      index1 = 17;
      break;

    case "000007": // УРАЛЬСК
      index1 = 18;
      break;

    case "000019": // УСТЬ-КАМЕНОГОРСК
      index1 = 19;
      break;

    case "000012": // ШЫМКЕНТ
      index1 = 20;
      break;

    case "000024": // ЭКИБАСТУЗ
      index1 = 21;
      break;

    case "000259": // АБАЙ
      index1 = 22;
      break;

    case "000229": // АККОЛЬ
      index1 = 23;
      break;

    case "000198": // АКСУ
      index1 = 24;
      break;

    case "000098": // БАУТИНО
      index1 = 25;
      break;

    case "000100": // ЕСИК
      index1 = 26;
      break;

    case "000080": // ЖАНАОЗЕНЬ
      index1 = 27;
      break;

    case "000116": // ЗЫРЯНОВСК
      index1 = 28;
      break;

    case "000119": // КАПШАГАЙ
      index1 = 29;
      break;

    case "000114": // КАСКЕЛЕН
      index1 = 30;
      break;

    case "000069": // КУЛЬСАРЫ
      index1 = 31;
      break;

    case "000082": // ЛИСАКОВСК
      index1 = 32;
      break;

    case "000263": // РИДДЕР
      index1 = 33;
      break;

    case "000077": // РУДНЫЙ
      index1 = 34;
      break;

    case "000070": // САТПАЕВ
      index1 = 35;
      break;

    case "000036": // СТЕПНОГОРСК
      index1 = 36;
      break;

    case "000157": // ТАЛГАР
      index1 = 37;
      break;

    case "000071": // ТЕМИРТАУ
      index1 = 38;
      break;

    case "000076": // ТЕНГИЗ
      index1 = 39;
      break;

    case "000272": // УЗУНАГАШ
      index1 = 40;
      break;

    case "000096": // ХРОМТАУ
      index1 = 41;
      break;

    case "000205": // ШАХТИНСК
      index1 = 42;
      break;

    case "000183": // ЩУЧИНСК
      index1 = 43;
      break;
  }

  return index1;
};

var getZone = function ($From, $To) {
  //hell from site
  var zones = [
    [0, 2, 4, 2, 1, 4, 2, 4, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 1, 1, 1, 4, 4, 4, 4, 1, 4, 4, 1, 1, 4, 4, 4, 4, 4, 4, 1, 4, 4, 2, 4, 4, 4, 5],
    [3, 0, 5, 3, 3, 5, 2, 4, 4, 3, 3, 3, 3, 3, 3, 3, 3, 3, 2, 3, 3, 3, 5, 5, 5, 2, 5, 2, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
    [5, 5, 0, 5, 5, 6, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 1, 5, 5, 5, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6],
    [3, 3, 5, 0, 3, 5, 3, 4, 4, 3, 3, 3, 3, 3, 3, 3, 3, 3, 2, 3, 3, 3, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 2, 5, 5, 5],
    [1, 2, 5, 2, 0, 2, 2, 4, 4, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 4, 2, 5, 5, 4, 5, 5, 4, 4, 5, 5, 5, 5, 5, 2, 4, 4, 5, 5, 5, 5, 4, 5],
    [3, 3, 3, 3, 3, 0, 3, 5, 5, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6],
    [3, 3, 5, 3, 3, 5, 0, 4, 4, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 5, 5, 5, 5, 5, 5, 5, 5, 5, 3, 5, 5, 5, 5, 5, 5, 5, 3, 5, 5, 5, 5, 5],
    [4, 4, 5, 4, 4, 5, 4, 0, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
    [4, 4, 5, 4, 4, 5, 4, 4, 0, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 3, 5, 5, 5, 5, 5, 5, 5, 5, 5],
    [2, 2, 5, 2, 2, 5, 2, 4, 4, 0, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 2, 5, 5, 5, 2, 5, 5],
    [2, 2, 5, 2, 2, 5, 2, 4, 4, 2, 0, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 2, 5],
    [2, 2, 5, 2, 2, 5, 2, 4, 4, 2, 2, 0, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 2, 5, 2, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
    [2, 2, 5, 2, 2, 5, 2, 4, 4, 2, 2, 2, 0, 2, 2, 2, 2, 2, 2, 2, 2, 2, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
    [2, 2, 5, 2, 2, 5, 2, 4, 4, 2, 2, 2, 2, 0, 2, 2, 2, 2, 2, 2, 2, 2, 5, 5, 2, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
    [2, 2, 5, 2, 2, 5, 2, 4, 4, 2, 2, 2, 2, 2, 0, 2, 2, 2, 2, 2, 2, 2, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
    [2, 2, 5, 2, 2, 5, 2, 4, 4, 2, 2, 2, 2, 2, 2, 0, 2, 2, 2, 2, 2, 2, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
    [1, 2, 5, 2, 2, 5, 2, 4, 4, 2, 2, 2, 2, 2, 2, 2, 0, 2, 2, 2, 2, 2, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
    [2, 2, 5, 2, 2, 5, 2, 4, 4, 2, 2, 2, 2, 2, 2, 2, 2, 0, 2, 2, 2, 2, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
    [3, 3, 1, 2, 3, 5, 2, 4, 4, 3, 3, 3, 3, 3, 3, 3, 3, 3, 0, 3, 3, 3, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
    [2, 2, 5, 2, 2, 5, 2, 4, 4, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 0, 2, 2, 5, 5, 5, 5, 5, 5, 2, 5, 5, 5, 5, 2, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
    [2, 2, 5, 2, 2, 5, 2, 4, 4, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 0, 2, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
    [2, 2, 5, 2, 2, 5, 2, 4, 4, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 0, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
    [5, 5, 6, 5, 5, 6, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 0, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6],
    [5, 5, 6, 5, 2, 6, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 6, 0, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 5, 6, 6, 6, 6, 6, 6, 6, 6],
    [5, 5, 6, 5, 5, 6, 5, 5, 5, 5, 5, 5, 5, 2, 5, 5, 5, 5, 5, 5, 5, 5, 6, 6, 0, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6],
    [5, 2, 6, 5, 5, 6, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 6, 6, 6, 0, 6, 5, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6],
    [1, 5, 6, 5, 5, 6, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 6, 6, 6, 6, 0, 6, 6, 5, 5, 6, 6, 6, 6, 6, 6, 5, 6, 6, 6, 6, 6, 6, 6],
    [5, 2, 6, 5, 5, 6, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 6, 6, 6, 5, 6, 0, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6],
    [5, 5, 6, 5, 5, 6, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 2, 5, 5, 6, 6, 6, 6, 6, 6, 0, 6, 6, 6, 6, 5, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6],
    [1, 5, 6, 5, 5, 6, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 6, 6, 6, 6, 5, 6, 6, 0, 5, 6, 6, 6, 6, 6, 6, 5, 6, 6, 6, 6, 6, 6, 6],
    [1, 5, 6, 5, 5, 6, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 6, 6, 6, 6, 5, 6, 6, 5, 0, 6, 6, 6, 6, 6, 6, 5, 6, 6, 6, 6, 6, 6, 6],
    [5, 5, 6, 5, 5, 6, 3, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 6, 6, 6, 6, 6, 6, 6, 6, 6, 0, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6],
    [5, 5, 6, 5, 5, 6, 5, 5, 5, 5, 5, 2, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 0, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6],
    [5, 5, 6, 5, 5, 6, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 2, 5, 5, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 0, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6],
    [5, 5, 6, 5, 5, 6, 5, 5, 5, 5, 5, 2, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 0, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6],
    [5, 5, 6, 5, 5, 6, 5, 5, 3, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 0, 6, 6, 6, 6, 6, 6, 6, 6, 6],
    [5, 5, 6, 5, 2, 6, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 6, 5, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 0, 6, 6, 6, 6, 6, 6, 6, 6],
    [1, 5, 6, 5, 5, 6, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 6, 6, 6, 6, 5, 6, 6, 5, 5, 6, 6, 6, 6, 6, 6, 0, 6, 6, 6, 6, 6, 6, 6],
    [5, 5, 6, 5, 5, 6, 5, 5, 5, 2, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 0, 6, 6, 6, 6, 6, 6],
    [5, 5, 6, 5, 5, 6, 3, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 0, 6, 6, 6, 6, 6],
    [2, 5, 6, 5, 5, 6, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 0, 6, 6, 6, 6],
    [5, 5, 6, 2, 5, 6, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 0, 6, 6, 6],
    [5, 5, 6, 5, 5, 6, 5, 5, 5, 2, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 0, 6, 6],
    [5, 5, 6, 5, 5, 6, 5, 5, 5, 5, 2, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 0, 6]
  ];

  var indexFrom = getIndex($From);

  if (indexFrom < 44) {
    return 'Z' + zones[indexFrom][getIndex($To)];
  }

  return 'Z0';
};

var getdeliveryPeriod = function (fromCity, toCity, service) {
  var deliveryPeriod = '';

  if (service == 'E') {
    switch (getZone(fromCity, toCity)) {
      case 'Z1':
        deliveryPeriod = '1-3';
        break;
      case 'Z2':
        deliveryPeriod = '2-3';
        break;
      case 'Z3':
        deliveryPeriod = '2-3';
        break;
      case 'Z4':
        deliveryPeriod = '3-5';
        break;
      case 'Z5':
        deliveryPeriod = '3-6';
        break;
      case 'Z6':
        deliveryPeriod = '4-7';
        break;
    }
  }
  else if (service == 'T') {
    switch (getZone(fromCity, toCity)) {
      case 'Z1':
        deliveryPeriod = '6-8';
        break;
      case 'Z2':
        deliveryPeriod = '8-12';
        break;
      case 'Z3':
        deliveryPeriod = '8-12';
        break;
      case 'Z4':
        deliveryPeriod = '10-14';
        break;
      case 'Z5':
        deliveryPeriod = '10-17';
        break;
      case 'Z6':
        deliveryPeriod = '10-17';
        break
    }
  }

  return deliveryPeriod;
};

var getCityName = function (city) {
  var result = city.LocalityName;
  if (city.Region) {
    result += (', ' + city.Region);
  }
  return result;
};

var getCitiesByCountry = function (country, callback) {
  var deliveryData = deliveryHelper.get(delivery);
  var opts = Object.assign({}, deliveryData.apiUrl);
  async.retry(config.retryOpts, function (callback) {
    opts.form = {
      Path: 'catalog',
      Controller: 'getCitiesByCountry',
      CountryLocalCode: country.id || '0001'
    };
    request(opts, callback)
  }, function (err, r, b) {
    var result = {
      success: false
    };
    if (err) {
      result.message = commonHelper.getCityJsonError(err);
      return callback(null, result);
    }
    var json = null;
    try {
      json = JSON.parse(b);
    } catch (e) {
      result.message = commonHelper.getCityJsonError(e);
    }
    if (!json) {
      return callback(null, result);
    }
    result.success = true;
    result.cities = json || [];
    callback(null, result);
  });
};

var findKzCity = function (city, array) {
  var trim = commonHelper.getCity(city);
  var founds = commonHelper.findInArray(array, trim, 'LocalityName', true);
  var foundsWithRegion = [];
  if (founds.length > 1) {
    var region = commonHelper.getRegionName(city);
    if (region) {
      foundsWithRegion = commonHelper.findInArray(founds, region, 'Region');
    }
  }
  return foundsWithRegion.length ? foundsWithRegion : founds;
};

var getCalcResult = function (item, opts, callback) {
    setTimeout(function () {
      async.retry(config.retryOpts, function (callback) {
        opts.form = item.req;
        opts.followAllRedirects = true;
        request(opts, callback)
      }, function (err, r, b) {
        var result = {
          success: false
        };
        if (err) {
          result.error = commonHelper.getResultJsonError(err);
          return callback(null, result);
        }
        var json = null;
        try {
          json = JSON.parse(b);
        } catch (e) {
          result.error = commonHelper.getResultJsonError(e);
        }
        if (!json) {
          return callback(null, result);
        }
        result.tariffs = [{
          service: item.service.name,
          cost: json.AmountPlusFactors,
          deliveryTime: getdeliveryPeriod(item.req.FromLocalCode, item.req.ToLocalCode, item.service.code)
        }];
        result.success = true;
        return callback(null, result);
      });
    }, commonHelper.randomInteger(500, 1000));
};

module.exports = function (req, cities, callback) {
  var deliveryData = deliveryHelper.get(delivery);
  var requests = [];
  var timestamp = callback ? new Date().getTime*2 : commonHelper.getReqStored(req, delivery);
  cities.forEach(function (item) {
    item.countryFrom = item.countryFrom || 'Россия';
    item.countryTo = item.countryTo || 'Россия';
    if (item.countryFrom.toLowerCase() === 'казахстан') {
      item.fromKz = true;
    }
    if (item.countryTo.toLowerCase() === 'казахстан') {
      item.toKz = true;
    }
  });
  async.auto({
    getCountries: function (callback) {
      var opts = _.extend({}, deliveryData.countriesUrl);
      async.retry(config.retryOpts, function (callback) {
        request(opts, callback)
      }, function (err, r, b) {
        var countries = [];
        if (err) {
          return callback(null, countries);
        }
        var $ = cheerio.load(b);
        var items = $('#toCountries').find('option');
        items.each(function (index, item) {
          countries.push({id: $(item).attr('value'), name: $(item).text(), result: {}});
        });
        callback(null, countries);
      });
    },
    getKzCities: function (callback) {
      getCitiesByCountry({}, function (err, result) {
        if (!result.success) {
          return callback(new Error(result.message));
        }
        callback(null, result.cities);
      });
    },
    getCitiesByCountry: ['getCountries', function (results, callback) {
      var countryObj = _.indexBy(results.getCountries, 'name');
      var countryRequests = {};
      cities.forEach(function (city) {
        if (typeof countryRequests[city.countryFrom.toUpperCase()] === 'undefined' && countryObj[city.countryFrom.toUpperCase()]) {
          countryRequests[city.countryFrom.toUpperCase()] = countryObj[city.countryFrom.toUpperCase()];
        }
        if (typeof countryRequests[city.countryTo.toUpperCase()] === 'undefined' && countryObj[city.countryTo.toUpperCase()]) {
          countryRequests[city.countryTo.toUpperCase()] = countryObj[city.countryTo.toUpperCase()];
        }
        if (typeof countryRequests["РОССИЯ"] === 'undefined' && countryObj["РОССИЯ"]) {
          countryRequests["РОССИЯ"] = countryObj["РОССИЯ"];
        }
      });
      async.mapSeries(Object.keys(countryRequests), function (countryKey, callback) {
        getCitiesByCountry(countryRequests[countryKey], function (err, result) {
          countryObj[countryKey].result = result;
          callback();
        });
      }, function () {
        callback(null, countryObj);
      });
    }],
    parseCities: ['getKzCities', 'getCitiesByCountry', function (results, callback) {
      var countryObj = results.getCitiesByCountry;
      for (var i=0; i<cities.length; i++) {
        var foundFromTotal = [];
        var foundToTotal = [];
        if (!cities[i].from || !cities[i].to) {
          cities[i].error = commonHelper.CITIESREQUIRED;
          requests = requests.concat(commonHelper.getResponseArray(req.body.weights, cities[i], delivery, cities[i].error));
          continue;
        }
        if (!cities[i].fromKz) {
          cities[i].error = commonHelper.CITYFROMKZ;
          requests = requests.concat(commonHelper.getResponseArray(req.body.weights, cities[i], delivery, cities[i].error));
          continue;
        } else {
          foundFromTotal = findKzCity(cities[i].from, results.getKzCities);
        }
        if (!cities[i].toKz) {
          var country = countryObj[cities[i].countryTo.toUpperCase()];
          if (!country) {
            cities[i].error = commonHelper.COUNTRYNOTFOUND;
            requests = requests.concat(commonHelper.getResponseArray(req.body.weights, cities[i], delivery, cities[i].error));
            continue;
          } else if (!country.result.success){
            cities[i].error = country.result.message;
            requests = requests.concat(commonHelper.getResponseArray(req.body.weights, cities[i], delivery, cities[i].error));
            continue;
          } else {
            var trimTo = commonHelper.getCity(cities[i].to);
            foundToTotal = commonHelper.findInArray(country.result.cities, trimTo, 'LocalityName', true);
          }
        } else {
          foundToTotal = findKzCity(cities[i].to, results.getKzCities);
        }

        if (!foundFromTotal.length) {
          cities[i].error = commonHelper.CITYFROMNOTFOUND;
          requests = requests.concat(commonHelper.getResponseArray(req.body.weights, cities[i], delivery, cities[i].error));
          continue;
        }

        if (!foundToTotal.length) {
          cities[i].error = commonHelper.CITYTONOTFOUND;
          requests = requests.concat(commonHelper.getResponseArray(req.body.weights, cities[i], delivery, cities[i].error));
          continue;
        }

        var tempRequests = [];
        foundFromTotal.forEach(function (fromCity) {
          foundToTotal.forEach(function (toCity) {
            var service = getService(cities[i]);
            tempRequests.push({
              city: {
                initialCityFrom: cities[i].from,
                initialCityTo: cities[i].to,
                from: getCityName(fromCity),
                to: getCityName(toCity),
                countryFrom: cities[i].countryFrom,
                countryTo: cities[i].countryTo
              },
              req: getReq(fromCity, toCity, service.code),
              service: service,
              delivery: delivery,
              tariffs: []
            });
          });
        });

        tempRequests.forEach(function (item) {
          req.body.weights.forEach(function (weight) {
            var obj = commonHelper.deepClone(item);
            obj.weight = weight;
            obj.req['Weight'] = weight;
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
        var opts = _.extend({}, deliveryData.apiUrl);
        async.series([
          function (cb) {
            getCalcResult(item, opts, cb);
          },
          function (cb) {
            if (item.service.code === 'E') {
              item.req.ServiceLocalCode = 'T';
              item.service = {code: 'T', name: 'Не срочные отправления по РК'};
              getCalcResult(item, opts, cb);
            } else {
              cb(null, {});
            }
          }
        ], function (err, results) {
          if (results[0].success) {
            item.tariffs = item.tariffs.concat(results[0].tariffs);
          }
          if (results[1].success) {
            item.tariffs = item.tariffs.concat(results[1].tariffs);
          }
          if (!item.tariffs.length) {
            item.error = results[0].error || results[1].error || commonHelper.getNoResultError();
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