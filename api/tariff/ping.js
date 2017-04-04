var responseHelper = require('../helpers/response');
var config = require('../../conf');
var _ = require('underscore');

var emspost = require('./emspost');
var majorexpress = require('./majorexpress');

var ping = function (delivery, req, res) {
  if (req.session.delivery[delivery] && req.session.delivery[delivery].complete) {
    return res.json({complete: true, results: req.session.delivery[delivery].results});
  } else {
    return res.json({complete: false, results: []});
  }
};

module.exports = function (req, res) {
  /*switch (req.query.delivery) {
    case 'emspost':
      return ping('emspost', req, res);
      break;
    case 'majorexpress':
      return ping('majorexpress', req, res);
      break;
    case 'spsr':
      return ping('spsr', req, res);
      break;
    default:
      return responseHelper.createResponse(res, new Error("Delivery is required"));
  }*/
  return res.json({deliveries: req.session.delivery});
};