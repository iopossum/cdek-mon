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
  getContentChangedMessage, COUNTRYFROMNOTFOUND, getResponseError,
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
  calcLink: '.sticky-top .hot-link a[href="https://i.jde.ru/rq/"]',
  cityFromInput: 'input#derival_point',
  cityToInput: 'input#arrival_point',
  cityDropdown: '.ui-autocomplete.show_all_items',
  cityDropdownOption: '.ui-menu-item',
  weightInput: 'input#sized_weight',
  fromServices: '#derival_variants_group > .derival',
  toServices: '#arrival_variants_group > .arrival',
  tariff: '.accordion-title.checkText',
};

const setWeight = async ({ page, weight }) => {

  const weightInput = await page.$(selectors.weightInput);
  await weightInput.focus();
  await page.keyboard.down('Control');
  await page.keyboard.press('KeyA');
  await page.keyboard.up('Control');
  await page.keyboard.press('Backspace');
  await page.waitForTimeout(100);
  await weightInput.focus();
  await page.keyboard.type(weight.toString());

};

const setCity = async ({ page, city, country, notFoundMessage, delivery, isFrom }) => {
  const selector = isFrom ? selectors.cityFromInput : selectors.cityToInput;
  const trim = getCity(city);
  const cityInput = await page.$(selector);
  await cityInput.focus();
  await page.keyboard.down('Control');
  await page.keyboard.press('KeyA');
  await page.keyboard.up('Control');
  await page.keyboard.press('Backspace');
  await page.waitForTimeout(100);
  await cityInput.focus();
  await page.keyboard.type(city);

  try {
    await waitForResponse({ page, url: delivery.citiesUrl.uri, format: 'text' });
  } catch (e) {
    throw new Error(notFoundMessage);
  }

  let dropdown = await page.evaluateHandle(s => Array.from(document.querySelectorAll(s)).filter(v => v.style.display !== 'none')[0], selectors.cityDropdown);
  let options = await page.evaluate((e, s) => Array.from(e.querySelectorAll(s)).map(v => v.innerText), dropdown, selectors.cityDropdownOption);
  const optionsHandlers = await dropdown.$$(selectors.cityDropdownOption);

  if (!options.length) {
    throw new Error(notFoundMessage);
  }

  let values = options.map((item, index) => ({name: item.replace('\n', ' '), index}));
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
  await optionsHandlers[result.index].click();

  try {
    await waitForResponse({page, url: isFrom ? delivery.routesFromUrl.uri : delivery.routesToUrl, timeout: 10000});
  } catch(e) {}
  if (isFrom) {
    try {
      await waitForResponse({page, url: delivery.servicesUrl.uri, timeout: 10000});
    } catch (e) {}
  }

  return result.name;

};

const getTariff = async ({ delivery, page, service, wait }) => {
  if (wait) {
    await waitForResponse({page, url: delivery.calcUrl.uri, message: UNABLETOGETTARIFF});
  }
  await printPDF(page, service)
  await page.waitForTimeout(100);
  let cost = await page.evaluate((tariffSelector) => document.querySelector(tariffSelector) && document.querySelector(tariffSelector).innerText, selectors.tariff);

  return createTariff(
    service,
    cost.replace(COSTREG, ''),
    ''
  )
};

const setTariffs = async ({ delivery, result, page, fromServices, toServices }) => {
  const errors = [];

  const actions = [];
  actions.push({
    completed: true,
    title: 'СС'
  });
  if (toServices[1]) {
    actions.push({
      handle: toServices[1],
      title: 'СД',
    });
  }
  if (fromServices[1]) {
    actions.push({
      handle: fromServices[1],
      title: 'ДД',
    });
  }
  if (fromServices[1] && toServices[1]) {
    actions.push({
      handle: toServices[0],
      title: 'ДС',
    });
  }

  for (let i = 0; i < actions.length; i++) {
    try {
      let tariff;
      if (!actions[i].completed) {
        await actions[i].handle.click();
        tariff = await getTariff({delivery, page, service: actions[i].title, wait: true});
      } else {
        tariff = await getTariff({delivery, page, service: actions[i].title, wait: false});
      }
      result.tariffs.push(tariff);
    } catch(e) {
      errors.push(e.message);
    }
  }

  console.log(result.tariffs)

  if (!result.tariffs.length) {
    result.error = errors.length ? errors[0] : getNoResultError();
  }
};

const getResult = async ({ deliveryKey, city, weights, browser }) => {
  const delivery = getOne(deliveryKey);
  let page;
  let results = [];
  try {

    page = await newPage(browser);
    await initPage({ delivery, page });
    await page.goto(delivery.page2Url.uri);
    try {
      await waitForResponse({ page, url: delivery.codeUrl.uri});
    } catch(e) {}

    await waitForWrapper(page, selectors.cityFromInput);
    await waitForWrapper(page, selectors.cityToInput);

    let fromFound = await setCity({page, city: city.from, country: city.countryFrom, notFoundMessage: CITYFROMNOTFOUND, delivery, isFrom: true });
    let toFound = await setCity({page, city: city.to, country: city.countryTo, notFoundMessage: CITYTONOTFOUND, delivery });

    Object.assign(city, {
      from: fromFound,
      to: toFound,
    });

    await waitForWrapper(page, selectors.weightInput);

    let fromServices = await page.$$(selectors.fromServices);
    if (!fromServices.length) {
      throw new Error('Изменился контент сайта или по данным направлениям нет доставки');
    }

    let toServices = await page.$$(selectors.toServices);
    if (!toServices.length) {
      throw new Error('Изменился контент сайта или по данным направлениям нет доставки');
    }

    for (let i = 0; i < weights.length; i++) {

      const result = {
        city: {...city},
        weight: weights[i],
        tariffs: [],
        req: {},
        delivery: deliveryKey
      };

      try {
        try {
            await waitForResponse({ page, url: delivery.calcUrl.uri});
        } catch(e) {}
        await setWeight({ weight: weights[i], page });
        if (weights[i] != 1) {
          try {
            await waitForResponse({ page, url: delivery.calcUrl.uri});
          } catch(e) {}
        }
        const checkedFromTerminal = await fromServices[0].evaluate(s => s.querySelector('input[type="radio"]').checked);
        const checkedToTerminal = await toServices[0].evaluate(s => s.querySelector('input[type="radio"]').checked);
        if (!checkedFromTerminal) {
          await fromServices[0].click();
          try {
            await waitForResponse({ page, url: delivery.calcUrl.uri});
          } catch(e) {}
        }
        if (!checkedToTerminal) {
          await toServices[0].click();
          try {
            await waitForResponse({ page, url: delivery.calcUrl.uri});
          } catch(e) {}
        }
        await setTariffs({ page, delivery, fromServices, toServices, result });
      } catch (e) {
        result.error = e.message;
      }

      results.push(result);

    }
  } catch(e) {
    results = results.concat(allResultsError({ deliveryKey, weights, cities: [city], error: e.message || e.stack, req: {} }));
  }

  await closePage(page);
  return results;
};

const initPage = async ({ delivery, page }) => {
  try {
    await page.goto(delivery.pageUrl.uri);
    await waitForWrapper(page, selectors.calcLink);
    // const link = await page.$(selectors.calcLink);
    await page.evaluate((s) => {
      document.querySelector(s).click();
    }, selectors.calcLink);
    // link.click();
  } catch (e) {
    throw new Error(getResponseError('Изменилась структура сайта'));
  }
};

module.exports = async function ({ deliveryKey, weights, cities, req}) {

  let results = [];
  let browser;
  try {
    browser = await getBrowser();
    for (let i = 0; i < cities.length; i++) {
      const initialCity = {
        ...cities[i],
        initialCountryFrom: cities[i].countryFrom,
        initialCountryTo: cities[i].countryTo,
        initialCityFrom: cities[i].from,
        initialCityTo: cities[i].to,
      };
      if (!cities[i].from && !cities[i].to) {
        results = results.concat(allResultsError({ deliveryKey, weights, cities: [cities[i]], error: CITIESREQUIRED }));
        continue;
      }
      await randomTimeout(cfg.browser.delay.min, cfg.browser.delay.max);
      if (!shouldAbort(req)) {
        const data = await getResult({ deliveryKey, city: initialCity, browser, weights });
        results = results.concat(data);
      }
    }
  } catch(error) {
    results = allResultsError({ deliveryKey, weights, cities, error });
  }

  await closeBrowser(browser);

  return results;
};