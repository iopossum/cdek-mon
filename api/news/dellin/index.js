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
  var years = [];
  var from = moment(req.body.date);
  for (var i=from.year(); i<=moment().year(); i++) {
    years.push(i);
  }

  years.forEach(function (year, index) {
    var fr = 1;
    var to = 12;
    if (index === 0) {
      fr = from.month() + 1;
    }
    if (index === years.length - 1) {
      to = moment().month() + 1;
    }
    for (var i=fr; i<=to; i++) {
      var opts = _.extend({}, deliveryData.newsUrl);
      opts.uri += ('year=' + year + '&month=' + i);
      requests.push(opts);
    }
  });

  async.mapLimit(requests, 3, function (item, callback) {
    var news = [];
    setTimeout(function () {
      async.retry(config.retryOpts, function (callback) {
        request(item, callback)
      }, function (err, r, b) {
        if (err) {
          warning = commonHelper.getNewsPartError(req.body.delivery);
          return callback(null, []);
        }
        var json = null;
        try {
          json = JSON.parse(b);
        } catch (e) {}

        if (!json) {
          warning = commonHelper.getNewsWrongResponse(req.body.delivery);
          return callback(null, []);
        }
        if (!json.page) {
          warning = commonHelper.getNewsWrongResponse(req.body.delivery);
          return callback(null, []);
        }

        var $ = cheerio.load(json.page);
        $('.item').each(function (index, item) {
          var date = $(item).find('.date').text().trim();
          var momentDate = moment(date, "DD MMMM YYYY", 'ru');
          if (date) {
            if (momentDate.isAfter(moment(req.body.date))) {
              news.push({
                title: $(item).find('.header').text().trim(),
                date: momentDate.format('DD MMMM YYYY'),
                link: deliveryData.baseUrl + '/news/' + $(item).find('.header').find('a').attr('href').trim(),
                description: $(item).find('.text').text().trim(),
                delivery: req.body.delivery
              });
            }
          } else {
            warning = commonHelper.getNewsWrongResponse(req.body.delivery);
          }
        });
        callback(null, news);
      });
    }, commonHelper.randomInteger(500, 1000));
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
