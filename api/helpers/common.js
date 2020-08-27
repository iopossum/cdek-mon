const request = require('request');
const Nightmare = require('nightmare');
const realMouse = require('nightmare-real-mouse');
const _ = require('underscore');
const commonSafe = require('./common-safe');
const Store = require('./store');
const NodeTtl = require( "node-ttl" );
const cfg = require('../../conf');
const async = require('promise-async');
const fetch = require('cross-fetch');
const { Headers } = require('node-fetch');
const puppeteer = require('puppeteer');
const ttl = new NodeTtl({ttl: 60*60*24});
_.extend(exports, commonSafe);

// add the plugin
realMouse(Nightmare);
request.defaults({
  timeout : 5000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/84.0.4147.135 Safari/537.36'
  },
  maxRedirects: 20
});

exports.shouldAbort = (req) => {
  return req && req.query && req.query.sessionID && !Store.getRequest(req);
};

exports.getBrowser = async () => {
  return await puppeteer.launch({
    ignoreHTTPSErrors: true,
    defaultViewport: {
      width: 1280,
      height: 1024
    },
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox'
    ]
  });
};

exports.newPage = async (browser) => {
  const page = await browser.newPage();
  await page.emulate({
    viewport: {
      width: 1280,
      height: 1024
    },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/84.0.4147.135 Safari/537.36'
  });
  return page;
};

exports.waitForWrapper = async (page, selector, opts = {}, message) => {
  try {
    await page.waitFor(selector, opts);
  } catch(e) {
    throw new Error(message || this.getContentChangedMessage(selector))
  }
};

exports.printPDF = async (page, number) => {
  try {
    await page.pdf({path: `${number || 1}.pdf`});
  } catch (e) {}
};

exports.closeBrowser = async (browser) => {
  if (browser) {
    try {
      await browser.close();
    } catch (e) {
    }
  }
};

exports.closePage = async (page) => {
  if (page) {
    try {
      await page.close();
    } catch (e) {
    }
  }
};

exports.refreshPage = async (page) => {
  if (page) {
    try {
      await page.reload();
    } catch (e) {
    }
  }
};

exports.waitForResponse = async ({ page, conditionCallback, message }) => {

  let response;
  try {
    response = await page.waitForResponse(conditionCallback);
  } catch (e) {
    throw new Error(message);
  }

  if (response.status() !== 200) {
    throw new Error(getCityJsonError(new Error("Статус ответа не 200"), trim));
  }

  try {
    json = await response.json();
  } catch(e) {
    throw new Error(getCityJsonError(new Error("Формат ответа не JSON"), trim));
  }
};

exports.request = request;

const requestPromise = (opts) => {
  return new Promise((resolve, reject) => {
    if (opts.body) {
      opts.body = JSON.stringify(opts.body);
    }
    request(opts, (err, response, body) => {
      err ? reject(err) : resolve({ response, body })
    });
  });
};

exports.requestWrapper = ({json, noReject, useRequest, req, ...opts}) => {
  return new Promise((resolve, reject) => {
    setTimeout(async () => {
      if (this.shouldAbort(req)) {
        return reject({ abort: true });
      }
      try {
        const retryRes = await async.retry(cfg.request.retryOpts, async (callback) => {
          if (this.shouldAbort(req)) {
            return callback({ abort: true });
          }
          if (!useRequest) {
            try {
              if (opts.headers) {
                opts.headers = new Headers(opts.headers);
              }
              const fetchRes = await fetch(opts.uri || opts.url, opts);
              console.log(opts)
              let body = null;
              if (json) {
                body = await fetchRes.json();
              } else {
                body = await fetchRes.text();
                const match = body.match(/(bad gateway)|(403 Forbidden)|(token mismatch)/i);
                if (match) {
                  return callback(new Error(match[1] || match[2] || match[3]));
                }
              }
              callback(null, {body, response: fetchRes});
            } catch (e) {
              callback(e);
            }
          } else {
            try {
              const res = await requestPromise({...opts, json});
              callback(null, res);
            } catch (e) {
              callback(e);
            }
          }
        });
        resolve(retryRes);
      } catch (e) {
        noReject && !e.abort ? resolve({error: e}) : reject(e);
      }
    }, this.randomInteger(cfg.request.delay.min, cfg.request.delay.max));
  });
};

exports.getNightmare = function () {
  var nightmare = new Nightmare({
    executionTimeout: 30000,
    loadTimeout: 30000,
    gotoTimeout: 30000,
    waitTimeout: 30000,
    // show: true,
    // openDevTools: true
  });
  nightmare.viewport(1000, 1000)
    .useragent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/65.0.3325.181 Safari/537.36");
  return nightmare;
};

exports.allResultsError = function ({ cities, weights, deliveryKey, error }) {
  let array = [];
  cities.forEach(function (item) {
    array = array.concat(exports.getResponseArray(weights, item, deliveryKey, error.message || error.stack || error));
  });
  return array;
};

exports.saveResults = function (req, err, opts) {
  if (opts.callback) {
    return opts.callback(err, opts.items);
  }
  if (exports.getReqStored(req, opts.delivery) > opts.timestamp) {
    return false;
  }
  if (err) {
    if (err.abort) {
      return false;
    }
    req.session.delivery[opts.delivery].complete = true;
    req.session.delivery[opts.delivery].error = err.message || err.stack || err;
    var array = [];
    opts.cities.forEach(function (item) {
      array = array.concat(exports.getResponseArray(req.body.weights, item, opts.delivery, err.message || err.stack || err))
    });
    req.session.delivery[opts.delivery].results = array;
  } else {
    req.session.delivery[opts.delivery].complete = true;
    req.session.delivery[opts.delivery].results = opts.items;
  }
  req.session.save ? req.session.save(function () {}) : null;
};

exports.saveStore = function (key, value) {
  ttl.push(key, value);
};

exports.getStored = function (key) {
  return ttl.get(key);
};

exports.saveReqStore = function (req, delivery, value) {
  exports.saveStore(delivery + req.session.id, value);
};

exports.getReqStored = function (req, delivery) {
  if (!req.session) {
    return 0;
  }
  return exports.getStored(delivery + req.session.id);
};