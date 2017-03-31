routing.$inject = ['$stateProvider', '$urlRouterProvider', '$locationProvider'];

export default function routing($stateProvider, $urlRouterProvider, $locationProvider) {
  //$locationProvider.html5Mode(true);
  $urlRouterProvider.otherwise('/news');

  $stateProvider
    .state('news', {
      url: '/news',
      template: require('./controllers/news/list.html'),
      controller: 'NewsCtrl',
      controllerAs: 'news',
      title: 'Новости'
    })
    .state('tariffs', {
      url: '/tariffs',
      template: require('./controllers/tariffs/list.html'),
      controller: 'TariffsCtrl',
      controllerAs: 'tariffs',
      title: 'Тарифы'
    })

}