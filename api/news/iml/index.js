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
  var warning = null;
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
          if (page === 1) {
            opts.uri = opts.uri + '?year=' + item;
          } else {
            opts.uri = opts.uri + '/year/' + item + '/page/' + page;
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
            $('.list-block').each(function (index, item) {
              var date = $(item).find('time').text().trim();
              var momentDate = moment(date, "DD.MM.YYYY", 'ru');
              if (date) {
                if (momentDate.isAfter(moment(req.body.date)) && !wasOld) {
                  news.push({
                    title: $(item).find('header').text().trim(),
                    date: momentDate.format('DD MMMM YYYY'),
                    link: deliveryData.baseUrl + $(item).find('a').attr('href').trim(),
                    description: $(item).find('article').text().trim(),
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
            if (count !== $('.list-block').length || !$('.list-block').length) {
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
      err.message = commonHelper.getNewsError(req.body.delivery, err);
      return responseHelper.createResponse(res, err, 500);
    }
    logger.newsInfoLog(req.body.delivery, results.getNews, 'news');
    var items = [];
    results.forEach(function (item) {
      if (item) {
        items = items.concat(item);
      }
    });
    items = commonHelper.sortNews(items);

    res.json(commonHelper.newsResponse(items, warning));
  });

};
