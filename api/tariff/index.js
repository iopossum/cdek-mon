const { asyncMiddleware, eventError, eventFinish, eventData } = require('../helpers/response');
const Store = require('../helpers/store');
const { RUSSIA } = require('../helpers/common');

module.exports = asyncMiddleware(async (req, res) => {

  const end = () => {
    Store.delete(req);
    res.end();
  };

  res.set({
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache',
    "Access-Control-Allow-Origin": "*"
  });

  const padding = new Array(2049);
  res.write(":" + padding.join(" ") + "\n"); // 2kB padding for IE
  res.write("retry: 2000\n");

  const lastEventId = Number(req.headers["last-event-id"]) || Number(req.query.lastEventId);

  res.flushHeaders(); // flush the headers to establish SSE with client

  let data = null;
  try {
    data = JSON.parse(req.query.data);
  } catch(e) {
    eventError(res, new Error('Неверные данные запроса.'));
  }

  if (!data) {
    return end();
  }

  if (!data.cities) {
    return eventError(res, new Error('Укажите направления'), end);
  }
  if (!data.cities.length) {
    return eventError(res, new Error('Укажите направления'), end);
  }
  if (!data.weights) {
    return eventError(res, new Error('Выберите вес'), end);
  }
  if (!data.weights.length) {
    return eventError(res, new Error('Выберите вес'), end);
  }
  if (!data.deliveries) {
    return eventError(res, new Error('Укажите службы доставки'), end);
  }
  if (!data.deliveries.length) {
    return eventError(res, new Error('Укажите службы доставки'), end);
  }
  data.cities.forEach(function (item) {
    if (item.countryFrom && RUSSIA.indexOf(item.countryFrom.toLowerCase()) > -1) {
      item.countryFrom = '';
    }
    if (item.countryTo && RUSSIA.indexOf(item.countryTo.toLowerCase()) > -1) {
      item.countryTo = '';
    }
  });

  req.socket.setTimeout(1000 * 60 * 60); // 1 Час

  // If client closes connection, stop sending events
  res.on('close', () => {
    Store.setTTL(req, -1);
    res.end();
  });

  const wasRequest = Store.getRequest(req);
  if (wasRequest && wasRequest.results && wasRequest.results.length) {
    eventData(res, wasRequest.results);
    Store.setResults(req, []);
  }

  Store.update(req);

  for (let i = 0; i < data.deliveries.length; i++) {
    const item = data.deliveries[i];
    if (!wasRequest || wasRequest && wasRequest.completed.indexOf(item) === -1) {
      require('./' + item)({deliveryKey: item, ...data, req})
        .then((results) => {
          const storedTTL = Store.getTTL(req);
          if (storedTTL >= -1) {
            Store.completeOne(req, item);
            if (storedTTL === -1) {
              Store.setResults(req, results);
            } else if (storedTTL) {
              const isEnd = Store.getRequest(req).completed.length === data.deliveries.length;
              if (isEnd) {
                eventFinish(res);
              }
              eventData(res, results);
              if (isEnd) {
                end();
              }
            }
          }
        });
    }
  }
});