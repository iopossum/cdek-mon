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

const getReq = (from, to) => {
  from = from || {};
  to = to || {};
  /*if (from.guid === '0c5b2444-70a0-4932-980c-b4dc0d3f02b5') {//Москва
    from.streetId = 'b30b63a1-c2be-4efc-9d0c-c9b6d7438e15';
    from.streetTitle = "Арбат ул";
    from.house = 1;
  } else if (from.guid === 'c2deb16a-0330-4f05-821f-1d09c93331e6') {//Спб
    from.streetId = 'f88e9ba3-ac55-4e4a-a164-b7e3a47b6ff4';
    from.streetTitle = "Садовая ул";
    from.house = 56;
  }
  if (to.guid === '0c5b2444-70a0-4932-980c-b4dc0d3f02b5') {//Москва
    to.streetId = 'b30b63a1-c2be-4efc-9d0c-c9b6d7438e15';
    to.streetTitle = "Арбат ул";
    to.house = 1;
  } else if (from.guid === 'c2deb16a-0330-4f05-821f-1d09c93331e6') {//Спб
    from.streetId = 'f88e9ba3-ac55-4e4a-a164-b7e3a47b6ff4';
    from.streetTitle = "Садовая ул";
    from.house = 56;
  }*/
  return {
    id: new Date().getTime(),
    'from[guid]': from.guid,
    'from[title]': from.title,
    'from[delivery]': 1,
    'from[street]': '',
    'from[street_title]': '',
    'from[house]': '',
    'from[housing]': '',
    'from[building]': '',
    'from[apartment]': '',
    'from[interval]': '09:00-18:00',
    'to[guid]': to.guid,
    'to[title]': to.title,
    'to[delivery]': 1,
    'to[hypermarket]': 0,
    'to[street]': '',
    'to[street_title]': '',
    'to[house]': '',
    'to[housing]': '',
    'to[building]': '',
    'to[apartment]': '',
    'to[interval]': '09:00-18:00',
    'to[fixed]': 0,
    'cargo[0][type]': '',
    'cargo[0][typeval]': '',
    'cargo[0][weight]': 1,
    'cargo[0][volume]': 0.01,
    'cargo[0][length]': 0.5,
    'cargo[0][width]': 0.2,
    'cargo[0][height]': 0.1,
    'cargo[0][oversized]': 0,
    'cargo[0][units]': 1,
    'cargo[0][pack][crate]': 0,
    'cargo[0][pack][pallet_board_i]': 0,
    'cargo[0][pack][pallet]': 0,
    'cargo[0][pack][sealed_pallet]': 0,
    'cargo[0][pack][bubble_wrap]': 0,
    'cargo[0][pack][big_bag]': 0,
    'cargo[0][pack][small_bag]': 0,
    'cargo[0][pack][medium_bag]': 0,
    'transport_type[]': 'avia',
    insurance: 0,
    cargo_docs: 0,
    return_docs: 0,
    no_cache: 0,
    mto: 0,
    source: 'calc'
  };
};

const _getCity = async ({ city, country, delivery, req }) => {
  const trim = getCity(city);
  const result = {
    cityTrim: trim,
    success: false
  };
  let json;
  try {
    const opts = {...delivery.citiesUrl};
    opts.uri += encodeURIComponent(trim);
    opts.headers['X-Requested-With'] = 'XMLHttpRequest';
    const res = await requestWrapper({ format: 'text', req, ...opts });
    json = JSON.parse(res.body);
  } catch(e) {}
  if (!json) {
    result.error = getCityJsonError('Изменился запрос', city);
    return result;
  }
  if (!Array.isArray(json)) {
    result.error = getCityJsonError("Неверный тип данных в ответе", trim);
    return result;
  }
  json = findInArray(json, trim, 'name', true);
  if (country) {
    json = findInArray(json, country, 'parents');
    if (!json.length) {
      result.error = getCityNoResultError(trim);
      return result;
    }
  }
  const region = getRegionName(city);
  const district = getDistrictName(city);
  let founds = [];
  if (region) {
    founds = findInArray(json, region, 'parents');
    if (!founds.length) {
      result.error = getCityNoResultError(city);
      return result;
    }
  }
  if (district) {
    founds = findInArray(founds.length ? founds : json, district, 'parents');
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

const getCityName = (city) => {
  let result = city.title;
  if (city.parents) {
    result = `${result}, ${city.parents}`;
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
        req: {...item.req, 'cargo[0][weight]': weight},
        tariffs: []
      });
    });
  });
  return {requests, errors};
};

const getCalcResults = async ({ request, delivery, req }) => {
  let body;
  try {
    const opts = {...delivery.calcUrl};
    const formData = new URLSearchParams();
    for (let key of Object.keys(request.req)) {
      formData.append(key, request.req[key]);
    }
    opts.body = formData;
    opts.headers = {
      ...opts.headers,
      origin: 'https://www.baikalsr.ru',
      referer: 'https://www.baikalsr.ru/tools/calculator/',
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
    };
    const res = await requestWrapper({ format: 'text', req, ...opts });
    body = JSON.parse(res.body);
  } catch(e) {
    request.error = getTariffErrorMessage('Изменилось API сайта');
  }
  request.req = {};
  if (!body) {
    return request;
  }
  if (body.error) {
    request.error = body.error;
    return request;
  }
  try {
    let resultAvto = 0;
    let resultAvia = 0;
    if (body.insurance && body.insurance.int) {
      resultAvto += body.insurance.int;
      resultAvia += body.insurance.int;
    }
    const priceFrom = body.from && body.from.delivery && body.from.delivery.int ? body.from.delivery.int : 0;
    const priceTo = body.to && body.to.delivery && body.to.delivery.int ? body.to.delivery.int : 0;
    const timeAvto = body.transit ? body.transit.int : '';
    const timeAvia = body.transit_avia ? body.transit_avia.int : '';
    const serviceAvto = 'автоперевозка';
    const serviceAvia = 'авиаперевозка';
    if (body.price.int) {
      const basePrice = resultAvto + body.price.int;
      request.tariffs.push(createTariff(`СС ${serviceAvto}`, basePrice, timeAvto));
      if (priceFrom) {
        request.tariffs.push(createTariff(`ДС ${serviceAvto}`, basePrice + priceFrom, timeAvto));
      }
      if (priceTo) {
        request.tariffs.push(createTariff(`СД ${serviceAvto}`, basePrice + priceTo, timeAvto));
      }
      if (priceFrom && priceTo) {
        request.tariffs.push(createTariff(`ДД ${serviceAvto}`, basePrice + priceFrom + priceTo, timeAvto));
      }
    }
    if (body.price_avia.int) {
      const basePrice = resultAvia + body.price_avia.int;
      request.tariffs.push(createTariff(`СС ${serviceAvia}`, basePrice, timeAvia));
      if (priceFrom) {
        request.tariffs.push(createTariff(`ДС ${serviceAvia}`, basePrice + priceFrom, timeAvia));
      }
      if (priceTo) {
        request.tariffs.push(createTariff(`СД ${serviceAvia}`, basePrice + priceTo, timeAvia));
      }
      if (priceFrom && priceTo) {
        request.tariffs.push(createTariff(`ДД ${serviceAvia}`, basePrice + priceFrom + priceTo, timeAvia));
      }
    }
  } catch(e) {
    request.error = getTariffErrorMessage('Изменилось API сайта');
  }
  if (!request.tariffs.length && !request.error) {
    request.error = getNoResultError();
  }
  return request;
};

module.exports = async function ({ deliveryKey, weights, cities, req }) {
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