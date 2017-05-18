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
    case 'flippost':
      return res.json({items: []}); //нет раздела с новостями
      break;
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
    case 'cityexpress':
      return require('./cityexpress')(req, res);
      break;
    case 'dellin':
      return require('./dellin')(req, res);
      break;
    case 'pecom':
      return require('./pecom')(req, res);
      break;
    case 'vozovoz':
      return require('./vozovoz')(req, res);
      break;
    case 'kit':
      return require('./kit')(req, res);
      break;
    case 'rateksib':
      return require('./rateksib')(req, res);
      break;
    case 'expressauto':
      return require('./expressauto')(req, res);
      break;
    case 'dhl':
      return require('./dhl')(req, res);
      break;
    case 'tnt':
      return require('./tnt')(req, res);
      break;
    case 'jde':
      return require('./jde')(req, res);
      break;
    case 'fedex':
      return require('./fedex')(req, res);
      break;
    case 'ups':
      return require('./ups')(req, res);
      break;
    case 'baikalsr':
      return require('./baikalsr')(req, res);
      break;
    default:
      return res.json({items: []});
  }
};