import { getOne } from '../../helpers/delivery';
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
  CITYORCOUNTRYTONOTFOUND,
  COUNTRYNOTFOUND,
  COSTREG,
  getCity,
  allResultsError,
  createTariff,
  getJSONChangedMessage,
  getRegionName,
  getNoResultError,
  getCityJsonError,
  getDistrictName,
  getContentChangedMessage,
} from '../../helpers/tariff';
import {
  getBrowser,
  newPage,
  closeBrowser,
  closePage,
  refreshPage,
  waitForWrapper,
  printPDF,
} from '../../helpers/browser';
const async = require('promise-async');
const cheerio = require('cheerio');
const logger = require('../../helpers/logger');
const cfg = require('../../../conf');

const selectors = {
  cityInput: '.v-select input[placeholder="Введите город"]',
  dropdownOption: '.vs__dropdown-menu .vs__dropdown-option',
  radio: '.base-radio.form__radio',
  weightInput: 'input[placeholder="Введите вес посылки, кг"]',
  aInput: 'input[placeholder="Длина',
  bInput: 'input[placeholder="Ширина',
  cInput: 'input[placeholder="Высота',
  submitButton: '.form__group-footer .form__submit',
  services: '.calculator-services .calculator-service',
  toast: '.vue-notification-wrapper .notification-content'
};

const setCity = async (page, cityInput, city, country, notFoundMessage) => {
  const trim = getCity(city);
  await cityInput.type(trim);
  await page.waitFor(1000);
  await waitForWrapper(page, selectors.dropdownOption, {timeout: 10000});
  let optionsHandlers = await page.$$(selectors.dropdownOption);
  if (!optionsHandlers.length) {
    throw new Error(notFoundMessage);
  }
  let values = await page.evaluate(s => Array.from(document.querySelectorAll(s)).map(v => v.innerText), selectors.dropdownOption);
  values = values.map((name, index) => ({ name, index }));
  const region = getRegionName(city);
  const filtered = findInArray(values, trim, 'name', true);
  let founds = [];
  if (country) {
    founds = findInArray(filtered, country, 'name');
  }
  if (region) {
    founds = findInArray(founds.length ? founds : filtered, region, 'name');
  }
  const result = founds.length ? founds[0] : filtered[0];
  await optionsHandlers[result.index].click();
  return result;
};

const getResult = async (delivery, resultObj, browser) => {
  let page;
  try {
    page = await newPage(browser);
    await page.goto(delivery.cookieUrl.uri);

    await waitForWrapper(page, selectors.cityInput);
    const cityInputs = await page.$$(selectors.cityInput);
    if (cityInputs.length < 2) {
      throw new Error(getContentChangedMessage(selectors.cityInput));
    }

    const fromFound = await setCity(page, cityInputs[cityInputs.length === 2 ? 0 : 1], resultObj.city.from, resultObj.city.countryFrom, CITYFROMNOTFOUND);
    const toFound = await setCity(page, cityInputs[cityInputs.length === 2 ? 1 : 2], resultObj.city.to, resultObj.city.countryTo, CITYTONOTFOUND);
    Object.assign(resultObj.city, {
      from: fromFound.name,
      to: toFound.name,
    });

    await waitForWrapper(page, selectors.radio, {timeout: 10000});
    const radios = await page.$$(selectors.radio);
    if (!radios.length) {
      throw new Error(getContentChangedMessage(selectors.radio));
    }
    await radios[1].click();

    await waitForWrapper(page, selectors.weightInput);
    const weightInput = await page.$(selectors.weightInput);
    await weightInput.type(resultObj.weight.toString(), {delay: 100});

    await waitForWrapper(page, selectors.aInput);
    const aInput = await page.$(selectors.aInput);
    await aInput.type("1");

    await waitForWrapper(page, selectors.bInput);
    const bInput = await page.$(selectors.bInput);
    await bInput.type("1");

    await waitForWrapper(page, selectors.cInput);
    const cInput = await page.$(selectors.cInput);
    await cInput.type("1");

    await waitForWrapper(page, selectors.submitButton);
    const buttons = await page.$$(selectors.submitButton);
    if (!buttons.length) {
      throw new Error(getContentChangedMessage(selectors.submitButton));
    }

    await buttons[1].click();

    try {
      const response = await page.waitForResponse(response => response.url() === delivery.calcUrl.uri && response.request().postData().indexOf('CalculatorServices') > -1);
      const json = await response.json();

      if (json.data.servicesListResult.success) {
        resultObj.tariffs = json.data.servicesListResult.servicesList.map((s) => createTariff(`${s.name} ${s.modeTitle}`, s.price.replace(COSTREG, ''), s.days.replace(DELIVERYTIMEREG, '')));
        if (!resultObj.tariffs.length) {
          resultObj.error = getNoResultError();
        }
      } else {
        resultObj.req = {};
        resultObj.error = json.data.servicesListResult.errors ? json.data.servicesListResult.errors.map(v => v.message).join(', ') : 'Внутренняя ошибка сервисов СДЭК';
      }
    } catch(e) {
      throw new Error(getJSONChangedMessage(delivery.calcUrl.uri));
    }
  } catch(e) {
    resultObj.error = e.message || e.stack;
  }
  await closePage(page);
};

module.exports = async function ({ deliveryKey, weights, cities, req}) {
  const delivery = getOne(deliveryKey);

  let results = [];
  let browser;
  try {
    browser = await getBrowser();
    for (let j = 0; j < weights.length; j++) {
      for (let i = 0; i < cities.length; i++) {
        const result = {
          city: {
            ...cities[i],
            initialCityFrom: cities[i].from,
            initialCityTo: cities[i].to,
          },
          weight: weights[j],
          delivery: deliveryKey,
          tariffs: []
        };
        if (!cities[i].from || !cities[i].to) {
          result.error = CITIESREQUIRED;
          results.push(result);
          continue;
        }
        await randomTimeout(cfg.browser.delay.min, cfg.browser.delay.max);
        if (!shouldAbort(req)) {
          await getResult(delivery, result, browser);
          results.push(result);
        }
      }
    }
  } catch(error) {
    results = allResultsError({ deliveryKey, weights, cities, error });
  }

  await closeBrowser(browser);

  return results;
};