const NodeTtl = require("node-ttl");
const ttl = new NodeTtl({ttl: 60*60*12});

const RequestItem = function (req, results) {
  this.req = req;
  this.results = results || [];
  this.completed = [];
};

const Store = {
  requests: {},
  update: function (req) {
    const key = req.query.sessionID;
    const ttlStored = this.getTTL(req);
    if (!ttlStored || ttlStored == -1) {
      this.setTTL(req, new Date().getTime());
    }
    this.requests[key] = this.requests[key] || new RequestItem(req);
    this.requests[key].req = req;
  },
  completeOne: function (req, delivery) {
    const key = req.query.sessionID;
    this.requests[key] = this.requests[key] || new RequestItem(req, []);
    this.requests[key].completed.push(delivery);
  },
  setResults: function (req, results) {
    const key = req.query.sessionID;
    this.requests[key] = this.requests[key] || new RequestItem(req, results);
    this.requests[key].results = results;
  },
  delete: function (req) {
    const key = req.query.sessionID;
    ttl.del(key);
  },
  deleteExpired: function (key) {
    delete this.requests[key];
  },
  getRequest: function (req) {
    return this.requests[req.query.sessionID];
  },
  getTTL: function (req) {
    const key = req.query.sessionID;
    return ttl.get(key)
  },
  setTTL: function (req, value) {
    const key = req.query.sessionID;
    ttl.push(key, value);
  }
};

module.exports = Store;

ttl.on("del", (key) => {
  Store.deleteExpired(key);
});