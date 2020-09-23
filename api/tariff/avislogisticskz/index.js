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
const moment = require('moment');

const selectors = {
  tariffResults: '#tariffTable tbody tr'
};

const services = [
  {title: 'Документы', req: {'Content': 1}},
  {title: 'Посылка', req: {'Content': 2}},
];

const getReq = (from, to, countryFrom, countryTo) => {
  from = from || {};
  to = to || {};
  return {
    CityFrom: from.id,
    CountryFrom: countryFrom.id,
    DicCityFrom: from.name,
    DicCountryFrom: countryFrom.name,
    CityTo: to.id,
    CountryTo: countryTo.id,
    DicCityTo: to.name,
    DicCountryTo: countryTo.name,
    StartCalculating: moment().format('DD/MM/YYYY HH:mm:ss'),
    Content: 1,
    ActualWeight: 2,
    VolumeWeight: '',
    radius: '',
    height: '',
    long: '',
    width: '',
  }
};

const _getCity = ({ city, country }) => {
  const trim = getCity(city);
  const result = {
    ...country,
    success: false,
  };
  const region = getRegionName(city);
  const json = findInArray(country.items, trim, 'name', true);
  let founds = [];
  if (region) {
    founds = findInArray(json, region, 'name');
  }
  if (!founds.length) {
    founds = findInArray(json, '(прочие)', 'name');
  }
  if (!json.length && !founds.length) {
    result.error = getCityNoResultError(trim);
  } else {
    result.success = true;
    result.items = founds.length ? founds.slice(0, 2) : json.slice(0, 2);
  }
  return result;
};

const _getCityByCountry = async ({ country, delivery, req }) => {
  const result = {
    ...country,
    success: false,
    items: [],
  };
  let json;
  try {
    const opts = { ...delivery.citiesUrl };
    const formData = new URLSearchParams();
    formData.append('countryFrom', country.id);
    opts.body = formData;
    const res = await requestWrapper({ req, ...opts });
    json = res.body;
  } catch(e) {}
  if (json && Array.isArray(json)) {
    if (!json.length) {
      result.error = getCityJsonError('В указанной стране нет доступных городов');
    } else {
      result.success = true;
      result.items = json;
    }
  } else {
    result.error = getCityJsonError('Неверные данные в ответе от сервера');
  }
  return result;
};

const getCities = async ({ cities, delivery, req, countries }) => {
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
      if (!city.from) {
        city.error = CITYFROMREQUIRED;
        return callback(null, city);
      }
      if (!city.to) {
        city.error = CITYTOREQUIRED;
        return callback(null, city);
      }
      const countryFrom = city.countryFrom || 'Россия';
      const countryTo = city.countryTo || 'Россия';
      const foundFromCountries = findInArray(countries, getCity(countryFrom), 'name');
      if (!foundFromCountries.length) {
        city.error = getCountryNoResultError(countryFrom);
        return callback(null, city);
      }
      const foundToCountries = findInArray(countries, getCity(countryTo), 'name');
      if (!foundToCountries.length) {
        city.error = getCountryNoResultError(countryTo);
        return callback(null, city);
      }
      if (!countryObj[foundFromCountries[0].id]) {
        countryObj[foundFromCountries[0].id] = await _getCityByCountry({ delivery, req, country: foundFromCountries[0] });
      }
      if (!countryObj[foundFromCountries[0].id].success) {
        city.error = countryObj[foundFromCountries[0].id].error;
        return callback(null, city);
      }
      if (!countryObj[foundToCountries[0].id]) {
        countryObj[foundToCountries[0].id] = await _getCityByCountry({ delivery, req, country: foundToCountries[0] });
      }
      if (!countryObj[foundToCountries[0].id].success) {
        city.error = countryObj[foundToCountries[0].id].error;
        return callback(null, city);
      }
      city.fromJSON = _getCity({ city: city.from, country: countryObj[foundFromCountries[0].id] });
      city.toJSON = _getCity({ city: city.to, country: countryObj[foundToCountries[0].id] });
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
            req: getReq(fromCity, toCity, item.fromJSON, item.toJSON),
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
        req: {...item.req, 'ActualWeight': weight},
        tariffs: []
      });
    });
  });
  return {requests, errors};
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
      const res = await requestWrapper({ format: 'text', req, ...opts });
      body = res.body;
    } catch(e) {}
    if (!body) {
      continue;
    }
    try {
      const $ = cheerio.load(body);
      const trs = $(selectors.tariffResults);
      trs.each(function (index, tr) {
        const tds = $(tr).find('td');
        const deliveryTime = $(tds[3]).text().trim();
        request.tariffs.push(createTariff(
          `${service.title} ${$(tds[1]).text().trim()}`,
          $(tds[2]).text().trim().replace(COSTREG, ''),
          deliveryTime.replace('по', '-').replace(DELIVERYTIMEREG, '')
        ));
      });
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

const getCountries = async ({ delivery, req }) => {
  const opts = { ...delivery.countriesUrl };
  try {
    const res = await requestWrapper({ req, ...opts });
    if (!res.body.length) {
      throw 1;
    }
    return res.body;
  } catch (e) {
    throw new Error(getCountriesError('Изменилось API'));
  }
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