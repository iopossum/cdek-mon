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

const getReq = (from, to, route, sessionId) => {
  from = from || {};
  to = to || {};
  return {
    city_from: from.DctCityName,
    city_to: to.DctCityName,
    country_code_from: from.CountryCode,
    country_code_to: to.CountryCode,
    date: moment().format('YYYY-MM-DD'),
    facility_code_from: from.FacilityCode,
    facility_code_to: to.FacilityCode,
    language: "ru",
    non_dhl_code_from: null,
    non_dhl_code_to: null,
    pickup_from_time: "10:00",
    pieces: [{id: 0, weight: "1", type: 0, width: 0, height: 0, depth: 0}],
    postal_code_from: from.PostalCode,
    postal_code_to: to.PostalCode,
    service_point_route: route.route,
    session_id: sessionId,
    shp_windows_time_zone_id: "N. Central Asia Standard Time",
  }
};

const _getCity = async ({ city, country, countryCode, isCountry, delivery, req, sessionId }) => {
  const trim = getCity(isCountry ? country : city);
  const notFoundFn = isCountry ? getCountryNoResultError : getCityNoResultError;
  const errorFn = isCountry ? getCountriesError : getCityJsonError;
  const result = {
    trim,
    success: false
  };
  let json;
  try {
    const opts = {...delivery.citiesUrl};
    const body = {
      language: "ru",
      max_count: 100,
      requested_entity: isCountry ? "country" : 'city',
      search_string: trim.toLowerCase(),
      session_id: sessionId
    };
    if (!isCountry) {
      body.country_code = countryCode || 'RU';
    }
    opts.body = JSON.stringify(body);
    const res = await requestWrapper({ req, ...opts });
    json = res.body;
  } catch(e) {}
  if (!json) {
    result.error = errorFn('Изменился запрос', city);
    return result;
  }
  if (!json.success) {
    result.error = errorFn('Неверный формат данных в ответе. Отсутствует параметр success', city);
    return result;
  }
  if (!Array.isArray(json.success)) {
    result.error = errorFn("Неверный тип данных в ответе. Success не массив", trim);
    return result;
  }
  if (isCountry) {
    if (json.success.length) {
      result.success = true;
      result.countryCode = json.success[0].CountryCode;
      result.country = json.success[0].CommonAlias;
    } else {
      result.error = notFoundFn(trim);
    }
    return result;
  }
  if (countryCode === 'RU') {
    json.success = findInArray(json.success, trim, 'CommonAlias', true);
  }
  if (!json.success.length) {
    result.error = notFoundFn(trim);
  } else {
    const region = getRegionName(city);
    const district = getDistrictName(city);
    let founds = [];
    if (region) {
      founds = findInArray(json.success, region, 'CommonAlias');
      if (!founds.length) {
        result.error = notFoundFn(city);
        return result;
      }
    }
    if (district) {
      founds = findInArray(founds.length ? founds : json.success, district, 'CommonAlias');
      if (!founds.length) {
        result.error = notFoundFn(city);
        return result;
      }
    }
    result.success = true;
    result.items = founds.length ? founds.slice(0, 2) : json.success.slice(0, 1);
  }
  return result;
};

const getCities = async ({cities, delivery, req, sessionId}) => {
  const cityObj = {};
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
      if (city.countryFrom) {
        city.error = COUNTRYFROMRUSSIA;
        return callback(null, city);
      }
      let countryFrom = { country: 'Россия', countryCode: 'RU' };
      let countryTo = { country: 'Россия', countryCode: 'RU' };
      if (city.countryFrom) {
        if (countryObj[city.countryFrom]) {
          countryFrom = {...countryObj[city.countryFrom]};
        } else {
          countryFrom = await _getCity({country: city.countryFrom, isCountry: true, delivery, req, sessionId});
          countryObj[city.countryFrom] = {...countryFrom};
        }
        if (!countryFrom.success) {
          city.error = countryFrom.error;
          return callback(null, city);
        } else {
          city.countryFrom = countryFrom.country;
        }
      }
      if (city.countryTo) {
        if (countryObj[city.countryTo]) {
          countryTo = {...countryObj[city.countryTo]};
        } else {
          countryTo = await _getCity({country: city.countryTo, isCountry: true, delivery, req, sessionId});
          countryObj[city.countryTo] = {...countryTo};
        }
        if (!countryTo.success) {
          city.error = countryTo.error;
          return callback(null, city);
        } else {
          city.countryTo = countryTo.country;
        }
      }
      const fromKey = city.from + city.countryFrom;
      const toKey = city.to + city.countryTo;
      if (cityObj[fromKey]) {
        city.fromJSON = { ...cityObj[fromKey] };
      } else {
        const result = await _getCity({city: city.from, countryCode: countryFrom.countryCode, delivery, req, sessionId});
        cityObj[fromKey] = result;
        city.fromJSON = result;
      }
      if (cityObj[toKey]) {
        city.toJSON = { ...cityObj[toKey] };
      } else {
        const result = await _getCity({city: city.to, countryCode: countryTo.countryCode, delivery, req, sessionId});
        cityObj[toKey] = result;
        city.toJSON = result;
      }
      callback(null, city);
    } catch(e) {
      callback(e);
    }
  });
};

const getRoute = async ({ delivery, req, fromCity, toCity, sessionId }) => {
  const opts = { ...delivery.calcUrlAdditional };
  opts.body = JSON.stringify({
    language: 'ru',
    max_count: 0,
    nearest: {
      city_from: fromCity.DctCityName,
      city_to: toCity.DctCityName,
      country_code_from: fromCity.CountryCode,
      country_code_to: toCity.CountryCode,
      facility_from: fromCity.FacilityCode,
      postal_code_from: null,
      postal_code_to: null
    },
    session_id: sessionId
  });
  const result = { success: false };
  try {
    const { body } = await requestWrapper({ req, ...opts});
    if (!body.success) {
      result.error = getResponseError('Не удалось получить код маршрута. Отсутствует параметр success');
      return result;
    }
    if (!Array.isArray(body.success)) {
      result.error = getResponseError("Не удалось получить код маршрута. Неверный тип данных в ответе. Success не массив");
      return result;
    }
    if (!body.success.length) {
      result.error = getResponseError("Не удалось получить код маршрута. Нет доступных маршрутов");
      return result;
    }
    result.route = body.success[0].route;
    result.success = true;
  } catch (e) {
    result.error = getResponseError('Не удалось получить код маршрута');
  }
  return result;
};

const getRequests = async ({ deliveryKey, cities, weights, sessionId, delivery, req }) => {
  let requests = [];
  let errors = [];
  const routeObj = {};
  const tempRequests = [];
  for (let item of cities) {
    if (item.error) {
      errors = errors.concat(getResponseErrorArray({ deliveryKey, weights, city: item, error: item.error }));
    } else if (!item.fromJSON.success) {
      errors = errors.concat(getResponseErrorArray({ deliveryKey, weights, city: item, error: item.fromJSON.error }));
    } else if (!item.toJSON.success) {
      errors = errors.concat(getResponseErrorArray({ deliveryKey, weights, city: item, error: item.toJSON.error }));
    } else {
      for (let fromCity of item.fromJSON.items) {
        for (let toCity of item.toJSON.items) {
          const routeKey = fromCity.CommonAlias + toCity.CommonAlias;
          if (!routeObj[routeKey]) {
            routeObj[routeKey] = await getRoute({ delivery, req, fromCity, toCity, sessionId });
          }
          const route = {...routeObj[routeKey]};
          const city = {
            ...item,
            fromJSON: undefined,
            toJSON: undefined,
            from: fromCity.CommonAlias,
            to: toCity.CommonAlias,
          };
          if (!route.success) {
            errors = errors.concat(getResponseErrorArray({ deliveryKey, weights, city, error: route.error }));
            continue;
          }
          tempRequests.push({
            city,
            req: getReq(fromCity, toCity, route, sessionId),
            delivery: deliveryKey,
          });
        }
      }
    }
  }
  tempRequests.forEach((item) => {
    weights.forEach((weight) => {
      const req = {...item.req };
      req.pieces = req.pieces.map(v => ({ ...v, weight }));
      requests.push({
        ...item,
        city: {...item.city},
        weight,
        req,
        tariffs: []
      });
    });
  });
  return {requests, errors};
};

const getCalcResults = async ({ request, delivery, req }) => {
  try {
    const opts = {...delivery.calcUrl};
    opts.body = JSON.stringify(request.req);
    const { body } = await requestWrapper({ req, ...opts });
    if (body.success) {
      if (body.success['call'] && body.success['call'].price) {
        request.tariffs.push(createTariff(
          'Вызвать курьера по телефону',
          body.success['call'].price,
          body.success['call'].total_transit_days || ''
        ));
      }
      if (body.success['click'] && body.success['click'].price) {
        request.tariffs.push(createTariff(
          'Вызвать курьера онлайн',
          body.success['click'].price,
          body.success['click'].total_transit_days || ''
        ));
      }
      if (body.success['walk'] && body.success['walk'].price) {
        request.tariffs.push(createTariff(
          'Отправить из офиса DHL',
          body.success['walk'].price,
          body.success['walk'].total_transit_days || ''
        ));
      }
    }
  } catch(e) {
    request.error = e.message;
  }
  if (!request.tariffs.length && !request.error) {
    request.error = getNoResultError();
  }
  request.req = {};
  return request;
};

const getToken = async ({ delivery, req }) => {
  const opts = { ...delivery.authorizeUrl };
  opts.body = JSON.stringify({
    language: 'ru',
    session_id: null
  });
  try {
    const { body } = await requestWrapper({ req, ...opts});
    return body.success.session_id;
  } catch (e) {
    throw getResponseError('Не удалось получить token session_id');
  }
};

module.exports = async function ({ deliveryKey, weights, cities, req}) {
  const delivery = getOne(deliveryKey);
  let results = [];

  try {
    const sessionId = await getToken({ delivery, req });
    if (shouldAbort(req)) {
      throw new Error('abort');
    }
    const citiesResults = await getCities({cities, delivery, req, sessionId});
    if (shouldAbort(req)) {
      throw new Error('abort');
    }
    const {requests, errors} = await getRequests({ deliveryKey, cities: citiesResults, weights, sessionId, delivery, req });
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