var responseHelper = require('../helpers/response');
var commonHelper = require('../helpers/common');
var config = require('../../conf');
var _ = require('underscore');
var async = require('async');
const pool = require('../../lib/db/postgre');

var getCity = function (city, country, callback) {
  var splits = city.split(',');
  var query = "SELECT * FROM public.address " +
              "LEFT JOIN postal_code ON (postal_code.city_id = address.id) " +
              "WHERE city_translation_id ILIKE '" + splits[0] + "' ";
  var area = null;
  var region = null;
  if (splits.length === 2) {
    var temp = splits[1].replace(/^\s*/, "");
    area = /республика/gi.test(temp) ? temp : temp.split(' ')[0];
  } else if (splits.length > 2) {
    var temp1 = splits[1].replace(/^\s*/, "");
    var temp2 = splits[2].replace(/^\s*/, "");
    region = temp1.split(' ')[0];
    area = /республика/gi.test(temp2) ? temp2 : temp2.split(' ')[0];
  }
  if (area) {
    query += "AND json_extract_path_text(translations :: JSON, '1') ILIKE '" + area + "' ";
  }
  if (region) {
    query += "AND json_extract_path_text(translations :: JSON, '3') ILIKE '" + region + "' ";
  }
  query += "LIMIT 100";

  pool.query(query, function(err, res) {
    if (err) {
      return callback(null, []);
    }
    callback(null, res.rows);
  });
};

module.exports = function (req, res) {
  if (!req.body.cities) {
    return res.json([]);
  }
  async.mapLimit(req.body.cities, 20, function (city, callback) {
    if (!city.from || !city.to) {
      return async.nextTick(function () {
        callback(null, city);
      });
    }
    async.parallel([
      function (callback) {
        if (city.countryFrom) {
          return callback(null, []);
        }
        getCity(city.from, city.countryFrom, callback);
      },
      function (callback) {
        if (city.countryTo) {
          return callback(null, []);
        }
        getCity(city.to, city.countryTo, callback);
      }
    ], function (err, foundCities) { //ошибки быть не может
      if (foundCities[0].length && foundCities[0][0].postal_code) {
        city.postcodeFrom = foundCities[0][0].postal_code;
      }
      if (foundCities[1].length && foundCities[1][0].postal_code) {
        city.postcodeTo = foundCities[1][0].postal_code;
      }
      callback(null, city);
    });
  }, function (err, results) {
    res.json(results);
  });
};