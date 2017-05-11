module.exports = {
  retryOpts: {
    times: 10, interval: 500
  },
  rootFolder: __dirname,
  mongo: {
    uri: 'mongodb://localhost/cdek-monitoring'
  },
  postgreCity: {
    user: 'city', //env var: PGUSER
    database: 'city_catalog', //env var: PGDATABASE
    password: 'catalog', //env var: PGPASSWORD
    host: '172.16.83.33', // Server hosting the postgres database
    port: 5432, //env var: PGPORT
    max: 10, // max number of clients in the pool
    idleTimeoutMillis: 30000, // how long a client is allowed to remain idle before being closed
  }
};
