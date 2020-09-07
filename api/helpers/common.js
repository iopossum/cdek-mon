import _ from 'lodash';
const Store = require('./store');

export const shouldAbort = (req) => {
  return req && req.query && req.query.sessionID && !Store.getRequest(req);
};

export const addZero = (number) => {
  if (number < 10) {
    number = ('0' + number);
  }
  return number;
};

export const getErrorMessage = (err) => {
  return typeof err === 'string' && err || err && err.message;
};

export const cloneArray = (array) => {
  return array.map(_.clone);
};

export const deepClone = (obj) => {
  return JSON.parse(JSON.stringify(obj));
};

export const randomInteger = (min, max) => {
  let rand = min - 0.5 + Math.random() * (max - min + 1);
  rand = Math.round(rand);
  return rand;
};

export const parseFloat = (value) => {
  value = value || 0;
  value = parseFloat(value);
  if (isNaN(value)) {
    value = 0;
  }
  return value;
};

export const rounded = (number, count) => {
  return Math.round(number*count)/count;
};

export const parseInt = (value) => {
  value = value || 0;
  value = parseInt(value, 10);
  if (isNaN(value)) {
    value = 0;
  }
  return value;
};

export const findInArray = (array, value, key, exactly) => {
  key = key || 'name';
  array = array || [];
  const reg = findInArrayRegExp(value, exactly);
  return array.filter((item) => {
    if (!item[key]) {
      return false;
    }
    return item[key].match(reg);
  });
};

export const findInArrayRegExp = function (value, exactly) {
  return exactly ? new RegExp("(^|[^_0-9a-zA-Zа-яёА-ЯЁ])" + value + "([^_0-9a-zA-Zа-яёА-ЯЁ-]|$)", "i") : new RegExp(value, 'gi');
};

export const randomTimeout = (from = 0, to = 0) => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      resolve();
    }, randomInteger(from, to));
  });
};

export const wrapTryCatch = async () => {
  try {

  } catch(e) {

  }
};