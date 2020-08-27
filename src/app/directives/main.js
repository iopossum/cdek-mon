let AppDirective = () => {
  return {
    template: require('../app.html').default,
    controller: 'AppCtrl',
    controllerAs: 'app'
  }
};

export default AppDirective;
