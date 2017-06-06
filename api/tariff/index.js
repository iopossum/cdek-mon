var responseHelper = require('../helpers/response');
var commonHelper = require('../helpers/common');
var config = require('../../conf');
var _ = require('underscore');

var emspost = require('./emspost');
var majorexpress = require('./majorexpress');
var spsr = require('./spsr');
var dpd = require('./dpd');

module.exports = function (req, res) {
  if (!req.body.cities) {
    return responseHelper.createResponse(res, new Error("Cities is required"));
  }
  if (!req.body.cities.length) {
    return responseHelper.createResponse(res, new Error("Cities is required"));
  }
  if (!req.body.weights) {
    return responseHelper.createResponse(res, new Error("Weights is required"));
  }
  if (!req.body.weights.length) {
    return responseHelper.createResponse(res, new Error("Weights is required"));
  }
  if (!req.body.deliveries) {
    return responseHelper.createResponse(res, new Error("Delivery is required"));
  }
  if (!req.body.deliveries.length) {
    return responseHelper.createResponse(res, new Error("Delivery is required"));
  }
  var targets = require('../helpers/delivery').list();
  var obj = {};
  targets.forEach(function (item) {
    obj[item.id] = {complete: false, results: []};
    commonHelper.saveReqStore(req, item.id, new Date().getTime());
  });
  req.session.delivery = obj;
  req.body.cities.forEach(function (item) {
    if (item.countryFrom && commonHelper.RUSSIA.indexOf(item.countryFrom.toLowerCase()) > -1) {
      item.countryFrom = '';
    }
    if (item.countryTo && commonHelper.RUSSIA.indexOf(item.countryTo.toLowerCase()) > -1) {
      item.countryTo = '';
    }
  });
  for (var i=0; i<req.body.deliveries.length; i++) {
    var item = req.body.deliveries[i];
    var cities = commonHelper.cloneArray(req.body.cities);
    switch (item) {
      case 'cdek':
        require('./cdek')(req, cities);
        break;
      case 'emspost':
        emspost(req, cities);
        break;
      case 'majorexpress':
        majorexpress(req, cities);
        break;
      case 'spsr':
        spsr(req, cities);
        break;
      case 'dpd':
        dpd(req, cities);
        break;
      case 'dimex':
        require('./dimex')(req, cities);
        break;
      case 'flippost':
        require('./flippost')(req, cities);
        break;
      case 'ponyexpress':
        require('./ponyexpress')(req, cities);
        break;
      case 'cse':
        require('./cse')(req, cities);
        break;
      case 'garantpost':
        require('./garantpost')(req, cities);
        break;
      case 'cityexpress':
        require('./cityexpress')(req, cities);
        break;
      case 'iml':
        require('./iml')(req, cities);
        break;
      case 'dellin':
        require('./dellin')(req, cities);
        break;
      case 'pecom':
        require('./pecom')(req, cities);
        break;
      case 'vozovoz':
        require('./vozovoz')(req, cities);
        break;
      case 'kit':
        require('./kit')(req, cities);
        break;
      case 'rateksib':
        require('./rateksib')(req, cities);
        break;
      case 'expressauto':
        require('./expressauto')(req, cities);
        break;
      case 'dhl':
        require('./dhl')(req, cities);
        break;
      case 'tnt':
        require('./tnt')(req, cities);
        break;
      case 'jde':
        require('./jde')(req, cities);
        break;
      case 'fedex':
        require('./fedex')(req, cities);
        break;
      case 'ups':
        require('./ups')(req, cities);
        break;
      case 'baikalsr':
        require('./baikalsr')(req, cities);
        break;
    }
  }
  return res.json(responseHelper.success());
};