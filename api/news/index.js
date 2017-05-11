var responseHelper = require('../helpers/response');
var config = require('../../conf');
var _ = require('underscore');

var emspost = require('./emspost');
var majorexpress = require('./majorexpress');
var spsr = require('./spsr');
var dpd = require('./dpd');

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
    case 'dpd':
      return dpd(req, res);
      break;
    case 'dimex':
      return require('./dimex')(req, res);
      break;
    case 'ponyexpress':
      return require('./ponyexpress')(req, res);
      break;
    case 'cse':
      return require('./cse')(req, res);
      break;
    case 'garantpost':
      return require('./garantpost')(req, res);
      break;
    case 'iml':
      return require('./iml')(req, res);
      break;
    default:
      return res.json([]);
  }
};