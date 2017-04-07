var _ = require('underscore');

var targets = [
  {
    id: 'emspost',
    /*calcUrl: {method: 'POST', uri: 'http://www.emspost.ru/default.aspx/MakeCalculation'},*/ //old
    calcUrl: {method: 'POST', uri: 'http://www.emspost.ru/default.aspx/getConditions'},
    citiesUrl: {method: 'GET', uri: 'http://www.emspost.ru/ru/'},
    newsUrl: {method: 'GET', uri: 'http://www.emspost.ru/ru/'},
    rssUrl: {method: 'GET', uri: 'http://www.emspost.ru'}
  },
  {
    id: 'majorexpress',
    calcUrl: {method: 'POST', uri: 'https://major-express.ru/calculator.aspx'},
    citiesUrl: {method: 'POST', uri: 'https://major-express.ru/calculator.aspx'},
    newsUrl: {method: 'GET', uri: 'https://www.major-express.ru/News.aspx'}
  },
  /*{
    id: 'spsr',
    calcUrl: {method: 'POST', uri: 'http://www.spsr.ru/ru/system/ajax'},
    citiesUrl: {method: 'GET', uri: 'http://www.spsr.ru/ru/service/calculator?q=/spsr/cc_autocomplete/'},
    newsUrl: {method: 'GET', uri: 'http://www.spsr.ru/ru/news'},
    calcGetUrl: {method: 'GET', uri: 'http://www.spsr.ru/ru/service/calculator'}
  },*/
  {
    id: 'spsr',
    calcUrl: {method: 'GET', uri: 'http://www.spsr.ru/webapi/calculator?'},
    citiesUrl: {method: 'GET', uri: 'http://www.spsr.ru/webapi/autocomplete_city?city='},
    newsUrl: {method: 'GET', uri: 'http://www.spsr.ru/ru/news/collection/novosti-i-press-relizy'}
  },
  {
    id: 'dpd',
    calcUrl: {method: 'POST', uri: 'http://www.dpd.ru/ols/calc/calc.do2'},
    calcInternationalUrl: {method: 'POST', uri: 'http://www.dpd.ru/ols/calcint/offire.do2'},
    citiesUrl: {method: 'POST', uri: 'http://www.dpd.ru/ols/calc/cities.do2'},
    citiesInternationalUrl: {method: 'POST', uri: 'http://www.dpd.ru/ols/calcint/city_ru.do2'},
    countriesUrl: {method: 'GET', uri: 'http://www.dpd.ru/ols/calcint/show.do2'},
    newsUrl: {method: 'GET', uri: 'http://www.dpd.ru/dpd/o-dpd/informacionnyj-centr/novosti.do2'},
    baseUrl: 'http://www.dpd.ru'
  },
  {
    id: 'dimex',
    calcUrl: {method: 'GET', uri: 'http://rus.tech-dimex.ru/calculator/calcestnew?'},
    citiesUrl: {method: 'GET', uri: 'http://rus.tech-dimex.ru/calculator/autocompletecity?'},
    countriesUrl: {method: 'POST', uri: 'http://rus.tech-dimex.ru/calculator/getajaxForm'},
    newsUrl: {method: 'GET', uri: 'http://www.dimex.ws/novosti-kompanii/arhiv-novostey/'},
    baseUrl: 'http://www.dimex.ws'
  },
  {
    id: 'flippost',
    calcFlipUrl: {method: 'GET', uri: 'http://flippost.com/proxy.php?dbAct=getTarif&'},
    calcOtdoUrl: {method: 'GET', uri: 'http://otdo.ru/calc/delivery-russia/?'},
    calcOtdoIntUrl: {method: 'GET', uri: 'http://otdo.ru/calc/world/?'},
    citiesUrl: {method: 'GET', uri: 'http://flippost.com/proxy.php?dbAct=getCities&'},
    //newsUrl: {method: 'GET', uri: 'http://www.dimex.ws/novosti-kompanii/arhiv-novostey/'}
  },
  /*{id: 'dhl', name: 'DHL'},
  {id: 'ponyexpress', name: 'Ponyexpress'},
  {id: 'tnt', name: 'TNT'},
  {id: 'ups', name: 'UPS'},
  {id: 'cse', name: 'CSE'},
  {id: 'garantpost', name: 'Garantpost'},
  {id: 'cityexpress', name: 'Cityexpress'},
  {id: 'fedex', name: 'Fedex'},
  {id: 'dellin', name: 'Dellin'},
  {id: 'pecom', name: 'Pecom'},
  {id: 'vozovoz', name: 'Vozovoz'},
  {id: 'baikalsr', name: 'Baikalsr'},
  {id: 'kit', name: 'TK-kit'},
  {id: 'rateksib', name: 'Rateksib'},
  {id: 'expressauto', name: 'Expressauto'},
  {id: 'jde', name: 'Jde'},
  {id: 'ems', name: 'EMS'},
  {id: 'iml', name: 'Iml'}*/
];

var targetObj = _.indexBy(targets, 'id');

exports.list = function () {
  return targets;
};

exports.get = function (id) {
  return targetObj[id];
};