import angular from 'angular';
import {Tariff, Notify} from './services'

export default angular.module('app.services', [])
  .service('Tariff', Tariff)
  .service('Notify', Notify)
  .name;