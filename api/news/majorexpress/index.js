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
  var warning = null;
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
          opts.uri = opts.uri + '?year=' + item;
          async.retry(config.retryOpts, function (callback) {
            request(opts, callback)
          }, function (err, r, b) {
            if (err) {
              warning = commonHelper.getNewsPartError(req.body.delivery);
              return callback(null, []);
            }
            var $ = cheerio.load(b);
            var news = [];
            var tables = $('#ContentPlaceHolder1_gvNews').find('table');
            tables.each(function (index, item) {
              var date = $(item).find('.newsDate').text().trim();
              if (date) {
                if (moment(date, 'DD MMMM YYYY', 'ru').isAfter(moment(req.body.date))) {
                  news.push({
                    title: $(item).find('.newsTitle').text().trim(),
                    date: date,
                    link: opts.uri,
                    description: $(item).find('.newsText').text().trim(),
                    delivery: req.body.delivery
                  })
                }
              } else {
                warning = commonHelper.getNewsWrongResponse(req.body.delivery);
              }
            });
            return callback(null, news);
          });
        }, commonHelper.randomInteger(500, 1000));
      }, callback);
    }]
  }, function (err, results) {

    if (err) {
      err.message = commonHelper.getNewsError(req.body.delivery, err);
      return responseHelper.createResponse(res, err, 500);
    }
    logger.newsInfoLog(req.body.delivery, results.getNews, 'news');
    var items = [];
    results.getNews.forEach(function (item) {
      if (item) {
        items = items.concat(item);
      }
    });
    items = commonHelper.sortNews(items);
    res.json(commonHelper.newsResponse(items, warning));
  });
};