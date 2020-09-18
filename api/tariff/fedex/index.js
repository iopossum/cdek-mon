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
  POSTCODEFROMNOTFOUND,
  POSTCODETONOTFOUND,
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

const selectors = {
  countryFromOptions: '#origCountryId option',
  countryToOptions: '#destCountryId option',
  tariffResults: '.tablebold tr',
  tariffNoResults: '.contentsmall .error',
};

const services = [
  {title: 'ДД', req: {'receivedAtCode': 1}},
  {title: 'СД', req: {'receivedAtCode': 5}},
];

const getReq = (item) => {
  return {
    BuildTimeStamp: '2020-02-28 AT 08:50:31',
    transitTime:false,
    doEdt:false,
    locId: 'express',
    originSelected: 'N',
    destSelected: 'N',
    origState: '',
    pricingOptionDisplayed: false,
    cmdcResponse: '',
    zipField: '',
    currentPage: 'rfsshipfromto',
    outlookAddressType: '',
    outLookResult: '',
    origCountry: item.countryFromEngShort,
    origZip: item.postcodeFrom,
    origCity: getCity(item.from),
    destCountry: item.countryToEngShort,
    destZip: item.postcodeTo,
    destCity: getCity(item.to),
    pricingOption: 'FEDEX_STANDARD_RATE',
    totalNumberOfPackages: 1,
    isPackageIdentical: 'YES',
    perPackageWeight: 1,
    weightUnit: 'kgs',
    receivedAtCode: 1,
    shipDate: moment().format('MM/DD/YYYY'),
    shipCalendarDate: moment().format('MM/DD/YYYY')
  }
};

const getCities = async ({ cities, delivery, req, countriesFrom, countriesTo }) => {
  const countryFromObj = _.keyBy(countriesFrom, 'name');
  const countryToObj = _.keyBy(countriesTo, 'name');
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
      if (!city.postcodeFrom) {
        city.error = POSTCODEFROMNOTFOUND;
        return callback(null, city);
      }
      if (!city.postcodeTo) {
        city.error = POSTCODETONOTFOUND;
        return callback(null, city);
      }
      if (!city.countryFrom) {
        city.countryFrom = "российская федерация";
      }
      if (!city.countryTo) {
        city.countryTo = "российская федерация";
      }
      if (!countryFromObj[city.countryFrom.toLowerCase()]) {
        city.error = COUNTRYFROMNOTFOUND;
        return callback(null, city);
      }
      if (!countryToObj[city.countryTo.toLowerCase()]) {
        city.error = COUNTRYTONOTFOUND;
        return callback(null, city);
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
    } else {
      tempRequests.push({
        city: {
          ...item
        },
        req: getReq(item),
        delivery: deliveryKey,
      });
    }
  });
  tempRequests.forEach((item) => {
    weights.forEach((weight) => {
      requests.push({
        ...item,
        city: {...item.city},
        weight,
        req: {...item.req, 'perPackageWeight': weight},
        tariffs: []
      });
    });
  });
  return {requests, errors};
};

const getCalcResults = async ({ request, delivery, req, cookie }) => {
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
      opts.body = formData;
      opts.headers.Cookie = 'siteDC=edc; ';
      opts.headers.Cookie += 'xacc=RU; ';
      opts.headers.Cookie += 'Rbt=f0; ';
      opts.headers.Cookie += cookie;
      const res = await requestWrapper({ format: 'text', req, ...opts });
      body = res.body;
    } catch(e) {}
    if (!body) {
      continue;
    }
    try {
      const $ = cheerio.load(body);
      const trs = $(selectors.tariffResults);
      trs.each(function (index, tr) {
        if ([0,1].indexOf(index) === -1) {
          const _service = $($(tr).find('td')[2]).text().trim();
          let time = $($(tr).find('td')[1]).text().trim();
          if (/Невозможно определить/.test(time)) {
            time = '';
          } else {
            const splits = time.split(' ');
            const date = [splits[0], splits[1], splits[2], splits[3]].join(' ');
            const momentDate = moment(date, 'dd MMMM D, YYYY', 'ru');
            if (momentDate.isValid()) {
              time = momentDate.diff(moment(), 'days') + 1;
            }
          }
          const cost = $($(tr).find('td')[3]).text().trim();
          request.tariffs.push(createTariff(`${service.title} ${_service}`, cost + '$', time));
        }
      });
      if ($(selectors.tariffNoResults).length) {
        throw new Error($(selectors.tariffNoResults).text().trim());
      }
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

const getCountries = async ({ delivery, req }) => {
  const opts = {...delivery.countriesUrl };
  const result = {
    countriesFrom: [],
    countriesTo: []
  };
  try {
    const { response, body } = await requestWrapper({format: 'text', req, ...opts});
    try {
      const reg = /(WGRTSESSIONID=[^;]*;)/;
      const match = response.headers.get('set-cookie').match(reg);
      result.cookie = match[1];
    } catch (e) {}
    const $ = cheerio.load(body);
    const fromOpts = $(selectors.countryFromOptions);
    const toOpts = $(selectors.countryToOptions);
    fromOpts.each(function (index, item) {
      if ($(item).attr('value')) {
        result.countriesFrom.push({
          id: $(item).attr('value'),
          name: $(item).text().trim().toLowerCase()
        });
      }
    });
    toOpts.each(function (index, item) {
      if ($(item).attr('value')) {
        result.countriesTo.push({
          id: $(item).attr('value'),
          name: $(item).text().trim().toLowerCase()
        });
      }
    });
    if (!result.countriesFrom.length || !result.countriesTo.length) {
      throw 1;
    }
    return result;
  } catch (e) {
    throw new Error(getCountriesError("Изменился контент сайта"));
  }
};

module.exports = async function ({ deliveryKey, weights, cities, req}) {
  const delivery = getOne(deliveryKey);
  let results = [];

  try {
    const countriesObj = await getCountries({ delivery, req });
    if (shouldAbort(req)) {
      throw new Error('abort');
    }
    if (!countriesObj.cookie) {
      throw new Error(getResponseError('Не удалось получить cookie'));
    }
    const citiesResults = await getCities({ cities, delivery, req, ...countriesObj });
    if (shouldAbort(req)) {
      throw new Error('abort');
    }
    const {requests, errors} = getRequests({ deliveryKey, cities: citiesResults, weights });
    results = results.concat(errors);
    for (let request of requests) {
      if (shouldAbort(req)) {
        break;
      }
      results.push(await getCalcResults({ request, delivery, req, cookie: countriesObj.cookie }));
    }
  } catch(error) {
    results = allResultsError({ deliveryKey, weights, cities, error });
  }

  return results;

};