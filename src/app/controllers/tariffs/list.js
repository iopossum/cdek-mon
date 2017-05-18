var async = require('async');
var _ = require('underscore');
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

    this.sort = {
      name: 'delivery',
      direction: 'asc'
    };

    this.acService;
    this.placeService;
    this.geocoder;
    try {
      this.acService = new google.maps.places.AutocompleteService();
      this.placeService = new google.maps.places.PlacesService(document.createElement('div'));
      this.geocoder = new google.maps.Geocoder();
    } catch (e) {
      console.error(e);
    }

    var weightStr = localStorage.weights;
    if (weightStr) {
      var json = null;
      try {
        json = JSON.parse(weightStr);
      } catch (e) {
        console.error(e);
      }
      if (json && Array.isArray(json)) {
        this.filter.weights = json;
      }
    }
  }

  setSort () {
    var results = [];
    var that = this;
    switch (this.sort.name) {
      case 'delivery':
        results = _.sortBy(this.results, function (item) {
          return item.delivery;
        });
        break;
      case 'weight':
        results = _.sortBy(this.results, function (item) {
          return item.weight;
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
              that.setSort(that.sort.name);
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
    localStorage.weights = JSON.stringify(this.filter.weights);
  }

  removeWeight() {
    localStorage.weights = JSON.stringify(this.filter.weights);
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
      weights: this.filter.weights,
      deliveries: targets.map(function (item) {return item.id;})
    };
    var that = this;
    this.requestedTargets = targets;
    this.results = [];
    this.errors = [];
    async.series([
      function (callback) {
        var intersection = _.intersection(obj.deliveries, ['dhl', 'tnt', 'fedex', 'ups']);
        if (intersection && intersection.length) {
          return that.getGoogleIds(callback);
        }
        callback(null);
      },
      function (callback) {
        var intersection = _.intersection(obj.deliveries, ['fedex', 'ups', 'baikalsr']);
        //if (intersection && intersection.length) {
        //  return that.getCdekIds(callback);
        //}
        callback(null, that.filter.cities);
      }
    ], function (err, cities) {
      obj.cities = cities[1];
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

  getCdekIds (callback) {
    var that = this;
    this.tariffService.cities({cities: this.filter.cities}).then(function (res) {
      callback(null, res);
    });
  }

  getGoogleIds (callback) {

    var that = this;
    if (!this.acService || !this.placeService) {
      try {
        this.acService = new google.maps.places.AutocompleteService();
        this.placeService = new google.maps.places.PlacesService(document.createElement('div'));
        this.geocoder = new google.maps.Geocoder();
      } catch (e) {
        console.error(e);
      }
    }
    var getCity = function (city, country, callback) {
      var query = city;
      country = country || 'Россия';
      query += ', ' + country;
      async.retry({times: 5, interval: 1000}, function (callback) {
        that.geocoder.geocode({ 'address': query}, function(results, status) {
          if (status !== 'OK') {
            return callback('err', []);
          }
          callback(null, results, status);
        });
      }, function (err, results, status) {
          results = results || [];
          if (!results.length) {
            return callback(null, null);
          }
          var json = {
            google_city_id: results[0].place_id,
            engName: results[0].formatted_address.split(',')[0],
            engFullName: results[0].formatted_address
          };
          var latlng = null;
          try {
            latlng = {lat: results[0].geometry.location.lat(), lng: results[0].geometry.location.lng()};
          } catch (e) {
            console.log(e);
          }
          if (!latlng) {
            return callback(null, json);
          }
          async.retry({times: 5, interval: 1000}, function (callback) {
            that.geocoder.geocode({'location': latlng}, function (lResults, status) {
              if (status !== 'OK') {
                return callback('err', []);
              }
              callback(null, lResults, status);
            });
          }, function (err, lResults, status) {
            lResults = lResults || [];
            if (!lResults.length) {
              return callback(null, json);
            }
            if (lResults[0].address_components && lResults[0].address_components.length) {
              lResults[0].address_components.forEach(function (item) {
                if (item.types && item.types.length) {
                  item.types.forEach(function (type) {
                    if (type === 'postal_code') {
                      json.postal_code = item.long_name;
                    }
                    if (type === 'country') {
                      json.countryShort = item.short_name;
                      json.countryLong = item.long_name;
                    }
                  });
                }
              });
            }
            callback(null, json);
          });
      });
      /*that.acService.getPlacePredictions({
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
            if (place.address_components && place.address_components.length) {
              place.address_components.forEach(function (item) {
                if (item.types && item.types.length) {
                  item.types.forEach(function (type) {
                    if (type === 'postal_code') {
                      _places[0].postal_code = item.long_name;
                    }
                    if (type === 'country') {
                      _places[0].countryShort = item.short_name;
                      _places[0].countryLong = item.long_name;
                    }
                  });
                }
              });
            }
          }
          callback(null, _places[0]);
        });
      });*/
    };
    var cityObj = {};
    async.eachSeries(this.filter.cities, function (city, callback) {
      if (!city.from && !city.to) {
        return callback(null);
      }
      async.series([
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
          city.countryFromEng = cityObj[city.from + city.countryFrom].countryLong;
          city.countryFromEngShort = cityObj[city.from + city.countryFrom].countryShort;
          city.postcodeFrom = cityObj[city.from + city.countryFrom].postal_code;
        }
        if (cityObj[city.to + city.countryTo]) {
          city.toGooglePlaceId = cityObj[city.to + city.countryTo].google_city_id;
          city.toGooglePlaceDsc = cityObj[city.to + city.countryTo].city_label;
          city.toEngName = cityObj[city.to + city.countryTo].engName;
          city.toEngFullName = cityObj[city.to + city.countryTo].engFullName;
          city.countryToEng = cityObj[city.to + city.countryTo].countryLong;
          city.countryToEngShort = cityObj[city.to + city.countryTo].countryShort;
          city.postcodeTo = cityObj[city.to + city.countryTo].postal_code;
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