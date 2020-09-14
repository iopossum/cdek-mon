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
  countryOption: '#ccp option',
  tariffResults: '.calcul tr'
};

const services = [
  {title: 'Документы', req: {packaging: 'b02'}},
  {title: 'Недокументы', req: {packaging: 'b00'}},
];

const getReq = (from, to) => {
  from = from || {};
  to = to || {};
  return {
    endselcat: 0,
    LANG: 'rus',
    city: from.text,
    cityo: from.id,
    citypp: to.text,
    cityp: to.id,
    f_length: '',
    f_width: '',
    f_height: '',
    declarv: 'd',
    packaging: 'b02',
    api_cargo_cost: '',
    _: new Date().getTime()
  }
};

const getInternationalReq = (from, countryTo, to) => {
  from = from || {};
  return {
    endselcat: 0,
    LANG: 'rus',
    city: from.text,
    cityo: from.id,
    countryp: countryTo.id,
    citypp: to ? to.text : '',
    cityp: to ? to.id : '',
    f_length: '',
    f_width: '',
    f_height: '',
    f_cena: '',
    declarv: 'd',
    packaging: 'b02', //b00
    _: new Date().getTime()
  }
};

const _getCity = async ({ city, country, dest, delivery, req }) => {
  const trim = getCity(city);
  const result = {
    city: city,
    cityTrim: trim,
    success: false
  };
  let json;
  try {
    const opts = {...delivery.citiesUrl};
    const formData = encodeURIComponent(
      country ?
      '[{"name":"endselcat","value":"0"},{"name":"sel[]","value":"2"},{"name":"LANG","value":"rus"},{"name":"sel[]","value":"6"},{"name":"sel[]","value":"19"},{"name":"city","value":""},{"name":"cityo","value":""},{"name":"countryp","value":""},{"name":"citypp","value":""},{"name":"cityp","value":""},{"name":"declarv","value":"d"},{"name":"massa","value":""},{"name":"f_length","value":""},{"name":"f_width","value":""},{"name":"f_height","value":""},{"name":"f_cena","value":""},{"name":"packaging","value":"b00"}]' :
      '[{"name":"endselcat","value":"12"},{"name":"sel[]","value":"2"},{"name":"sel[]","value":"5"},{"name":"sel[]","value":"12"},{"name":"city","value":""},{"name":"cityo","value":""},{"name":"citypp","value":""},{"name":"cityp","value":""},{"name":"massa","value":""},{"name":"f_length","value":""},{"name":"f_width","value":""},{"name":"f_height","value":""},{"name":"declarv","value":""}]'
    );
    opts.uri += ('formdata=' + formData);
    opts.uri += ('&cityq=' + dest);
    if (country) {
      opts.uri += ('&country=' + country.id);
    }
    opts.uri += ('&query=' + encodeURIComponent(trim));
    opts.uri += ('&_=' + new Date().getTime());
    const res = await requestWrapper({ format: 'text', req, ...opts });
    json = JSON.parse(res.body);
  } catch(e) {}
  if (!json) {
    result.error = getCityJsonError('Изменился запрос', city);
    return result;
  }
  if (!json.results) {
    result.error = getCityJsonError("Отсутствует results в ответе", trim);
    return result;
  }
  if (!Array.isArray(json.results)) {
    result.error = getCityJsonError("Неверный тип results в ответе", trim);
    return result;
  }
  json.results = findInArray(json.results, trim, 'text', true);
  if (!json.results.length) {
    result.error = getCityNoResultError(trim);
  } else if (json.results.length === 1) {
    result.items = json.results;
    result.success = true;
  } else {
    const region = getRegionName(city);
    let founds = [];
    if (region) {
      founds = findInArray(json.results, region, 'text');
    }
    result.items = founds.length ? founds.slice(0, 2) : json.results.slice(0, 2);
    result.success = true;
    result.hasCountry = !!country;
  }
  return result;
};

const getCities = async ({cities, delivery, req, countries}) => {
  const cityObj = {};
  const countryObj = _.keyBy(countries, 'name');
  return await async.mapSeries(cities, async (item, callback) => {
    try {
      const city = {
        ...item,
        countryFrom: dimexCountryChanger(item.countryFrom),
        countryTo: dimexCountryChanger(item.countryTo),
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
      if (city.countryTo && !countries.length) {
        city.error = getCountriesError('Изменился запрос');
        return callback(null, city);
      }
      if (city.countryTo && !countryObj[city.countryTo.toUpperCase()]) {
        city.error = getCountryNoResultError(city.countryTo);
        return callback(null, city);
      }
      const fromKey = city.from + city.countryFrom;
      const toKey = city.to + city.countryTo;
      if (cityObj[fromKey]) {
        city.fromJSON = { ...cityObj[fromKey] };
      } else {
        const result = await _getCity({city: city.from, dest: 'cityo', delivery, req});
        cityObj[fromKey] = result;
        city.fromJSON = result;
      }
      if (cityObj[toKey]) {
        city.toJSON = { ...cityObj[toKey] };
      } else {
        if (city.countryTo && DIMEXCOUNTRIES.indexOf(city.countryTo) === -1) {
          city.toJSON = { ...countryObj[city.countryTo.toUpperCase()] };
        } else {
          const result = await _getCity({
            city: city.to,
            dest: 'cityp',
            country: city.countryTo && countryObj[city.countryTo.toUpperCase()],
            delivery,
            req
          });
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
  const internationalRequests = [];
  const tempRequests = [];
  const tempIntRequests = [];
  cities.forEach((item) => {
    if (item.error) {
      errors = errors.concat(getResponseErrorArray({ deliveryKey, weights, city: item, error: item.error }));
    } else if (!item.fromJSON.success) {
      errors = errors.concat(getResponseErrorArray({ deliveryKey, weights, city: item, error: item.fromJSON.error }));
    } else if (!item.toJSON.success) {
      errors = errors.concat(getResponseErrorArray({ deliveryKey, weights, city: item, error: item.toJSON.error }));
    } else {
      item.fromJSON.items.forEach((fromCity) => {
        if (item.toJSON.isCountry) {
          tempIntRequests.push({
            city: {
              ...item,
              fromJSON: undefined,
              toJSON: undefined,
              from: fromCity.text,
              to: item.countryTo,
            },
            req: getInternationalReq(fromCity, item.toJSON),
            delivery: deliveryKey,
          });
        } else {
          item.toJSON.items.forEach((toCity) => {
            if (item.toJSON.hasCountry) {
              tempIntRequests.push({
                city: {
                  ...item,
                  fromJSON: undefined,
                  toJSON: undefined,
                  from: fromCity.text,
                  to: toCity.text,
                },
                req: getInternationalReq(fromCity, item.toJSON, toCity),
                delivery: deliveryKey,
              });
            } else {
              tempRequests.push({
                city: {
                  ...item,
                  fromJSON: undefined,
                  toJSON: undefined,
                  from: fromCity.text,
                  to: toCity.text,
                },
                req: getReq(fromCity, toCity),
                delivery: deliveryKey,
              });
            }
          });
        }
      });
    }
  });
  tempRequests.forEach((item) => {
    weights.forEach((weight) => {
      requests.push({
        ...item,
        city: {...item.city},
        weight,
        req: {...item.req, 'massa': weight},
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
        req: {...item.req, massa: weight},
        tariffs: []
      });
    });
  });
  return {internationalRequests, requests, errors};
};

const getCalcResults = async ({ request, delivery, isInternational, req }) => {
  let tariffs = [];
  const errors = [];
  for (let service of services) {
    let body;
    try {
      const opts = {...delivery.calcUrl};
      if (!isInternational) {
        opts.uri += 'sel[]=2&sel[]=5&sel[]=12&';
      } else {
        opts.uri += 'sel[]=2&sel[]=6&sel[]=19&';
      }
      const reqCopy = {...request.req, ...service.req};
      for (let key of Object.keys(reqCopy)) {
        opts.uri += (key + '=' + encodeURIComponent(reqCopy[key]) + '&');
      }
      const res = await requestWrapper({ req, ...opts, format: 'text' });
      body = res.body;
    } catch(e) {}
    if (!body) {
      continue;
    }
    try {
      const $ = cheerio.load(body);
      const trs = $(selectors.tariffResults);
      if (trs[4]) {
        const tds = $(trs[6]).find('td');
        if (tds.length) {
          tariffs.push({
            service: `${service.title} ${$($(trs[2]).find('td')[1]).text()}`,
            cost: $(tds[6]).text().replace(" ", ""),
            deliveryTime: $(tds[0]).text()
          });
        }
      }
      if (trs[8]) {
        const additionalTrs = Array.from(trs).splice(8, trs.length);
        let commonService;
        additionalTrs.forEach(v => {
          const isCommon = $(v).find('td').length === 6;
          if (isCommon) {
            commonService = $($(v).find('td')[0]).text();
          }
          const tds = $(v).find('td');
          tariffs.push({
            service: `${service.title} ${commonService} ${isCommon ? $(tds[1]).text() : $(tds[0]).text()}`,
            cost: $(tds[isCommon ? 5 : 4]).text().replace(" ", ""),
            deliveryTime: ''
          });
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
  const opts = {...delivery.countriesUrl};
  const formData = new URLSearchParams();
  formData.append('formdata', '[{"name":"endselcat","value":"0"},{"name":"sel[]","value":"2"},{"name":"LANG","value":"rus"},{"name":"sel[]","value":"6"},{"name":"sel[]","value":"19"}]');
  opts.body = formData;
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

module.exports = async function ({ deliveryKey, weights, cities, req}) {
  const delivery = getOne(deliveryKey);
  let results = [];

  try {
    const countries = await getCountries({ delivery, req });
    if (shouldAbort(req)) {
      throw new Error('abort');
    }
    const citiesResults = await getCities({cities, delivery, req, countries});
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
      results.push(await getCalcResults({ request, isInternational: true, delivery, req }));
    }
  } catch(error) {
    results = allResultsError({ deliveryKey, weights, cities, error });
  }

  return results;

};