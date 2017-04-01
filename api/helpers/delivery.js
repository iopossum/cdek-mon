var _ = require('underscore');

var targets = [
  {
    id: 'emspost',
    calcUrl: {method: 'POST', uri: 'http://www.emspost.ru/default.aspx/MakeCalculation'},
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
  {
    id: 'spsr',
    calcUrl: {method: 'POST', uri: 'http://www.spsr.ru/ru/system/ajax'},
    citiesUrl: {method: 'GET', uri: 'http://www.spsr.ru/ru/service/calculator?q=/spsr/cc_autocomplete/'},
    newsUrl: {method: 'GET', uri: 'http://www.spsr.ru/ru/news'}
  },
  /*{id: 'dpd', name: 'DPD'},
  {id: 'dhl', name: 'DHL'},
  {id: 'dimex', name: 'Dimex'},
  {id: 'flippost', name: 'Flippost'},
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



exports.get = function (id) {
  return targetObj[id];
};