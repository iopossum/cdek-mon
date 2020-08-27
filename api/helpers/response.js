
export const createResponse = (res, err, status) => {
  return res.status(status || 500).json(createMessage(err));
};

export const createMessage = (err) => {
  if (!err) {
    return success();
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

export const success = () => {
  return {success: true};
};


