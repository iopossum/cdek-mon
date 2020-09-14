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
  COUNTRYRUSSIA,
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
  getPVZNoResultError,
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

const getReq = (from, to) => {
  from = from || {};
  to = to || {};
  return {
    Weight: 1,
    Volume: 1,
    GoodItems: [{"Weight":"1","Length":"1","Width":"1","Height":"1"}],
    ValuatedAmount: 0,
    ShipmentDate: '',
    timeOrderTransfer: '',
    delivery: 3,
    fromPlace: from.city.name,
    fromPickpoint: from.pvz.Special_Code,
    fromRegion: from.city.region,
    fromRegionCode: from.city.RegionCode,
    toPlace: to.city.name,
    toPickpoint: to.pvz.Special_Code,
    toRegion: to.city.region,
    toRegionCode: to.city.RegionCode,
    Job: 'C24',
    captchaToken: 'blabla'
  }
};

const getPVZ = (pvzObj, city) => {
  const found = pvzObj[city.region];
  let result;
  if (found) {
    for (let value of Object.values(found)) {
      if (Array.isArray(value) && value.length) {
        result = value.find(v => v.RegionCode === city.RegionCode);
        if (result) {
          break;
        }
      }
    }
  }
  return result;
};

const getCities = async ({cities, emlData}) => {
  const {c2cFromPlaces, c2cToPlaces, c2cFromPickpoints, c2cToPickpoints} = emlData;
  return await async.mapSeries(cities, async (item, callback) => {
    try {
      const city = {
        ...item,
        initialCityFrom: item.from,
        initialCityTo: item.to,
        initialCountryFrom: item.countryFrom,
        initialCountryTo: item.countryTo,
      };
      if (city.countryFrom || city.countryTo) {
        city.error = COUNTRYRUSSIA;
        return callback(null, city);
      }
      let trim = getCity(city.from);
      let from = findInArray(c2cFromPlaces, trim, 'name', true);
      if (!from.length) {
        city.error = getCityNoResultError(city.from);
        return callback(null, city);
      }
      trim = getCity(city.to);
      let to = findInArray(c2cToPlaces, trim, 'name', true);
      if (!to.length) {
        city.error = getCityNoResultError(city.from);
        return callback(null, city);
      }
      const fromPVZ = getPVZ(c2cFromPickpoints, from[0]);
      if (!fromPVZ) {
        city.error = getPVZNoResultError(from[0].name);
        return callback(null, city);
      }
      const toPVZ = getPVZ(c2cToPickpoints, to[0]);
      if (!toPVZ) {
        city.error = getPVZNoResultError(to[0].name);
        return callback(null, city);
      }
      city.fromJSON = { city: from[0], pvz: fromPVZ };
      city.toJSON = { city: to[0], pvz: toPVZ };
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
          ...item,
          fromJSON: undefined,
          toJSON: undefined,
          from: item.fromJSON.city.name,
          to: item.toJSON.city.name,
        },
        req: getReq(item.fromJSON, item.toJSON),
        delivery: deliveryKey,
      });
    }
  });
  tempRequests.forEach((item) => {
    weights.forEach((weight) => {
      const GoodItems = item.req.GoodItems.slice();
      GoodItems[0].Weight = weight;
      requests.push({
        ...item,
        city: {...item.city},
        weight,
        req: {...item.req, 'Weight': weight, GoodItems: JSON.stringify(GoodItems)},
        tariffs: []
      });
    });
  });
  return {requests, errors};
};

const getCalcResults = async ({ request, delivery, req }) => {
  try {
    const opts = {...delivery.calcUrl};
    const formData = new URLSearchParams();
    for (let key of Object.keys(request.req)) {
      formData.append(key, request.req[key]);
    }
    opts.body = formData;
    const res = await requestWrapper({ req, ...opts, format: 'text' });
    let json = JSON.parse(res.body);
    if (json.error) {
      request.error = getTariffErrorMessage(`Ответ от сервера: ${json.error}` )
    } else {
      request.tariffs.push({
        service: `ПВЗ - ПВЗ`,
        cost: json.deliveryCost,
        deliveryTime: ''
      });
    }
  } catch(e) {
    request.error = getTariffErrorMessage('Изменилось API');
  }
  request.req = {};
  return request;
};

const parseJsonVariable = (strScript, varName) => {
  strScript = strScript || '';
  let result = [];
  if (strScript.search(varName) < 0) {
    return result;
  }
  const reg = new RegExp(varName + ' convertFromJson\\(' + '(.*)\\);');
  const match = strScript.match(reg);
  result = JSON.parse(match[1]);
  return result;
};

const getCitiesFromIml = async ({ delivery, req }) => {
  const opts = { ...delivery.citiesUrl };
  let c2cFromPlaces = [];
  let c2cToPlaces = [];
  let c2cFromPickpoints = [];
  let c2cToPickpoints = [];
  try {
    const res = await requestWrapper({ req, ...opts, format: 'text' });
    const $ = cheerio.load(res.body);
    const text = $($('script')).text();
    c2cFromPlaces = parseJsonVariable(text, "var c2cFromPlaces =");
    c2cToPlaces = parseJsonVariable(text, "var c2cToPlaces =");
    c2cFromPickpoints = parseJsonVariable(text, "var c2cFromPickpoints =");
    c2cToPickpoints = parseJsonVariable(text, "var c2cToPickpoints =");
  } catch (e) {
    throw new Error(getCityJsonError('Изменился контент сайта'));
  }
  return {c2cFromPlaces, c2cToPlaces, c2cFromPickpoints, c2cToPickpoints};
};

module.exports = async function ({ deliveryKey, weights, cities, req}) {
  const delivery = getOne(deliveryKey);
  let results = [];

  try {
    const emlData = await getCitiesFromIml({ delivery, req });
    if (shouldAbort(req)) {
      throw new Error('abort');
    }
    const citiesResults = await getCities({ cities, delivery, req, emlData });
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