var responseHelper = require('../helpers/response');
var config = require('../../conf');
var _ = require('underscore');

var emspost = require('./emspost');
var majorexpress = require('./majorexpress');

module.exports = function (req, res) {
  if (!req.body.deliveries) {
    req.body.cities = [
      {from: 'Новосибирск', to: 'Москва'},
      {from: 'Пушкино, Московская обл.', to: 'Москва'},
      {from: 'Химки', to: 'Новосибирск'},
      {from: '', to: '', countryFrom: '', countryTo: 'Хорватия'}
    ];
    req.body.weights = [1, 2, 3];
    req.body.deliveries = ['majorexpress'];
  }
  if (!req.body.cities) {
    req.body.cities = [
      {from: 'Новосибирск', to: 'Москва'},
      {from: 'Пушкино, Московская обл.', to: 'Москва'},
      {from: 'Химки', to: 'Новосибирск'},
      {from: '', to: '', countryFrom: '', countryTo: 'Хорватия'},
      {from: 'Москва', to: 'Абай', countryFrom: '', countryTo: 'Казахстан'}
    ];
  }
  if (!req.body.weights) {
    req.body.weights = [1, 2, 3];
  }
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
        req.session.user.emspost = {complete: false, results: []};
        global.emspost = new Date().getTime();
        emspost(req, res);
        break;
      case 'majorexpress':
        req.session.user.majorexpress = {complete: false, results: []};
        global.majorexpress = new Date().getTime();
        majorexpress(req, res);
        break;
    }
  });
  return res.json(responseHelper.success());
};