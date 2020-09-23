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
  countryOption: '.pseudo_selector .pseudo_selections a',
  tariffNoResults: '#calc_noservices_message_container',
  tariffResults: 'table#calc_result_table tr'
};

const services = [
  {title: 'ДД', req: {'form.cityPickupType': 0, 'form.cityDeliveryType': 0}, intReq: {'pickupCityType': 'Д', 'deliveryCityType': 'Д'}},
  {title: 'ДС', req: {'form.cityPickupType': 0, 'form.cityDeliveryType': 1}, intReq: {'pickupCityType': 'Д', 'deliveryCityType': 'Т'}},
  {title: 'СС', req: {'form.cityPickupType': 1, 'form.cityDeliveryType': 1}},
  {title: 'СД', req: {'form.cityPickupType': 1, 'form.cityDeliveryType': 0}, intReq: {'pickupCityType': 'Т', 'deliveryCityType': 'Д'}},
];

const getReq = (from, to) => {
  from = from || {};
  to = to || {};
  return {
    'method:calc': '',
    direction: '',
    'form.cityPickupId': from.id,
    'form.cityDeliveryId': to.id,
    'form.cityPickupCountryCode': from.countryCode ? from.countryCode.toLowerCase() : '',
    'form.cityDeliveryCountryCode': to.countryCode ? to.countryCode.toLowerCase() : '',
    'form.cityPickupNameFull': from.name,
    'form.cityDeliveryNameFull': to.name,
    'form.cityPickupNameTotal': from.name,
    'form.cityDeliveryNameTotal': to.name,
    'serverCountryCode': 'ru',
    'form.cityPickupName': from.name,
    'form.cityPickupType': 0,
    'form.cityDeliveryName': to.name,
    'form.cityDeliveryType': 0,
    'form.weightStr': 1,
    'form.volumeStr': '',
    'form.parcelLimits.maxLength': 350,
    'form.parcelLimits.maxWidth': 160,
    'form.parcelLimits.maxHeight': 180,
    'form.parcelLimits.maxWeight': 1000,
    'form.declaredCostStr': '',
    'form.maxDeclaredCost': 30000000,
    'form.deliveryPeriodId': 191696130
  };
};

const _getCity = async ({ city, country = 'Россия', cookie, delivery, req }) => {
  const trim = getCity(city);
  const result = {
    cityTrim: trim,
    success: false
  };
  let json;
  try {
    const opts = { ...delivery.citiesUrl };
    const formData = new URLSearchParams();
    formData.append('name_startsWith', trim.toLowerCase());
    formData.append('country', 'RU');
    opts.body = formData;
    opts.headers = {
      ...opts.headers,
      'Cookie': cookie
    };
    const res = await requestWrapper({ req, ...opts });
    json = res.body;
  } catch(e) {}
  if (!json) {
    result.error = getCityJsonError('Изменился запрос', city);
    return result;
  }
  if (!json.geonames) {
    result.error = getCityJsonError("Отсутствует geonames в ответе", trim);
    return result;
  }
  if (!Array.isArray(json.geonames)) {
    result.error = getCityJsonError("Неверный тип geonames в ответе", trim);
    return result;
  }
  json.geonames = findInArray(json.geonames, trim, 'name', true);
  json.geonames = findInArray(json.geonames, country, 'countryName', false)
  const region = getRegionName(city);
  const district = getDistrictName(city);
  let founds = [];
  if (region) {
    founds = findInArray(json.geonames, region, 'reg');
    if (!founds.length) {
      result.error = getCityNoResultError(city);
      return result;
    }
  }
  if (district) {
    founds = findInArray(founds.length ? founds : json.geonames, district, 'dist');
    if (!founds.length) {
      result.error = getCityNoResultError(city);
      return result;
    }
  }
  if (!json.geonames.length && !founds.length) {
    result.error = getCityNoResultError(trim);
  } else {
    result.success = true;
    result.items = founds.length ? founds.slice(0, 2) : json.geonames.slice(0, 1);
  }
  return result;
};

const getCities = async ({ cities, delivery, req, cookie }) => {
  const cityObj = {};
  return await async.mapSeries(cities, async (item, callback) => {
    try {
      const city = {
        ...item,
        countryFrom: dpdCountryChanger(item.countryFrom),
        countryTo: dpdCountryChanger(item.countryTo),
        initialCityFrom: item.from,
        initialCityTo: item.to,
        initialCountryFrom: item.countryFrom,
        initialCountryTo: item.countryTo,
      };
      if (!city.from || !city.to) {
        city.error = CITIESREQUIRED;
        return callback(null, city);
      }
      const fromKey = city.from + city.countryFrom;
      const toKey = city.to + city.countryTo;
      if (cityObj[fromKey]) {
        city.fromJSON = { ...cityObj[fromKey] };
      } else {
        const result = await _getCity({city: city.from, country: city.countryFrom, delivery, req, cookie});
        cityObj[fromKey] = result;
        city.fromJSON = result;
      }
      if (cityObj[toKey]) {
        city.toJSON = { ...cityObj[toKey] };
      } else {
        const result = await _getCity({city: city.to, country: city.countryTo, delivery, req, cookie});
        cityObj[toKey] = result;
        city.toJSON = result;
      }
      callback(null, city);
    } catch(e) {
      callback(e);
    }
  });
};

const getCityName = (city) => {
  let result = '';
  if (city.abbr) {
    result += city.abbr + '. ';
  }
  if (city.name) {
    result += city.name;
  }
  if (city.dist) {
    result += ', ' + city.dist;
  }
  if (city.reg) {
    result += ', ' + city.reg;
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
        req: {...item.req, 'form.weightStr': weight},
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
    let body;
    try {
      const opts = { ...delivery.calcUrl };
      const formData = new URLSearchParams();
      const reqCopy = {...request.req, ...service.req};
      for (let key of Object.keys(reqCopy)) {
        formData.append(key, reqCopy[key]);
      }
      opts.body = formData;
      opts.headers = {
        ...opts.headers,
        'Cookie': cookie
      };
      const res = await requestWrapper({ req, ...opts, format: 'text' });
      body = res.body;
    } catch(e) {}
    if (!body) {
      continue;
    }
    try {
      const $ = cheerio.load(body);
      if ($(selectors.tariffNoResults).length && $(selectors.tariffNoResults).css('display') !== 'none') {
        continue;
      }
      const trs = $(selectors.tariffResults);
      trs.each(function (index, tr) {
        if (index !== 0 && index !== trs.length - 1) {
          const tds = $(tr).find('td');
          if (tds.length) {
            tariffs.push({
              service: `${service.title} ${$(tr).find('input[name="name"]').val()}`,
              cost: $(tr).find('input[name="cost"]').val(),
              deliveryTime: $(tr).find('input[name="days"]').val()
            });
          }
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

const getCookie = async ({ delivery, req }) => {
  const opts = {...delivery.countriesUrl};
  const { response, body } = await requestWrapper({format: 'text', req, ...opts});
  let cookie;
  try {
    cookie = response.headers.get('set-cookie').split(';')[0];
  } catch (e) {}
  if (!cookie) {
    throw new Error(getResponseError('Не удалось получить cookie.'));
  }
  return cookie;
};

module.exports = async function ({ deliveryKey, weights, cities, req}) {
  const delivery = getOne(deliveryKey);
  let results = [];

  try {
    const cookie = await getCookie({ delivery, req });
    if (shouldAbort(req)) {
      throw new Error('abort');
    }
    console.log(cookie);
    throw 1;
    const citiesResults = await getCities({ cities, delivery, req, cookie });
    if (shouldAbort(req)) {
      throw new Error('abort');
    }
    const {requests, errors} = getRequests({ deliveryKey, cities: citiesResults, weights });
    results = results.concat(errors);
    for (let request of requests) {
      if (shouldAbort(req)) {
        break;
      }
      results.push(await getCalcResults({ request, cookie, delivery, req }));
    }
  } catch(error) {
    results = allResultsError({ deliveryKey, weights, cities, error });
  }

  return results;

};