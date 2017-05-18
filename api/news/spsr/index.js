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

/*
  Old version
 */

/*module.exports = function (req, res) {
  var deliveryData = deliveryHelper.get(req.body.delivery);
  var news = [];
  var page = 0;
  var complete = false;
  async.until(
    function () { return complete; },
    function (callback) {
      setTimeout(function () {
        var opts = Object.assign({}, deliveryData.newsUrl);
        if (page > 0) {
          opts.uri += '?page=' + page;
        }
        async.retry(config.retryOpts, function (callback) {
          request(opts, callback)
        }, function (err, r, b) {
          page++;
          if (err && !news.length) {
            return callback(err);
          }
          var $ = cheerio.load(b);
          var count = 0;
          $('.news_wrap').find('.news_date').each(function (index, item) {
            var date = $(item).find('span').attr('content').trim();
            if (date && moment(date).isAfter(moment(req.body.date))) {
              var title = $('.news_wrap').find('.news_title')[index];
              var desc = $($('.news_wrap').find('.field-name-body')[index]);
              news.push(
                {
                  title: $(title).find('a').text().trim(),
                  date: moment(date).locale("ru").format('DD MMMM YYYY'),
                  link: 'http://www.spsr.ru' + $(title).find('a').attr('href').trim(),
                  description: desc.text() || '',
                  delivery: req.body.delivery
                }
              );
              count++;
            }
          });
          if (count !== $('.news_wrap').find('.news_date').length || !$('.news_wrap').find('.news_date').length) {
            complete = true;
          }
          callback(null);
        });
      }, commonHelper.randomInteger(500, 1000));
    },
    function (err, n) {
      if (err) {
        return responseHelper.createResponse(res, err, 500);
      }
      res.json(news);
    }
  );
};*/

module.exports = function (req, res) {
  var deliveryData = deliveryHelper.get(req.body.delivery);
  var warning = null;
  var news = [];
  var page = 0;
  var complete = false;
  async.until(
    function () { return complete; },
    function (callback) {
      setTimeout(function () {
        var opts = Object.assign({}, deliveryData.newsUrl);
        if (page > 0) {
          opts.uri += '?page=' + page;
        }
        async.retry(config.retryOpts, function (callback) {
          request(opts, callback)
        }, function (err, r, b) {
          page++;
          if (err) {
            complete = true;
            warning = commonHelper.getNewsPartError(req.body.delivery);
            return callback(null, []);
          }
          var $ = cheerio.load(b);
          var count = 0;
          var wasOld = false;
          $('.sonata-blog-post-container').each(function (index, item) {
            var date = $(item).find('.sonata-blog-post-information').text().trim();
            var momentDate = moment(date, "DD MMMM, HH:mm", 'ru');
            if (date) {
              if (momentDate.isAfter(moment(req.body.date)) && !wasOld) {
                var title = $(item).find('.sonata-blog-post-title');
                var desc = $(item).find('.sonata-blog-post-abtract').text().trim();
                news.push({
                  title: $(title).text().trim(),
                  date: momentDate.locale("ru").format('DD MMMM YYYY'),
                  link: $(title).find('a').attr('href').trim(),
                  description: desc,
                  delivery: req.body.delivery
                });
                count++;
              } else {
                wasOld = true;
              }
            } else {
              warning = commonHelper.getNewsWrongResponse(req.body.delivery);
            }
          });
          if (count !== $('.sonata-blog-post-container').length || !$('.sonata-blog-post-container').length) {
            complete = true;
          }
          callback(null);
        });
      }, commonHelper.randomInteger(500, 1000));
    },
    function (err, n) {
      if (err) {
        err.message = commonHelper.getNewsError(req.body.delivery, err);
        return responseHelper.createResponse(res, err, 500);
      }
      logger.newsInfoLog(req.body.delivery, news, 'news');
      var items = commonHelper.sortNews(news);
      res.json(commonHelper.newsResponse(items, warning));
    }
  );
};
