const async = require('async');
const _ = require('underscore');
import { NativeEventSource, EventSourcePolyfill } from 'event-source-polyfill';
import { v4 as uuidv4 } from 'uuid';
const EventSource = NativeEventSource || EventSourcePolyfill;

const pluralize = (num, array) => {
  const mod = num % 10;
  let result = array[2];
  if (mod === 1 && num % 11 !== 0) {
    result = array[0];
  } else if ([2,3,4].indexOf(mod) > -1) {
    result = array[1];
  }
  return result;
};

class TariffsCtrl {

  constructor($scope, $rootScope, Tariff, Notify, Xls, bsLoadingOverlayService) {
    this.filter = {
      cities: [],
      weights: [],
      targets: []
    };
    const array = [];
    for (let i = 1; i <= 10; i++) {
      if (i === 1) {
        array.push(0.5);
      }
      array.push(i);
    }
    for (let i = 20; i <= 100; i += 10) {
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
    this.bsLoadingOverlayService = bsLoadingOverlayService;
    this.tariffService = Tariff;
    this.dynamic = 0;
    this.targets = Tariff.getTargets();
    this.countries = Tariff.getCountries();
    this.filter.country = this.countries[0].id;
    this.requestedTargets = [];
    this.targetsObj = Tariff.getTargetsObj();

    this.sort = {
      name: 'delivery',
      direction: 'asc'
    };

    this.sessionID = uuidv4();

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

    const weightStr = localStorage.weights;
    if (weightStr) {
      let json = null;
      try {
        json = JSON.parse(weightStr);
      } catch (e) {
        console.error(e);
      }
      if (json && Array.isArray(json)) {
        this.filter.weights = json;
      }
    }

    window.addEventListener('beforeunload', (e) => {
      navigator.sendBeacon(`http://localhost:5000/api/beacon?sessionID=${this.sessionID}`, {});
    });
  }

  setSort () {
    let results = [];
    switch (this.sort.name) {
      case 'delivery':
        results = _.sortBy(this.results, (item) => item.delivery);
        break;
      case 'weight':
        results = _.sortBy(this.results, (item) => item.weight);
        break;
    }
    let needReverse = this.sort.direction === 'desc' && results.length;
    if (needReverse) {
      const value = results[0][this.sort.name];
      if (results.every((item) => item[this.sort.name] === value)) {
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
    res.forEach((item) => {
      if (!item.error) {
        this.results.push(item);
      } else {
        this.errors.push(item);
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
    const item = parseFloat($item);
    if (isNaN(item)) {
      this.filter.weights = this.filter.weights.filter((it) => it !== $item);
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
    var that = this;
    this.loading.main = true;
    this.dynamic = 0;
    var targets = this.filter.targets.length ? this.filter.targets : this.targets.filter(function (item) { return item.country === that.filter.country;});
    var obj = {
      weights: this.filter.weights,
      deliveries: targets.map(function (item) {return item.id;})
    };
    this.requestedTargets = targets;
    this.results = [];
    this.errors = [];
    async.series([
      function (callback) {
        var intersection = _.intersection(obj.deliveries, ['dhl', 'tnt', 'fedex', 'ups', 'majorexpress', 'cityexpress', 'pochta', 'avislogisticskz', 'dhlkz']);
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
      const es1 = new EventSource(`http://localhost:5000/api/tariff/request?data=${JSON.stringify(obj)}&sessionID=${that.sessionID}`);
      es1.addEventListener("message", ({ data }) => {
        const parsedData = JSON.parse(data);
        that.$scope.$apply(() => {
          const obj = {};
          parsedData.forEach(v => obj[v.delivery] = 1);
          that.dynamic = that.dynamic + Object.keys(obj).length;
          that.receiveTariffs(parsedData);
        });
      });
      es1.addEventListener("error", function () {
        that.notify.error({ status: 500, data: {title: "Соединение с сервером потеряно. Ожидается реконнект"} });
      });
      es1.addEventListener("eventFinish", ({ data }) => {
        es1.close();
        that.$scope.$apply(() => {
          that.loading.main = false;
          that.requestedTargets = [];
          that.dynamic = 0;
          that.receiveTariffs(JSON.parse(data));
        });
      });
      es1.addEventListener("eventError", (event) => {
        try {
          that.notify.error({ status: 500, data: JSON.parse(event.data) });
        } catch(e) {}
        es1.close();
        that.$scope.$apply(() => {
          that.loading.main = false;
          that.requestedTargets = [];
        });
      });

      // that.tariffService.request(obj).then(function (res) {
      //   that.pingTariffs();
      // }, function (err) {
      //   that.notify.error(err);
      // });
    });

  }

  getCityKey (item) {
    return item.city.initialCityFrom + item.city.initialCityTo + item.city.from + item.city.to +
      item.city.initialCountryFrom + item.city.initialCountryTo + item.city.countryFrom + item.city.countryTo + item.weight
  }

  repeatResponse (res) {
    res.forEach((item) => {
      const key = this.getCityKey(item);
      if (!item.error) {
        const resFiltered = this.results.filter((resItem) => {
          return this.getCityKey(resItem) === key;
        });
        if (!resFiltered.length) {
          this.results.push(item);
          this.errors = this.errors.filter((resItem) => {
            return this.getCityKey(resItem) !== key;
          });
        } else {
          _.extend(resFiltered[0], item);
        }
      } else {
        const errFiltered = this.errors.filter((resItem) => {
          return this.getCityKey(resItem) === key;
        });
        if (!errFiltered.length) {
          this.errors.push(item);
        } else {
          _.extend(errFiltered[0], item);
        }
      }
    });

  }

  repeatAll() {
    this.loading.errors = true;
    this.bsLoadingOverlayService.start();
    let requests = {};
    this.errors.forEach((item) => {
      if (item.req) {
        requests[item.delivery] = requests[item.delivery] || {};
        requests[item.delivery].delivery = item.delivery;
        requests[item.delivery].requests = requests[item.delivery].requests || [];
        const copy = _.clone(item.city);
        copy.from = copy.initialCityFrom || copy.from;
        copy.to = copy.initialCityTo || copy.to;
        copy.countryFrom = copy.initialCountryFrom || copy.countryFrom;
        copy.countryTo = copy.initialCountryTo || copy.countryTo;
        requests[item.delivery].requests.push({
          city: copy,
          weight: item.weight
        });
      }
    });
    async.eachSeries(Object.keys(requests), (key, callback) => {
      this.tariffService.one({delivery: key, requests: requests[key].requests})
        .then(this.repeatResponse.bind(this), this.notify.error.bind(this.notify))
        .finally(() =>  {
          callback(null);
        });
    }, () => {
      this.loading.errors = false;
      this.bsLoadingOverlayService.stop();
    });
  }

  repeat(item) {
    item.loading = true;
    const copy = _.clone(item.city);
    copy.from = copy.initialCityFrom || copy.from;
    copy.to = copy.initialCityTo || copy.to;
    copy.countryFrom = copy.initialCountryFrom || copy.countryFrom;
    copy.countryTo = copy.initialCountryTo || copy.countryTo;
    this.tariffService.one({delivery: item.delivery, requests: [{city: copy, weight: item.weight}]})
      .then(this.repeatResponse.bind(this), this.notify.error.bind(this.notify))
      .finally(() => {
        item.loading = false;
      });
  }

  downloadFile () {
    this.xls.download('Тарифы.xlsx', document.getElementById('tariffs'));
  }

  getCdekIds (callback) {
    this.tariffService.cities({cities: this.filter.cities})
      .then(function (res) {
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
    const reader = new FileReader();
    reader.onload = (e) => {
      this.$scope.$apply(() => {
        this.filter.cities = this.xls.readCities(e.target.result);
      });
    };
    reader.readAsBinaryString(f);
  }

  pluralizeCities (value) {
    return `${value} ${pluralize(value, ['направление', 'направления', 'направлений'])}`;
  };

}

export default TariffsCtrl;

TariffsCtrl.$inject = ['$scope', '$rootScope', 'Tariff', 'Notify', 'Xls', 'bsLoadingOverlayService'];