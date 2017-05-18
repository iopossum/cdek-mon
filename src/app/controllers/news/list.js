var moment = require('moment');
var _ = require('underscore');
var commonHelper = require('../../../../api/helpers/common-safe');

class NewsCtrl {
  constructor($scope, $rootScope, Tariff, Notify, Xls) {
    this.filter = {
      targets: [],
      date: new Date(moment().add(-1, 'month'))
    };
    this.results = [];
    this.errors = [];
    this.loading = false;
    this.$scope = $scope;
    this.notify = Notify;
    this.xls = Xls;
    this.tariffService = Tariff;
    this.dynamic = 0;
    this.targets = Tariff.getTargets();
    this.targetsObj = Tariff.getTargetsObj();

    this.sort = {
      name: 'date',
      direction: 'desc'
    };
  }

  receiveNews(res) {
    var that = this;
    this.results = this.results.concat(res.items);
    this.setSort(this.sort.name);
    if (res.warning) {
      that.notify.warning(res.warning);
    }
  }

  setSort () {
    var results = [];
    var that = this;
    switch (this.sort.name) {
      case 'date':
        results = _.sortBy(this.results, function (item) {
          return moment(item.date, 'DD MMMM YYYY', 'ru');
        });
        break;
      case 'delivery':
        results = _.sortBy(this.results, function (item) {
          return item.delivery;
        });
        break;
    }
    var needReverse = this.sort.direction === 'desc' && results.length;
    if (needReverse) {
      var value = results[0][this.sort.name];
      if (results.every(function (item) {return item[that.sort.name] === value;})) {
        needReverse = false;
      }
    }
    if (needReverse) {
      results.reverse();
    }
    this.results = results;
  }

  downloadFile () {
    this.xls.download('Новости.xlsx', document.getElementById('news'));
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

NewsCtrl.$inject = ['$scope', '$rootScope', 'Tariff', 'Notify', 'Xls'];