let AppDirective = () => {
  return {
    template: require('../app.html'),
    controller: 'AppCtrl',
    controllerAs: 'app'
  }
};

export default AppDirective;
