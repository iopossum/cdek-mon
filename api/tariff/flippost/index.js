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
  COUNTRYLISTERROR,
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
  SNG, COSTREGDOT
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
  countryOption: 'select[name="CityID"] option',
  tariffResults: '.calculator-result .calculator-result__info-item'
};

const services = [
  {title: 'Документы', req: {packaging: 'b02'}},
  {title: 'Недокументы', req: {packaging: 'b00'}},
];

const getReq = (to) => {
  to = to || {};
  return {
    from: 'Москва',
    from_code: 'MOW',
    to: to.value,
    to_code: to.citycode,
    length: '',
    width: '',
    height: '',
  }
};

const getOtDoReq = (to) => {
  to = to || {};
  return {
    CityID: to.id
  }
};

const _getCity = async ({ city, country, delivery, req }) => {
  const trim = getCity(city || country);
  const result = {
    city: city || country,
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
    result.error = getCityJsonError('Изменился запрос', city);
    return result;
  }
  if (!json.suggestions) {
    result.error = getCityJsonError("Отсутствует suggestions в ответе", trim);
    return result;
  }
  if (!Array.isArray(json.suggestions)) {
    result.error = getCityJsonError("Неверный тип suggestions в ответе", trim);
    return result;
  }
  json.suggestions = findInArray(json.suggestions, trim, 'city', true);
  if (!json.suggestions.length) {
    result.error = city ? getCityNoResultError(trim) : getCountryNoResultError(country);
  } else if (json.suggestions.length === 1) {
    result.items = json.suggestions;
    result.success = true;
  } else {
    const region = getRegionName(city);
    let founds = [];
    if (region) {
      founds = findInArray(json.suggestions, region, 'fullname');
    }
    result.items = founds.length ? founds.slice(0, 2) : json.suggestions.slice(0, 2);
    result.success = true;
  }
  return result;
};

const getCities = async ({cities, delivery, req, otDoCities, otDoCountries}) => {
  const cityObj = {};
  const cityOtDoObj = _.keyBy(otDoCities, 'name');
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
      if (city.countryFrom) {
        city.error = COUNTRYFROMRUSSIA;
        return callback(null, city);
      }
      if (!city.to && !city.countryTo) {
        city.error = CITYORCOUNTRYTOREQUIRED;
        return callback(null, city);
      }
      if (["новосибирск", "москва"].indexOf(city.from.toLowerCase()) === -1) {
        city.error = "Отправления возможны только из г. Москва или г. Новосибирск";
        return callback(null, city);
      }
      const foundCountries = findInArray(otDoCountries, city.countryTo, 'name', false);
      const isFromNsk = ["новосибирск"].indexOf(city.from.toLowerCase()) !== -1;
      if (isFromNsk) {
        if (!city.to && !otDoCountries.length) {
          city.error = getCountriesError('Изменился запрос');
          return callback(null, city);
        }
        if (!city.to && !foundCountries.length) {
          city.error = getCountryNoResultError(city.countryTo);
          return callback(null, city);
        }
        if (city.countryTo && !foundCountries.length) { //страна в приоритете
          city.error = getCountryNoResultError(city.countryTo);
          return callback(null, city);
        }
        if (city.to && !city.countryTo && typeof cityOtDoObj[city.to.toUpperCase()] === 'undefined') {
          city.error = getCityNoResultError(city.to);
          return callback(null, city);
        }
      }
      const toKey = city.to + city.countryTo;
      if (isFromNsk) {
        if (city.countryTo) {
          city.toJSON = { ...foundCountries[0] };
        } else {
          city.toJSON = { ...cityOtDoObj[city.to.toUpperCase()] };
        }
      } else {
        if (cityObj[toKey]) {
          city.toJSON = { ...cityObj[toKey] };
        } else {
          const result = await _getCity({city: city.to, country: city.countryTo, delivery, req});
          cityObj[toKey] = result;
          city.toJSON = result;
        }
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
  const otDoRequests = [];
  const tempRequests = [];
  const tempOtdoRequests = [];
  cities.forEach((item) => {
    if (item.error) {
      errors = errors.concat(getResponseErrorArray({ deliveryKey, weights, city: item, error: item.error }));
    } else if (["новосибирск"].indexOf(item.from.toLowerCase()) !== -1) {
      tempOtdoRequests.push({
        city: {
          ...item,
          fromJSON: undefined,
          toJSON: undefined,
          from: item.from,
          to: item.toJSON.isCountry ? item.to : item.toJSON.name,
          countryFrom: item.countryFrom,
          countryTo: item.toJSON.isCountry ? item.toJSON.name : item.countryTo
        },
        isCountry: item.toJSON.isCountry,
        req: getOtDoReq(item.toJSON),
        delivery: deliveryKey,
      });
    } else if (!item.toJSON.success) {
      errors = errors.concat(getResponseErrorArray({ deliveryKey, weights, city: item, error: item.toJSON.error }));
    } else {
      item.toJSON.items.forEach((toCity) => {
        tempRequests.push({
          city: {
            ...item,
            fromJSON: undefined,
            toJSON: undefined,
            from: item.from,
            to: toCity.fullname,
          },
          req: getReq(toCity),
          delivery: deliveryKey,
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
  tempOtdoRequests.forEach((item) => {
    weights.forEach((weight) => {
      otDoRequests.push({
        ...item,
        city: {...item.city},
        weight,
        req: {...item.req, Ves: weight},
        tariffs: []
      });
    });
  });
  return {otDoRequests, requests, errors};
};

const getCalcResults = async ({ request, delivery, req }) => {
  let body;
  try {
    const opts = {...delivery.calcFlipUrl};
    const formData = new URLSearchParams();
    for (let key of Object.keys(request.req)) {
      formData.append(key, request.req[key]);
    }
    opts.body = formData;
    const res = await requestWrapper({ req, ...opts, format: 'text' });
    body = res.body;
  } catch(e) {}
  request.req = {};
  if (!body) {
    request.error = getTariffErrorMessage('Изменился запрос');
    return request;
  }
  try {
    const $ = cheerio.load(body);
    const results = $(selectors.tariffResults);
    if (results.length < 2) {
      throw new Error(getNoResultError());
    }
    const cost = $(results[0]).text().trim().replace('руб.', '').replace(COSTREGDOT, '');
    const deliveryTime = $(results[1]).find('span').text().trim().replace(DELIVERYTIMEREG, '');
    request.tariffs.push(createTariff('доставка', cost, deliveryTime));
  } catch(e) {
    request.error = e.message;
  }
  return request;
};

const getOtDoCalcResults = async ({ request, delivery, req }) => {
  let body;
  try {
    const opts = !request.isCountry ? { ...delivery.calcOtdoUrl } : { ...delivery.calcOtdoIntUrl };
    for (let key of Object.keys(request.req)) {
      opts.uri += (key + '=' + encodeURIComponent(request.req[key]) + '&');
    }
    const res = await requestWrapper({ req, ...opts, format: 'text' });
    body = res.body;
  } catch(e) {}
  request.req = {};
  if (!body) {
    request.error = getTariffErrorMessage('Изменился запрос');
    return request;
  }
  try {
    const $ = cheerio.load(body);
    if (request.isCountry) {
      const p = $('.content p')[0];
      if (p) {
        const strong = $($(p).find('strong')[1]);
        const splits = $(p).html().split('</strong>');
        if (strong.length && splits[2]) {
          request.tariffs.push(createTariff('международная доставка', strong.text().replace(COSTREGDOT, ''), cheerio.load(splits[2]).text().replace(DELIVERYTIMEREG, '')));
        }
      }
    } else {
      const items = $('.content li');
      items.each(function (index, li) {
        const splits = $(li).html().split('<strong>');
        if (splits[2]) {
          request.tariffs.push(createTariff(
            cheerio.load(splits[0]).text().replace(' - ', ''),
            cheerio.load(splits[1]).text().replace(COSTREGDOT, '').replace(',', ''),
            cheerio.load(splits[2]).text().replace(DELIVERYTIMEREG, '')
          ));
        }
      });
    }
  } catch(e) {
    request.error = e.message;
  }
  delete request.isCountry;
  if (!request.tariffs.length && !request.error) {
    request.error = getNoResultError();
  }
  return request;
};

const getOtDoCountries = async ({ delivery, req }) => {
  const opts = delivery.calcOtdoIntUrl;
  let countries = [];
  try {
    const { body } = await requestWrapper({format: 'text', req, ...opts});
    const $ = cheerio.load(body);
    const options = $(selectors.countryOption);
    options.each((index, item) => {
      countries.push({id: $(item).attr('value'), name: $(item).text().trim().toUpperCase(), success: true, isCountry: true});
    });
  } catch (e) {}
  return countries;
};

const getOtDoCities = async ({ delivery, req }) => {
  const opts = delivery.calcOtdoUrl;
  let cities = [];
  try {
    const { body } = await requestWrapper({format: 'text', req, ...opts});
    const $ = cheerio.load(body);
    const options = $(selectors.countryOption);
    options.each((index, item) => {
      cities.push({id: $(item).attr('value'), name: $(item).text().trim().toUpperCase(), success: true});
    });
  } catch (e) {}
  return cities;
};

module.exports = async function ({ deliveryKey, weights, cities, req}) {
  const delivery = getOne(deliveryKey);
  let results = [];

  try {
    const otDoCountries = await getOtDoCountries({ delivery, req });
    if (shouldAbort(req)) {
      throw new Error('abort');
    }
    const otDoCities = await getOtDoCities({ delivery, req });
    const citiesResults = await getCities({cities, otDoCities, otDoCountries, delivery, req});
    if (shouldAbort(req)) {
      throw new Error('abort');
    }
    const {otDoRequests, requests, errors} = getRequests({ deliveryKey, cities: citiesResults, weights });
    results = results.concat(errors);
    for (let request of requests) {
      if (shouldAbort(req)) {
        break;
      }
      results.push(await getCalcResults({ request, delivery, req }));
    }
    for (let request of otDoRequests) {
      if (shouldAbort(req)) {
        break;
      }
      results.push(await getOtDoCalcResults({ request, delivery, req }));
    }
  } catch(error) {
    results = allResultsError({ deliveryKey, weights, cities, error });
  }

  return results;

};