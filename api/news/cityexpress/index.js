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
      async.retry(config.retryOpts, function (callback) {
        request(opts, callback)
      }, function (err, r, b) {
        if (err) {
          return callback(err);
        }
        var $ = cheerio.load(b);
        var news = [];
        var items = $('.post.news_full_list.news');
        items.each(function (index, item) {
          var date = $(item).find('.date').text().trim();
          if (date) {
            if (moment(date, 'DD MMMM YYYY', 'ru').isAfter(moment(req.body.date))) {
              news.push({
                title: $(item).find('.titl').text().trim(),
                date: moment(date, 'DD MMMM YYYY', 'ru').locale('ru').format('DD MMMM YYYY'),
                link: deliveryData.baseUrl + $(item).find('.more').find('a').attr('href').trim(),
                description: $(item).find('.anons').text().trim(),
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