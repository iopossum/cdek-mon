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
  CITYORCOUNTRYTONOTFOUND,
  UNABLETOGETTARIFF,
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
  getTariffErrorMessage,
  getContentChangedMessage,
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

const selectors = {
  cityFromInput: '.parcel-page__source-input input',
  cityToInput: '.parcel-page__destination-input input',
  weightInput: '.product-page__weight-input input',
  tariffButtons: '.product-page__options-buttons > .product-page__option',
  standardButton: '.parcel-page__standard-option',
  rapidButton: '.parcel-page__rapid-option',
  emsButton: '.parcel-page__ems-option',
  dropdownOption: '.input__suggest-wrapper .input__suggest__element'
};

const services = [
  {title: 'Обычный', timeKey: 'deliveryTimeRange'},
  {title: 'Ускоренный', timeKey: 'firstClassTimeRange'},
  {title: 'EMS', timeKey: 'emsDeliveryTimeRange'},
];

const setWeight = async ({ page, weight }) => {
  // await page.waitFor(1000);
  const weightInput = await page.$(selectors.weightInput);
  await weightInput.click({ clickCount: 2 });
  await page.keyboard.press('Backspace');
  await page.focus(selectors.weightInput);
  await page.keyboard.type(weight.toString());

  const optionsHandlers = await page.$$(selectors.dropdownOption);
  if (!optionsHandlers.length) {
    throw new Error('Сервис временно недоступен или указан недопустимый вес');
  }

  if (optionsHandlers.length < 2) {
    throw new Error('Указан недопустимый вес');
  }

  const notSupported = await page.$$eval(selectors.dropdownOption, nodes => Array.from(nodes).some(node => node.classList.contains('product-page__weight-input-overweight-warning')));

  if (notSupported) {
    throw new Error('Указан недопустимый вес');
  }

  await optionsHandlers[0].click();
};

const setCity = async ({ page, selector, city, isCountry, country, notFoundMessage, delivery, isFrom }) => {
  city = isCountry ? pochtaCountryChanger(city) : city;
  const trim = getCity(city);
  const lastLetter = trim.slice(-1);
  const trimSliced = trim.slice(0, -1);
  const cityInput = await page.$(selector);
  await cityInput.click({ clickCount: 2 });
  await page.keyboard.press('Backspace');
  await page.waitFor(100);
  await cityInput.focus();
  await page.keyboard.type(trimSliced);
  await page.waitFor(1000);
  await page.keyboard.type(lastLetter);
  let json = await waitForResponse({page, url: delivery.citiesUrl.uri, message: getCityJsonError(null, trim)});

  if (!Array.isArray(json)) {
    throw new Error(getCityJsonError("Формат ответа не массив", trim));
  }

  if (!json.length) {
    throw new Error(notFoundMessage);
  }

  let values = json.map((item, index) => ({ ...item, name: isCountry ? item.country : item.city, index })).filter(v => ["COUNTRY", 'CITY'].indexOf(v.precision) > -1);
  const region = getRegionName(city);
  const district = getDistrictName(city);
  const filtered = findInArray(values, trim, 'name', true);

  if (!filtered.length) {
    throw new Error(notFoundMessage);
  }

  let founds = [];
  if (country) {
    founds = findInArray(filtered, country, 'country');
    if (!founds.length) {
      throw new Error(notFoundMessage);
    }
  }

  if (region) {
    founds = findInArray(founds.length ? founds : filtered, region, 'area');
  }
  if (district) {
    founds = findInArray(founds.length ? founds : filtered, region, 'region');
  }
  const result = founds.length ? founds[0] : filtered[0];
  let optionsHandlers = await page.$$(selectors.dropdownOption);
  if (!optionsHandlers.length) {
    throw new Error(notFoundMessage);
  }
  await optionsHandlers[result.index].click();
  try {
    await waitForResponse({page, url: delivery.citiesIndexUrl.uri});
  } catch(e) {
    console.log(e);
  }
  if (isFrom) {
    try {
      await waitForResponse({page, url: delivery.citiesPostofficesUrl.uri});
    } catch(e) {
      console.log(e);
    }
  } else {
    try {
      await waitForResponse({page, url: delivery.countriesUrl.uri});
    } catch(e) {
      console.log(e);
    }
  }
  if (isCountry || result.precision === 'COUNTRY') {
     try {
      await waitForResponse({page, url: delivery.dictionaryUrl.uri});
    } catch(e) {
      console.log(e);
    }
  }
  return result;
};

const setTariffs = async ({ url, result, page }) => {
  const tariffs = [];
  const errors = [];

  const tariffButtons = await page.$$(selectors.tariffButtons);
  if (tariffButtons.length < 3) {
    throw new Error(getContentChangedMessage(selectors.tariffButtons));
  }

  for (let i = 0; i < services.length; i++) {
    const isDisabled = await tariffButtons[i].evaluate(node => node.classList.contains('big-option-button--disabled'));
    if (isDisabled) {
      continue;
    }
    await tariffButtons[i].click();
    let json;
    try {
      json = await waitForResponse({page, url, message: UNABLETOGETTARIFF});
    } catch (e) {
      errors.push(e.message);
    }
    if (json) {
      try {
        if (json.status === "OK") {
          tariffs.push(createTariff(services[i].title, json.data.costEntity.cost, json.data.timeEntity[services[i].timeKey]));
        } else {
          throw new Error(getTariffErrorMessage('Статус ответа не "ОК"'));
        }
      } catch (e) {
        errors.push(e.message);
      }
    }
  }
  result.tariffs = tariffs;
  if (!tariffs.length) {
    result.error = errors.length ? errors[0] : getNoResultError();
  }
};

const getResult = async ({ deliveryKey, city, page, weights }) => {
  const delivery = getOne(deliveryKey);
  let results = [];
  try {
    await page.goto(delivery.cookieUrl.uri);

    await waitForWrapper(page, selectors.cityFromInput);
    await waitForWrapper(page, selectors.cityToInput);

    const fromFound = await setCity({page, selector: selectors.cityFromInput, city: city.from, notFoundMessage: CITYFROMNOTFOUND, delivery, isFrom: true });

    let toFound;
    if (city.to) {
      try {
        toFound = await setCity({page, selector: selectors.cityToInput, city: city.to, country: city.countryTo, notFoundMessage: CITYTONOTFOUND, delivery });
      } catch(e) {
        console.log(e)
      }
      if (!toFound) {
        if (city.countryTo) {
          toFound = await setCity({page, selector: selectors.cityToInput, isCountry: true, city: city.countryTo, notFoundMessage: COUNTRYNOTFOUND, delivery });
        } else {
          throw new Error(CITYTONOTFOUND);
        }
      }
    } else {
      toFound = await setCity({page, selector: selectors.cityToInput, isCountry: true, city: city.countryTo, notFoundMessage: COUNTRYNOTFOUND, delivery });
    }

    Object.assign(city, {
      from: fromFound.name,
      to: toFound.name,
    });

    await waitForWrapper(page, selectors.weightInput);

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
        await waitForResponse({ page, url: delivery.calcUrl.uri, message: UNABLETOGETTARIFF});
        await setTariffs({ page, url: delivery.calcUrl.uri, result });
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
        initialCityFrom: cities[i].from,
        initialCityTo: cities[i].to,
      };
      if (!cities[i].from) {
        results = results.concat(allResultsError({ deliveryKey, weights, cities: [cities[i]], error: CITYFROMREQUIRED }));
        continue;
      }
      if (cities[i].countryFrom) {
        results = results.concat(allResultsError({ deliveryKey, weights, cities: [cities[i]], error: COUNTRYFROMRUSSIA }));
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