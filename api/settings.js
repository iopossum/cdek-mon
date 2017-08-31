var responseHelper = require('./helpers/response');
var deliveryHelper = require('./helpers/delivery');
var config = require('../conf');
var _ = require('underscore');

module.exports = function (req, res) {
  return res.json({
    deliveries: deliveryHelper.list(),
    countries: deliveryHelper.countries()
  });
};