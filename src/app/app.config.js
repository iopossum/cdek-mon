routing.$inject = ['$stateProvider', '$urlRouterProvider', '$locationProvider'];

export default function routing($stateProvider, $urlRouterProvider, $locationProvider) {
  //$locationProvider.html5Mode(true);
  $urlRouterProvider.otherwise('/tariffs');

  var settings = [
    '$q', 'Tariff',
    function($q, Tariff) {
      var defer = $q.defer();
      Tariff.settings().then(function (res) {
        defer.resolve();
        Tariff.setSettings(res);
      });
      return defer.promise;
    }];

  $stateProvider
    .state('news', {
      url: '/news',
      template: require('./controllers/news/list.html'),
      controller: 'NewsCtrl',
      controllerAs: 'news',
      title: 'Новости',
      resolve: {
        settings: settings
      }
    })
    .state('tariffs', {
      url: '/tariffs',
      template: require('./controllers/tariffs/list.html'),
      controller: 'TariffsCtrl',
      controllerAs: 'tariffs',
      title: 'Тарифы',
      resolve: {
        settings: settings
      }
    })

}