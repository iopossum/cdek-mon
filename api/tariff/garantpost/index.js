import { getOne, dimexCountryChanger, DIMEXCOUNTRIES } from '../../helpers/delivery';
import {
  shouldAbort,
  findInArray,
  randomTimeout
} from '../../helpers/common';
import {
  CITYORCOUNTRYREQUIRED,
  COUNTRYLISTERROR,
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
  getResponseErrorObject,
  getCountriesError,
  getCountryNoResultError,
  createTariff,
  getJSONChangedMessage,
  getRegionName,
  getNoResultError,
  getCityJsonError,
  getCityNoResultError,
  getServicesError,
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

const _getCity = async ({ city, isFrom, delivery, req }) => {
  const result = isFrom ? { ...city.fromJSON } : { ...city.toJSON };
  if (result.isSpecial) {
    result.regionId = result.items[0].id;
  }
  result.city = isFrom ? city.from : city.to;
  result.trim = isFrom ? city.fromTrim : city.toTrim;
  result.success = true;
  let json;
  try {
    const opts = {...delivery.citiesUrl};
    opts.uri += result.items[0].id;
    let { body } = await requestWrapper({ format: 'text', req, ...opts });
    body = body.substring(1, body.length);
    json = JSON.parse(body);
  } catch(e) {}
  if (!json) {
    return result;
  }
  if (!Array.isArray(json)) {
    return result;
  }
  let founds = [];
  const district = getDistrictName(isFrom ? city.from : city.to);
  if (district) {
    founds = findInArray(json, district, 'OkatoName');
  }
  if (!founds.length) {
    founds = findInArray(json, result.trim, 'OkatoName', true);
  }
  if (founds.length) {
    result.items = founds.slice(0, 2).map((item) => {
      return {
        id: item.OkatoID,
        name: item.OkatoName.toLowerCase()
      };
    });
  }
  return result;
};

const getCities = async ({cities, delivery, req, countries, initialCities}) => {
  const cityObj = {};
  const countryObj = _.keyBy(countries, 'name');
  return await async.mapSeries(cities, async (item, callback) => {
    try {
      const city = {
        ...item,
        initialCityFrom: item.from,
        initialCityTo: item.to,
        initialCountryFrom: item.countryFrom,
        initialCountryTo: item.countryTo,
      };
      if (!city.from && !city.countryTo) {
        city.error = CITYORCOUNTRYREQUIRED;
        return callback(null, city);
      }
      if (city.countryFrom) {
        city.error = COUNTRYFROMRUSSIA;
        return callback(null, city);
      }
      if (city.countryTo && !countries.length) {
        city.error = COUNTRYLISTERROR;
        return callback(null, city);
      }
      if (city.countryTo && !countryObj[city.countryTo.toLowerCase()]) {
        city.error = getCountryNoResultError(city.countryTo);
        return callback(null, city);
      }
      if (!city.countryTo) {
        if (!initialCities.length) {
          city.error = getCityJsonError();
          return callback(null, city);
        }
        city.fromTrim = getCity(city.from);
        let from = findInArray(initialCities, city.fromTrim);
        const regionFrom = getRegionName(city.from);
        if (!from.length && regionFrom) {
          from = findInArray(initialCities, regionFrom);
        }
        if (!from.length) {
          city.error = getCityNoResultError(city.from);
          return callback(null, city);
        }
        city.toTrim = getCity(city.to);
        let to = findInArray(initialCities, city.toTrim);
        const regionTo = getRegionName(city.to);
        if (!to.length && regionTo) {
          to = findInArray(initialCities, regionTo);
        }
        if (!to.length) {
          city.error = getCityNoResultError(city.to);
          return callback(null, city);
        }
        const fromKey = city.from + city.countryFrom;
        const toKey = city.to + city.countryTo;
        city.fromJSON = {items: [from[0]], success: true, isSpecial: !!regionFrom};
        city.toJSON = {items: [to[0]], success: true, isSpecial: !!regionTo};
        if (regionFrom) {
          if (cityObj[fromKey]) {
            if (cityObj[fromKey].items && cityObj[fromKey].items.length) {
              city.fromJSON = { ...cityObj[fromKey] };
            }
          } else {
            const result = await _getCity({city, isFrom: true, delivery, req });
            if (result.items && result.items.length) {
              cityObj[fromKey] = result;
              city.fromJSON = result;
            }
          }
        }
        if (regionTo) {
          if (cityObj[toKey]) {
            if (cityObj[toKey].items && cityObj[toKey].items.length) {
              city.toJSON = { ...cityObj[toKey] };
            }
          } else {
            const result = await _getCity({city, isFrom: false, delivery, req });
            if (result.items && result.items.length) {
              cityObj[toKey] = result;
              city.toJSON = result;
            }
          }
        }
      } else {
        city.toJSON = { ...countryObj[city.countryTo.toLowerCase()] };
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
  const internationalRequests = [];
  const tempRequests = [];
  const tempIntRequests = [];
  cities.forEach((item) => {
    if (item.error) {
      errors = errors.concat(getResponseErrorArray({ deliveryKey, weights, city: item, error: item.error }));
    } else if (item.countryTo) {
      tempIntRequests.push({
        city: {
          ...item,
          fromJSON: undefined,
          toJSON: undefined,
          fromTrim: undefined,
          toTrim: undefined,
          to: item.countryTo,
        },
        req: {fromJSON: {id: 45000000}, toJSON: item.toJSON},
        delivery: deliveryKey,
      });
    } else if (!item.fromJSON.success) {
      errors = errors.concat(getResponseErrorArray({ deliveryKey, weights, city: item, error: item.fromJSON.error }));
    } else if (!item.toJSON.success) {
      errors = errors.concat(getResponseErrorArray({ deliveryKey, weights, city: item, error: item.toJSON.error }));
    } else {
      item.fromJSON.items.forEach((fromCity) => {
        if (item.fromJSON.regionId) {
          fromCity.regionId = item.fromJSON.regionId;
        }
        item.toJSON.items.forEach((toCity) => {
          if (item.toJSON.regionId) {
            toCity.regionId = item.toJSON.regionId;
          }
          tempRequests.push({
            city: {
              ...item,
              from: fromCity.name,
              to: toCity.name,
              fromJSON: undefined,
              toJSON: undefined,
              fromTrim: undefined,
              toTrim: undefined,
            },
            req: {fromJSON: fromCity, toJSON: toCity},
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
        req: {...item.req, weight},
        tariffs: []
      });
    });
  });
  tempIntRequests.forEach((item) => {
    weights.forEach((weight) => {
      internationalRequests.push({
        ...item,
        city: {...item.city},
        weight,
        req: {...item.req, weight},
        tariffs: []
      });
    });
  });
  return {internationalRequests, requests, errors};
};

const getDeliveryTime = async ({ request, delivery, req, type }) => {
  const opts = { ...delivery.calcUrl1 };
  opts.uri += 'calc=' + type;
  opts.uri += '&from=' + (request.req.fromJSON.regionId || request.req.fromJSON.id);
  opts.uri += '&to=' + (request.req.toJSON.regionId || request.req.toJSON.id);
  let deliveryTime = {};
  try {
    let { body } = await requestWrapper({format: 'text', req, ...opts});
    body = body.substring(1, body.length);
    const json = JSON.parse(body);
    deliveryTime.from = json[0].DaysMin;
    deliveryTime.to = json[0].DaysMax;
  } catch (e) {}
  return deliveryTime;
};

const getCalcResults = async ({ request, delivery, isInternational, req, services, type }) => {
  if (!services[type].length) {
    return getResponseErrorObject({ deliveryKey, weight: request.weight, city: request.city, error: getServicesError('Изменился запрос'), req: {} });
  }
  const deliveryTime = await getDeliveryTime({ request, delivery, isInternational, req, services, type });
  let tariffs = [];
  const errors = [];
  let index = 0;
  for (let service of services[type]) {
    let json;
    try {
      const opts = type === 'w' ? { ...delivery.calcIntUrl } : { ...delivery.calcUrl2 };
      opts.uri += 'service=' + service.id;
      opts.uri += '&from=' + request.req.fromJSON.id;
      opts.uri += '&to=' + request.req.toJSON.id;
      opts.uri += '&weight=' + request.weight;
      opts.uri += '&count=' + index;
      index++;
      let { body } = await requestWrapper({ req, ...opts, format: 'text' });
      body = body.substring(1, body.length);
      json = JSON.parse(body);
    } catch(e) {}
    if (!json) {
      continue;
    }
    try {
      if (json[0].Tariff) {
        tariffs.push({
          service: `${service.name}`,
          cost: json[0].Tariff,
          deliveryTime: deliveryTime ? `${deliveryTime.from} - ${deliveryTime.to}` : ''
        });
      }
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

const getCountries = async ({ delivery, req, cookie }) => {
  const opts = { ...delivery.countriesUrl };
  let countries = [];
  try {
    let { body } = await requestWrapper({format: 'text', req, ...opts});
    body = body.substring(1, body.length);
    const json = JSON.parse(body);
    countries = json.map((item) => {
      return {
        id: item.OkatoID,
        name: item.OkatoName.toLowerCase(),
        success: true,
        isCountry: true
      };
    })
  } catch (e) {}
  return countries;
};

const getInitialCities = async ({ delivery, req, cookie }) => {
  const opts = { ...delivery.citiesUrl };
  opts.uri += 'show';
  let cities = [];
  try {
    let { body } = await requestWrapper({format: 'text', req, ...opts});
    body = body.substring(1, body.length);
    const json = JSON.parse(body);
    cities = json.map((item) => {
      return {
        id: item.OkatoID,
        name: item.OkatoName.toLowerCase(),
        isCountry: false
      };
    })
  } catch (e) {}
  return cities;
};

const getServices = async ({ delivery, req }) => {
  let services = {};
  for (let type of ['r', 'w']) {
    const opts = { ...delivery.servicesUrl };
    opts.uri += type;
    try {
      let { body } = await requestWrapper({format: 'text', req, ...opts});
      body = body.substring(1, body.length);
      const json = JSON.parse(body);
      services[type] = json.map((item) => {
        return {
          id: item.Value,
          name: item.Type
        };
      })
    } catch (e) {
      services[type] = [];
    }
  }
  if (Object.keys(services).every(key => !services[key].length)) {
    throw new Error(getServicesError('Изменилось api или сервер недоустпуен'));
  }
  return services;
};

module.exports = async function ({ deliveryKey, weights, cities, req}) {
  const delivery = getOne(deliveryKey);
  let results = [];

  try {
    const services = await getServices({ delivery, req });
    if (shouldAbort(req)) {
      throw new Error('abort');
    }
    const countries = await getCountries({ delivery, req });
    if (shouldAbort(req)) {
      throw new Error('abort');
    }
    const initialCities = await getInitialCities({ delivery, req });
    if (shouldAbort(req)) {
      throw new Error('abort');
    }
    const citiesResults = await getCities({cities, delivery, req, countries, initialCities});
    if (shouldAbort(req)) {
      throw new Error('abort');
    }
    const {internationalRequests, requests, errors} = getRequests({ deliveryKey, cities: citiesResults, weights });
    results = results.concat(errors);
    for (let request of requests) {
      if (shouldAbort(req)) {
        break;
      }
      results.push(await getCalcResults({request, delivery, req, services, type: 'r'}));
    }
    for (let request of internationalRequests) {
      if (shouldAbort(req)) {
        break;
      }
      results.push(await getCalcResults({request, delivery, req, services, type: 'w'}));
    }
  } catch(error) {
    results = allResultsError({ deliveryKey, weights, cities, error });
  }

  return results;

};