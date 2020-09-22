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
  isKz, CITYFROMKZ
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

const MSK_CODE = '000013';

const selectors = {
  countryOption: '#toCountries option'
};

const grtServiceName = (to, country) => {
  let result = 'экспресс отправления по РК';
  if (country) {
    result = to.key == MSK_CODE ? 'доставка в г. Москва' : 'экспресс отправления по РК';
  }
  return result;
};

const getReq = (from, to, country) => {
  from = from || {};
  to = to || {};
  return {
    Path: 'calc',
    Controller: 'getAmountV2',
    FromCountryCode: '0001',
    FromLocalCode: from.LocalCode,
    ToCountryCode: country ? country.id : '0001',
    ToLocalCode: country ? to.key : to.LocalCode,
    ServiceLocalCode: country && to.key == MSK_CODE ? 'MOW' : 'E',
    Weight: 1,
    service: grtServiceName(to, country)
  }
};

const _getCity = ({ city, entities, country }) => {
  const trim = getCity(city);
  const isInternational = !!country;
  const result = {
    success: false,
    isInternational,
    country
  };
  const region = getRegionName(city);
  const json = findInArray(entities, trim, isInternational ? 'value' : 'LocalityName', true);
  let founds = [];
  if (!isInternational && region) {
    founds = findInArray(json, region, 'Region');
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

const getCities = async ({ cities, delivery, req, localCities, localCitiesInt, countries }) => {
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
      const isFromKz = isKz(item.countryFrom);
      const isToKz = isKz(item.countryTo);
      const countryTo = item.countryTo || 'Россия';
      if (!isFromKz) {
        city.error = CITYFROMKZ;
        return callback(null, city);
      }
      if (!isToKz) {
        if (!Object.keys(countries).length) {
          city.error = getCountriesError('Изменилось API');
          return callback(null, city);
        }
        if (!countries[countryTo.toUpperCase()]) {
          city.error = COUNTRYTONOTFOUND;
          return callback(null, city);
        }
        if (!localCitiesInt.length) {
          city.error = getCityJsonError('Изменилось API');
          return callback(null, city);
        }
        city.fromJSON = _getCity({ city: city.from, entities: localCitiesInt });
        city.toJSON = _getCity({ city: city.to, entities: countries[countryTo.toUpperCase()].items, country: countries[countryTo.toUpperCase()] });
      } else {
        if (!localCities.length) {
          city.error = getCityJsonError('Изменилось API');
          return callback(null, city);
        }
        city.fromJSON = _getCity({ city: city.from, entities: localCities });
        city.toJSON = _getCity({ city: city.to, entities: localCities });
      }
      callback(null, city);
    } catch(e) {
      callback(e);
    }
  });
};

const getCityName = (city) => {
  let result = city.LocalityName;
  if (city.Region) {
    result += ', ' + city.Region;
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
              to: item.toJSON.isInternational ? toCity.value : getCityName(toCity),
            },
            req: getReq(fromCity, toCity, item.toJSON.country),
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
        req: {...item.req, 'Weight': weight },
        tariffs: []
      });
    });
  });
  return {requests, errors};
};

const getCalcResults = async ({ request, delivery, req }) => {
  let body;
  const service = request.req.service;
  try {
    const opts = {...delivery.calcUrl};
    const formData = new URLSearchParams();
    delete request.req.service;
    for (let key of Object.keys(request.req)) {
      formData.append(key, request.req[key]);
    }
    request.req = {};
    opts.body = formData;
    const res = await requestWrapper({req, ...opts, format: 'text'});
    body = JSON.parse(res.body);
  } catch (e) {
  }
  if (!body) {
    request.error = getTariffErrorMessage('Изменилось API');
    return request;
  }
  if (body.AmountPlusFactors) {
    request.tariffs.push({
      service,
      cost: body.AmountPlusFactors,
      deliveryTime: ''
    });
  }
  if (!request.tariffs.length) {
    request.error = getNoResultError();
  }
  return request;
};

const getInitialCities = async ({ delivery, req }) => {
  const requests = [
    { key: 'localCities', req: { Path: 'catalog', Controller: 'getCitiesByCountry', CountryLocalCode: '0001' } },
    { key: 'localCitiesInt', req: {  Path: 'catalog', Controller: 'getStation' } }
  ];
  const result = {
    localCities: [],
    localCitiesInt: []
  };
  for (let request of requests) {
    const opts = { ...delivery.citiesUrl };
    const formData = new URLSearchParams();
    for (let key of Object.keys(request.req)) {
      formData.append(key, request.req[key]);
    }
    opts.body = formData;
    try {
      const { body } = await requestWrapper({ format: 'text', req, ...opts });
      result[request.key] = JSON.parse(body);
    } catch (e) {}
  }
  return result;
};

const getCountries = async ({ delivery, req }) => {
  const opts = { ...delivery.countriesUrl };
  let countriesObj = {};
  try {
    const { body } = await requestWrapper({ format: 'text', req, ...opts });
    const $ = cheerio.load(body);
    const options = Array.from($(selectors.countryOption)).map(v => ({ id: $(v).attr('value'), name: $(v).text().trim() }));
    for (let option of options) {
      const reg = new RegExp('var Cities_' + option.id + ' = ([^;]*);', 'i');
      const match = body.match(reg);
      if (match && match[1]) {
        const result = match[1].replace(/key/g, '"key"').replace(/value/g, '"value"');
        countriesObj[option.name] = { id: option.id, items: JSON.parse(result) };
      }
    }
  } catch (e) {}
  if (countriesObj['РОССИЯ']) {
    countriesObj['РОССИЯ'].items = countriesObj['РОССИЯ'].items || [];
    countriesObj['РОССИЯ'].items.push({ key: MSK_CODE, value: 'Москва' });
  }
  return countriesObj;
};

module.exports = async function ({ deliveryKey, weights, cities, req}) {
  const delivery = getOne(deliveryKey);
  let results = [];

  try {
    const initialCities = await getInitialCities({ delivery, req });
    if (shouldAbort(req)) {
      throw new Error('abort');
    }
    const countries = await getCountries({ delivery, req });
    if (shouldAbort(req)) {
      throw new Error('abort');
    }
    const citiesResults = await getCities({ cities, delivery, req, ...initialCities, countries });
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