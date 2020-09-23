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
  cityFromOption: 'select[name="from"] option',
  cityToOption: 'select[name="to"] option',
  countryOption: 'select[name="to"] option',
  tariffs: '.context h1'
};

const services = [
  {title: 'ДД', req: {tos: {from: "doors", to: "doors"}}},
  {title: 'СД', req: {tos: {from: "office", to: "doors"}, service: 3}},
  {title: 'ДС', req: {tos: {from: "doors", to: "office"}, service: 3}},
  {title: 'СС', req: {tos: {from: "office", to: "office"}, service: 1}},
];

const services2 = [
  {title: 'Стандарт', req: {rate: 'standart'}},
  {title: 'Экспресс', req: {rate: 'express'}},
];

const services3 = [
  {title: 'Посылки, грузы', req: {type: 'tare', declared: 10000}},
  {title: 'Документы', req: {type: 'docs', declared: 1000, estimated: 0.1}},
];

const getReq = (from, to) => {
  from = from || {};
  to = to || {};
  return {
    "route": {
      "from": from,
      "to": to
    },
    "tos":{
      "from":"doors",
      "to":"doors"
    },
    "load":"parcel",
    "rate":"standart",
    "type":"tare",
    "fizjur":"fiz",
    "clientId":"",
    "length": 30,
    "width": 22,
    "height": 7,
    "weight": 1,
    "volumetric": 0.924,
    "estimated": 1,
    "declared": 10000,
    "parts": 1,
    "zone": 0,
    "service": 5
  };
};

const _getCity = ({ city, entities }) => {
  const trim = getCity(city);
  const result = {
    success: false
  };
  const region = getRegionName(city);
  let founds = [];
  const json = findInArray(entities, trim, 'value', true);
  if (region) {
    founds = findInArray(json, region, 'region');
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
      const isFromKz = isKz(item.countryFrom);
      const isToKz = isKz(item.countryTo);
      if (!city.to) {
        city.error = CITYTOREQUIRED;
        return callback(null, city);
      }
      if (!city.from) {
        city.error = CITYFROMREQUIRED;
        return callback(null, city);
      }
      if (!isFromKz) {
        city.error = CITYFROMKZ;
        return callback(null, city);
      }
      if (!isToKz) {
        city.error = CITYFROMKZ;
        return callback(null, city);
      }
      city.fromJSON = _getCity({ city: city.from, entities: initialCities });
      city.toJSON = _getCity({ city: city.to, entities: initialCities });
      callback(null, city);
    } catch(e) {
      callback(e);
    }
  });
};

const getCityName = (city) => {
  let result = city.display;
  if (city.region) {
    result = `${result}, ${city.region}`;
  }
  return result;
};

const getPrice = (body, req) => {
  let base = parseFloat(body.price);
  if (isNaN(base)) {
    base = 0;
  }
  base += Math.round(base * 0.1); // Топливный сбор
  base += Math.round(.007 * req.declared); // Комиссия
  return base;
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
        req: {...item.req, weight, estimated: weight},
        tariffs: []
      });
    });
  });
  return {requests, errors};
};

const getCalcResults = async ({ request, delivery, req }) => {
  const errors = [];
  const filteredServices = [services[0]];
  if (!request.req.route.from.can_be_sent) {
    request.error = getNoResultError();
    return request;
  }
  if (request.req.route.from.office) {
    filteredServices.push(services[1]);
  }
  if (request.req.route.to.office) {
    filteredServices.push(services[2]);
  }
  if (request.req.route.from.office && request.req.route.to.office) {
    filteredServices.push(services[3]);
  }
  for (let service of filteredServices) {
    for (let service2 of services2) {
      for (let service3 of services3) {
        let body;
        const opts = {...delivery.calcUrl};
        const reqCopy = {...request.req, ...service.req, ...service2.req, ...service3.req };
        if (service2.req.rate === 'express') {
          if (['СД', 'ДС'].indexOf(service.title) > -1) {
            reqCopy.service = 4;
          }
          if (['ДД'].indexOf(service.title) > -1) {
            reqCopy.service = 6;
          }
          if (['СС'].indexOf(service.title) > -1) {
            reqCopy.service = 2;
          }
        }
        try {
          opts.body = JSON.stringify(reqCopy);
          const res = await requestWrapper({req, ...opts});
          body = res.body;
        } catch (e) {
          errors.push(getTariffErrorMessage('Изменилось api'));
        }
        if (!body) {
          continue;
        }
        if (body.result !== 'success') {
          continue;
        }
        try {
          request.tariffs.push(createTariff(
            `${service.title} ${service2.title} ${service3.title}`,
            getPrice(body, reqCopy),
            body.maxdeliverydays || ''
          ));
        } catch (e) {
          errors.push(e.message);
        }
      }
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
    if (!Array.isArray(body)) {
      throw 1;
    }
    return body;
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