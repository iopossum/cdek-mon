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

const selectors = {
  tariffResults: '#TariffsTable tbody tr'
};

const services = [
  {title: 'ДД', req: {'CityFromTake': 0, 'CityToTake': 0}},
  {title: 'ДС', req: {'CityFromTake': 0, 'CityToTake': 1}},
  {title: 'СС', req: {'CityFromTake': 1, 'CityToTake': 1}},
  {title: 'СД', req: {'CityFromTake': 1, 'CityToTake': 0}},
];

const getReq = (from, to) => {
  from = from || {};
  to = to || {};
  return {
    'Insurance[Options][0][Id]': '18c4aa7b-b834-463c-99fe-5631b0b6ae88',
    'Insurance[Options][0][InsuranceType]': 1004501,
    'Insurance[Options][0][Factor]': 30,
    'Insurance[Options][0][MaxInsurance]': 5000,
    'Insurance[Options][0][MinInsurance]': 0,
    'Insurance[Options][0][DefaultInsurance]': 5000,
    'Insurance[Options][0][IsSimplifiedProduct]': 'false',
    'Insurance[Options][0][aass]': '0,00 - 5000,0000000000',
    'Insurance[Options][1][Id]': '5480a21f-93c4-4edf-a629-9547ef798495',
    'Insurance[Options][1][InsuranceType]': 1004501,
    'Insurance[Options][1][Factor]': 60,
    'Insurance[Options][1][MaxInsurance]': 15000,
    'Insurance[Options][1][MinInsurance]': 5001,
    'Insurance[Options][1][DefaultInsurance]': 15000,
    'Insurance[Options][1][IsSimplifiedProduct]': 'false',
    'Insurance[Options][1][aass]': '5001,00 - 15000,0000000000',
    'Insurance[Options][2][Id]': 'c88eb4bc-c059-4d42-b23b-33592936a1cc',
    'Insurance[Options][2][InsuranceType]': 1004501,
    'Insurance[Options][2][Factor]': 150,
    'Insurance[Options][2][MaxInsurance]': 30000,
    'Insurance[Options][2][MinInsurance]': 15001,
    'Insurance[Options][2][DefaultInsurance]': 30000,
    'Insurance[Options][2][IsSimplifiedProduct]': 'false',
    'Insurance[Options][2][aass]': '15001,00 - 30000,0000000000',
    'Insurance[Checked]': 'false',
    'Insurance[SelectedInsuranceId]': '',
    'Insurance[SelectedInsuranceAmount]': '',
    'Insurance[SelectedInsuranceSum]': '',
    'Insurance[BlockedMethod]': '',
    'Insurance[InsurancesForDispatchObjectTypeId]': 11201,
    'AddressFromValues[FullName]': from.FullAddress,
    'AddressFromValues[CityName]': from.CityName,
    'AddressFromValues[CountryId]': from.CountryId,
    'AddressFromValues[RegionId]': from.RegionId,
    'AddressFromValues[CityId]': from.CityId,
    'AddressToValues[FullName]': to.FullAddress,
    'AddressToValues[CityName]': to.CityName,
    'AddressToValues[CountryId]': to.CountryId,
    'AddressToValues[RegionId]': to.RegionId,
    'AddressToValues[CityId]': to.CityId,
    'CityFromId': from.CityId,
    'CityToId': to.CityId,
    'UserType': 'individual',
    'CalculateWeight': 1,
    'DispatchObjectTypes': 11201,
    'DispatchPiece[DispatchObjectTypes]': 11201,
    'DispatchPiece[WrapperHeight]': 5,
    'DispatchPiece[WrapperLength]': 5,
    'DispatchPiece[WrapperWidth]': 5,
    'DispatchPiece[PhysicalWeight]': 1,
    'DispatchPiece[PieceCount]': 1,
    'DispatchPiece[DistributionCount]': 1,
    'DispatchPiece[CalculateWeight]': 1,
    'DispatchPiece[Id]': 2,
    'TariffId': '324c26f4-ba73-49f4-89db-98e36a69b134',
    'DeliveryType': 12303,
    'IsLegalClient': 'false',
    'CityFromTake': 0,
    'CityToTake': 0
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
    const formData = new URLSearchParams();
    formData.append('highlightClass', 'highlight');
    formData.append('filter', trim);
    formData.append('filterType', 'contains');
    opts.body = formData;
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
  json = findInArray(json, trim, 'CityName', true);
  if (!json.length) {
    result.error = getCityNoResultError(trim);
  } else {
    const region = getRegionName(city);
    let founds = [];
    if (region || country) {
      founds = findInArray(json, region || country, 'FullAddress');
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
      item.fromJSON.items.forEach((fromCity) => {
        item.toJSON.items.forEach((toCity) => {
          tempRequests.push({
            city: {
              ...item,
              fromJSON: undefined,
              toJSON: undefined,
              from: fromCity.FullAddress,
              to: toCity.FullAddress,
            },
            req: getReq(fromCity, toCity),
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
        req: {...item.req, 'CalculateWeight:': weight, 'DispatchPiece[CalculateWeight]': weight, 'DispatchPiece[PhysicalWeight]': weight},
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
      const formData = new URLSearchParams();
      for (let key of Object.keys(reqCopy)) {
        formData.append(key, reqCopy[key]);
      }
      opts.body = formData;
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
        const tds = $(tr).find('td');
        const deliveryTime = $(tds[3]).text().trim();
        request.tariffs.push(createTariff(
          `${service.title} ${$(tds[1]).text().trim()}`,
          $(tds[2]).text().trim(),
          /на/.test(deliveryTime) ? '' : deliveryTime.replace(DELIVERYTIMEREG, '')
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
    const citiesResults = await getCities({cities, delivery, req});
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