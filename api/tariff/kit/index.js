import { getOne, dimexCountryChanger, DIMEXCOUNTRIES } from '../../helpers/delivery';
import {
  shouldAbort,
  findInArray,
  randomTimeout
} from '../../helpers/common';
import {
  CITIESREQUIRED,
  CITYORCOUNTRYFROMREQUIRED,
  COUNTRYFROMNOTFOUND,
  CITYFROMORTORU,
  CITYFROMNOTFOUND,
  CITYTONOTFOUND,
  CITYFROMREQUIRED,
  DELIVERYTIMEREG,
  COUNTRYFROMRUSSIA,
  CITYORCOUNTRYTOREQUIRED,
  CITYORCOUNTRYTONOTFOUND,
  UNABLETOGETTARIFF,
  COUNTRYTONOTFOUND,
  COSTREG,
  getCity,
  allResultsError,
  getResponseError,
  getResponseErrorArray,
  getCountriesError,
  getCountryNoResultError,
  createTariff,
  getJSONChangedMessage,
  getRegionName,
  getNoResultError,
  getCityJsonError,
  getCityNoResultError,
  getDistrictName,
  getTariffErrorMessage,
  getContentChangedMessage,
  SNG, CITYTOREQUIRED
} from '../../helpers/tariff';
import {
  getBrowser,
  newPage,
  closeBrowser,
  closePage,
  refreshPage,
  waitForWrapper,
  waitForResponse,
  printPDF,
  requestWrapper
} from '../../helpers/browser';
const async = require('promise-async');
const cheerio = require('cheerio');
const logger = require('../../helpers/logger');
const _  = require('lodash');
const cfg = require('../../../conf');


const services = [
  {title: 'ДД', req: {'pickup-type': 1, 'delivery-type': 1, 'CalculateMiniForm[pick_up]': 1, 'CalculateMiniForm[delivery]': 1}},
  {title: 'ДС', req: {'pickup-type': 1, 'delivery-type': 0, 'CalculateMiniForm[pick_up]': 1, 'CalculateMiniForm[delivery]': 0}},
  {title: 'СС', req: {'pickup-type': 0, 'delivery-type': 0, 'CalculateMiniForm[pick_up]': 0, 'CalculateMiniForm[delivery]': 0}},
  {title: 'СД', req: {'pickup-type': 0, 'delivery-type': 1, 'CalculateMiniForm[pick_up]': 0, 'CalculateMiniForm[delivery]': 1}},
];

const getReq = (from, to, token) => {
  from = from || {};
  to = to || {};
  return {
    _csrf: token,
    'CalculateMiniForm[city_out_code]': from.id,
    'CalculateMiniForm[city_in_code]': to.id,
    'CalculateMiniForm[pick_up]': 0,
    'CalculateMiniForm[delivery]': 0,
    'CalculateMiniForm[deliveryLock]': 0,
    'CalculateMiniForm[pickUpLock]': 0,
    'CalculateMiniForm[city_out]': from.value,
    'CalculateMiniForm[city_in]': to.value,
    'pickup-type': 0,
    'delivery-type': 0,
    'CalculateMiniForm[weight]': 1,
    'CalculateMiniForm[volume]': 0.001,
    'CalculateMiniForm[places]': 1,
    'CalculateMiniForm[price]': 100
  }
};

const getReqs = (from, to, token) => {
  from = from || {};
  to = to || {};
  const results = [];
  results.push({ ...getReq(from, to, token), ...services[0].req, service: services[0].title });
  if (from.sr && services[3]) {
    results.push({ ...getReq(from, to, token), ...services[3].req, service: services[3].title });
  }
  if (to.sr && services[1]) {
    results.push({ ...getReq(from, to, token), ...services[1].req, service: services[1].title });
  }
  if (from.sr && to.sr && services[2]) {
    results.push({ ...getReq(from, to, token), ...services[2].req, service: services[2].title });
  }
  return results;
};

const _getCity = async ({ city, country, delivery, req, cookie, token }) => {
  const trim = getCity(city);
  const result = {
    city: city,
    cityTrim: trim,
    success: false
  };
  let json;
  try {
    const opts = {...delivery.citiesUrl};
    opts.uri += encodeURIComponent(trim);
    opts.headers['x-csrf-token'] = token;
    opts.headers.cookie = cookie;
    opts.headers['X-Requested-With'] = 'XMLHttpRequest';
    const res = await requestWrapper({ req, ...opts });
    json = res.body;
  } catch(e) {}
  if (!json) {
    result.error = getCityJsonError('Изменился запрос', city);
    return result;
  }
  if (!Array.isArray(json)) {
    result.error = getCityJsonError("Неверный тип данных в ответе", trim);
    return result;
  }
  json = json.filter(v => v.id);
  json = findInArray(json, trim, 'value', true);
  if (country) {
    json = findInArray(json, country, 'label');
  }
  if (!json.length) {
    result.error = getCityNoResultError(trim);
  } else {
    const region = getRegionName(city);
    const district = getDistrictName(city);
    let founds = [];
    if (region) {
      founds = findInArray(json, region, 'label');
      if (!founds.length) {
        result.error = getCityNoResultError(city);
        return result;
      }
    }
    if (district) {
      founds = findInArray(founds.length ? founds : json, district, 'label');
      if (!founds.length) {
        result.error = getCityNoResultError(city);
        return result;
      }
    }
    result.items = founds.length ? founds.slice(0, 3) : json.slice(0, 1);
    result.success = true;
  }
  return result;
};

const getCities = async ({cities, delivery, req, cookie, token}) => {
  const cityObj = {};
  return await async.mapSeries(cities, async (item, callback) => {
    try {
      const city = {
        ...item,
        initialCityFrom: item.from,
        initialCityTo: item.to,
        initialCountryFrom: item.countryFrom,
        initialCountryTo: item.countryTo,
      };
      if (!city.from) {
        city.error = CITYFROMREQUIRED;
        return callback(null, city);
      }
      if (!city.to) {
        city.error = CITYTOREQUIRED;
        return callback(null, city);
      }
      const fromKey = city.from + city.countryFrom;
      const toKey = city.to + city.countryTo;
      if (cityObj[fromKey]) {
        city.fromJSON = { ...cityObj[fromKey] };
      } else {
        const result = await _getCity({city: city.from, country: city.countryFrom, delivery, req, cookie, token});
        cityObj[fromKey] = result;
        city.fromJSON = result;
      }
      if (cityObj[toKey]) {
        city.toJSON = { ...cityObj[toKey] };
      } else {
        const result = await _getCity({city: city.to, country: city.countryTo, delivery, req, cookie, token});
        cityObj[toKey] = result;
        city.toJSON = result;
      }
      callback(null, city);
    } catch(e) {
      callback(e);
    }
  });
};

const getRequests = ({ deliveryKey, cities, weights, token }) => {
  let requests = [];
  let errors = [];
  const tempRequests = [];
  cities.forEach((item) => {
    if (item.error) {
      errors = errors.concat(getResponseErrorArray({ deliveryKey, weights, city: item, error: item.error }));
    } else if (!item.fromJSON.success) {
      errors = errors.concat(getResponseErrorArray({ deliveryKey, weights, city: item, error: item.fromJSON.error }));
    } else if (!item.toJSON.success) {
      errors = errors.concat(getResponseErrorArray({ deliveryKey, weights, city: item, error: item.toJSON.error }));
    } else {
      item.fromJSON.items.forEach((fromCity) => {
        item.toJSON.items.forEach((toCity) => {
          tempRequests.push({
            city: {
              ...item,
              fromJSON: undefined,
              toJSON: undefined,
              from: fromCity.value,
              to: toCity.value,
            },
            req: getReqs(fromCity, toCity, token),
            delivery: deliveryKey,
          });
        });
      });
    }
  });
  tempRequests.forEach((item) => {
    weights.forEach((weight) => {
      requests.push({
        ...item,
        city: {...item.city},
        weight,
        req: [...item.req],
        tariffs: []
      });
    });
  });
  return {requests, errors};
};

const getCalcResults = async ({ request, delivery, req, cookie, token }) => {
  const errors = [];
  for (let item of request.req) {
    let body;
    try {
      const opts = {...delivery.calcUrl};
      const reqCopy = {...item, 'CalculateMiniForm[weight]': request.weight, service: undefined};
      const formData = new URLSearchParams();
      for (let key of Object.keys(reqCopy)) {
        formData.append(key, reqCopy[key]);
      }
      const headers = {
        dnt: 1,
        origin: 'https://gtdel.com',
        referer: 'https://gtdel.com/',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-origin',
        'x-csrf-token': token,
        cookie,
        'x-requested-with': 'XMLHttpRequest'
      };
      opts.headers = {...opts.headers, ...headers};
      opts.body = formData;
      const res = await requestWrapper({ req, ...opts });
      body = res.body;
    } catch(e) {}
    if (!body) {
      continue;
    }
    if (!body.RUB) {
      errors.push(getTariffErrorMessage('Отсутствует параметр RUB'));
      continue;
    }
    if (!body.RUB['1']) {
      errors.push(getTariffErrorMessage('Отсутствует параметр RUB.1'));
      continue;
    }
    try {
      request.tariffs.push(createTariff(
        item.service,
        body.RUB['1'].cost,
        body.RUB['1'].time || ''
      ));
    } catch(e) {
      errors.push(e.message);
    }
  }

  if (!request.tariffs.length) {
    request.error = errors.length ? errors[0] : getNoResultError();
  }
  request.req = {};
  return request;
};

const getToken = async ({ delivery, req }) => {
  const opts = { ...delivery.tokenUrl };

  try {
    const { response, body } = await requestWrapper({format: 'text', req, ...opts});
    const $ = cheerio.load(body);
    const cookie = response.headers.get('set-cookie');
    const reg = /(gtdel=[^;]*);.*(_csrf=[^;]*);/;
    const match = cookie.match(reg);
    return {
      cookie: `${match[1]}; ${match[2]};`,
      token: $('input[name="_csrf"]').val()
    };
  } catch (e) {
    throw getResponseError('Не удалось получить cookie');
  }
};

module.exports = async function ({ deliveryKey, weights, cities, req}) {
  const delivery = getOne(deliveryKey);
  let results = [];

  try {
    const secureData = await getToken({delivery, req});
    if (shouldAbort(req)) {
      throw new Error('abort');
    }
    const citiesResults = await getCities({cities, delivery, req, ...secureData});
    if (shouldAbort(req)) {
      throw new Error('abort');
    }
    const {requests, errors} = getRequests({ deliveryKey, cities: citiesResults, weights, ...secureData });
    results = results.concat(errors);
    for (let request of requests) {
      if (shouldAbort(req)) {
        break;
      }
      results.push(await getCalcResults({ request, delivery, req, ...secureData }));
    }
  } catch(error) {
    results = allResultsError({ deliveryKey, weights, cities, error });
  }

  return results;

};