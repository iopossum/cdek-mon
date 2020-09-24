import { getOne, dpdCountryChanger } from '../../helpers/delivery';
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
  createTariff,
  getJSONChangedMessage,
  getRegionName,
  getNoResultError,
  getCityJsonError,
  getCityNoResultError,
  getDistrictName,
  getTariffErrorMessage,
  getContentChangedMessage,
  SNG
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
  countryOptions: '#order-form-app order',
};

const services = [
  {title: 'документы', req: {'cargo_type[]': '81dd8a13-8235-494f-84fd-9c04c51d50ec'}},
  {title: 'груз', req: {'cargo_type[]': '4aab1fc6-fc2b-473a-8728-58bcd4ff79ba', 'service[]': ''}},
];

const getReq = (from, to) => {
  from = from || {};
  to = to || {};
  return {
    is_b2c: 0,
    office_guid: '16632f2d-8203-11dc-86de-0015170f8c09',
    directions: 1,
    'from_locality_guid[]': from.guid,
    'to_locality_guid[]': to.guid,
    'cargo_type[]': '81dd8a13-8235-494f-84fd-9c04c51d50ec',
    'delivery_type[]': 0,
    'weight[]': 1,
    'volume_weight[]': 0
  };
};

const _getCity = async ({ city, country, delivery, req }) => {
  const trim = getCity(city);
  const result = {
    city: city,
    cityTrim: trim,
    success: false
  };
  let json;
  try {
    const opts = {...delivery.citiesUrl};
    opts.uri += country.guid;
    opts.uri += `&prefix=${encodeURIComponent(trim)}`;
    const res = await requestWrapper({ req, ...opts });
    json = res.body;
  } catch(e) {}
  if (!json) {
    result.error = getCityJsonError('Изменился запрос', city);
    return result;
  }
  if (Array.isArray(json) && !json.length) {
    result.error = getCityNoResultError(trim);
    return result;
  }
  if (!Object.keys(json).length) {
    result.error = getCityNoResultError(trim);
    return result;
  }
  let values = findInArray(Object.values(json), trim, 'name', true);
  let filteredByCity = values.filter(v => v.is_city);
  values = filteredByCity.length ? filteredByCity : values;
  const region = getRegionName(city);
  if (region) {
    values = findInArray(values, region, 'region');
  }
  if (!values.length) {
    result.error = getCityNoResultError(city);
  } else {
    result.items = values.slice(0, 2);
    result.success = true;
  }
  return result;
};

const getCities = async ({cities, delivery, req, countries}) => {
  const cityObj = {};
  const countryObj = _.keyBy(countries, 'name');
  const russiaObj = countryObj['РОССИЯ'];
  if (!russiaObj) {
    throw new Error('Контент сайта изменился');
  }
  return await async.mapSeries(cities, async (item, callback) => {
    try {
      const city = {
        ...item,
        initialCityFrom: item.from,
        initialCityTo: item.to,
        initialCountryFrom: item.countryFrom,
        initialCountryTo: item.countryTo,
      };
      if (!city.from && !city.to) {
        city.error = CITIESREQUIRED;
        return callback(null, city);
      }
      if (city.countryFrom && !countryObj[city.countryFrom.toUpperCase()]) {
        city.error = COUNTRYFROMNOTFOUND;
        return callback(null, city);
      }
      if (city.countryTo && !countryObj[city.countryTo.toUpperCase()]) {
        city.error = COUNTRYTONOTFOUND;
        return callback(null, city);
      }
      const fromKey = city.from + city.countryFrom;
      const toKey = city.to + city.countryTo;
      if (cityObj[fromKey]) {
        city.fromJSON = { ...cityObj[fromKey] };
      } else {
        const result = await _getCity({city: city.from, country: city.countryFrom ? countryObj[city.countryFrom.toUpperCase()] : russiaObj, delivery, req});
        cityObj[fromKey] = result;
        city.fromJSON = result;
      }
      if (cityObj[toKey]) {
        city.toJSON = { ...cityObj[toKey] };
      } else {
        const result = await _getCity({city: city.to, country: city.countryTo ? countryObj[city.countryTo.toUpperCase()] : russiaObj, delivery, req});
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
      errors = errors.concat(getResponseErrorArray({ deliveryKey, weights, city: item, error: item.fromJSON.error, req: {} }));
    } else if (!item.toJSON.success) {
      errors = errors.concat(getResponseErrorArray({ deliveryKey, weights, city: item, error: item.toJSON.error, req: {} }));
    } else {
      item.fromJSON.items.forEach((fromCity) => {
        item.toJSON.items.forEach((toCity) => {
          tempRequests.push({
            city: {
              ...item,
              fromJSON: undefined,
              toJSON: undefined,
              from: fromCity.suggestion,
              to: toCity.suggestion,
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
        req: {...item.req, 'weight[]': weight},
        tariffs: []
      });
    });
  });
  return {requests, errors};
};

const getCalcResults = async ({ request, delivery, cookie, req }) => {
  let tariffs = [];
  const errors = [];
  for (let service of services) {
    let json;
    try {
      const opts = {...delivery.calcUrl};
      const reqCopy = {...request.req, ...service.req};
      for (let key of Object.keys(reqCopy)) {
        opts.uri += (key + '=' + encodeURIComponent(reqCopy[key]) + '&');
      }
      const res = await requestWrapper({ req, ...opts });
      json = res.body;
    } catch(e) {}
    if (!json) {
      continue;
    }
    if (!Array.isArray(json) || !json[0]) {
      continue;
    }
    if (!json[0].Items) {
      continue;
    }
    try {
      json[0].Items.forEach(v => {
        if (Array.isArray(v.CostedTariffs)) {
          v.CostedTariffs.forEach(t => {
            tariffs.push({
              service: `${service.title} ${v.Urgency} ${t.Tariff}`,
              cost: t.Total,
              deliveryTime: v.DeliveryPeriod.replace(DELIVERYTIMEREG, '')
            });
          });
        } else {
          tariffs.push({
            service: `${service.title} ${v.Urgency}`,
            cost: v.CostedTariffs.Total,
            deliveryTime: v.DeliveryPeriod.replace(DELIVERYTIMEREG, '')
          });
        }
      });
    } catch(e) {
      errors.push(e.message);
    }
  }
  request.tariffs = tariffs;
  if (!request.tariffs.length) {
    request.error = errors.length ? errors[0] : getNoResultError();
  }
  request.req = {};
  return request;
};

const getCountries = async ({ delivery, req }) => {
  const opts = {...delivery.calcPageUrl};
  let countries = [];
  const { body } = await requestWrapper({format: 'text', req, ...opts});
  const $ = cheerio.load(body);
  try {
    const order = $(selectors.countryOptions);
    countries = JSON.parse($(order).attr(':countries'));
  } catch(e) {}
  if (!countries.length) {
    throw new Error(getCountriesError(`Контент сайта изменился. Искали ${selectors.countryOptions}`));
  }
  return countries;
};

module.exports = async function ({ deliveryKey, weights, cities, req}) {
  const delivery = getOne(deliveryKey);
  let results = [];

  try {
    const countries = await getCountries({ delivery, req });
    if (shouldAbort(req)) {
      throw new Error('abort');
    }
    const citiesResults = await getCities({ cities, delivery, req, countries });
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