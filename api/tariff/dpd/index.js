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

const getInternationalReq = (from, to, isCountryFrom, isCountryTo) => {
  from = from || {};
  to = to || {};
  return {
    'countryOrigName': isCountryFrom ? from.name : 'Россия',
    'countryDestName': isCountryTo ? to.name : 'Россия',
    'cityOrigId': isCountryFrom ? '' : from.id,
    cityDestId: isCountryTo ? '' : from.id,
    cityPickupCountryCode: isCountryFrom ? from.id : 'RU',
    cityDeliveryCountryCode: isCountryTo ? to.id : 'RU',
    cityPickupNameFull: isCountryFrom ? '' : from.name,
    cityPickupNameTotal: isCountryFrom ? '' : from.name,
    cityDeliveryNameFull: isCountryTo ? '' : from.name,
    cityDeliveryNameTotal: isCountryTo ? '' : from.name,
    costRUB: 1,
    costEUR: '0.00',
    payWeight: 1,
    euro: 89.4771,
    koeffDPE: 250.0,
    koeffDPI: 250.0,
    siteCountryCode: 'RU',
    siteCurrencyCode: 'RUB',
    countryOrig: isCountryFrom ? from.id : 'RU',
    cityOrig:  isCountryFrom ? '' : from.name,
    pickupCityType: 'Д',
    countryDest: isCountryTo ? to.id : 'RU',
    deliveryCityType: 'Д',
    weight: 1,
    length: '',
    width: '',
    height: '',
    cost: 1,
    currency: 'rub'
  }
};

const _getCity = async ({ city, country, isInternational, cookie, delivery, req }) => {
  const trim = getCity(city);
  const result = {
    city: city,
    cityTrim: trim,
    success: false
  };
  let json;
  try {
    const opts = Object.assign({}, isInternational ? delivery.citiesInternationalUrl : delivery.citiesUrl);
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
  if (country) {
    json.geonames = findInArray(json.geonames, country, 'countryName', false)
  }
  if (!json.geonames.length) {
    result.error = getCityNoResultError(trim);
  } else if (json.geonames.length === 1) {
    result.items = json.geonames;
    result.success = true;
  } else {
    const region = getRegionName(city);
    let founds = [];
    if (region) {
      founds = findInArray(json.geonames, region, 'reg');
    }
    if (founds.length > 1) {
      let filtered = founds.filter(v => ['г', 'п'].indexOf(v.abbr) > -1);
      if (filtered.length && filtered.length < founds.length) {
        founds = filtered;
      }
    }
    result.items = founds.length ? founds : [json.geonames[0]];
    result.success = true;
  }
  return result;
};

const getCities = async ({cities, delivery, req, cookie, countries}) => {
  const cityObj = {};
  const cityIntObj = {};
  const countryObj = _.keyBy(countries, 'name');
  return await async.mapSeries(cities, async (item, callback) => {
    const city = {
      ...item,
      countryFrom: dpdCountryChanger(item.countryFrom),
      countryTo: dpdCountryChanger(item.countryTo),
      initialCityFrom: item.from,
      initialCityTo: item.to,
      initialCountryFrom: item.countryFrom,
      initialCountryTo: item.countryTo,
    };
    if (!city.from && !city.to) {
      city.error = CITIESREQUIRED;
      return callback(null, city);
    }
    if (!city.from && !city.countryFrom) {
      city.error = CITYORCOUNTRYFROMREQUIRED;
      return callback(null, city);
    }
    if (!city.to && !city.countryTo) {
      city.error = CITYORCOUNTRYTOREQUIRED;
      return callback(null, city);
    }
    if (city.countryFrom && SNG.indexOf(city.countryFrom.toLowerCase()) > -1) {
      city.countryFromTemp = city.countryFrom;
      city.countryFrom = '';
    }
    if (city.countryTo && SNG.indexOf(city.countryTo.toLowerCase()) > -1) {
      city.countryToTemp = city.countryTo;
      city.countryTo = '';
    }
    if (city.countryFrom && !countryObj[city.countryFrom.toUpperCase()]) {
      city.error = COUNTRYFROMNOTFOUND;
      return callback(null, city);
    }
    if (city.countryTo && !countryObj[city.countryTo.toUpperCase()]) {
      city.error = COUNTRYTONOTFOUND;
      return callback(null, city);
    }
    if (city.countryTo && !countryObj[city.countryTo.toUpperCase()]) {
      city.error = COUNTRYTONOTFOUND;
      return callback(null, city);
    }
    if (city.countryFrom && city.countryTo) {
      city.error = CITYFROMORTORU;
      return callback(null, city);
    }
    if ((city.countryFrom || city.countryTo) && (city.countryFromTemp || city.countryToTemp)) {
      city.error = CITYFROMORTORU;
      return callback(null, city);
    }
    const fromKey = city.from + city.countryFrom;
    const toKey = city.to + city.countryTo;
    if (city.countryFrom || city.countryTo) {
      if (city.from) {
        if (cityIntObj[fromKey]) {
          city.fromJSON = cityIntObj[fromKey];
        } else {
          const result = await _getCity({city: city.from, delivery, req, isInternational: true, cookie});
          cityIntObj[fromKey] = result;
          city.fromJSON = result;
        }
        city.toJSON = { isCountry: true, success: true, items: [countryObj[city.countryTo.toUpperCase()]] };
      } else {
        city.fromJSON = { isCountry: true, success: true, items: [countryObj[city.countryFrom.toUpperCase()]] };
        if (cityIntObj[toKey]) {
          city.toJSON = cityIntObj[toKey];
        } else {
          const result = await _getCity({city: city.to, delivery, req, isInternational: true, cookie});
          cityIntObj[toKey] = result;
          city.toJSON = result;
        }
      }
    } else {
      if (cityObj[fromKey]) {
        city.fromJSON = cityObj[fromKey];
      } else {
        const result = await _getCity({city: city.from, country: city.countryFromTemp, delivery, req, cookie});
        cityObj[fromKey] = result;
        city.fromJSON = result;
      }
      if (cityObj[toKey]) {
        city.toJSON = cityObj[toKey];
      } else {
        const result = await _getCity({city: city.to, country: city.countryToTemp, delivery, req, cookie});
        cityObj[toKey] = result;
        city.toJSON = result;
      }
    }
    delete city.countryFromTemp;
    delete city.countryToTemp;
    callback(null, city);
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
  const internationalRequests = [];
  const tempRequests = [];
  const tempIntRequests = [];
  cities.forEach((item) => {
    if (item.error) {
      requests = requests.concat(getResponseErrorArray({ deliveryKey, weights, city: {...item, error: undefined}, error: item.error }));
    } else if (!item.fromJSON.success) {
      requests = requests.concat(getResponseErrorArray({ deliveryKey, weights, city: item, error: item.fromJSON.error }));
    } else if (!item.toJSON.success) {
      requests = requests.concat(getResponseErrorArray({ deliveryKey, weights, city: item, error: item.toJSON.error }));
    } else {
      item.fromJSON.items.forEach((fromCity) => {
        item.toJSON.items.forEach((toCity) => {
          if (item.fromJSON.isCountry || item.toJSON.isCountry) {
            tempIntRequests.push({
              city: {
                ...item,
                fromJSON: undefined,
                toJSON: undefined,
                from: fromCity.name,
                to: toCity.name,
              },
              req: getInternationalReq(fromCity, toCity, item.fromJSON.isCountry, item.toJSON.isCountry),
              delivery: deliveryKey,
              tariffs: []
            });
          } else {
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
              tariffs: []
            });
          }
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
        req: {...item.req, 'form.weightStr': weight}
      });
    });
  });
  tempIntRequests.forEach((item) => {
    weights.forEach((weight) => {
      internationalRequests.push({
        ...item,
        city: {...item.city},
        weight,
        req: {...item.req, payWeight: weight, weight}
      });
    });
  });
  return {internationalRequests, requests};
};

const getCalcResults = async ({ request, delivery, cookie, req }) => {
  let tariffs = [];
  const errors = [];
  for (let service of services) {
    let body;
    try {
      const opts = delivery.calcUrl;
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

const getIntCalcResult = async ({ request, delivery, cookie, req }) => {
  let tariffs = [];
  const errors = [];
  let intServices = services.slice(0, 1);
  if (request.city.countryFrom) {
    intServices = intServices.concat(services.slice(1, 2));
  } else {
    intServices = intServices.concat(services.slice(3, 4));
  }
  for (let service of intServices) {
    let body;
    try {
      const opts = delivery.calcInternationalUrl;
      const formData = new URLSearchParams();
      const reqCopy = {...request.req, ...service.intReq};
      console.log(reqCopy)
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
        if (index !== 0) {
          const tds = $(tr).find('td');
          if (tds.length) {
            tariffs.push({
              service: `${service.title} ${$(tr).find('input[name="serviceName"]').val()}`,
              cost: $(tr).find('input[name="serviceCost"]').val(),
              deliveryTime: $(tr).find('input[name="serviceDays"]').val()
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
  let countries = [];
  try {
    cookie = response.headers.get('set-cookie').split(';')[0];
  } catch (e) {}
  if (!cookie) {
    throw new Error(getResponseError('Не удалось получить cookie.'));
  }
  const $ = cheerio.load(body);
  try {
    const items = $(selectors.countryOption);
    items.each((index, item) => {
      countries.push({id: $(item).attr('value'), name: $(item).text().toUpperCase()});
    });
  } catch(e) {}
  if (!countries.length) {
    throw new Error(getCountriesError(`Контент сайта изменился. Искали ${selectors.countryOption}`));
  }
  return {cookie, countries};
};

module.exports = async function ({ deliveryKey, weights, cities, req}) {
  const delivery = getOne(deliveryKey);
  let results = [];

  try {
    const {cookie, countries} = await getCookie({ delivery, req });
    const citiesResults = await getCities({cities, delivery, req, cookie, countries});
    const {internationalRequests, requests} = getRequests({ deliveryKey, cities: citiesResults, weights });
    for (let request of requests) {
      results.push(await getCalcResults({ request, cookie, delivery, req }));
    }
    for (let request of internationalRequests) {
      results.push(await getIntCalcResult({ request, cookie, delivery, req }));
    }
  } catch(error) {
    results = allResultsError({ deliveryKey, weights, cities, error });
  }

  return results;

};