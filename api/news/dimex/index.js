var responseHelper = require('../../helpers/response');
var deliveryHelper = require('../../helpers/delivery');
var commonHelper = require('../../helpers/common');
var async = require('async');
var request = commonHelper.request;
var cheerio = require('cheerio');
var config = require('../../../conf');
var _ = require('underscore');
var moment = require('moment');
var logger = require('../../helpers/logger');


module.exports = function (req, res) {
  var deliveryData = deliveryHelper.get(req.body.delivery);
  var requests = [];
  var from = moment(req.body.date);
  for (var i=from.year(); i<=moment().year(); i++) {
    requests.push(i);
  }
  async.auto({
    getNews: [function (callback) {
      async.mapLimit(requests, 3, function (item, callback) {
        setTimeout(function () {
          var opts = _.extend({}, deliveryData.newsUrl);
          if (item !== moment().year()) {
            opts.uri = opts.uri + '?year=' + item;
          }
          async.retry(config.retryOpts, function (callback) {
            request(opts, callback)
          }, function (err, r, b) {
            if (err) {
              return callback(null, null);
            }
            var $ = cheerio.load(b);
            var news = [];
            var items = $('.primary-column').find('li');
            items.each(function (index, item) {
              var splits = $(item).text().split('\n');
              if (splits[1]) {
                var date = splits[0].replace(/\s/g, "");
                if (date && moment(date, 'DD/MM/YYYY').isAfter(moment(req.body.date))) {
                  news.push({
                    title: splits[1].trim(),
                    date: moment(date, 'DD/MM/YYYY').locale('ru').format('DD MMMM YYYY'),
                    link: deliveryData.baseUrl + $(item).find('a').attr('href'),
                    delivery: req.body.delivery
                  })
                }
              }
            });
            return callback(null, news);
          });
        }, commonHelper.randomInteger(500, 1000));
      }, callback);
    }]
  }, function (err, results) {

    if (err) {
      return responseHelper.createResponse(res, err, 500);
    }
    logger.newsInfoLog(req.body.delivery, results.getNews, 'news');
    var items = [];
    results.getNews.forEach(function (item) {
      if (item) {
        items = items.concat(item);
      }
    });
    items = _.sortBy(items, function (item) {
      return item.date;
    });
    res.json(items);
  });
};