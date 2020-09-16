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

const getReq = (typeFrom, typeTo, service, from, to, fromTerminal, toTerminal) => {
  const req = {
    service: service,

    additional: {
      retrieveAD: {
        location: { id: from.guid },
        point: { address: {id: "", value: ""}, type: typeFrom },
        scanned: false,
        using: false,
      },
      scannedConsignationNote: false,
      specificLoading: {used: false, dispatch: [], destination: []},
      unboxingOD: {used: false, weight: 0}
    },

    cargo: {
      category: { id: "" },
      customId: null,
      dimension: {
        detail: {length: 0.2, width: 0.2, height: 0.2, weight: 0.9},
        general: {volume: 0.13, weight: 0.9, place: 1}
      },
      insurance: {used: false, insurance: 0},
      insurance_ndv: {insurance_ndv: true},
      mode: "dimension",
      pallet: {
       general: {volume: 0.19, weight: 0.9, place: 1},
       wizard: [{length: 1.2, width: 0.8, height: 0.2, weight: 0.9, quantity: 1, type: "european", wrapping: []}],
       wizardUsed: true
      },
      parcel: [{weight: 0.9, quantity: 1, volume: 0.02, wrapping: "box1"}],
      promocode: "",
      type: { cargo: true, correspondence: false },
      wizard: [{length: 0.2, width: 0.2, height: 0.2, weight: 0.9, quantity: 1, wrapping: [], numericWrapping: {safePackage: 1}}],
      wizardUsed: false,
      wrapping: {
        bag1: {used: false, value: 1},
        bag2: {used: false, value: 1},
        box1: {used: false, value: 1},
        box2: {used: false, value: 1},
        box3: {used: false, value: 1},
        box4: {used: false, value: 1},
        bubbleFilmVolume: {value: 0.13, used: false},
        extraBlackPackageVolume: {value: 0.13, used: false},
        extraPackageVolume: {value: 0.13, used: false},
        hardPackageVolume: {value: 0.13, used: false},
        hardPackageVolumeUOD: {value: 0.13, used: false},
        hardPackageVolumeUOD_WP: {value: 0.13, used: false},
        hardPackageVolume_WP: {value: 0.13, used: false},
        palletCollar: {value: 0.13, used: false},
        palletizingBubbleFilmVolume: {value: 0.13, used: false},
        palletizingBubbleFilmVolumeOD: {value: 0.13, used: false},
        palletizingExtraBlackPackageVolume: {value: 0.13, used: false},
        palletizingExtraBlackPackageVolumeOD: {value: 0.13, used: false},
        palletizingExtraPackageVolume: {value: 0.13, used: false},
        palletizingExtraPackageVolumeOD: {value: 0.13, used: false},
        safePackage: {used: false, value: 1}
      }
    },

    currency: "RU",
    customId: null,

    customer: {
      destination: {type: "individual", individual: {name: {id: "", value: ""}, phone: [], email: "", sendCode: true}},
      dispatch: {type: "individual", individual: {name: {id: "", value: ""}, phone: [], email: "", sendCode: true}},
      payer: "dispatch",
      segregated: {
        default: "destination",
        list: {
          '0e924061-6b65-49c8-9fc5-5b7532bb8108': "destination",
          '1f9ead3d-f5ce-4dff-b1f6-649707373104': "destination",
          '8dcec46b-df9a-11e6-80f6-00155d903d0c': "destination",
          '06699496-c50f-45f5-a7d8-6e9476f49490': "destination"
        }
      },
      third: {type: "individual", individual: {name: {id: "", value: ""}, phone: [], email: ""}}
    },

    gateway: {
      destination: {
        location: { id: to.guid },
        point: {
          type: typeTo,
          address: {
            address: [""],
            driverComment: "",
            "hint-kladr": {byHint: false, byHintNoKladr: false},
            needLoading: {fixTime: false, used: false, floor: 1, lift: false},
            shippingTerm: {date_submit: '', time: {start: "14:00", end: "19:00"}, fixTime: false}
          }
        }
      },
      dispatch: {
        location: { id: from.guid },
        point: {
          type: typeFrom,
          address: {
            address: [""],
            driverComment: "",
            "hint-kladr": {byHint: false, byHintNoKladr: false},
            needLoading: {fixTime: false, used: false, floor: 1, lift: false},
            shippingTerm: {date_submit: '', time: {start: "14:00", end: "19:00"}, fixTime: false}
          }
        }
      },
    },

    heightExchange: "0",
    promocode: "",
    vip: false,
  };
  if (typeFrom === 'terminal') {
    delete req.gateway.dispatch.point.address;
    req.gateway.dispatch.point.terminal = {
      shippingTerm: {date_submit: moment().add(1, 'days').format('YYYY-MM-DD'), time: "19:00"},
      terminal: {id: fromTerminal.guid}
    };
  }
  if (typeTo === 'terminal') {
    delete req.gateway.destination.point.address;
    req.gateway.destination.point.terminal = {
      shippingTerm: {date_submit: "", time: "14:00"},
      terminal: {id: toTerminal.guid}
    };
  }
  return req;
};

const getReqs = (from, to, terminals) => {
  from = from || {};
  to = to || {};
  const results = [getReq('address', 'address', 'ДД', from, to)];
  if (terminals.length) {
    const fromTerminal = terminals.find(v => v.location_guid === from.guid);
    const toTerminal = terminals.find(v => v.location_guid === to.guid);
    if (from.has_terminals === "1" && to.has_terminals === "1" && fromTerminal && toTerminal) {
      results.push(getReq('terminal', 'terminal', 'СC', from, to, fromTerminal, toTerminal));
    }
    if (from.has_terminals === "1" && fromTerminal) {
      results.push(getReq('terminal', 'address', 'СД', from, to, fromTerminal, toTerminal));
    }
    if (to.has_terminals === "1" && toTerminal) {
      results.push(getReq('address', 'terminal', 'ДС', from, to, fromTerminal, toTerminal));
    }
  }
  return results;
};

const _getCity = async ({ city, country, delivery, req, cookie }) => {
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
    formData.append('search', trim);
    opts.body = formData;
    opts.headers.cookie = cookie;
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
  json = findInArray(json, trim, 'name', true);
  json = json.filter(v => v.type === 'г');
  if (country) {
    json = json.filter(v => v.country !== 'RU');
  }
  if (!json.length) {
    result.error = getCityNoResultError(trim);
  } else {
    const region = getRegionName(city);
    const district = getDistrictName(city);
    let founds = [];
    if (region) {
      founds = findInArray(json, region, 'region');
      if (!founds.length) {
        result.error = getCityNoResultError(city);
        return result;
      }
    }
    if (district) {
      founds = findInArray(founds.length ? founds : json, district, 'region');
      if (!founds.length) {
        result.error = getCityNoResultError(city);
        return result;
      }
    }
    result.items = founds.length ? founds.slice(0, 2) : json.slice(0, 1);
    result.success = true;
  }
  return result;
};

const getCityName = (city) => {
  let result = '';
  if (city.type) {
    result += city.type + '. ';
  }
  if (city.name) {
    result += city.name + ', ';
  }
  if (city.region) {
    result += city.region;
  }
  return result;
};

const getCities = async ({cities, delivery, req, cookie}) => {
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
      if (!city.from || !city.to) {
        city.error = CITIESREQUIRED;
        return callback(null, city);
      }
      const fromKey = city.from + city.countryFrom;
      const toKey = city.to + city.countryTo;
      if (cityObj[fromKey]) {
        city.fromJSON = { ...cityObj[fromKey] };
      } else {
        const result = await _getCity({city: city.from, country: city.countryFrom, delivery, req, cookie});
        cityObj[fromKey] = result;
        city.fromJSON = result;
      }
      if (cityObj[toKey]) {
        city.toJSON = { ...cityObj[toKey] };
      } else {
        const result = await _getCity({city: city.to, country: city.countryTo, delivery, req, cookie});
        cityObj[toKey] = result;
        city.toJSON = result;
      }
      callback(null, city);
    } catch(e) {
      callback(e);
    }
  });
};

const getRequests = ({ deliveryKey, cities, weights, terminals }) => {
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
              from: getCityName(fromCity),
              to: getCityName(toCity),
            },
            req: getReqs(fromCity, toCity, terminals),
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
        req: [...item.req],
        tariffs: []
      });
    });
  });
  return {requests, errors};
};

const getDeliveryTime = (obj) => {
  let result = '';
  try {
    const start = moment(obj.traffic.dateStart, 'DD MMMM', 'ru');
    const endDates = Object.values(obj.traffic.dates).filter(v => v.end).map(v => v.end);
    let end;
    endDates.forEach(v => {
      const d = moment(v, 'DD MMMM', 'ru');
      if (d.isValid()) {
        if (end) {
          if (d.isAfter(end)) {
            end = d;
          }
        } else {
          end = d;
        }
      }
    });
    if (start.isValid() && end.isValid()) {
      result = end.diff(start, 'days');
    }
  } catch(e) {}
  return result;
};

const getCalcResults = async ({ request, delivery, req, cookie }) => {
  const errors = [];
  for (let item of request.req) {
    let body;
    try {
      const opts = {...delivery.calcUrl};
      let reqCopy = {...item, service: undefined};
      reqCopy.cargo.dimension.general.weight = request.weight;
      reqCopy.cargo.dimension.detail.weight = request.weight;
      opts.body = JSON.stringify(reqCopy);
      opts.headers.cookie = cookie;
      opts.headers['Content-Type'] = 'application/json';
      const res = await requestWrapper({ req, ...opts });
      body = res.body;
    } catch(e) {}
    if (!body) {
      continue;
    }
    if (body.error) {
      errors.push(body.error);
      continue;
    }
    if (!body.cost) {
      errors.push(getTariffErrorMessage('Отсутствует cost в ответе'));
      continue;
    }
    if (!body.cost.total) {
      errors.push(getTariffErrorMessage('Отсутствует cost.total в ответе'));
      continue;
    }
    try {
      request.tariffs.push(createTariff(item.service, body.cost.total.replace(COSTREG, ''), getDeliveryTime(body)));
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

const getCookie = async ({ delivery, req }) => {
  const opts = { ...delivery.tokenUrl };
  try {
    const { response } = await requestWrapper({format: 'text', req, ...opts});
    return response.headers.get('set-cookie');
  } catch (e) {
    throw getResponseError('Не удалось получить cookie');
  }
};

const getTerminals = async ({ delivery, req, cookie }) => {
  const opts = { ...delivery.terminalUrl };
  opts.headers.cookie = cookie;
  let terminals = [];
  try {
    const { body } = await requestWrapper({req, ...opts});
    terminals = body;
  } catch (e) {}
  return terminals;
};

module.exports = async function ({ deliveryKey, weights, cities, req}) {
  const delivery = getOne(deliveryKey);
  let results = [];

  try {
    const cookie = await getCookie({ delivery, req });
    if (shouldAbort(req)) {
      throw new Error('abort');
    }
    const terminals = await getTerminals({ delivery, req, cookie });
    if (shouldAbort(req)) {
      throw new Error('abort');
    }
    const citiesResults = await getCities({cities, delivery, req, cookie});
    if (shouldAbort(req)) {
      throw new Error('abort');
    }
    const {requests, errors} = getRequests({ deliveryKey, cities: citiesResults, weights, terminals });
    results = results.concat(errors);
    for (let request of requests) {
      if (shouldAbort(req)) {
        break;
      }
      results.push(await getCalcResults({ request, delivery, req, cookie }));
    }
  } catch(error) {
    results = allResultsError({ deliveryKey, weights, cities, error });
  }

  return results;

};