import { getErrorMessage } from './common';

export const CITIESREQUIRED = 'Должен быть указан город отправления и город назначения';
export const CITYORCOUNTRYREQUIRED = 'Должен быть указан город отправления и назначения или страна отправления и назначения';
export const CITYFROMREQUIRED = 'Должен быть указан город отправления';
export const CITYTOREQUIRED = 'Должен быть указан город назначения';
export const CITYORCOUNTRYFROMREQUIRED = 'Должен быть указан город или страна отправления';
export const CITYORCOUNTRYTOREQUIRED = 'Должен быть указан город или страна назначения';
export const COUNTRYLISTERROR = 'Не удалось получить список стран. Попробуйте позже.';
export const COUNTRYFROMNOTFOUND = 'Страна отправления отстуствует в списке доступных';
export const COUNTRYTONOTFOUND = 'Страна назначения отстуствует в списке доступных';
export const CITYFROMNOTFOUND = 'Город отправления отстуствует в списке доступных';
export const CITYTONOTFOUND = 'Город назначения отстуствует в списке доступных';
export const CITYORCOUNTRYTONOTFOUND = 'Город или страна назначения отстуствует в списке доступных';
export const COUNTRYFROMRUSSIA = 'Отправления возможны только из России';
export const COUNTRYRUSSIA = 'Отправления возможны только по России';
export const POSTCODEFROMNOTFOUND = 'Не удалось получить индекс города отправления';
export const POSTCODETONOTFOUND = 'Не удалось получить индекс города получения';
export const UNABLETOGETTARIFF = 'Не удалось получить тарифы с сайта.';

export const CITIESBY = 'Отправления возможны только по Беларуси';
export const CITYFROMBY = 'Отправления возможны только из Беларуси';
export const CITYFROMKZ = 'Отправления возможны только из Казахстана';
export const CITYFROMORTOKZ = 'Международные отправления возможны только из Казахстана или в Казахстан';
export const CITYFROMORTOBY = 'Международные отправления возможны только из Беларуси или в Беларусь';
export const CITYFROMORTORU = 'Международные отправления возможны только из России или в Россию';

export const DATEFORMATREG = /^\s*((0?[1-9]|[12][0-9]|3[01])\.(0?[1-9]|1[012])\.\d{4})([\d\D]*)/;
export const COSTREG = /[^0-9,]/g;
export const COSTREGDOT = /[^0-9,\.]/g;
export const DELIVERYTIMEREG = /[^0-9-]/g;

export const RUSSIA = ['россия', 'российская', 'рф', 'russia'];
export const BY = ['беларусь', 'белоруссия'];
export const SNG = ['казахстан', 'армения', 'беларусь', 'белоруссия', 'кыргызстан', 'киргизия'];

export const getCity = (city) => {
  return city.split(',')[0].trim();
};

export const getDistrictName = (city) => {
  let region = null;
  const splits = city.split(',');
  if (splits.length >= 3) {
    region = splits[2].split(' ')[1] || splits[2].split(' ')[0];
  }
  return region;
};

export const getRegionName = (city) => {
  let region = null;
  const splits = city.split(',');
  if (splits.length === 2) {
    region = splits[1].split(' ')[1] || splits[1].split(' ')[0];
  } else if (splits.length >= 3) {
    region = splits[2].split(' ')[1] || splits[2].split(' ')[0];
  }
  return region;
};

export const getCountryName = (city) => {
  let country = null;
  const splits = city.split(',');
  if (splits.length > 1) {
    country = splits[splits.length - 1];
  }
  if (country) {
    country = country.replace(/^ /, "");
  }
  return country;
};

export const getServicesError = (err) => {
  const message = getErrorMessage(err);
  return "Не удалось получить услуги с сайта. " + (message ? 'Ошибка: ' + message : '');
};

export const getResponseError = (err) => {
  const message = getErrorMessage(err);
  return "Не удалось получить информацию с сайта. " + (message ? 'Ошибка: ' + message : '');
};

export const getCityJsonError = (err, city) => {
  const message = getErrorMessage(err);
  let result = "Не удалось получить города с сайта. Неверный ответ от сервера. " + (message ? 'Ошибка: ' + message : '');
  if (city) {
    result = "Не удалось получить город " + city.toUpperCase() + " с сайта. Неверный ответ от сервера. " + (message ? 'Ошибка: ' + message : '')
  }
  return result;
};

export const getCountriesError = (err, country) => {
  const message = getErrorMessage(err);
  let result = "Не удалось получить страны с сайта. " + (message ? 'Ошибка: ' + message : '');
  if (country) {
    result = "Не удалось получить страну " + country.toUpperCase() + " с сайта. " + (message ? 'Ошибка: ' + message : '');
  }
  return result;
};

export const getCityNoResultError = (city) => {
  city = city || '';
  return "Не удалось получить города с сайта. Такого города " + city.toUpperCase() + " нет в БД сайта.";
};

export const getPVZNoResultError = (city) => {
  city = city || '';
  return "Не удалось получить список ПВЗ для города " + city.toUpperCase() + ".";
};

export const getCountryNoResultError = (country) => {
  country = country || '';
  return "Не удалось получить страны с сайта. Такой страны " + country.toUpperCase() + " нет в БД сайта.";
};

export const getNoResultError = () => {
  return "По указанным направлениям ничего не найдено";
};

export const getContentChangedMessage = (selector) => {
  return `Контент сайта изменился. Selector: ${selector}`;
};

export const getJSONChangedMessage = (selector) => {
  return `Формат ответа изменился. Запрос: ${selector}`;
};

export const getJSONRequestTimeoutMessage = (selector) => {
  return `Изменился запрос к api или не был сделан запрос или запрос отвалился по таймауту. Запрос: ${selector}`;
};

export const getTariffErrorMessage = (err) => {
  const message = getErrorMessage(err);
  return "Не удалось получить тарифы с сайта. " + (message ? 'Ошибка: ' + message : '');
};

export const getUnavailableError = (err) => {
  const message = getErrorMessage(err);
  return "Калькулятор недоступен, попробуйте позже. " + (message ? 'Ошибка: ' + message : '');
};

export const createTariff = (service, cost, deliveryTime) => {
  return {
    cost,
    service,
    deliveryTime
  };
};

export const getResponseErrorObject = ({ city, deliveryKey, weight, error, req }) => {
  delete city.fromJSON;
  delete city.toJSON;
  delete city.error;
  const result = {
    city: {...city},
    delivery: deliveryKey,
    weight,
    tariffs: [],
    error: getErrorMessage(error)
  };
  if (req) {
    result.req = req;
  }
  return result;
};

export const getResponseErrorArray = ({ weights, ...props }) => {
  return weights.map((weight) => {
    return getResponseErrorObject({ ...props, weight });
  });
};

export const allResultsError = ({ cities, ...props }) => {
  let array = [];
  cities.forEach((item) => {
    array = array.concat(getResponseErrorArray({ ...props, city: item }));
  });
  return array;
};

export const isBy = (country) => {
  return country && BY.indexOf(country.toLowerCase()) > -1;
};