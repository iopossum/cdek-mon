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
  isBy,
  CITYFROMBY
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
  {title: 'ДД', req: {where: 'office'}},
  {title: 'СД', req: {where: 'ops'}},
];

const services2 = [
  {title: 'Документы', req: {what: 'doc'}},
  {title: 'Товары', req: {what: 'goods'}},
];

const services3 = [
  {title: 'с доставкой в течении рабочего дня, следующего за днем приема', req: {group0: 'inday_after'}},
  {title: 'с доставкой до 10 часов рабочего дня, следующего за днем приема', req: {group0: 'before'}},
  {title: 'с доставкой в указанное время рабочего дня, следующего за днем приема', req: {group0: 'intime'}},
  {title: 'с доставкой в день приема', req: {group0: 'inday'}},
];

const internationalServices = [
  {title: 'Документы международная доставка', req: {type: 'docs'}},
  {title: 'Товары международная доставка', req: {type: 'goods'}},
];

const getReq = (from, to) => {
  from = from || {};
  to = to || {};
  return {
    who: 'fiz',
    where: 'office', //office
    what: 'goods',
    from: from.id,
    sendFrom: from.name,
    to: to.id,
    sendTo: to.name,
    weight: 1000,
    group0: 'inday_after',
    group1: 'none',
    declared: ''
  };
};

const getIntReq = (country) => {
  country = country || {};
  return {
    who: 'fiz',
    type: 'goods',
    to: country.id,
    weight: 1000,
    declared: ''
  }
};

const _getCity = ({ city, country, entities }) => {
  const isCountry = !!country;
  const trim = getCity(isCountry ? country : city);
  const cityTrim = getCity(city);
  const result = {
    isCountry,
    success: false
  };
  const region = getRegionName(city);
  let founds = [];
  if (isCountry && country === 'Россия' && city) {
    founds = findInArray(entities, cityTrim, 'name', true);
    if (!founds.length && region) {
      founds = findInArray(entities, region, 'name');
    }
    if (founds.length) {
      result.success = true;
      result.items = founds.slice(0, 2);
      return result;
    }
  }
  const json = findInArray(entities, trim, 'name', true);
  if (region) {
    founds = findInArray(json, region, 'name');
    if (!founds.length) {
      result.error = getCityNoResultError(city);
      return result;
    }
  }
  if (!json.length && !founds.length) {
    result.error = isCountry ? getCountryNoResultError(country) : getCityNoResultError(trim);
  } else {
    result.success = true;
    result.items = founds.length ? founds.slice(0, 2) : json.slice(0, 2);
  }
  return result;
};

const getCities = async ({ cities, citiesFrom, citiesTo, countries }) => {
  return await async.mapSeries(cities, (item, callback) => {
    try {
      const city = {
        ...item,
        initialCityFrom: item.from,
        initialCityTo: item.to,
        initialCountryFrom: item.countryFrom,
        initialCountryTo: item.countryTo,
      };
      const isFromBy = isBy(item.countryFrom);
      const isToBy = isBy(item.countryTo);
      if (!isFromBy) {
        city.error = CITYFROMBY;
        return callback(null, city);
      }
      if (isToBy) {
        if (!city.to) {
          city.error = CITYTOREQUIRED;
          return callback(null, city);
        }
        if (!city.from) {
          city.error = CITYFROMREQUIRED;
          return callback(null, city);
        }
        if (!citiesFrom.length || !citiesTo.length) {
          city.error = getCountriesError('Изменился контент сайта');
          return callback(null, city);
        }
        city.fromJSON = _getCity({ city: city.from, entities: citiesFrom });
        city.toJSON = _getCity({ city: city.to, entities: citiesTo });
      } else {
        if (!countries.length) {
          city.error = getCountriesError('Изменился контент сайта');
          return callback(null, city);
        }
        city.toJSON = _getCity({ city: city.to, country: city.countryTo || 'Россия', entities: countries });
      }

      callback(null, city);
    } catch(e) {
      callback(e);
    }
  });
};

const getRequests = ({ deliveryKey, cities, weights }) => {
  let requests = [];
  let internationalRequests = [];
  let errors = [];
  const tempRequests = [];
  const tempIntRequests = [];
  cities.forEach((item) => {
    if (item.error) {
      errors = errors.concat(getResponseErrorArray({ deliveryKey, weights, city: item, error: item.error }));
    } else if (item.fromJSON && !item.fromJSON.success) {
      errors = errors.concat(getResponseErrorArray({ deliveryKey, weights, city: item, error: item.fromJSON.error }));
    } else if (!item.toJSON.success) {
      errors = errors.concat(getResponseErrorArray({ deliveryKey, weights, city: item, error: item.toJSON.error }));
    } else {
      if (item.toJSON.isCountry) {
        item.toJSON.items.forEach((toCity) => {
          tempIntRequests.push({
            city: {
              ...item,
              fromJSON: undefined,
              toJSON: undefined,
              to: toCity.name,
            },
            req: getIntReq(toCity),
            delivery: deliveryKey,
          });
        });
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
              req: getReq(fromCity, toCity),
              delivery: deliveryKey,
            });
          });
        });
      }
    }
  });
  tempRequests.forEach((item) => {
    weights.forEach((weight) => {
      requests.push({
        ...item,
        city: {...item.city},
        weight,
        req: {...item.req, weight: weight * 1000},
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
        req: {...item.req, weight: weight * 1000},
        tariffs: []
      });
    });
  });
  return {internationalRequests, requests, errors};
};

const getCalcResults = async ({ request, delivery, req }) => {
  const errors = [];
  for (let service of services) {
    for (let service2 of services2) {
      for (let service3 of services3) {
        let body;
        try {
          const opts = {...delivery.calcUrl};
          const reqCopy = {...request.req, ...service.req, ...service2.req, ...service3.req };
          const formData = new URLSearchParams();
          for (let key of Object.keys(reqCopy)) {
            formData.append(key, reqCopy[key]);
          }
          opts.body = formData;
          const res = await requestWrapper({format: 'text', req, ...opts});
          body = res.body;
        } catch (e) {
          errors.push(getTariffErrorMessage('Изменилось api'));
        }
        if (!body) {
          continue;
        }

        try {
          const $ = cheerio.load(body);
          const blocks = $(selectors.tariffs);

          if (blocks.length) {
            const text = $(blocks[0]).text().trim();
            if (/сумма/gi.test(text)) {
              request.tariffs.push(createTariff(
                `${service.title} ${service2.title} ${service3.title}`,
                text.replace(COSTREGDOT, '').replace(/\.$/, ''),
                ''
              ));
            } else {
              errors.push(text);
            }
          }
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

const getIntCalcResults = async ({ request, delivery, req }) => {
  const errors = [];
  for (let service of internationalServices) {
    let body;
    try {
      const opts = {...delivery.calcInternationalUrl};
      const reqCopy = {...request.req, ...service.req};
      const formData = new URLSearchParams();
      for (let key of Object.keys(reqCopy)) {
        formData.append(key, reqCopy[key]);
      }
      opts.body = formData;
      const res = await requestWrapper({ format: 'text', req, ...opts });
      body = res.body;
    } catch(e) {
      errors.push(getTariffErrorMessage('Изменилось api'));
    }
    if (!body) {
      continue;
    }

    try {
      const $ = cheerio.load(body);
      const blocks = $(selectors.tariffs);

      if (blocks.length) {
        const text = $(blocks[1]).text().trim();
        if (/сумма/gi.test(text)) {
          request.tariffs.push(createTariff(
            `${service.title}`,
            text.replace(COSTREGDOT, '').replace(/\.$/, ''),
            ''
          ));
        } else {
          errors.push(text);
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

const getInitialCities = async ({ delivery, req }) => {
  const opts = { ...delivery.citiesUrl };
  try {
    const { body } = await requestWrapper({ format: 'text', req, ...opts });
    const $ = cheerio.load(body);
    const from = $(selectors.cityFromOption);
    const to = $(selectors.cityToOption);
    return {
      citiesFrom: Array.from(from).map(v => ({ name: $(v).text().trim(), id: $(v).attr('value') })),
      citiesTo: Array.from(to).map(v => ({ name: $(v).text().trim(), id: $(v).attr('value') })),
    }
  } catch (e) {
    throw getResponseError('Не удалось получить города с сайта. Изменилось API');
  }
};

const getCountries = async ({ delivery, req }) => {
  const opts = { ...delivery.countriesUrl };
  try {
    const { body } = await requestWrapper({ format: 'text', req, ...opts });
    const $ = cheerio.load(body);
    const country = $(selectors.countryOption);
    return Array.from(country).filter(v => $(v).attr('value')).map(v => ({ name: $(v).text().trim(), id: $(v).attr('value') }));
  } catch (e) {
    throw getResponseError('Не удалось получить страны с сайта. Изменилось API');
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
    const countries = await getCountries({ delivery, req });
    if (shouldAbort(req)) {
      throw new Error('abort');
    }
    const citiesResults = await getCities({ cities, delivery, req, ...initialCities, countries });
    if (shouldAbort(req)) {
      throw new Error('abort');
    }
    const {internationalRequests, requests, errors} = getRequests({ deliveryKey, cities: citiesResults, weights });
    results = results.concat(errors);
    for (let request of requests) {
      if (shouldAbort(req)) {
        break;
      }
      results.push(await getCalcResults({ request, delivery, req }));
    }
    for (let request of internationalRequests) {
      if (shouldAbort(req)) {
        break;
      }
      results.push(await getIntCalcResults({ request, delivery, req }));
    }
  } catch(error) {
    results = allResultsError({ deliveryKey, weights, cities, error });
  }

  return results;

};