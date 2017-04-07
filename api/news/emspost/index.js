var responseHelper = require('../../helpers/response');
var deliveryHelper = require('../../helpers/delivery');
var commonHelper = require('../../helpers/common');
var async = require('async');
var request = commonHelper.request;
var cheerio = require('cheerio');
var config = require('../../../conf');
var moment = require('moment');
var _ = require('underscore');
var logger = require('../../helpers/logger');


module.exports = function (req, res) {
  var deliveryData = deliveryHelper.get(req.body.delivery);
  var requests = [];
  async.auto({
    getLink: function (callback) {
      var opts = deliveryData.newsUrl;
      async.retry(config.retryOpts, function (callback) {
        request(opts, callback)
      }, callback);
    },
    parseLink: ['getLink', function (results, callback) {
      var $ = cheerio.load(results.getLink[1]);
      var link = $('#rss_link');
      if (!link.length) {
        return callback(new Error("Структура сайта изменилась"));
      }
      var opts = deliveryData.rssUrl;
      opts.uri = opts.uri + link.attr('href');
      async.retry(config.retryOpts, function (callback) {
        request(opts, callback)
      }, callback);
    }],
    getNews: ['parseLink', function (results, callback) {
      var $ = cheerio.load(results.parseLink[1], {
        xmlMode: true
      });
      var news = [];
      $('channel').find('item').each(function (index, item) {
        var date = $(item).find('pubDate').text().trim();
        if (date && moment(date).isAfter(moment(req.body.date))) {
          news.push(
            {
              title: $(item).find('title').text().trim(),
              date: moment(date).locale("ru").format('DD MMMM YYYY'),
              link: $(item).find('link').text().trim(),
              description: $(item).find('description').text().trim(),
              delivery: req.body.delivery
            }
          );
        }
      });
      callback(null, news);
    }]
  }, function (err, results) {
    if (err) {
      return responseHelper.createResponse(res, err, 500);
    }
    logger.newsInfoLog(req.body.delivery, results.getNews, 'news');
    res.json(results.getNews);
  });
};