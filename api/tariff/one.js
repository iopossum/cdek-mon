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
    try {
      require('./' + delivery)(req, cities, response);
    } catch (e) {
      response(new Error("Delivery is not found"));
    }
  }, function (err) {
    if (err) {
      return responseHelper.createResponse(res, err, 500);
    }
    return res.json(array);
  });
};