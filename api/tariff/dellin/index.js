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

const COUNTRY_CODE_RU = 643;

const services = [
  {title: 'ДД', req: {'derival_variant': 'toDoor', 'arrival_variant': 'toDoor'}},
  {title: 'ДС', req: {'derival_variant': 'toDoor', 'arrival_variant': 'terminal'}},
  {title: 'СС', req: {'derival_variant': 'terminal', 'arrival_variant': 'terminal'}},
  {title: 'СД', req: {'derival_variant': 'terminal', 'arrival_variant': 'toDoor'}},
];

const getReq = (from, to, terminalFrom, terminalTo) => {
  from = from || {};
  to = to || {};
  return {
    requestType: 'cargo-single',
    delivery_type: 1,
    length: 0.1,
    width: 0.1,
    height: 0.1,
    sized_weight: 1,
    sized_volume: 0.1,
    max_length: 0.3,
    max_width: 0.21,
    max_height: 0.01,
    max_weight: 0.5,
    quantity: 1,
    total_weight: 0.50,
    total_volume: 0.01,
    cargoUID: '0xaf9da9015d2615434e73741e39ac3bec',
    packedUID: '',
    stated_value: 0,
    derival_point: from.label,
    derival_point_code: from.code,
    derival_variant: 'toDoor',
    derival_terminal_city_code: terminalFrom ? terminalFrom.city_code : from.code,
    derival_terminal_id: terminalFrom ? terminalFrom.id : '',
    derival_street_code: '',
    derival_street: '',
    derival_worktime_start: '09:00',
    derival_worktime_end: '17:00',
    arrival_point: to.label,
    arrival_point_code: to.code,
    arrival_variant: 'toDoor',
    arrival_terminal_city_code: terminalTo ? terminalTo.city_code : to.code,
    arrival_terminal_id: terminalTo ? terminalTo.id : '',
    arrival_street_code: '',
    arrival_street: '',
    arrival_worktime_start: '09:00',
    arrival_worktime_end: '18:00',
    produceDate: moment().add(1, 'days').format('DD.MM.YYYY'),
    'derival_loading_unloading_parameters[0xadf1fc002cb8a9954298677b22dbde12]': '',
    'derival_loading_unloading_parameters[0x9a0d647ddb11ebbd4ddaaf3b1d9f7b74]': '',
    oversized_weight_avia: 0,
    oversized_volume_avia: 0,
    'arrival_loading_unloading_parameters[0xadf1fc002cb8a9954298677b22dbde12]': '',
    'arrival_loading_unloading_parameters[0x9a0d647ddb11ebbd4ddaaf3b1d9f7b74]': '',
    derival_point_noSendDoor: 0
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
    const res = await requestWrapper({ req, ...opts });
    json = res.body;
  } catch(e) {}
  if (!json) {
    result.error = getCityJsonError('Изменился запрос', city);
    return result;
  }
  if (!Array.isArray(json)) {
    result.error = getCityJsonError("Неверный тип данных в ответе", trim);
    return result;
  }
  json = findInArray(json, trim, 'city', true);
  if (country) {
    json = json.filter(v => v.country_code !== COUNTRY_CODE_RU);
  }
  if (!json.length) {
    result.error = getCityNoResultError(trim);
  } else {
    const region = getRegionName(city);
    let founds = [];
    if (region) {
      founds = findInArray(json, region, 'fullName');
      if (!founds.length) {
        result.error = getCityNoResultError(trim);
      } else {
        result.items = founds.slice(0, 2);
        result.success = true;
      }
    } else {
      result.items = json.slice(0, 1);
      result.success = true;
    }
  }
  return result;
};

const getTerminal = async ({ code, delivery, req }) => {
  const result = {
    success: false
  };
  let json;
  try {
    const opts = {...delivery.terminalsUrl};
    opts.uri += encodeURIComponent(code);
    const res = await requestWrapper({ req, ...opts });
    json = res.body;
  } catch(e) {}
  if (!json) {
    result.error = getCityJsonError('Изменилсось API', city);
    return result;
  }
  if (!Array.isArray(json)) {
    result.error = getCityJsonError("Неверный тип данных в ответе", trim);
    return result;
  }
  if (!json.length) {
    result.error = 'Не удалось найти терминал';
  } else {
    result.success = true;
    result.terminal = json[0];
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

const getRequests = async ({ deliveryKey, cities, weights, delivery, req }) => {
  let requests = [];
  let errors = [];
  const tempRequests = [];
  const terminalObj = {};
  for (let item of cities) {
    if (item.error) {
      errors = errors.concat(getResponseErrorArray({ deliveryKey, weights, city: item, error: item.error }));
    } else if (!item.fromJSON.success) {
      errors = errors.concat(getResponseErrorArray({ deliveryKey, weights, city: item, error: item.fromJSON.error }));
    } else if (!item.toJSON.success) {
      errors = errors.concat(getResponseErrorArray({ deliveryKey, weights, city: item, error: item.toJSON.error }));
    } else {
      for (let fromCity of item.fromJSON.items) {
        if (!terminalObj[fromCity.fullName]) {
          terminalObj[fromCity.fullName] = await getTerminal({ delivery, req, code: fromCity.code })
        }
        for (let toCity of item.toJSON.items) {
          if (!terminalObj[toCity.fullName]) {
            terminalObj[toCity.fullName] = await getTerminal({ delivery, req, code: toCity.code })
          }
          tempRequests.push({
            city: {
              ...item,
              fromJSON: undefined,
              toJSON: undefined,
              from: fromCity.fullName,
              to: toCity.fullName,
            },
            req: getReq(fromCity, toCity, terminalObj[fromCity.fullName].terminal, terminalObj[toCity.fullName].terminal),
            delivery: deliveryKey,
          });
        }
      }
    }
  }
  tempRequests.forEach((item) => {
    weights.forEach((weight) => {
      requests.push({
        ...item,
        city: {...item.city},
        weight,
        req: {...item.req, sized_weight: weight},
        tariffs: []
      });
    });
  });
  return {requests, errors};
};

const getDeliveryTime = (obj) => {
  let result = '';
  let start = obj.sender_terminal_arrival_date;
  if (!start) {
    start = obj.sender_terminal_dispatch_date;
  }
  let finish = obj.recipient_terminal_arrival_date;
  if (!finish) {
    finish = obj.recipient_terminal_dispatch_date;
  }
  if (start && finish) {
    result = moment(finish, 'YYYY-MM-DD').diff(moment(start, 'YYYY-MM-DD'), 'days');
  }
  return result;
};

const getCost = (obj, type) => {
  let result = (obj.intercity || 0) + (obj.fatal_informing || 0);
  if (obj.term_insurance) {
    result += obj.term_insurance;
    result += (obj.insurance || 0);
  }
  if (obj.derival_terminal_price) {
    result += obj.derival_terminal_price;
  }
  switch (type) {
    case 'ДД': {
      result += (obj.derivalToDoor || 0);
      result += (obj.arrivalToDoor || 0);
      break;
    }
    case 'ДС': {
      result += (obj.derivalToDoor || 0);
      break;
    }
    case 'СД': {
      result += (obj.arrivalToDoor || 0);
      break;
    }
  }
  return result;
};

const getCalcResults = async ({ request, delivery, req }) => {
  const errors = [];
  for (let service of services) {
    let body;
    try {
      const opts = { ...delivery.calcUrl };
      const reqCopy = {...request.req, ...service.req};
      for (let key of Object.keys(reqCopy)) {
        opts.uri += (key + '=' + encodeURIComponent(reqCopy[key]) + '&');
      }
      const res = await requestWrapper({ req, ...opts });
      body = res.body;
    } catch(e) {}
    if (!body) {
      continue;
    }
    try {
      request.tariffs.push({
        service: `${service.title}`,
        cost: getCost(body, service.title),
        deliveryTime: getDeliveryTime(body)
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

module.exports = async function ({ deliveryKey, weights, cities, req}) {
  const delivery = getOne(deliveryKey);
  let results = [];

  try {
    const citiesResults = await getCities({cities, delivery, req});
    if (shouldAbort(req)) {
      throw new Error('abort');
    }
    const {requests, errors} = await getRequests({ deliveryKey, cities: citiesResults, weights, delivery, req });
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