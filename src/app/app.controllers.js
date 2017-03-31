import angular from 'angular';
import AppCtrl from './controllers/main'
import NewsCtrl from './controllers/news/list'
import TariffsCtrl from './controllers/tariffs/list'

export default angular.module('app.controllers', [])
  .controller('AppCtrl', AppCtrl)
  .controller('NewsCtrl', NewsCtrl)
  .controller('TariffsCtrl', TariffsCtrl)
  .name;