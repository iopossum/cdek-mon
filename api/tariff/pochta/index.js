import { getOne } from '../../helpers/delivery';
import {
  shouldAbort,
  findInArray,
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

const selectors = {
  cityFromInput: '.parcel-page__source-input input',
  cityToInput: '.parcel-page__destination-input input',
  weightInput: '.product-page__weight-input input',
  standardButton: '.parcel-page__standard-option',
  rapidButton: '.parcel-page__rapid-option',
  emsButton: '.parcel-page__ems-option',
  dropdownOption: '.input__suggest-wrapper .input__suggest__element'
};

const setCity = async ({ page, selector, city, isCountry, country, notFoundMessage, delivery }) => {
  const trim = getCity(city);
  const lastLetter = trim.slice(-1);
  const trimSliced = trim.slice(0, -1);
  const cityInput = await page.$(selector);
  await cityInput.click({ clickCount: 2 });
  await page.keyboard.press('Backspace');
  await cityInput.focus();
  await page.waitFor(500);
  await page.keyboard.type(trimSliced);
  await page.waitFor(1000);
  await page.keyboard.type(lastLetter);
  let response;
  let json;
  try {
    response = await page.waitForResponse(response => response.url() === delivery.citiesUrl.uri);
  } catch(e) {
    throw new Error(notFoundMessage);
  }

  if (response.status() !== 200) {
    throw new Error(getCityJsonError(new Error("Статус ответа не 200"), trim));
  }

  try {
    json = await response.json();
  } catch(e) {
    throw new Error(getCityJsonError(new Error("Формат ответа не JSON"), trim));
  }

  if (!Array.isArray(json)) {
    throw new Error(getCityJsonError(new Error("Формат ответа не массив"), trim));
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
  return result;
};

const getResult = async (delivery, resultObj, page) => {
  try {
    await page.goto(delivery.cookieUrl.uri);

    await waitForWrapper(page, selectors.cityFromInput);
    await waitForWrapper(page, selectors.cityToInput);

    const fromFound = await setCity({page, selector: selectors.cityFromInput, city: resultObj.city.from, notFoundMessage: CITYFROMNOTFOUND, delivery });

    let toFound;
    if (resultObj.city.to) {
      try {
        toFound = await setCity({page, selector: selectors.cityToInput, city: resultObj.city.to, country: resultObj.city.countryTo, notFoundMessage: CITYTONOTFOUND, delivery });
      } catch(e) {}
      if (!toFound) {
        if (resultObj.city.countryTo) {
          toFound = await setCity({page, selector: selectors.cityToInput, isCountry: true, city: resultObj.city.countryTo, notFoundMessage: COUNTRYNOTFOUND, delivery });
        } else {
          throw new Error(CITYTONOTFOUND);
        }
      }
    } else {
      toFound = await setCity({page, selector: selectors.cityToInput, isCountry: true, city: resultObj.city.countryTo, notFoundMessage: COUNTRYNOTFOUND, delivery });
    }

    Object.assign(resultObj.city, {
      from: fromFound.name,
      to: toFound.name,
    });

    await waitForWrapper(page, selectors.weightInput);
    const weightInput = await page.$(selectors.weightInput);
    await weightInput.type(resultObj.weight.toString());

    try {
      const response = await page.waitForResponse(response => response.url() === delivery.calcUrl.uri);
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
  await refreshPage(page);
};

module.exports = async function ({ deliveryKey, weights, cities, req}) {
  const delivery = getOne(deliveryKey);

  let results = [];
  let browser;
  let page;
  try {
    browser = await getBrowser();
    page = await newPage(browser);
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
        if (!cities[i].from) {
          result.error = CITYFROMREQUIRED;
          results.push(result);
          continue;
        }
        if (cities[i].countryFrom) {
          result.error = COUNTRYFROMRUSSIA;
          results.push(result);
          continue;
        }
        if (!cities[i].to && !cities[i].countryTo) {
          result.error = CITYORCOUNTRYTOREQUIRED;
          results.push(result);
          continue;
        }
        if (!shouldAbort(req)) {
          await getResult(delivery, result, page);
          results.push(result);
        }
      }
    }
  } catch(error) {
    results = allResultsError({ deliveryKey, weights, cities, error });
  }

  await closePage(page);
  await closeBrowser(browser);

  return results;
};