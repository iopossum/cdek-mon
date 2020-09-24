module.exports = {
  browser: {
    delay: {
      min: 1000,
      max: 2000
    },
  },
  request: {
    delay: {
      min: 1500,
      max: 2500
    },
    retryOpts: {
      times: 2,
      interval: 1500
    },
  },
  rootFolder: __dirname,
  userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/84.0.4147.135 Safari/537.36",
};
