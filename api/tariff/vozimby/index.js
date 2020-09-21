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
  COUNTRYRUSSIA,
  CITYORCOUNTRYTOREQUIRED,
  CITYORCOUNTRYTONOTFOUND,
  UNABLETOGETTARIFF,
  COUNTRYTONOTFOUND,
  COSTREG,
  COSTREGDOT,
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
  SNG, CITYTOREQUIRED, BY,
  CITIESBY,
  isBy
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
const moment = require('moment');

const services = [
  {title: 'Доставка', req: {}},
  {title: 'Доставка до 18:00', req: {delivery18: 1}},
];

const getReq = (from, to) => {
  from = from || {};
  to = to || {};
  return {
    form: 'calculation',
    'client-type':0,
    calculation:2,
    rule: '',
    length:1,
    width:1,
    height:1,
    weight:0,
    'good-cost': '',
    'locality-from': from.name,
    'locality-to': to.name,
    fromstore: 1
  }
};

const _getCity = (cities, city) => {
  const trim = getCity(city);
  const result = {
    cityTrim: trim,
    success: false
  };
  const json = findInArray(cities, trim, 'name', true);
  const region = getRegionName(city);
  const district = getDistrictName(city);
  let founds = [];
  if (region) {
    founds = findInArray(json, region, 'name');
    if (!founds.length) {
      result.error = getCityNoResultError(city);
      return result;
    }
  }
  if (district) {
    founds = findInArray(founds.length ? founds : json, district, 'name');
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

const getCities = async ({ cities, initialCities }) => {
  return await async.mapSeries(cities, (item, callback) => {
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
      if (item.countryFrom && !isBy(item.countryFrom)) {
        city.error = CITIESBY;
        return callback(null, city);
      }
      if (item.countryTo && !isBy(item.countryTo)) {
        item.error = CITIESBY;
        return callback(null, city);
      }

      city.fromJSON = _getCity(initialCities, item.from);
      city.toJSON = _getCity(initialCities, item.to);

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
              from: fromCity.name,
              to: toCity.name,
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

const getDeliveryTime = (days) => {
  let result = '';
  if (!days) {
    return result;
  }
  const splits = days.split("-");
  result = 1;
  if (splits.length > 1) {
    result = moment(splits[1], 'DD.MM.YYYY').diff(moment(splits[0], 'DD.MM.YYYY'), 'days') + 1;
  }
  return result;
};

const getService = (type) => {
  let result = '';
  if (!type) {
    return result;
  }
  switch (type) {
    case '1':
      result = 'Экспресс';
      break;
    case '2':
      result = 'Стандарт';
      break;
    case '3':
      result = 'Эконом';
      break;
  }
  return result;
};

const getCalcResults = async ({ request, delivery, req }) => {
  const errors = [];
  for (let service of services) {
    let body;
    try {
      const opts = {...delivery.calcUrl};
      const reqCopy = {...request.req, ...service.req};
      const formData = new URLSearchParams();
      for (let key of Object.keys(reqCopy)) {
        formData.append(key, reqCopy[key]);
      }
      opts.body = formData;
      const res = await requestWrapper({ req, ...opts });
      body = res.body;
    } catch(e) {
      errors.push(getTariffErrorMessage('Изменилось api'));
    }
    if (!body) {
      continue;
    }

    try {
      for (let key of Object.keys(body)) {
        if (['custom', 'minimal'].indexOf(key) === -1 && body[key].enabled) {
          request.tariffs.push(createTariff(
            `${service.title} ${getService(key)}`,
            body[key].cost,
            getDeliveryTime(body[key].days)
          ));
        }
      }
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

const getInitialCities = async ({ delivery, req }) => {
  const opts = { ...delivery.citiesUrl };
  try {
    const { body } = await requestWrapper({ req, ...opts });
    return body.map(v => ({ name: v }));
  } catch (e) {
    throw getResponseError('Не удалось получить города с сайта. Изменилось API');
  }
};

module.exports = async function ({ deliveryKey, weights, cities, req}) {
  const delivery = getOne(deliveryKey);
  let results = [];

  try {
    const initialCities = await getInitialCities({ delivery, req });
    if (shouldAbort(req)) {
      throw new Error('abort');
    }
    const citiesResults = await getCities({ cities, delivery, req, initialCities });
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