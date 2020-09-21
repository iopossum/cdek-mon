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

const selectors = {
  tariffResults: '#TariffsTable tbody tr'
};

const services = [
  {title: 'ДД', req: {'additionalOption': 1}},
  {title: 'ДС', req: {'additionalOption': 2}},
  {title: 'СС', req: {'additionalOption': 4}},
  {title: 'СД', req: {'additionalOption': 3}},
];

const getReq = (from, to) => {
  from = from || {};
  to = to || {};
  return {
    senderType: 1,
    senderCountry: 'Беларусь',
    senderCity: from.value,
    senderRussianRegion: '',
    receiverCountry: 'Беларусь',
    receiverCity: to.value,
    receiverRussianRegion: '',
    deliveryType: 'on',
    senderCityId: from.id,
    receiverCityId: to.id,
    cargoType: 'Документы',
    cargoPlaceAmount: 1,
    cargoWeight: 1,
    palletsWeight: '',
    cargoLength: 1,
    cargoWidth: 1,
    cargoHeight: 1,
    volume: 0.000001,
    cargoLengthMax: '',
    cargoWidthMax: '',
    cargoHeightMax: '',
    metka: '',
    additionalOption: 1,
    postServiceCodes: 'EMPS',
    isCalculator: 1,
    postform: 'do',
    emailNotice: '',
    smsNotice: '',
    returnOfSignedDocuments: '',
    saturdayDelivery: '',
    customNotice: '',
    toPerson: '',
    codValue: '',
    codValuePost: '',
    declaredValue: '',
    declaredValuePost: '',
    investmentsInventory: ''
  }
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
    opts.uri += encodeURIComponent(trim);
    const res = await requestWrapper({ format: 'text', req, ...opts });
    json = JSON.parse(res.body);
  } catch(e) {}
  if (!json) {
    result.error = getCityJsonError('Изменилось API', city);
    return result;
  }
  if (!Array.isArray(json)) {
    result.error = getCityJsonError("Неверный тип данных в ответе", trim);
    return result;
  }
  json = findInArray(json, trim, 'value', true);
  const reg = new RegExp(trim + '?(.*) г.', 'gi');
  const exactlyReg = new RegExp(trim + ' г.', 'gi');
  json = json.filter(v => v.value.match(reg));
  let founds = json.filter(v => v.value.match(exactlyReg));
  if (founds.length) {
    result.success = true;
    result.items = founds.slice(0, 2);
    return result;
  }
  const region = getRegionName(city);
  const district = getDistrictName(city);
  if (region) {
    founds = findInArray(json, region, 'value');
    if (!founds.length) {
      result.error = getCityNoResultError(city);
      return result;
    }
  }
  if (district) {
    founds = findInArray(founds.length ? founds : json, district, 'value');
    if (!founds.length) {
      result.error = getCityNoResultError(city);
      return result;
    }
  }
  if (!json.length && !founds.length) {
    result.error = getCityNoResultError(trim);
  } else {
    result.success = true;
    result.items = founds.length ? founds.slice(0, 2) : json.slice(0, 1);
  }
  return result;
};

const getCities = async ({cities, delivery, req}) => {
  const cityObj = {};
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
      if (!isBy(item.countryFrom)) {
        city.error = CITIESBY;
        return callback(null, city);
      }
      if (!isBy(item.countryTo)) {
        item.error = CITIESBY;
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
      if (cityObj[toKey]) {
        city.toJSON = { ...cityObj[toKey] };
      } else {
        const result = await _getCity({city: city.to, country: city.countryTo, delivery, req});
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
              from: fromCity.value,
              to: toCity.value,
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
        req: {...item.req, cargoWeight: weight},
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
      opts.headers['Content-Type'] = 'application/x-www-form-urlencoded; charset=UTF-8';
      opts.body = formData;
      const res = await requestWrapper({ format: 'text', req, ...opts });
      body = res.body;
    } catch(e) {}
    if (!body) {
      continue;
    }
    try {
      body = JSON.parse(body);
      request.tariffs.push(createTariff(
        `${service.title} Документы ${body[0][1]}`,
        body[0][3],
        ''
      ));
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