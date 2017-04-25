
class TariffsCtrl {

  constructor($scope, $rootScope, Tariff, Notify, Xls) {
    this.filter = {
      cities: [],
      weights: [],
      targets: []
    };
    var array = [];
    var that = this;
    for (var i=1; i<=10; i++) {
      if (i===1) {
        array.push(0.5);
      }
      array.push(i);
    }
    this.results = [];
    this.errors = [];
    this.loading = {
      main: false,
      errors: false
    };
    this.mainInterval = null;
    this.availableWeights = array;
    this.$scope = $scope;
    this.notify = Notify;
    this.xls = Xls;
    this.tariffService = Tariff;
    this.dynamic = 0;
    this.targets = Tariff.getTargets();
    this.requestedTargets = [];
    this.targetsObj = Tariff.getTargetsObj();

    //that.tariffService.request({deliveries: ['emspost', 'majorexpress']}).then(function (res) {
    //  that.pingTariffs();
    //}, function (err) {
    //  console.log(err);
    //  that.notify.error(err);
    //});
  }

  pingTariffs() {
    var that = this;
    this.dynamic = 0;
    clearInterval(this.mainInterval);
    for (var key in this.targetsObj) {
      delete this.targetsObj[key].error;
      this.targetsObj[key].complete = false;
    }
    this.mainInterval = setInterval(function () {
      that.tariffService.ping().then(function (res) {
        var countCompleted = 0;
        var errors = [];
        var results = [];
        for (var key in res.deliveries) {
          if (res.deliveries[key].complete) {
            countCompleted++;
            if (!that.targetsObj[key].complete) {
              results = results.concat(res.deliveries[key].results || []);
            }
            that.targetsObj[key].complete = true;
            if (res.deliveries[key].error && !that.targetsObj[key].error) {
              that.targetsObj[key].error = res.deliveries[key].error;
              errors.push({delivery: key, error: res.deliveries[key].error});
            }
          }
        }
        that.dynamic = countCompleted;
        that.receiveTariffs(results);
        if (that.dynamic === that.requestedTargets.length) {
          that.loading.main = false;
          clearInterval(that.mainInterval);
        }
        if (errors.length) {
          errors.forEach(function (item) {
            that.notify.error(item.error);
          });
        }
      });
    }, 10000);
    /*this.targets.forEach(function (item, index) {
      if (that.targetsObj[item.id].mainInterval) {
        clearInterval(that.targetsObj[item.id].mainInterval);
        that.targetsObj[item.id].req.reject();
      }
      if (['emspost', 'majorexpress', 'spsr'].indexOf(item.id) !== -1) {
        that.targetsObj[item.id].mainInterval = setInterval(function () {
          console.log('tick', item.id);
          that.targetsObj[item.id].req = that.tariffService.ping({delivery: item.id});
          that.targetsObj[item.id].req.then(function (res) {
            console.log(res);
            if (res.complete) {
              clearInterval(that.targetsObj[item.id].mainInterval);
              that.dynamic++;
              that.receiveTariffs(res.results || []);
              if (that.dynamic === that.targets.length) {
                that.loading.main = false;
              }
              if (res.error) {
                that.notify.error(res.error);
              }
            }
          })
        }, 10000);
      }
    });*/
  }

  deleteTariff(parentIndex, index) {
    if (this.results[parentIndex].tariffs.length > 1) {
      this.results[parentIndex].tariffs.splice(index, 1);
    } else {
      this.results.splice(parentIndex, 1);
    }
  }

  receiveTariffs(res) {
    var that = this;
    res.forEach(function (item) {
      if (!item.error) {
        //item.tariffs.forEach(function (tariff) {
        //  var obj = Object.assign(item);
        //  obj.tariff = tariff;
        //  delete obj.tariffs;
          that.results.push(item);
        //});
      } else {
        that.errors.push(item);
      }
    });
  }

  chooseCities() {
    this.handleFile(this.filter.cityInput);
  }

  inputButtonClick(event) {
    $(event.target).siblings('input').click();
  }

  addWeight($item) {
    var item = parseFloat($item);
    if (isNaN(item)) {
      this.filter.weights = this.filter.weights.filter(function (it) {
        return it !== $item;
      });
      return false;
    }
  }

  getTariffs() {
    if (!this.filter.weights.length) {
      return this.notify.warning("Укажите вес");
    }
    if (!this.filter.cities.length) {
      return this.notify.warning("Укажите города");
    }
    this.loading.main = true;
    this.dynamic = 0;
    var targets = this.filter.targets.length ? this.filter.targets : this.targets;
    var obj = {
      cities: this.filter.cities,
      weights: this.filter.weights,
      deliveries: targets.map(function (item) {return item.id;})
    };
    var that = this;
    this.requestedTargets = targets;
    this.results = [];
    this.errors = [];
    this.tariffService.request(obj).then(function (res) {
      that.pingTariffs();
    }, function (err) {
      that.notify.error(err);
    });
  }

  downloadFile () {
    this.xls.download('Тарифы.xlsx', document.getElementById('tariffs'));
  }

  handleFile (f) {
    var reader = new FileReader();
    var that = this;
    reader.onload = function(e) {
      that.$scope.$apply(function () {
        that.filter.cities = that.xls.readCities(e.target.result);
      });
    };
    reader.readAsBinaryString(f);
  }

}

export default TariffsCtrl;

TariffsCtrl.$inject = ['$scope', '$rootScope', 'Tariff', 'Notify', 'Xls'];