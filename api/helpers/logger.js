var winston = require('winston');
var targets = require('./delivery').list();
var conf = require('../../conf');

var createLog = function (key) {
  var news = new winston.Logger({
    maxFiles: 5,
    maxsize: 30000,
    prettyPrint: true,
    transports: [
      new (winston.transports.File)({filename: conf.rootFolder + '/logs/news/' + key + '.log', level: 'info', json: true, name: key + '_info'}),
      new (winston.transports.File)({filename: conf.rootFolder + '/logs/news/' + key + '.log', level: 'error', json: true, name: key + '_error'})
    ]
  });
  var tariffs = new winston.Logger({
    maxFiles: 5,
    maxsize: 30000,
    prettyPrint: true,
    transports: [
      new (winston.transports.File)({filename: conf.rootFolder + '/logs/tariffs/' + key + '.log', level: 'info', json: false, name: key + '_info'}),
      new (winston.transports.File)({filename: conf.rootFolder + '/logs/tariffs/' + key + '.log', level: 'error', json: true, name: key + '_error'})
    ]
  });
  return {
    news: news,
    tariffs: tariffs
  };
};

var error = function () {
  var error = new winston.Logger({
    levels: {
      error: 3
    },
    maxFiles: 5,
    maxsize: 30000,
    prettyPrint: true,
    transports: [
      new (winston.transports.File)({ filename: conf.rootFolder + '/logs/error.log', level: 'error', json: true})
    ]
  });
  return error.error;
};

var exports = {
  error: error()
};

targets.forEach(function (item) {
  exports[item.id] = createLog(item.id);
});

exports.newsInfoLog = function (type, obj, msg) {
  msg = msg || '';
  exports[type].news.info(msg, obj);
};

exports.tariffsInfoLog = function (type, obj, msg) {
  exports[type].tariffs.info(msg, obj);
};

exports.newsErrorLog = function (type, obj, msg) {
  msg = msg || '';
  exports[type].news.error(msg, obj);
};

exports.tariffsErrorLog = function (type, obj, msg) {
  msg = msg || '';
  exports[type].tariffs.error(msg, obj);
};

module.exports = exports;