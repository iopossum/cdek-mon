import { getOne, ponyCountryChanger, PONYCOUNTRIES } from '../../helpers/delivery';
import {
  shouldAbort,
  findInArray,
  randomTimeout
} from '../../helpers/common';
import {
  CITIESREQUIRED,
  CITYORCOUNTRYFROMREQUIRED,
  CITYORCOUNTRYREQUIRED,
  COUNTRYFROMNOTFOUND,
  CITYFROMORTORU,
  CITYFROMNOTFOUND,
  CITYTONOTFOUND,
  CITYFROMREQUIRED,
  CITYTOREQUIRED,
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
const moment = require('moment');

const getReq = (from, to, fromCountry, toCountry) => {
  return {
    send_to_email: 1,
    'tips[tips_iblock_code]': 'form_tips',
    'tips[tips_section_code]': 'pegas_by',
    'order[currency_code]': 'BYN',
    'default_country': 'Беларусь',
    'order[mode]': 'Calculation',
    'order[sender][region]': getRegionName(from, true) || '',
    'order[sender][district]': getDistrictName(from) || '',
    'order[recipient][region]':  getRegionName(to, true) || '',
    'order[recipient][district]': getDistrictName(to) || '',
    'order[cargo][0][weight]': 0,
    'order[cargo][0][description]': '',
    'order[cargo][0][packing]': 'Box',
    'order[cargo][0][dimensions][length]': 10,
    'order[cargo][0][dimensions][width]': 10,
    'order[cargo][0][dimensions][height]': 10,
    'order[cargo][0][cost]': '',
    'order[cargo][0][is_oversized]': 0,
    'order[cargo][0][is_dangerous]': 0,
    'order[sender][country]': fromCountry,
    'order[sender][city]': getCity(from),
    'order[recipient][country]': toCountry,
    'order[recipient][city]': getCity(to) || '',
    'order[hascargo]': 1,
    'box-select': 'Box',
    'order[pickup_date_now]': 1,
    'order[pickup_date]': moment().add(1, 'days').format('DD.MM.YYYY'),
    'order[documents][warranty_letter]': 0,
    'order[payment_type]': 'Cash',
    'order[payment_contract]': '',
    'order[payment_mode]': 'Sender',
    'order[sender][persons][0][name]': '',
    'order[sender][company]': '',
    'order[sender][persons][0][emails][0]': '',
    'order[sender][persons][0][phones][0]': '',
    'order[sender][street_type]': 'ул.',
    'order[sender][street]': '',
    'order[sender][house]': '',
    'order[sender][housing]': '',
    'order[sender][building]': '',
    'order[sender][flat]': '',
    'order[sender][postcode]': '',
    'order[recipient][persons][0][name]': '',
    'order[recipient][company]': '',
    'order[recipient][persons][0][emails][0]': '',
    'order[recipient][persons][0][phones][0]': '',
    'order[recipient][street_type]': 'ул.',
    'order[recipient][street]': '',
    'order[recipient][house]': '',
    'order[recipient][housing]': '',
    'order[recipient][building]': '',
    'order[recipient][flat]': '',
    'order[recipient][postcode]': ''
  }
};

const _getCity = async ({ city, delivery, req }) => {
  const trim = getCity(city);
  const result = {
    success: false,
  };
  let json;
  try {
    const opts = {...delivery.citiesUrl};
    opts.uri += encodeURIComponent(trim);
    const res = await requestWrapper({ format: 'text', req, ...opts });
    res.body = res.body.substring(1, res.body.length);
    json = JSON.parse(res.body);
  } catch(e) {}
  if (!json) {
    result.error = getCityJsonError('Изменился запрос', city);
    return result;
  }
  if (!Array.isArray(json)) {
    result.error = getCityJsonError("Неверный тип ответа", trim);
    return result;
  }
  json = json.map(v => ({name: v}));
  if (!json.length || !json[0]) { // [null]
    result.error = getCityNoResultError(trim);
  } else {
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
      result.items = founds.length ? founds.map(v => v.name).slice(0, 2) : json.map(v => v.name).slice(0, 2);
    }
  }
  return result;
};

const _getCountry = async ({ country, delivery, req }) => {
  const trim = getCity(country);
  const result = {
    success: false
  };
  let json;
  try {
    const opts = {...delivery.countriesUrl};
    opts.uri += encodeURIComponent(trim);
    const res = await requestWrapper({ format: 'text', req, ...opts });
    res.body = res.body.substring(1, res.body.length);
    json = JSON.parse(res.body);
  } catch(e) {}
  if (!json) {
    result.error = getCountriesError('Изменился запрос', city);
    return result;
  }
  if (!Array.isArray(json)) {
    result.error = getCountriesError("Неверный тип ответа", trim);
    return result;
  }
  json = json.map(v => ({name: v}));
  if (!json.length || !json[0]) { // [null]
    result.error = getCountryNoResultError(trim);
  } else {
    result.success = true;
    result.country = json[0];
  }
  return result;
};

const getCities = async ({ cities, delivery, req }) => {
  const cityObj = {};
  const countriesObj = {};
  return await async.mapSeries(cities, async (item, callback) => {
    try {
      const city = {
        ...item,
        countryFrom: ponyCountryChanger(item.countryFrom),
        countryTo: ponyCountryChanger(item.countryTo),
        initialCityFrom: item.from,
        initialCityTo: item.to,
        initialCountryFrom: item.countryFrom,
        initialCountryTo: item.countryTo,
      };
      if (!city.from) {
        city.error = CITYFROMREQUIRED;
        return callback(null, city);
      }
      if (item.countryFrom && PONYCOUNTRIES.indexOf(item.countryFrom.toLowerCase()) === -1) {
        city.error = `Доставка из данной страны невозможна`;
        return callback(null, city);
      }
      const isToInternational = item.countryTo && PONYCOUNTRIES.indexOf(item.countryTo.toLowerCase()) === -1;
      const countryFrom = city.countryFrom || 'Россия';
      const countryTo = city.countryTo || 'Россия';
      let countryFromJSON;
      let countryToJSON;
      if (countriesObj[countryFrom]) {
        countryFromJSON = { ...countriesObj[countryFrom] };
      } else {
        const result = await _getCountry({country: countryFrom, delivery, req});
        countriesObj[countryFrom] = result;
        countryFromJSON = result;
      }
      if (!countryFromJSON.success) {
        city.error = countryFromJSON.error;
        return callback(null, city);
      }
      if (countriesObj[countryTo]) {
        countryToJSON = { ...countriesObj[countryTo] };
      } else {
        const result = await _getCountry({country: countryTo, delivery, req});
        countriesObj[countryTo] = result;
        countryToJSON = result;
      }
      if (!countryToJSON.success) {
        city.error = countryToJSON.error;
        return callback(null, city);
      }
      const fromKey = city.from;
      const toKey = city.to;
      if (cityObj[fromKey]) {
        city.fromJSON = { ...cityObj[fromKey] };
      } else {
        const result = await _getCity({city: city.from, delivery, req});
        result.country = countryFromJSON.country.name;
        cityObj[fromKey] = result;
        city.fromJSON = result;
      }
      if (!isToInternational) {
        if (cityObj[toKey]) {
          city.toJSON = {...cityObj[toKey]};
        } else {
          const result = await _getCity({city: city.to, delivery, req});
          result.country = countryToJSON.country.name;
          cityObj[toKey] = result;
          city.toJSON = result;
        }
      } else {
        city.toJSON = {
          success: true,
          country: countryToJSON.country.name,
          items: ['']
        }
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
              from: fromCity,
              to: toCity,
            },
            req: getReq(fromCity, toCity, item.fromJSON.country, item.toJSON.country),
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
        req: {...item.req, 'order[cargo][0][weight]': weight * 1000},
        tariffs: []
      });
    });
  });
  return {requests, errors};
};

const getDeliveryTime = (json) => {
  let result = '';
  json = json || {};
  if (!json.MinTerm && !json.MaxTerm) {
    return result;
  }
  if (json.MinTerm && json.MaxTerm && json.MinTerm != json.MaxTerm) {
    result = `${json.MinTerm}-${json.MaxTerm}`;
  } else {
    result = json.MinTerm || json.MaxTerm;
  }
  return result;
};

const getCalcResults = async ({ request, delivery, req }) => {
  let body;
  try {
    const opts = { ...delivery.calcUrl };
    const formData = new URLSearchParams();
    for (let key of Object.keys(request.req)) {
      formData.append(key, request.req[key]);
    }
    request.req = {};
    opts.body = formData;
    const res = await requestWrapper({ req, ...opts, format: 'text' });
    body = JSON.parse(res.body);
  } catch(e) {}
  if (!body) {
    request.error = getTariffErrorMessage('Изменился запрос');
    return request;
  }
  if (!body.result) {
    request.error = getTariffErrorMessage('Изменился запрос. Отсутствует параметр result');
    return request;
  }
  if (typeof body.result.DeliveryRateSet === 'undefined') {
    request.error = getTariffErrorMessage('Изменился запрос. Отсутствует параметр result.DeliveryRateSet');
    return request;
  }
  try {
    if (body.result.DeliveryRateSet) {
      for (let key of Object.keys(body.result.DeliveryRateSet)) {
        request.tariffs.push({
          service: body.result.DeliveryRateSet[key].Description,
          cost: body.result.DeliveryRateSet[key].Sum,
          deliveryTime: getDeliveryTime(body.result.DeliveryRateSet[key])
        });
      }
    }
  } catch(e) {
    request.error = getTariffErrorMessage('Изменился запрос. Неверный формат result');
    return request;
  }
  if (!request.tariffs.length) {
    request.error = getNoResultError();
  }
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