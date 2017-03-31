import xlsx from 'xlsx';

class TariffsCtrl {

  constructor($scope, $rootScope, Tariff, Notify) {
    this.filter = {
      cities: [],
      weights: []
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
    this.availableWeights = array;
    this.$scope = $scope;
    this.notify = Notify;
    this.tariffService = Tariff;
    this.dynamic = 0;
    this.targets = Tariff.getTargets();
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
    this.targets.forEach(function (item, index) {
      if (that.targetsObj[item.id].mainInterval) {
        clearInterval(that.targetsObj[item.id].mainInterval);
        that.targetsObj[item.id].req.reject();
      }
      if (['emspost', 'majorexpress'].indexOf(item.id) !== -1) {
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
    });
  }

  receiveTariffs(res) {
    var that = this;
    res.forEach(function (item) {
      if (!item.error) {
        item.tariffs.forEach(function (tariff) {
          var obj = Object.assign(item);
          obj.tariff = tariff;
          delete obj.tariffs;
          that.results.push(obj);
        });
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
    var obj = {
      cities: this.filter.cities,
      weights: this.filter.weights,
      deliveries: this.targets.map(function (item) {return item.id;})
    };
    var that = this;
    this.tariffService.request(obj).then(function (res) {
      that.pingTariffs();
    }, function (err) {
      that.notify.error(err);
    });
  }

  handleFile (f) {
    var reader = new FileReader();
    var that = this;
    reader.onload = function(e) {
      var data = e.target.result;

      var workbook = xlsx.read(data, {type: 'binary'});
      var data = xlsx.utils.sheet_to_row_object_array(workbook.Sheets[workbook.SheetNames[0]], {header: 1});
      var array = [];
      data.forEach(function (item) {
        if (item[0] && item[1] || item[3])
        array.push({from: item[0] || '', to: item[1] || '', countryFrom: item[2] || '', countryTo: item[3] || ''});
      });
      that.$scope.$apply(function () {
        that.filter.cities = array;
      });
    };
    reader.readAsBinaryString(f);
  }

}

export default TariffsCtrl;

TariffsCtrl.$inject = ['$scope', '$rootScope', 'Tariff', 'Notify'];