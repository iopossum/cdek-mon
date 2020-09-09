import { getOne, majorExpressCountryChanger } from '../../helpers/delivery';
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
  COUNTRYFROMNOTFOUND,
  CITYORCOUNTRYTOREQUIRED,
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
  countryFromInput: '#ContentPlaceHolder1_cbCountryFrom_I',
  countryToInput: '#ContentPlaceHolder1_cbCountryTo_I',
  countryFromDropdownOption: '#ContentPlaceHolder1_cbCountryFrom_DDD_L_LBT .dxeListBoxItem',
  countryToDropdownOption: '#ContentPlaceHolder1_cbCountryTo_DDD_L_LBT .dxeListBoxItem',
  cityFromInput: '#ContentPlaceHolder1_cbCityFrom_I',
  cityToInput: '#ContentPlaceHolder1_cbCityTo_I',
  cityFromDropdownOption: '#ContentPlaceHolder1_cbCityFrom_DDD_L_LBT .dxeListBoxItem',
  cityToDropdownOption: '#ContentPlaceHolder1_cbCityTo_DDD_L_LBT .dxeListBoxItem',
  weightInput: '#ContentPlaceHolder1_tbCalcWeight_I',
  calcButton: '#ContentPlaceHolder1_btnCalc_CD',
};

const setWeight = async ({ page, weight }) => {
  const weightInput = await page.$(selectors.weightInput);
  await page.focus(selectors.weightInput);
  await weightInput.click({ clickCount: 2 });
  await page.keyboard.press('Backspace');
  await page.focus(selectors.weightInput);
  await page.keyboard.type(weight.toString());
};

const setCity = async ({ page, city, notFoundMessage, delivery, isFrom }) => {
  return new Promise(async (resolve, reject) => {
    let selector = isFrom ? selectors.cityFromInput : selectors.cityToInput;
    let dropdownSelector = isFrom ? selectors.cityFromDropdownOption : selectors.cityToDropdownOption;

    const trim = getCity(city);
    const cityInput = await page.$(selector);
    const isDisabled = await cityInput.evaluate(node => node.classList.contains('dxeDisabled'));
    if (isDisabled) {
      return resolve();
    }
    await cityInput.focus();
    await cityInput.click({clickCount: 2});
    await page.keyboard.press('Backspace');
    await page.waitFor(100);
    await cityInput.focus();
    await page.keyboard.type(trim);

    waitForResponse({page, url: delivery.citiesUrl.uri, message: getCityJsonError(null, trim), format: 'text'})
      .then(async text => {
        text = text.replace('0|/!*DX*!/(', '');
        text = text.replace('0|/*DX*/(', '');
        text = text.substring(0, text.length - 1);
        text = text.replace(/\"/g, '\\"').replace(/\'/g, '"');

        let json = null;
        try {
          json = JSON.parse(text);
        } catch (e) {
          throw new Error(getCityJsonError("Формат ответа не JSON", trim));
        }

        if (!json.result) {
          throw new Error(getCityJsonError("Отсутствует параметр result", trim));
        }

        let jsonResult;

        try {
          jsonResult = JSON.parse(json.result);
        } catch (e) {
          throw new Error(getCityJsonError("Неверный формат result", trim));
        }

        if (!jsonResult.length) {
          throw new Error(notFoundMessage);
        }

        const values = [];
        jsonResult.forEach((item, index) => {
          if (typeof item === 'string') {
            values.push({id: jsonResult[index - 1], name: item, index: index - 1});
          }
        });

        const region = getRegionName(city);
        const district = getDistrictName(city);
        const filtered = findInArray(values, trim, 'name', true);
        let founds = [];

        if (!filtered.length) {
          throw new Error(notFoundMessage);
        }

        if (region) {
          founds = findInArray(founds.length ? founds : filtered, region, 'area');
        }
        if (district) {
          founds = findInArray(founds.length ? founds : filtered, district, 'region');
        }
        const result = founds.length ? founds[0] : filtered[0];
        let optionsHandlers = await page.$$(dropdownSelector);
        if (!optionsHandlers.length) {
          throw new Error(notFoundMessage);
        }
        await optionsHandlers[result.index].click();
        resolve(result);
      })
      .catch(reject);

    await page.keyboard.type(" ");
  });
};

const setCountry = async ({ page, country, notFoundMessage, delivery, isFrom }) => {
  return new Promise(async (resolve) => {
    const trim = getCity(majorExpressCountryChanger(country));

    let selector = isFrom ? selectors.countryFromInput : selectors.countryToInput;
    let dropdownSelector = isFrom ? selectors.countryFromDropdownOption : selectors.countryToDropdownOption;

    const options = await page.$$eval(dropdownSelector, nodes => Array.from(nodes).map((node, index) => ({ name: node.innerText, index })));
    const filtered = findInArray(options, trim, 'name', true);

    if (!filtered.length) {
      throw new Error(notFoundMessage);
    }

    const countryInput = await page.$(selector);
    await countryInput.click({ clickCount: 2 });
    await page.keyboard.press('Backspace');
    await page.waitFor(100);
    await countryInput.focus();
    await page.keyboard.type(trim);

    const optionsHandlers = await page.$$(dropdownSelector);

    waitForResponse({page, url: delivery.reloadCitiesUrl.uri})
      .then(() => resolve(filtered[0]))
      .catch(() => resolve(filtered[0]));

    await optionsHandlers[filtered[0].index].click();
  });
};

const setTariffs = async ({ result, page, delivery }) => {

  const calcButton = await page.$(selectors.calcButton);
  await calcButton.click();

  let json = await waitForResponse({page, url: delivery.calcUrl.uri, message: UNABLETOGETTARIFF});
  if (!json.d) {
    throw new Error(getTariffErrorMessage('Отсутствует параметр d в ответе'));
  }
  let parsed;
  try {
    parsed = JSON.parse(json.d);
  } catch (e) {
    throw new Error(getTariffErrorMessage('Неверный формат JSON в ответе'));
  }
  if (!Array.isArray(parsed)) {
    throw new Error(getTariffErrorMessage('Изменился формат ответа. Ожидался массив'));
  }
  let tariffs = parsed.map(v => createTariff(v.ServiceName, v.FullCost, v.DeliveryPeriod));
  result.tariffs = tariffs;
  if (!tariffs.length) {
    result.error = getNoResultError();
  }
};

const getResult = async ({ deliveryKey, city, page, weights }) => {
  const delivery = getOne(deliveryKey);
  let results = [];
  try {
    await page.goto(delivery.pageUrl.uri);

    await waitForWrapper(page, selectors.cityFromInput);
    await waitForWrapper(page, selectors.cityToInput);

    if (city.countryFrom) {
      await setCountry({page, country: city.countryFrom, notFoundMessage: COUNTRYFROMNOTFOUND, delivery, isFrom: true });
    }

    if (city.countryTo) {
      await setCountry({page, country: city.countryTo, notFoundMessage: COUNTRYTONOTFOUND, delivery });
    }

    const fromFound = await setCity({page, city: city.from, notFoundMessage: CITYFROMNOTFOUND, delivery, isFrom: true });
    const toFound = await setCity({page, city: city.to, country: city.countryTo, notFoundMessage: CITYTONOTFOUND, delivery });

    Object.assign(city, {
      from: fromFound ? fromFound.name : city.from,
      to: toFound ? toFound.name : city.countryTo,
    });

    await waitForWrapper(page, selectors.weightInput);
    await waitForWrapper(page, selectors.calcButton);

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
        await setTariffs({ page, result, delivery });
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
        countryFrom: majorExpressCountryChanger(cities[i].countryFrom),
        countryTo: majorExpressCountryChanger(cities[i].countryTo),
        initialCountryFrom: cities[i].countryFrom,
        initialCountryTo: cities[i].countryTo,
        initialCityFrom: cities[i].from,
        initialCityTo: cities[i].to,
      };
      if (!cities[i].from) {
        results = results.concat(allResultsError({ deliveryKey, weights, cities: [cities[i]], error: CITYFROMREQUIRED }));
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