var responseHelper = require('../helpers/response');
var config = require('../../conf');
var _ = require('underscore');

var emspost = require('./emspost');
var majorexpress = require('./majorexpress');
var spsr = require('./spsr');

module.exports = function (req, res) {
  if (!req.body.delivery) {
    return responseHelper.createResponse(res, new Error("Delivery is required"));
  }
  switch (req.body.delivery) {
    case 'emspost':
      return emspost(req, res);
      break;
    case 'majorexpress':
      return majorexpress(req, res);
      break;
    case 'spsr':
      return spsr(req, res);
      break;
    default:
      return res.json([]);
  }
};