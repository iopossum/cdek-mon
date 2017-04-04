module.exports = {
  retryOpts: {
    times: 10, interval: 500
  },
  rootFolder: __dirname,
  mongo: {
    uri: 'mongodb://localhost/cdek-monitoring'
  }
};
