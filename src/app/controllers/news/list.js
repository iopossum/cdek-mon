var moment = require('moment');

class NewsCtrl {
  constructor($scope, $rootScope, Tariff, Notify) {
    this.filter = {
      targets: [],
      date: new Date(moment().add(-1, 'month'))
    };
    this.results = [];
    this.errors = [];
    this.loading = false;
    this.dpOpened = false;
    this.$scope = $scope;
    this.notify = Notify;
    this.tariffService = Tariff;
    this.dynamic = 0;
    this.targets = Tariff.getTargets();
    this.targetsObj = Tariff.getTargetsObj();

    /*that.tariffService.request({}).then(function (res) {
      that.pingTariffs();
    }, function (err) {
      console.log(err);
      that.notify.error(err);
    });*/
  }

  receiveNews(res) {
    var that = this;
    this.results = this.results.concat(res);
  }

  requestNews () {
    var that = this;
    this.results = [];
    that.loading = true;
    var targets = this.filter.targets.length ? this.filter.targets : this.targets;
    that.dynamic = 0;
    targets.forEach(function (item, index) {
      var obj = {
        date: that.filter.date,
        delivery: item.id
      };
      that.tariffService.news(obj).then(function (res) {
        that.dynamic++;
        if (index === targets.length - 1) {
          that.loading = false;
        }
        that.receiveNews(res);
      }, function (err) {
        if (index === targets.length - 1) {
          that.loading = false;
        }
        that.dynamic++;
        that.notify.error(err);
      });
    });
  }
}

export default NewsCtrl;

NewsCtrl.$inject = ['$scope', '$rootScope', 'Tariff', 'Notify'];