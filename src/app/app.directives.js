import angular from 'angular';
import AppDirective from './directives/main'
import {InputFile} from './directives/common'

export default angular.module('app.directives', [])
  .directive('app', AppDirective)
  .directive('inputFile', InputFile)
  .name;