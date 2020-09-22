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
  SNG, CITYTOREQUIRED,
  isBy, CITYFROMORTOBY,
  COSTREGDOT
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

const selectors = {
  tariffResults: '#TariffsTable tbody tr'
};

const services = [
  {title: 'Документы', req: {}},
  {title: 'Не документы', req: {doc: 'on'}},
];

const getReq = (from, to) => {
  from = from || {};
  to = to || {};
  return {
    fio: '',
    organiz: '',
    email: '',
    phone: '',
    address_from: from.FULL_TITLE,
    address_to: to.FULL_TITLE,
    weight: 1,
    d: '0,01',
    sh: '0,01',
    v: '0,01'
  }
};

const _getCity = async ({ city, country, delivery, req }) => {
  country = country || 'Россия';
  const trim = getCity(city);
  const result = {
    success: false
  };
  let json;
  try {
    const opts = {...delivery.citiesUrl};
    const formData = new URLSearchParams();
    formData.append('address_from', trim);
    opts.body = formData;
    opts.headers['X-Requested-With'] = 'XMLHttpRequest';
    const res = await requestWrapper({ req, ...opts });
    json = res.body;
  } catch(e) {}
  if (!json) {
    result.error = getCityJsonError('Изменилось API', city);
    return result;
  }
  if (json.OK !== 'Y') {
    result.error = getCityJsonError("Неверный формат ответа, статус не Y", trim);
    return result;
  }
  if (!json.list) {
    result.error = getCityJsonError("Неверный формат ответа, отсутствует параметр list", trim);
    return result;
  }
  if (!Array.isArray(json.list)) {
    result.error = getCityJsonError("Неверный тип данных list в ответе", trim);
    return result;
  }
  json = findInArray(json.list, trim, 'FULL_TITLE', true);
  json = findInArray(json, country, 'FULL_TITLE');
  const region = getRegionName(city);
  let founds = [];
  if (region) {
    founds = findInArray(json, region, 'FULL_TITLE');
    if (!founds.length) {
      result.error = getCityNoResultError(city);
      return result;
    }
  }
  if (!json.length && !founds.length) {
    result.error = getCityNoResultError(trim);
  } else {
    result.success = true;
    result.items = founds.length ? founds.slice(0, 2) : json.slice(0, 2);
  }
  return result;
};

const getCities = async ({cities, delivery, req}) => {
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
      const isFromBy = isBy(item.countryFrom);
      const isToBy = isBy(item.countryTo);
      if (!isFromBy && !isToBy) {
        city.error = CITYFROMORTOBY;
        return callback(null, city);
      }
      const fromKey = city.from + city.countryFrom;
      const toKey = city.to + city.countryTo;
      if (cityObj[fromKey]) {
        city.fromJSON = { ...cityObj[fromKey] };
      } else {
        const result = await _getCity({city: city.from, country: city.countryFrom, delivery, req});
        cityObj[fromKey] = result;
        city.fromJSON = result;
      }
      if (cityObj[toKey]) {
        city.toJSON = { ...cityObj[toKey] };
      } else {
        const result = await _getCity({city: city.to, country: city.countryTo, delivery, req});
        cityObj[toKey] = result;
        city.toJSON = result;
      }
      callback(null, city);
    } catch(e) {
      callback(e);
    }
  });
};

const getRequests = ({ deliveryKey, cities, weights }) => {
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
              from: fromCity.FULL_TITLE,
              to: toCity.FULL_TITLE,
            },
            req: getReq(fromCity, toCity),
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
        req: {...item.req, weight},
        tariffs: []
      });
    });
  });
  return {requests, errors};
};

const getDeliveryTime = (json) => {
  let result = '';
  json = json || {};
  if (!json.days) {
    return result;
  }
  if (!json.days.days_min) {
    return result;
  }
  result = json.days.days_min;
  if (json.days.days_max) {
    result += '-' + json.days.days_max;
  }
  return result;
};

const getCalcResults = async ({ request, delivery, req }) => {
  const errors = [];
  for (let service of services) {
    let json;
    try {
      const opts = {...delivery.calcUrl};
      const reqCopy = {...request.req, ...service.req};
      const formData = new URLSearchParams();
      for (let key of Object.keys(reqCopy)) {
        formData.append(key, reqCopy[key]);
      }
      opts.body = formData;
      opts.headers['X-Requested-With'] = 'XMLHttpRequest';
      const res = await requestWrapper({ req, ...opts });
      json = res.body;
    } catch(e) {}
    if (!json) {
      continue;
    }
    try {
      if (json.OK !== 'Y') {
        throw new Error(getTariffErrorMessage('Неверный формат ответа, статус не Y'));
      }
      if (!json.price) {
        throw new Error(getNoResultError());
      }
      request.tariffs.push(createTariff(
        service.title,
        json.price.replace(COSTREGDOT, '').replace(/\.$/, ''),
        getDeliveryTime(json)
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

module.exports = async function ({ deliveryKey, weights, cities, req}) {
  const delivery = getOne(deliveryKey);
  let results = [];

  try {
    const citiesResults = await getCities({cities, delivery, req});
    if (shouldAbort(req)) {
      throw new Error('abort');
    }
    const {requests, errors} = getRequests({ deliveryKey, cities: citiesResults, weights });
    results = results.concat(errors);
    for (let request of requests) {
      if (shouldAbort(req)) {
        break;
      }
      results.push(await getCalcResults({ request, delivery, req }));
    }
  } catch(error) {
    results = allResultsError({ deliveryKey, weights, cities, error });
  }

  return results;

};