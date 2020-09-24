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
  isKz
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
  {title: 'Экспресс', req: {service: 'express'}},
  {title: 'Стандарт', req: {service: 'standard'}},
];

const getReq = (from, to) => {
  from = from || {};
  to = to || {};
  return {
    origin_id: from.id,
    destination_id: to.id,
    service: 'express',
    weight: 1,
    w: 0,
    l: 0,
    h: 0,
    declared_value: 15000
  }
};

const _getCity = async ({ city, country, delivery, req, isFrom, isKz }) => {
  const isCountry = !city;
  const entity = isCountry ? country : city;
  const trim = getCity(entity);
  const notFoundFn = isCountry ? getCountryNoResultError : getCityNoResultError;
  const errorFn = isCountry ? getCountriesError : getCityJsonError;
  const result = {
    success: false,
    isCountry
  };
  let json;
  try {
    const opts = isFrom ? {...delivery.citiesFromUrl} : {...delivery.citiesToUrl};
    opts.uri += encodeURIComponent(trim) + '&_=' + new Date().getTime();
    const res = await requestWrapper({ req, ...opts });
    json = res.body;
  } catch(e) {}
  if (!json) {
    result.error = errorFn('Изменился запрос', trim);
    return result;
  }
  if (!json.regions) {
    result.error = errorFn('Отсутствует параметр regions в ответе', trim);
    return result;
  }
  if (!Array.isArray(json.regions)) {
    result.error = errorFn("Неверный тип данных regions в ответе", trim);
    return result;
  }
  json = findInArray(json.regions, trim, 'title', true);
  const region = getRegionName(entity);
  const district = getDistrictName(entity);
  let founds = [];
  if (region) {
    founds = findInArray(json, region, 'cached_path');
    if (!founds.length) {
      result.error = notFoundFn(entity);
      return result;
    }
  }
  if (isKz && district) {
    founds = findInArray(founds.length ? founds : json, district, 'cached_path');
    if (!founds.length) {
      result.error = notFoundFn(entity);
      return result;
    }
  }
  if (!json.length && !founds.length) {
    result.error = notFoundFn(entity);
  } else {
    result.success = true;
    result.items = founds.length ? founds.slice(0, 2) : json.slice(0, 2);
  }
  return result;
};

const getCities = async ({cities, delivery, req}) => {
  const cityObj = {};
  const countryObj = {};
  return await async.mapSeries(cities, async (item, callback) => {
    try {
      const city = {
        ...item,
        initialCityFrom: item.from,
        initialCityTo: item.to,
        initialCountryFrom: item.countryFrom,
        initialCountryTo: item.countryTo,
      };
      const isFromKz = isKz(item.countryFrom);
      const isToKz = isKz(item.countryTo);
      if (isFromKz && !city.from || !item.countryFrom && !city.from) {
        city.error = CITYFROMREQUIRED;
        return callback(null, city);
      }
      if (isToKz && !city.to || !item.countryTo && !city.to) {
        city.error = CITYTOREQUIRED;
        return callback(null, city);
      }
      const fromKey = city.from + city.countryFrom;
      const toKey = city.to + city.countryTo;
      if (cityObj[fromKey]) {
        city.fromJSON = { ...cityObj[fromKey] };
      } else {
        let result = await _getCity({city: city.from, country: city.countryFrom, delivery, req, isFrom: true, isKz: isFromKz});
        cityObj[fromKey] = result;
        if (!result.success && city.from && city.countryFrom && !isFromKz) {
          if (countryObj[city.countryFrom]) {
            result = { ...countryObj[city.countryFrom] };
          } else {
            result = await _getCity({country: city.countryFrom, delivery, req, isFrom: true, isKz: isFromKz});
            countryObj[city.countryFrom] = result;
          }
        }
        city.fromJSON = result;
      }
      if (cityObj[toKey]) {
        city.toJSON = { ...cityObj[toKey] };
      } else {
        let result = await _getCity({city: city.to, country: city.countryTo, delivery, req, isKz: isToKz});
        cityObj[toKey] = result;
        if (!result.success && city.to && city.countryTo && !isToKz) {
          if (countryObj[city.countryTo]) {
            result = { ...countryObj[city.countryTo] };
          } else {
            result = await _getCity({country: city.countryTo, delivery, req, isKz: isToKz});
            countryObj[city.countryTo] = result;
          }
        }
        city.toJSON = result;
      }
      callback(null, city);
    } catch(e) {
      callback(e);
    }
  });
};

const getCityName = (city) => {
  let result = city.title;
  if (city.cached_parent) {
    result += '. ' + city.cached_parent;
  }
  return result;
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
              from: getCityName(fromCity),
              to: getCityName(toCity),
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
  if (!json.min && !json.max) {
    return result;
  }
  const intMin = parseInt(json.min);
  const intMax = parseInt(json.max);
  if (isNaN(intMin) && isNaN(intMax)) {
    return result;
  }
  if (json.min && json.max && json.min != json.max) {
    result = `${json.min}-${json.max}`;
  } else {
    result = json.min || json.max;
  }
  return result;
};

const getPrice = (json) => {
  let result = json.price || 0;
  if (json.declared_value_fee) {
    result += parseFloat(json.declared_value_fee);
  }
  if (json.fuel_surplus) {
    result += parseFloat(json.fuel_surplus);
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
      for (let key of Object.keys(reqCopy)) {
        opts.uri += key + '=' + encodeURIComponent(reqCopy[key]) + '&';
      }
      const res = await requestWrapper({ req, ...opts });
      body = res.body;
    } catch(e) {}
    if (!body) {
      continue;
    }
    try {
      if (!body.calculation) {
        throw new Error(getTariffErrorMessage('Отсутствует параметр calculation'));
      }
      if (body.calculation.price) {
        request.tariffs.push(createTariff(
          `${service.title}`,
          getPrice(body.calculation),
          getDeliveryTime(body.calculation)
        ));
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

module.exports = async function ({ deliveryKey, weights, cities, req}) {
  const delivery = getOne(deliveryKey);
  let results = [];

  try {
    const citiesResults = await getCities({ cities, delivery, req });
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