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

const selectors = {
  tariffResults: '#TariffsTable tbody tr'
};

const services = [
  {title: 'документы', req: {'type': 'DOCUMENT'}},
  {title: 'груз', req: {'type': 'PACKAGE'}},
];

const getReq = (from, to) => {
  from = from || {};
  to = to || {};
  return {
    dutiable: false,
    extendedLiability: null,
    fromAddress: from,
    globalMailShipment: false,
    packages: [{ packaging: {
      fixedWeight: false,
      height: 1,
      id: "CODE",
      length: 1,
      maxQuantity: 999,
      name: "Your Own Package",
      packageType: "CUSTOM",
      pallet: false,
      shipmentType: "BOTH",
      units: "METRIC",
      width: 1,
    }, quantity: 1, weight: 1 }],
    shippingDate: moment().format('YYYY-MM-DD'),
    toAddress: to,
    totalDeclaredValue: "",
    type: "DOCUMENT",
    wccType: "CLICK"
  }
};

const _getCity = async ({ city, country, delivery, req }) => {
  let trim = getCity(city);
  trim = trim.replace(/[0-9]*/g, '').trim();
  const splits = trim.split(' ');
  trim = splits[0];
  const result = {
    success: false
  };
  let json;
  try {
    const opts = {...delivery.citiesUrl};
    opts.uri += encodeURIComponent(trim);
    opts.uri += `&countryCode=${country}`;
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
  if (!json.length) {
    result.error = getCityNoResultError(trim);
  } else {
    result.success = true;
    let addition = {};
    if (json[0].facilityList && json[0].facilityList.length) {
      addition.facilityId = json[0].facilityList[0].facilityIdentifier;
      addition.serviceAreaCode = json[0].facilityList[0].serviceAreaCode;
    }
    result.item = {
      facilityId: addition.facilityId,
      postCode: json[0].postalCode,
      serviceAreaCode: addition.serviceAreaCode,
      countryCode: json[0].country,
      cityName: json[0].city
    };
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
        const result = await _getCity({city: city.fromEngName, country: city.countryFromEngShort, delivery, req});
        cityObj[fromKey] = result;
        city.fromJSON = result;
      }
      if (cityObj[toKey]) {
        city.toJSON = { ...cityObj[toKey] };
      } else {
        const result = await _getCity({city: city.toEngName, country: city.countryToEngShort, delivery, req});
        cityObj[toKey] = result;
        city.toJSON = result;
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
    } else if (!item.fromJSON.success) {
      errors = errors.concat(getResponseErrorArray({ deliveryKey, weights, city: item, error: item.fromJSON.error }));
    } else if (!item.toJSON.success) {
      errors = errors.concat(getResponseErrorArray({ deliveryKey, weights, city: item, error: item.toJSON.error }));
    } else {
      tempRequests.push({
        city: {
          ...item,
          fromJSON: undefined,
          toJSON: undefined,
          from: item.fromJSON.item.cityName,
          to: item.toJSON.item.cityName,
        },
        req: getReq(item.fromJSON.item, item.toJSON.item),
        delivery: deliveryKey,
      });
    }
  });
  tempRequests.forEach((item) => {
    weights.forEach((weight) => {
      const req = {...item.req };
      req.packages = req.packages.map(v => ({ ...v, weight }));
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
  const errors = [];
  for (let service of services) {
    let body;
    try {
      const opts = {...delivery.calcUrl};
      const reqCopy = {...request.req, ...service.req};
      opts.body = JSON.stringify(reqCopy);
      opts.headers['Content-Type'] = 'application/json';
      opts.headers['origin'] = 'https://mydhl.express.dhl';
      opts.headers['referer'] = 'https://mydhl.express.dhl/kz/ru/shipment.html';
      const res = await requestWrapper({ req, ...opts });
      body = res.body;
    } catch(e) {}
    if (!body) {
      continue;
    }
    try {
      Array.isArray(body) && body.forEach(v => {
        request.tariffs.push(createTariff(
          `${service.title} ${v.localProductName}`,
          v.payment.total.value,
          moment(v.estimatedDeliveryDate, 'YYYY-MM-DD').diff(moment(), 'days')
        ));
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