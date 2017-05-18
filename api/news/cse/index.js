var responseHelper = require('../../helpers/response');
var deliveryHelper = require('../../helpers/delivery');
var commonHelper = require('../../helpers/common');
var async = require('async');
var request = commonHelper.request;
var cheerio = require('cheerio');
var config = require('../../../conf');
var _ = require('underscore');
var moment = require('moment');
var iconv = require("iconv-lite");
var logger = require('../../helpers/logger');

module.exports = function (req, res) {
  var deliveryData = deliveryHelper.get(req.body.delivery);
  var warning = null;

  async.auto({
    getNews: [function (callback) {

        var opts = _.extend({}, deliveryData.newsUrl);
        opts.encoding = 'binary';
        async.retry(config.retryOpts, function (callback) {
          request(opts, callback)
        }, function (err, r, b) {
          if (err) {
            return callback(err);
          }
          b = iconv.encode(iconv.decode(new Buffer (b, 'binary'), 'win1251'), 'utf8');
          var $ = cheerio.load(b);
          var news = [];
          var items = $('.news-list-item');
          items.each(function (index, item) {
            var date = $(item).find('.news-list-date');
            if (date) {
              if (moment(date, 'DD.MM.YYYY').isAfter(moment(req.body.date))) {
                news.push({
                  title: $(item).find('.news-list-title').text().trim(),
                  date: moment(date, 'DD.MM.YYYY').locale('ru').format('DD MMMM YYYY'),
                  description: $(item).find('.news-list-caption').text().trim(),
                  delivery: req.body.delivery
                })
              }
            } else {
              warning = commonHelper.getNewsWrongResponse(req.body.delivery);
            }
          });
          return callback(null, news);
        });
    }]
  }, function (err, results) {

    if (err) {
      err.message = commonHelper.getNewsError(req.body.delivery, err);
      return responseHelper.createResponse(res, err, 500);
    }
    logger.newsInfoLog(req.body.delivery, results.getNews, 'news');
    var items = commonHelper.sortNews(results.getNews);
    res.json(commonHelper.newsResponse(items, warning));
  });
};