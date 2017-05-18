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
  var page = 1;
  var complete = false;
  var news = [];
  var warning = null;

  async.until(
    function () { return complete; },
    function (callback) {
      setTimeout(function () {
        var opts = _.extend({}, page === 1 ? deliveryData.newsFirstUrl : deliveryData.newsUrl);
        if (page !== 1) {
          opts.form = {
            action: 'load_more_custom_posts_entries',
            page_num: page,
            post_type: 'newsroom',
            taxonomy: 'language',
            selected_taxonomy: 'global-english',
            featured_post: 1
          };
          opts.headers['X-Requested-With'] = 'XMLHttpRequest';
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
          $('.about-blog-block').each(function (index, item) {
            var date = $(item).find('h5').text().trim();
            var momentDate = moment(date, "MMMM DD, YYYY");
            if (date) {
              if (momentDate.isAfter(moment(req.body.date)) && !wasOld) {
                news.push({
                  title: $(item).find('h2').text().trim(),
                  date: momentDate.locale('ru').format('DD MMMM YYYY'),
                  link: $(item).find('h2').find('a').attr('href'),
                  description: $(item).find('p').text().trim(),
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
          if (count !== $('.about-blog-block').length || !$('.about-blog-block').length) {
            complete = true;
          }
          callback(null, news);
        });
      }, commonHelper.randomInteger(500, 1000));
    },
    function (err, results) {

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
    }
  );

};
