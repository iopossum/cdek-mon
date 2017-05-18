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
    var news = [];
    setTimeout(function () {
      var opts = _.extend({}, deliveryData.newsUrl);
      opts.uri = opts.uri + (item === moment().year() ? '.html' : '/releases_' + item + '.html');
      async.retry(config.retryOpts, function (callback) {
        request(opts, callback)
      }, function (err, r, b) {
        if (err) {
          warning = commonHelper.getNewsPartError(req.body.delivery);;
          return callback(null, []);
        }
        var $ = cheerio.load(b);
        $('[dojotype="dijit.NewsListTitlePane"]').each(function (index, item) {
          var date = $(item).attr('title');
          var momentDate = moment(date, "MM/DD/YYYY", 'ru');
          if (date) {
            if (momentDate.isAfter(moment(req.body.date))) {
              news.push({
                title: $(item).attr('subtitle'),
                date: momentDate.format('DD MMMM YYYY'),
                link: $(item).find('.arrowLink').attr('onclick').split("'")[1],
                description: $(item).find('.newslist_txt_teaser').text().trim(),
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
