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
  for (var i=0; i<req.body.deliveries.length; i++) {
    var item = req.body.deliveries[i];
    var cities = commonHelper.cloneArray(req.body.cities);
    switch (item) {
      case 'emspost':
        req.session.delivery.emspost = {complete: false, results: []};
        global.emspost = new Date().getTime();
        emspost(req, cities);
        break;
      case 'majorexpress':
        req.session.delivery.majorexpress = {complete: false, results: []};
        global.majorexpress = new Date().getTime();
        majorexpress(req, cities);
        break;
      case 'spsr':
        req.session.delivery.spsr = {complete: false, results: []};
        global.spsr = new Date().getTime();
        spsr(req, cities);
        break;
      case 'dpd':
        req.session.delivery.dpd = {complete: false, results: []};
        global.dpd = new Date().getTime();
        dpd(req, cities);
        break;
      case 'dimex':
        req.session.delivery.dimex = {complete: false, results: []};
        global.dimex = new Date().getTime();
        require('./dimex')(req, cities);
        break;
      case 'flippost':
        req.session.delivery.flippost = {complete: false, results: []};
        global.flippost = new Date().getTime();
        require('./flippost')(req, cities);
        break;
      case 'ponyexpress':
        req.session.delivery.ponyexpress = {complete: false, results: []};
        global.ponyexpress = new Date().getTime();
        require('./ponyexpress')(req, cities);
        break;
      case 'cse':
        req.session.delivery.cse = {complete: false, results: []};
        global.cse = new Date().getTime();
        require('./cse')(req, cities);
        break;
      case 'garantpost':
        req.session.delivery.garantpost = {complete: false, results: []};
        global.garantpost = new Date().getTime();
        require('./garantpost')(req, cities);
        break;
      case 'iml':
        req.session.delivery.iml = {complete: false, results: []};
        global.iml = new Date().getTime();
        require('./iml')(req, cities);
        break;
    }
  }
  return res.json(responseHelper.success());
};