var responseHelper = require('../helpers/response');
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
  req.body.deliveries.forEach(function (item) {
    switch (item) {
      case 'emspost':
        req.session.delivery.emspost = {complete: false, results: []};
        global.emspost = new Date().getTime();
        emspost(req, res);
        break;
      case 'majorexpress':
        req.session.delivery.majorexpress = {complete: false, results: []};
        global.majorexpress = new Date().getTime();
        majorexpress(req, res);
        break;
      case 'spsr':
        req.session.delivery.spsr = {complete: false, results: []};
        global.spsr = new Date().getTime();
        spsr(req, res);
        break;
      case 'dpd':
        req.session.delivery.dpd = {complete: false, results: []};
        global.dpd = new Date().getTime();
        dpd(req, res);
        break;
    }
  });
  return res.json(responseHelper.success());
};