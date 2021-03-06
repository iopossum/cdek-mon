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

const selectors = {
  fromCity: 'select.c_from_with_partners option',
  toCity: 'select.c_to_with_partners option'
};

const getReq = (from, to) => {
  from = from || {};
  to = to || {};
  return {
    act: 'getPrice',
    cfId: from.id,
    ctId: to.id,
    weight: 2,
    volume: 0
  }
};

const getCities = async ({cities, initialCities}) => {
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
      if (city.countryFrom || city.countryTo) {
        city.error = COUNTRYRUSSIA;
        return callback(null, city);
      }
      const trimFrom = getCity(item.from);
      const foundsFrom = findInArray(initialCities.citiesFrom, trimFrom, 'name', true);
      if (!foundsFrom.length) {
        city.error = getCityNoResultError(trimFrom);
        return callback(null, city);
      }

      const trimTo = getCity(item.to);
      const foundsTo = findInArray(initialCities.citiesTo, trimTo, 'name', true);
      if (!foundsTo.length) {
        city.error = getCityNoResultError(trimTo);
        return callback(null, city);
      }

      city.fromJSON = { success: true, items: foundsFrom.slice() };
      city.toJSON = { success: true, items: foundsTo.slice() };

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

const getCalcResults = async ({ request, delivery, req }) => {
  try {
    const opts = {...delivery.calcUrl};
    opts.headers['X-Requested-With'] = 'XMLHttpRequest';
    const formData = new URLSearchParams();
    for (let key of Object.keys(request.req)) {
      formData.append(key, request.req[key]);
    }
    opts.body = formData;
    const { body } = await requestWrapper({ format: 'text', req, ...opts });
    request.tariffs.push(createTariff(
      'доставка',
      body,
      ''
    ));
  } catch(e) {
    request.error = e.message;
  }
  if (!request.tariffs.length && !request.error) {
    request.error = getNoResultError();
  }
  request.req = {};
  return request;
};

const getInitialCities = async ({ delivery, req }) => {
  const opts = { ...delivery.citiesUrl };
  const formData = new URLSearchParams();
  formData.append('act', 'getCalc');
  opts.body = formData;
  opts.headers['X-Requested-With'] = 'XMLHttpRequest';
  try {
    const { body } = await requestWrapper({format: 'text', req, ...opts});
    const $ = cheerio.load(body);
    const result = {
      citiesFrom: [],
      citiesTo: []
    };
    const fromOpts = $(selectors.fromCity);
    const toOpts = $(selectors.toCity);
    fromOpts.each(function (index, item) {
      const value = $(item).attr('value');
      if (value) {
        result.citiesFrom.push({id: $(item).attr('value'), name: $(item).text().trim().toLowerCase()});
      }
    });
    toOpts.each(function (index, item) {
      const value = $(item).attr('value');
      if (value) {
        result.citiesTo.push({id: $(item).attr('value'), name: $(item).text().trim().toLowerCase()});
      }
    });
    return result;
  } catch (e) {
    throw getResponseError('Не удалось получить города с сайта');
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
    const citiesResults = await getCities({cities, delivery, req, initialCities});
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