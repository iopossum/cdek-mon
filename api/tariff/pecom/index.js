import { getOne, pochtaCountryChanger } from '../../helpers/delivery';
import {
  shouldAbort,
  findInArray,
  randomTimeout
} from '../../helpers/common';
import {
  CITIESREQUIRED,
  CITYFROMNOTFOUND,
  CITYTONOTFOUND,
  CITYFROMREQUIRED,
  DELIVERYTIMEREG,
  COUNTRYFROMRUSSIA,
  CITYORCOUNTRYTOREQUIRED,
  CITYORCOUNTRYREQUIRED,
  CITYORCOUNTRYTONOTFOUND,
  UNABLETOGETTARIFF,
  COUNTRYTONOTFOUND,
  COSTREG,
  getCity,
  allResultsError,
  createTariff,
  getJSONChangedMessage,
  getRegionName,
  getNoResultError,
  getCityJsonError,
  getDistrictName,
  getTariffErrorMessage,
  getContentChangedMessage, COUNTRYFROMNOTFOUND,
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
} from '../../helpers/browser';
const async = require('promise-async');
const cheerio = require('cheerio');
const logger = require('../../helpers/logger');
const cfg = require('../../../conf');
const moment = require('moment');

const selectors = {
  cityFromInput: '.bid-dir-block__from .bid-input-direction__control-field textarea',
  cityToInput: '.bid-dir-block__to .bid-input-direction__control-field textarea',
  cityFromDropdownOption: '.bid-dir-block__from .bid-input-direction__control .bid-input-direction__dropdown .bid-input-direction__item',
  cityToDropdownOption: '.bid-dir-block__to .bid-input-direction__control .bid-input-direction__dropdown .bid-input-direction__item',
  weightInput: 'input[name="CargoTab1TotalWeight"]',
  fromServices: '.bid-dir-block__from .select-dir__radio-wrapper .modal-dir__radio label',
  toServices: '.bid-dir-block__to .select-dir__radio-wrapper .modal-dir__radio label',
  fastTariffs: '.bid-check__faster .bid-check__faster-container .container-type',
  tariffs: '.bid-check .bid-check__inner .bid-check__info.info-table .m-total',
  deliveryTime: '.bid-check .bid-check__est .bid-check__est-date',
  date: '.bid-dir-bottom__datetime .bid-date input',
};

const setWeight = async ({ page, weight }) => {

  const weightInput = await page.$(selectors.weightInput);
  await weightInput.focus();
  await page.keyboard.down('Control');
  await page.keyboard.press('KeyA');
  await page.keyboard.up('Control');
  await page.keyboard.press('Backspace');
  await page.waitFor(100);
  await weightInput.focus();
  await page.keyboard.type(weight.toString());

};

const setCity = ({ page, city, isCountry, country, notFoundMessage, delivery, isFrom }) => {
  return new Promise(async (resolve, reject) => {
    try {
      const selector = isFrom ? selectors.cityFromInput : selectors.cityToInput;
      const dropdownSelector = isFrom ? selectors.cityFromDropdownOption : selectors.cityToDropdownOption;
      city = isCountry ? country : city;
      const trim = getCity(city);
      const cityInput = await page.$(selector);
      await cityInput.focus();
      await page.keyboard.down('Control');
      await page.keyboard.press('KeyA');
      await page.keyboard.up('Control');
      await page.keyboard.press('Backspace');
      await page.waitFor(100);
      await cityInput.focus();
      await page.keyboard.type(city);

      try {
        await waitForWrapper(page, dropdownSelector);
      } catch (e) {
        throw new Error(notFoundMessage);
      }

      let optionsHandlers = await page.$$(dropdownSelector);
      if (!optionsHandlers.length) {
        throw new Error(notFoundMessage);
      }

      const options = await page.evaluate(s => Array.from(document.querySelectorAll(s)).map(v => v.innerText), dropdownSelector);

      if (!options.length) {
        throw new Error(notFoundMessage);
      }

      let values = options.map((item, index) => ({name: item, index}));
      const region = getRegionName(city);
      const district = getDistrictName(city);
      const filtered = findInArray(values, trim, 'name', true);

      if (!filtered.length) {
        throw new Error(notFoundMessage);
      }

      let founds = [];
      if (country) {
        founds = findInArray(filtered, country, 'name');
        if (!founds.length) {
          throw new Error(notFoundMessage);
        }
      }

      if (region) {
        founds = findInArray(founds.length ? founds : filtered, region, 'name');
        if (!founds.length) {
          throw new Error(notFoundMessage);
        }
      }
      if (district) {
        founds = findInArray(founds.length ? founds : filtered, district, 'name');
      }
      const result = founds.length ? founds[0] : filtered[0];
      const splits = result.name.split('\n');

      Promise.all([
        waitForResponse({
          page,
          url: delivery.calcUrl.uri,
          checkFn: (response) => response.request().postData().indexOf('Order.Address.Price') > -1,
          timeout: 10000
        }).catch(() => null),
        waitForResponse({
          page,
          url: delivery.calcUrl.uri,
          checkFn: (response) => response.request().postData().indexOf('Order.Request.Update') > -1,
          timeout: 5000
        }).catch(() => null),
      ])
        .then(() => resolve(splits[0]))
        .catch(() => {
          resolve(splits[0]);
        });

      await optionsHandlers[result.index].click();
    } catch(e) {
      reject(e);
    }
  });
};

const getTariffs = async ({ delivery, page, date, service }) => {
  let tariffs = [];
  try {
    await waitForResponse({ page, url: delivery.calcUrl.uri, checkFn: (response) => response.request().postData().indexOf('Order.Request.Update') > -1, message: UNABLETOGETTARIFF});
    await page.waitFor(100);
    const items = await page.evaluate((fastSelector, tariffSelector, deliverySelector) => {
      let results = [];
      document.querySelectorAll(fastSelector).forEach(e => {
        const service = e.querySelector('.container-type__text-name');
        const price = e.querySelector('.container-type__text .container-type__radio-price');
        const time = e.querySelector('.container-type__radio .container-type__radio-price');
        if (service && price && time) {
          results.push({service: service.innerText, cost: price.innerText, time: time.innerText});
        }
      });
      if (!results.length) {
        const price = document.querySelector(tariffSelector);
        const time = document.querySelector(deliverySelector);
        if (price) {
          results.push({service: 'доставка', cost: price.innerText, time: time ? time.innerText.trim() : ''});
        }
      }
      return results;
    }, selectors.fastTariffs, selectors.tariffs, selectors.deliveryTime);
    tariffs = items.map(v => createTariff(
      `${service} ${v.service}`,
      v.cost.replace(COSTREG, ''),
      v.time && moment(v.time, 'DD MMMM', 'ru').isValid() ? Math.max(moment(v.time, 'DD MMMM', 'ru').diff(date, 'days') - 1, 0) : ''
    ));
  } catch(e) {
    throw e;
  }
  return tariffs;
};

const getHandleProps = async (handle) => {
  return await handle.evaluate(n => {
    return {
      text: n.innerText,
      checked: n.querySelector('input') && n.querySelector('input').checked
    }
  });
};

const getServiceTitle = (from, to) => {
  let result = '';
  if (/Забрать/gi.test(from) && /Доставить/gi.test(to)) {
    result = 'ДД';
  } else if (/Забрать/gi.test(from) && /Получить/gi.test(to)) {
    result = 'ДС';
  } else if (/Сдать/gi.test(from) && /Получить/gi.test(to)) {
    result = 'СС';
  } else if (/Сдать/gi.test(from) && /Доставить/gi.test(to)) {
    result = 'СД';
  }
  return result;
};

const setTariffs = async ({ delivery, result, page, fromServices, toServices, date }) => {
  const errors = [];

  const actions = [];
  const fromProps = await getHandleProps(fromServices[0]);
  const toProps = await getHandleProps(toServices[0]);
  actions.push({
    completed: true,
    title: getServiceTitle(fromProps.text, toProps.text)
  });
  if (toServices[1]) {
    const fromProps = await getHandleProps(fromServices[0]);
    const { text } = await getHandleProps(toServices[1]);
    actions.push({
      handle: toServices[1],
      title: getServiceTitle(fromProps.text, text),
    });
  }
  if (fromServices[1]) {
    const { text } = await getHandleProps(fromServices[1]);
    const toProps = await getHandleProps(toServices[toServices[1] ? 1 : 0]);
    actions.push({
      handle: fromServices[1],
      title: getServiceTitle(text, toProps.text),
    });
  }
  if (fromServices[1] && toServices[1]) {
    const { text } = await getHandleProps(fromServices[0]);
    const toProps = await getHandleProps(toServices[1]);
    actions.push({
      handle: fromServices[0],
      title: getServiceTitle(text, toProps.text),
    });
  }

  for (let i = 0; i < actions.length; i++) {
    try {
      if (!actions[i].completed) {
        await actions[i].handle.click();
      }
      const tariffs = await getTariffs({delivery, page, date, service: actions[i].title});
      result.tariffs = result.tariffs.concat(tariffs);
    } catch(e) {
      errors.push(e.message);
    }
  }
  if (!result.tariffs.length) {
    result.error = errors.length ? errors[0] : getNoResultError();
  }
};

const getResult = async ({ deliveryKey, city, page, weights }) => {
  const delivery = getOne(deliveryKey);
  let results = [];
  try {
    await page.goto(delivery.pageUrl.uri);

    await waitForWrapper(page, selectors.cityFromInput);
    await waitForWrapper(page, selectors.cityToInput);

    let fromFound = await setCity({page, city: city.from, notFoundMessage: CITYFROMNOTFOUND, delivery, isFrom: true });
    if (city.from) {
      try {
        fromFound = await setCity({page, city: city.from, country: city.countryFrom, notFoundMessage: CITYFROMNOTFOUND, delivery, isFrom: true });
      } catch(e) {}
      if (!fromFound) {
        if (city.countryFrom) {
          fromFound = await setCity({page, isCountry: true, city: city.countryFrom, country: city.countryFrom, notFoundMessage: COUNTRYFROMNOTFOUND, delivery, isFrom: true });
        } else {
          throw new Error(COUNTRYFROMNOTFOUND);
        }
      }
    } else {
      fromFound = await setCity({page, isCountry: true, city: city.countryFrom, country: city.countryFrom, notFoundMessage: COUNTRYFROMNOTFOUND, delivery, isFrom: true });
    }

    let toFound;
    if (city.to) {
      try {
        toFound = await setCity({page, city: city.to, country: city.countryTo, notFoundMessage: CITYTONOTFOUND, delivery });
      } catch(e) {}
      if (!toFound) {
        if (city.countryTo) {
          toFound = await setCity({page, isCountry: true, city: city.countryTo, country: city.countryTo, notFoundMessage: COUNTRYTONOTFOUND, delivery });
        } else {
          throw new Error(CITYTONOTFOUND);
        }
      }
    } else {
      toFound = await setCity({page, isCountry: true, city: city.countryTo, country: city.countryTo, notFoundMessage: COUNTRYTONOTFOUND, delivery });
    }

    Object.assign(city, {
      from: fromFound,
      to: toFound,
    });

    await waitForWrapper(page, selectors.weightInput);

    let fromServices = await page.$$(selectors.fromServices);
    if (!fromServices.length) {
      throw new Error(getNoResultError());
    }

    let toServices = await page.$$(selectors.toServices);
    if (!toServices.length) {
      throw new Error(getNoResultError());
    }

    let date = moment().add(1, 'days');
    try {
      const d = await page.evaluate(d => document.querySelector(d).value, selectors.date);
      date = moment(d, 'DD.MM.YYYY');
    } catch(e) {}

    for (let i = 0; i < weights.length; i++) {

      const result = {
        city: {...city},
        weight: weights[i],
        tariffs: [],
        req: {},
        delivery: deliveryKey
      };

      try {
        await setWeight({ weight: weights[i], page });
        await fromServices[0].click();
        await toServices[0].click();
        await page.waitFor(500);
        fromServices = await page.$$(selectors.fromServices);
        toServices = await page.$$(selectors.toServices);
        await setTariffs({ page, delivery, fromServices, toServices, date, result });
      } catch (e) {
        result.error = e.message;
      }

      results.push(result);

    }
  } catch(e) {
    results = results.concat(allResultsError({ deliveryKey, weights, cities: [city], error: e.message || e.stack, req: {} }));
  }
  await refreshPage(page);
  return results;
};

module.exports = async function ({ deliveryKey, weights, cities, req}) {

  let results = [];
  let browser;
  let page;
  try {
    browser = await getBrowser();
    page = await newPage(browser);
    for (let i = 0; i < cities.length; i++) {
      const initialCity = {
        ...cities[i],
        initialCountryFrom: cities[i].countryFrom,
        initialCountryTo: cities[i].countryTo,
        initialCityFrom: cities[i].from,
        initialCityTo: cities[i].to,
      };
      if (!cities[i].from && !cities[i].countryFrom) {
        results = results.concat(allResultsError({ deliveryKey, weights, cities: [cities[i]], error: CITYORCOUNTRYREQUIRED }));
        continue;
      }
      if (!cities[i].to && !cities[i].countryTo) {
        results = results.concat(allResultsError({ deliveryKey, weights, cities: [cities[i]], error: CITYORCOUNTRYTOREQUIRED }));
        continue;
      }
      await randomTimeout(cfg.browser.delay.min, cfg.browser.delay.max);
      if (!shouldAbort(req)) {
        const data = await getResult({ deliveryKey, city: initialCity, page, weights });
        results = results.concat(data);
      }
    }
  } catch(error) {
    results = allResultsError({ deliveryKey, weights, cities, error });
  }

  await closePage(page);
  await closeBrowser(browser);

  return results;
};