var request = require('request');
var Nightmare = require('nightmare');
var realMouse = require('nightmare-real-mouse');
var _ = require('underscore');

// add the plugin
realMouse(Nightmare);
request.defaults({ timeout : 5000 });

exports.randomInteger = function (min, max) {
  var rand = min - 0.5 + Math.random() * (max - min + 1);
  rand = Math.round(rand);
  return rand;
};

exports.getNightmare = function () {
  var nightmare = new Nightmare({
    executionTimeout: 30000,
    loadTimeout: 30000,
    gotoTimeout: 30000,
    waitTimeout: 30000
  });
  nightmare.viewport(1000, 1000)
    .useragent("Mozilla/5.0 (Windows NT 6.3; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/38.0.2125.111 Safari/537.36");
  return nightmare;
};

exports.getCity = function (city) {
  return city.split(',')[0].trim();
};

exports.getRegionName = function (city) {
  var region = null;
  var splits = city.split(',');
  if (splits.length === 2) {
    region = splits[1].split(' ')[1] || splits[1].split(' ')[0];
  } else if (splits.length > 3) {
    region = splits[2].split(' ')[1] || splits[2].split(' ')[0];
  }
  return region;
};

exports.getResponseArray = function (weights, cityItem, delivery, error) {
  return weights.map(function (weight) {
    return exports.getResponseObject(cityItem, delivery, weight, error);
  });
};

exports.getResponseObject = function (cityItem, delivery, weight, error) {
  return {
    city: _.clone(cityItem),
    delivery: delivery,
    weight: weight,
    tariffs: [],
    error: error
  }
};

exports.request = request;