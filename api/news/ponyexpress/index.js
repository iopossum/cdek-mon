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
  var from = moment(req.body.date);
  for (var i=from.year(); i<=moment().year(); i++) {
    requests.push(i);
  }

  async.mapLimit(requests, 3, function (item, callback) {
    var page = 1;
    var complete = false;
    var news = [];
    async.until(
      function () { return complete; },
      function (callback) {
        setTimeout(function () {
          var opts = _.extend({}, deliveryData.newsUrl);
          opts.uri = opts.uri + 'year_' + item + '/?ajax=Y&PAGEN_1=' + page;
          async.retry(config.retryOpts, function (callback) {
            request(opts, callback)
          }, function (err, r, b) {
            page++;
            if (err) {
              return callback(null, []);
            }
            var $ = cheerio.load(b);
            var count = 0;
            var wasOld = false;
            $('.category').remove();
            $('.b-article-item').each(function (index, item) {
              var date = $(item).find('.date').text().trim();
              var momentDate = moment(date, "DD MMMM YYYY", 'ru');
              if (date && momentDate.isAfter(moment(req.body.date)) && !wasOld) {
                news.push(commonHelper.createNews($(item).find('p').text().trim(), date, deliveryData.baseUrl + $(item).attr('href').trim(), req.body.delivery));
                count++;
              } else {
                wasOld = true;
              }
            });
            if (count !== $('.b-article-item').length || !$('.b-article-item').length) {
              complete = true;
            }
            callback(null, news);
          });
        }, commonHelper.randomInteger(500, 1000));
      },
      callback
    );
  }, function (err, results) {

    if (err) {
      return responseHelper.createResponse(res, err, 500);
    }
    logger.newsInfoLog(req.body.delivery, results.getNews, 'news');
    var items = [];
    results.forEach(function (item) {
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
