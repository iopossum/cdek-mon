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
    try {
      require('./' + item)(req, cities);
    } catch (e) {}
  }
  return res.json(responseHelper.success());
};