const request = require('request');
const {
  userAgent,
  ...cfg
} = require('../../conf');
const async = require('promise-async');
const fetch = require('cross-fetch');
const { Headers } = require('node-fetch');
const puppeteer = require('puppeteer');

request.defaults({
  timeout : 5000,
  headers: {
    'User-Agent': userAgent
  },
  maxRedirects: 20
});

export const getBrowser = async () => {
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

export const newPage = async (browser) => {
  const page = await browser.newPage();
  await page.emulate({
    viewport: {
      width: 1280,
      height: 1024
    },
    userAgent: userAgent
  });
  return page;
};

export const waitForWrapper = async (page, selector, opts = {}, message) => {
  try {
    await page.waitFor(selector, opts);
  } catch(e) {
    throw new Error(message || this.getContentChangedMessage(selector))
  }
};

export const printPDF = async (page, number) => {
  try {
    await page.pdf({path: `${number || 1}.pdf`});
  } catch (e) {}
};

export const closeBrowser = async (browser) => {
  if (browser) {
    try {
      await browser.close();
    } catch (e) {
    }
  }
};

export const closePage = async (page) => {
  if (page) {
    try {
      await page.close();
    } catch (e) {
    }
  }
};

export const refreshPage = async (page) => {
  if (page) {
    try {
      await page.reload();
    } catch (e) {
    }
  }
};

export const waitForResponse = async ({ page, conditionCallback, message }) => {

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

const requestPromise = (opts) => {
  return new Promise((resolve, reject) => {
    if (opts.body) {
      opts.body = JSON.stringify(opts.body);
    }
    nodeRequest(opts, (err, response, body) => {
      err ? reject(err) : resolve({ response, body })
    });
  });
};

export const requestWrapper = ({json, noReject, useRequest, req, ...opts}) => {
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

exports.allResultsError = function ({ cities, weights, deliveryKey, error }) {
  let array = [];
  cities.forEach(function (item) {
    array = array.concat(exports.getResponseArray(weights, item, deliveryKey, error.message || error.stack || error));
  });
  return array;
};