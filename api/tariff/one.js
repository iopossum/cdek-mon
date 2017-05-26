var responseHelper = require('../helpers/response');
var commonHelper = require('../helpers/common');
var config = require('../../conf');
var _ = require('underscore');
var async = require('async');

var emspost = require('./emspost');
var majorexpress = require('./majorexpress');
var spsr = require('./spsr');
var dpd = require('./dpd');

module.exports = function (req, res) {
  if (!req.body.requests) {
    return responseHelper.createResponse(res, new Error("Requests is required"));
  }
  if (!req.body.requests.length) {
    return responseHelper.createResponse(res, new Error("Requests is required"));
  }
  if (!req.body.delivery) {
    return responseHelper.createResponse(res, new Error("Delivery is required"));
  }
  var array = [];
  var delivery = req.body.delivery;
  async.each(req.body.requests, function (item, callback) {
    var response = function (err, results) {
      if (results) {
        array = array.concat(results);
      }
      callback(err);
    };
    var cities = [item.city];
    var req = {
      body: {
        delivery: delivery,
        weights: [item.weight]
      }
    };
    switch (req.body.delivery) {
      case 'emspost':
        emspost(req, cities, response);
        break;
      case 'majorexpress':
        majorexpress(req, cities, response);
        break;
      case 'spsr':
        spsr(req, cities, response);
        break;
      case 'dpd':
        dpd(req, cities, response);
        break;
      case 'dimex':
        require('./dimex')(req, cities, response);
        break;
      case 'flippost':
        require('./flippost')(req, cities, response);
        break;
      case 'ponyexpress':
        require('./ponyexpress')(req, cities, response);
        break;
      case 'cse':
        require('./cse')(req, cities, response);
        break;
      case 'garantpost':
        require('./garantpost')(req, cities, response);
        break;
      case 'cityexpress':
        require('./cityexpress')(req, cities, response);
        break;
      case 'iml':
        require('./iml')(req, cities, response);
        break;
      case 'dellin':
        require('./dellin')(req, cities, response);
        break;
      case 'pecom':
        require('./pecom')(req, cities, response);
        break;
      case 'vozovoz':
        require('./vozovoz')(req, cities, response);
        break;
      case 'kit':
        require('./kit')(req, cities, response);
        break;
      case 'rateksib':
        require('./rateksib')(req, cities, response);
        break;
      case 'expressauto':
        require('./expressauto')(req, cities, response);
        break;
      case 'dhl':
        require('./dhl')(req, cities, response);
        break;
      case 'tnt':
        require('./tnt')(req, cities, response);
        break;
      case 'jde':
        require('./jde')(req, cities, response);
        break;
      case 'fedex':
        require('./fedex')(req, cities, response);
        break;
      case 'ups':
        require('./ups')(req, cities, response);
        break;
      case 'baikalsr':
        require('./baikalsr')(req, cities, response);
        break;
      default:
        response(new Error("Delivery is not found"));
    }
  }, function (err) {
    if (err) {
      return responseHelper.createResponse(res, err, 500);
    }
    return res.json(array);
  });
};