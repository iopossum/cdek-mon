var request = require('request');
var Nightmare = require('nightmare');
var realMouse = require('nightmare-real-mouse');
var _ = require('underscore');
var commonSafe = require('./common-safe');
_.extend(exports, commonSafe);

// add the plugin
realMouse(Nightmare);
request.defaults({
  timeout : 5000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.81 Safari/537.36'
  }
});

exports.request = request;

exports.getNightmare = function () {
  var nightmare = new Nightmare({
    executionTimeout: 30000,
    loadTimeout: 30000,
    gotoTimeout: 30000,
    waitTimeout: 30000,
    //show: true,
    //openDevTools: true
  });
  nightmare.viewport(1000, 1000)
    .useragent("Mozilla/5.0 (Windows NT 6.3; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/38.0.2125.111 Safari/537.36");
  return nightmare;
};

exports.saveResults = function (req, err, opts) {
  if (global[opts.delivery] > opts.timestamp) {
    return false;
  }
  if (err) {
    if (err.abort) {
      return false;
    }
    req.session.delivery[opts.delivery].complete = true;
    req.session.delivery[opts.delivery].error = err.message || err.stack || err;
    var array = [];
    opts.cities.forEach(function (item) {
      array = array.concat(exports.getResponseArray(req.body.weights, item, opts.delivery, err.message || err.stack || err))
    });
    req.session.delivery[opts.delivery].results = array;
  } else {
    req.session.delivery[opts.delivery].complete = true;
    req.session.delivery[opts.delivery].results = opts.items;
  }
  req.session.save ? req.session.save(function () {}) : null;
};
