const { createResponse } = require('../helpers/response');
const async = require('promise-async');

module.exports = async function (req, res) {
  if (!req.body.requests) {
    return createResponse(res, new Error("Requests is required"));
  }
  if (!req.body.requests.length) {
    return createResponse(res, new Error("Requests is required"));
  }
  if (!req.body.delivery) {
    return createResponse(res, new Error("Delivery is required"));
  }
  let array = [];
  const delivery = req.body.delivery;
  try {
    await async.each(req.body.requests, async (item, callback) => {
      const cities = [{...item.city}];
      try {
        const results = await require('./' + delivery)({deliveryKey: delivery, cities, weights: [item.weight], req});
        array = array.concat(results);
        callback(null, results);
      } catch (e) {
        callback(new Error("Delivery is not found"));
      }
    });
    res.json(array);
  } catch(e) {
    createResponse(res, e, 500);
  }
};