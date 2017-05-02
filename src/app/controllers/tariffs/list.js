var async = require('async');
var commonHelper = require('../../../../api/helpers/common-safe');
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

    this.acService;
    this.placeService;
    try {
      this.acService = new google.maps.places.AutocompleteService();
      this.placeService = new google.maps.places.PlacesService(document.createElement('div'));
    } catch (e) {
      console.error(e);
    }
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
    this.getGoogleIds(function () {
      that.tariffService.request(obj).then(function (res) {
        that.pingTariffs();
      }, function (err) {
        that.notify.error(err);
      });
    });
  }

  downloadFile () {
    this.xls.download('Тарифы.xlsx', document.getElementById('tariffs'));
  }

  getGoogleIds (callback) {
    var that = this;
    if (!this.acService || !this.placeService) {
      try {
        this.acService = new google.maps.places.AutocompleteService();
        this.placeService = new google.maps.places.PlacesService(document.createElement('div'));
      } catch (e) {
        console.error(e);
      }
    }
    var getCity = function (city, country, callback) {
      var query = city;
      country = country || 'Россия';
      query += ', ' + country;
      that.acService.getPlacePredictions({
        input: query,
        language: 'en-US',
        types:['(cities)']
      }, function(places, status) {
        places = places || [];
        var _places = [];
        for (var i = 0; i < places.length; ++i) {
          _places.push({
            google_city_id: places[i].place_id,
            city_label: places[i].description
          });
        }

        if (!_places[0]) {
          return callback(null, null);
        }

        var request = {
          placeId: _places[0].google_city_id
        };
        that.placeService.getDetails(request, function (place, status) {
          if (status == google.maps.places.PlacesServiceStatus.OK) {
            _places[0].engName = place.name;
            _places[0].engFullName = place.formatted_address;
          }
          callback(null, _places[0]);
        });
      });
    };
    var cityObj = {};
    async.eachSeries(this.filter.cities, function (city, callback) {
      if (!city.from && !city.to) {
        return callback(null);
      }
      async.parallel([
        function (callback) {
          if (typeof  cityObj[city.from + city.countryFrom] !== 'undefined') {
            return callback(null);
          }
          if (!city.from) {
            return callback(null);
          }
          getCity(city.from, city.countryFrom, callback);
        },
        function (callback) {
          if (typeof  cityObj[city.to + city.countryTo] !== 'undefined') {
            return callback(null);
          }
          if (!city.to) {
            return callback(null);
          }
          getCity(city.to, city.countryTo, callback);
        }
      ], function (err, foundCities) { //ошибки быть не может
        if (typeof  cityObj[city.from + city.countryFrom] === 'undefined') {
          cityObj[city.from + city.countryFrom] = foundCities[0];
        }
        if (typeof  cityObj[city.to + city.countryTo] === 'undefined') {
          cityObj[city.to + city.countryTo] = foundCities[1];
        }
        if (cityObj[city.from + city.countryFrom]) {
          city.fromGooglePlaceId = cityObj[city.from + city.countryFrom].google_city_id;
          city.fromGooglePlaceDsc = cityObj[city.from + city.countryFrom].city_label;
          city.fromEngName = cityObj[city.from + city.countryFrom].engName;
          city.fromEngFullName = cityObj[city.from + city.countryFrom].engFullName;
        }
        if (cityObj[city.to + city.countryTo]) {
          city.toGooglePlaceId = cityObj[city.to + city.countryTo].google_city_id;
          city.toGooglePlaceDsc = cityObj[city.to + city.countryTo].city_label;
          city.toEngName = cityObj[city.to + city.countryTo].engName;
          city.toEngFullName = cityObj[city.to + city.countryTo].engFullName;
        }
        callback(null, city);
      });
    }, callback);
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