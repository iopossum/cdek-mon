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

const getReq = (from, to, isCountry) => {
  return {
    'parcel[currency_id]': 4,
    'parcel[tips_iblock_code]': 'form_tips',
    'parcel[tips_section_code]': 'pegas',
    'parcel[direction]': isCountry ? 'outer' : 'inner',
    'parcel[from_country]': isCountry ? from : '',
    'parcel[from_city]': !isCountry ? from : '',
    'parcel[to_country]': isCountry ? to : '',
    'parcel[to_city]': !isCountry ? to : '',
    'parcel[weight]': 1,
    b_volume_l: '',
    b_volume_h: '',
    b_volume_w: '',
    c_volume_l: '',
    c_volume_d: '',
    t_volume_h: '',
    t_volume_b: '',
    t_volume_a: '',
    t_volume_c: '',
    'parcel[usecurrentdt]': 0,
    'parcel[kgo]': 0,
    'parcel[og]': 0,
    'parcel[isdoc]':0
  }
};

const _getCity = async ({ city, country, delivery, req }) => {
  const isCountry = !city;
  const entity = isCountry ? country : city;
  const trim = getCity(entity);
  const result = {
    city: entity,
    cityTrim: trim,
    success: false,
    isCountry
  };
  let json;
  try {
    const opts = isCountry ? {...delivery.countriesUrl} : {...delivery.citiesUrl};
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
  if (!json.length || !json[0]) { // [null]
    result.error = isCountry ? getCountryNoResultError(trim) : getCityNoResultError(trim);
  } else if (json.length === 1) {
    result.items = json;
    result.success = true;
  } else {
    const region = getRegionName(city);
    let founds = [];
    if (region) {
      founds = json.filter(v => new RegExp(region, 'gi').test(v));
    }
    result.items = founds.length ? founds.slice(0, 2) : json.slice(0, 2);
    result.success = true;
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
      if (!city.from && !city.countryFrom && !city.countryTo) {
        city.error = CITYORCOUNTRYFROMREQUIRED;
        return callback(null, city);
      }
      if (!city.to && !city.countryTo && !city.countryFrom) {
        city.error = CITYORCOUNTRYTOREQUIRED;
        return callback(null, city);
      }
      if (!city.countryFrom && !city.countryTo && !city.from && !city.to) {
        city.error = CITYORCOUNTRYREQUIRED;
        return callback(null, city);
      }
      const isFromSpecial = !city.countryFrom || city.countryFrom && PONYCOUNTRIES.indexOf(city.countryFrom.toLowerCase()) > -1;
      const isInternational = city.countryTo && PONYCOUNTRIES.indexOf(city.countryTo.toLowerCase()) === -1;
      if (city.countryFrom && !isFromSpecial) {
        city.error = `Доставка из указанной страны невозможна`;
        return callback(null, city);
      }
      if (isInternational) {
        city.fromJSON = {
          success: true,
          items: [city.countryFrom || 'Россия']
        };
        city.toJSON = {
          success: true,
          items: [city.countryTo]
        };
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
      if (isInternational) {
        if (countriesObj[toKey]) {
          city.toJSON = { ...countriesObj[toKey] };
        } else {
          const result = await _getCity({country: city.countryTo, delivery, req});
          countriesObj[toKey] = result;
          city.toJSON = result;
        }
      } else {
        if (cityObj[toKey]) {
          city.toJSON = { ...cityObj[toKey] };
        } else {
          const result = await _getCity({city: city.to, country: city.countryTo, delivery, req});
          cityObj[toKey] = result;
          city.toJSON = result;
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
            req: getReq(fromCity, toCity, item.toJSON.isCountry),
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
        req: {...item.req, 'parcel[weight]': weight},
        tariffs: []
      });
    });
  });
  return {requests, errors};
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
  if (typeof body.result.calculation !== 'undefined' && !body.result.calculation) {
    request.error = getNoResultError();
    return request;
  }
  try {
    for (let key of Object.keys(body.result)) {
      request.tariffs.push({
        service: body.result[key].servise,
        cost: body.result[key].tariffvat,
        deliveryTime: body.result[key].delivery
      });
    }
  } catch(e) {
    request.error = getTariffErrorMessage('Изменился запрос. Неверный формат result');
    return request;
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