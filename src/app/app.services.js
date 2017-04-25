import angular from 'angular';
import {Tariff, Notify, Xls} from './services'

export default angular.module('app.services', [])
  .service('Tariff', Tariff)
  .service('Notify', Notify)
  .service('Xls', Xls)
  .name;