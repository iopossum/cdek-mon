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
        var items = $('.about-post');
        items.each(function (index, item) {
          var date = $(item).find('span.title');
          if (date && moment(date, 'DD/MM/YYYY').isAfter(moment(req.body.date))) {
            news.push({
              title: $(item).find('h3.title').text().trim(),
              date: moment(date, 'DD/MM/YYYY').locale('ru').format('DD MMMM YYYY'),
              link: deliveryData.baseUrl + $(item).find('a').attr('href').trim(),
              description: $(item).find('p').text().trim(),
              delivery: req.body.delivery
            })
          }
        });
        return callback(null, news);
      });
    }]
  }, function (err, results) {

    if (err) {
      return responseHelper.createResponse(res, err, 500);
    }
    logger.newsInfoLog(req.body.delivery, results.getNews, 'news');
    var items = _.sortBy(results.getNews, function (item) {
      return item.date;
    });
    res.json(items);
  });
};