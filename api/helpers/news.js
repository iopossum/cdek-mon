import moment from 'moment';
import { getErrorMessage } from './common';

export const newsResponse = (items, warning) => {
  return {
    items,
    warning
  };
};

export const createNews = (title, date, link, delivery, description) => {
  return {
    title,
    date,
    link,
    description,
    delivery
  };
};

export const sortNews = (items) => {
  return _.sortBy(items, (item) => {
    return -moment(item.date, 'DD MMMM YYYY', 'ru');
  });
};

export const getNewsError = (delivery, err) => {
  const message = getErrorMessage(err);
  return "Не удалось получить новости c сайта " + delivery.toUpperCase() + ". Попробуйте позже. " + (message ? 'Ошибка: ' + message : '');
};

export const getNewsPartError = (delivery) => {
  return "Не удалось получить часть новостей c сайта " + delivery.toUpperCase() + ". Попробуйте позже.";
};

export const getNewsWrongResponse = (delivery) => {
  return "Не удалось получить часть новостей c сайта " + delivery.toUpperCase() + ". Возможно изменалась структура сайта.";
};