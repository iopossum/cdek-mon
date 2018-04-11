var request = require('request');
var Nightmare = require('nightmare');
var realMouse = require('nightmare-real-mouse');
var _ = require('underscore');
var commonSafe = require('./common-safe');
var NodeTtl = require( "node-ttl" );
var ttl = new NodeTtl({ttl: 60*60*24});
_.extend(exports, commonSafe);

// add the plugin
realMouse(Nightmare);
request.defaults({
  timeout : 5000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/65.0.3325.181 Safari/537.36'
  },
  maxRedirects:20
});

exports.request = request;

exports.getNightmare = function () {
  var nightmare = new Nightmare({
    executionTimeout: 30000,
    loadTimeout: 30000,
    gotoTimeout: 30000,
    waitTimeout: 30000,
    // show: true,
    // openDevTools: true
  });
  nightmare.viewport(1000, 1000)
    .useragent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/65.0.3325.181 Safari/537.36");
  return nightmare;
};

exports.saveResults = function (req, err, opts) {
  if (opts.callback) {
    return opts.callback(err, opts.items);
  }
  if (exports.getReqStored(req, opts.delivery) > opts.timestamp) {
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

exports.saveStore = function (key, value) {
  ttl.push(key, value);
};

exports.getStored = function (key) {
  return ttl.get(key);
};

exports.saveReqStore = function (req, delivery, value) {
  exports.saveStore(delivery + req.session.id, value);
};

exports.getReqStored = function (req, delivery) {
  if (!req.session) {
    return 0;
  }
  return exports.getStored(delivery + req.session.id);
};
