
exports.createResponse = (res, err, status) => {
  return res.status(status || 500).json(this.createMessage(err));
};

exports.createMessage = function (err) {
  if (!err) {
    return this.success();
  }
  const obj = {
    success: false,
    title: err.message || err,
    reason: err.message || err
  };
  if (err.code) {
    obj.code = err.code;
  }
  return obj;
};

exports.success = function () {
  return {success: true};
};

exports.asyncMiddleware = fn =>
  (req, res, next) => {
    Promise.resolve(fn(req, res, next))
      .catch(next);
  };

exports.eventError = (res, err, end) => {
  res.write("event: eventError\n");
  res.write(`data: ${JSON.stringify(this.createMessage(err))}\n\n`);
  end && end();
};

exports.eventFinish = (res, end) => {
  res.write("event: eventFinish\n");
  end && end();
};

exports.eventData = (res, data) => {
  res.write(`data: ${JSON.stringify(data)}\n\n`);
};