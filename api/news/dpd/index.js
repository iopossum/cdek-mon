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
  async.auto({
    getNewsList: function (callback) {
      var opts = _.extend({}, deliveryData.newsUrl);
      async.retry(config.retryOpts, function (callback) {
        request(opts, callback)
      }, function (err, r, b) {
        if (err) {
          return callback(err);
        }
        var $ = cheerio.load(b);
        var news = [];
        var links = $('#novosti').find('.one_link');
        links.each(function (index, item) {
          var obj = {
            delivery: req.body.delivery,
            link: deliveryData.baseUrl + $(item).find('a').attr('href')
          };
          news.push(obj)
        });
        return callback(null, news);
      });
    },
    getNewsItem: ['getNewsList', function (results, callback) {
      async.mapLimit(results.getNewsList, 3, function (item, callback) {
        setTimeout(function () {
          var opts = _.extend({}, deliveryData.newsUrl);
          opts.uri = item.link;
          async.retry(config.retryOpts, function (callback) {
            request(opts, callback)
          }, function (err, r, b) {
            if (err) {
              return callback(null, null);
            }
            var $ = cheerio.load(b);
            var content = $('.content_grid');
            var reg = commonHelper.DATEFORMATREG;
            var match = content.find('.headline').text().match(reg);
            if (match) {
              item.date = moment(match[1], 'DD.MM.YYYY').locale("ru").format('DD MMMM YYYY');
              item.title = match[4];
            }
            item.description = content.find('p').text();
            return callback(null, item);
          });
        }, commonHelper.randomInteger(500, 1000));
      }, callback);
    }]
  }, function (err, results) {
    if (err) {
      return responseHelper.createResponse(res, err, 500);
    }
    logger.newsInfoLog(req.body.delivery, results.getNewsItem, 'news');
    var items = [];
    results.getNewsItem.forEach(function (item) {
      if (item) {
        items.push(item);
      }
    });
    items = items.filter(function (item) {
      return moment(item.date, 'DD MMMM YYYY', 'ru').isAfter(req.body.date);
    });
    items = _.sortBy(items, function (item) {
      return item.date;
    });
    res.json(items);
  });
};
