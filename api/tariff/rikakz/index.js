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
  isKz,
  CITYFROMKZ,
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
  countryFromOption: '#city_from_resul .asd_si_result_item',
  countryToOption: '#city_to_resul .asd_si_result_item',
  tariffs: '.center_content form + h3'
};

const services = [
  {title: 'документы', req: {world_type: 'doc'}},
  {title: 'посылка', req: {world_type: 'post'}},
];

const getReq = (from, to, token) => {
  from = from || {};
  to = to || {};
  return {
    go: 'yes',
    sessid: token,
    city_from_input: from.name,
    city_from: from.id,
    city_to_input: to.name,
    city_to: to.id,
    world_type: 'post',
    massa: 1,
    size_1: '',
    size_2: '',
    size_3: '',
    vmassa2: 0,
    submit: 'Расчитать стоимость доставки'
  };
};

const _getCity = ({ country, entities }) => {
  const trim = getCity(country);
  const result = {
    success: false
  };
  const json = findInArray(entities, trim, 'name');
  if (!json.length) {
    result.error = getCountryNoResultError(trim);
  } else {
    result.success = true;
    result.items = json.slice(0, 1);
  }
  return result;
};

const getCities = async ({ cities, countriesFrom, countriesTo }) => {
  return await async.mapSeries(cities, (item, callback) => {
    try {
      const city = {
        ...item,
        countryFrom: item.countryFrom || 'Россия',
        countryTo: item.countryTo || 'Россия',
        initialCityFrom: item.from,
        initialCityTo: item.to,
        initialCountryFrom: item.countryFrom,
        initialCountryTo: item.countryTo,
      };
      city.fromJSON = _getCity({ country: city.countryFrom, entities: countriesFrom });
      city.toJSON = _getCity({ country: city.countryTo, entities: countriesTo });
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
              from: fromCity.name,
              to: toCity.name,
            },
            req: getReq(fromCity, toCity, token),
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
        req: {...item.req, massa: weight},
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
    const opts = {...delivery.calcUrl};
    const reqCopy = {...request.req, ...service.req };
    try {
      const formData = new URLSearchParams();
      for (let key of Object.keys(reqCopy)) {
        formData.append(key, reqCopy[key]);
      }
      opts.headers = {
        ...opts.headers,
        Host: 'rika.kz',
        Origin: 'http://rika.kz',
        Referer: 'http://rika.kz/calc/',
      };
      opts.body = formData;
      const res = await requestWrapper({format: 'text', req, ...opts});
      body = res.body;
    } catch (e) {
      errors.push(getTariffErrorMessage('Изменился контент сайта'));
    }
    if (!body) {
      continue;
    }
    try {
      const $ = cheerio.load(body);
      if ($(selectors.tariffs).length) {
        const text = $(selectors.tariffs).text().trim();
        if (/стоимость/gi.test(text)) {
          const price = text.replace(COSTREG, '');
          if (price) {
            request.tariffs.push(createTariff(
              service.title,
              price,
              ''
            ));
          }
        }
      }
    } catch (e) {
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
  const opts = {...delivery.countriesUrl};
  const { response, body } = await requestWrapper({format: 'text', req, ...opts});
  const result = {
    countriesFrom: [],
    countriesTo: []
  };
  const $ = cheerio.load(body);
  try {
    const from = $(selectors.countryFromOption);
    from.each((index, item) => {
      result.countriesFrom.push({id: $(item).attr('id').replace('city_from_res', ''), name: $(item).text().trim().toUpperCase()});
    });
    const to = $(selectors.countryToOption);
    to.each((index, item) => {
      result.countriesTo.push({id: $(item).attr('id').replace('city_to_res', ''), name: $(item).text().trim().toUpperCase()});
    });
    const reg = /bitrix_sessid':'([^']*)'/;
    const match = body.match(reg);
    result.token = match[1];
  } catch(e) {}
  if (!result.token) {
    throw new Error(getResponseError('Не удалось получить token.'));
  }
  if (!result.countriesFrom.length) {
    throw new Error(getCountriesError(`Контент сайта изменился. Искали ${selectors.countryFromOption}`));
  }
  if (!result.countriesTo.length) {
    throw new Error(getCountriesError(`Контент сайта изменился. Искали ${selectors.countryToOption}`));
  }
  return result;
};

module.exports = async function ({ deliveryKey, weights, cities, req}) {
  const delivery = getOne(deliveryKey);
  let results = [];

  try {
    const initialData = await getToken({ delivery, req });
    if (shouldAbort(req)) {
      throw new Error('abort');
    }
    const citiesResults = await getCities({ cities, delivery, req, ...initialData });
    if (shouldAbort(req)) {
      throw new Error('abort');
    }
    const {requests, errors} = getRequests({ deliveryKey, cities: citiesResults, weights, ...initialData });
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