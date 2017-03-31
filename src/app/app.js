import './app.scss';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'ui-select/dist/select.min.css';
import 'angular-toastr/dist/angular-toastr.min.css';
import 'font-awesome/css/font-awesome.min.css';

import angular from 'angular';
import jQuery from 'jquery';
import uirouter from 'angular-ui-router';
import uiselect from 'ui-select';
import uiBootstrap from 'angular-ui-bootstrap';
import ngResource from 'angular-resource';
import ngToastr from 'angular-toastr';
import ngCookie from 'angular-cookie';
import routing from './app.config';

import controllers from './app.controllers';
import directives from './app.directives';
import services from './app.services';


const MODULE_NAME = 'app';

angular.module(MODULE_NAME, [uirouter, uiselect, uiBootstrap, ngResource, ngCookie, ngToastr, controllers, directives, services])
  .config(routing)
  .run(['$rootScope', '$state', '$stateParams', '$location', function ($rootScope, $state, $stateParams, $location) {
    $rootScope.$state = $state;
    $rootScope.$stateParams = $stateParams;
    $rootScope.$on('$stateChangeStart', function (event, toState) {
      $rootScope.$state.current = toState;
    });
  }]);

export default MODULE_NAME;