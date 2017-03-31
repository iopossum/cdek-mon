
exports.createResponse = function (res, err, status) {
  var obj = {
    success: false,
    title: err.message,
    reason: err.message
  };
  if (err.code) {
    obj.code = err.code;
  }
  return res.status(status || 500).json(obj);
};

exports.success = function () {
  return {success: true};
};