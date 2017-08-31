class Tariff {
  constructor($resource, $location) {
    var hostName = $location.$$protocol + '://' + $location.$$host;
    if ($location.$$port) {
      hostName += ':' + ($location.$$port === 8080 ? 5000 : $location.$$port);
    }
    var url = [hostName, 'api', 'tariff', ':action'];
    this.resource = $resource(url.join('/'), {}, {
      request: {
        params: {action: 'request'},
        method: 'POST',
        isArray: false
      },
      one: {
        params: {action: 'one'},
        method: 'POST',
        isArray: true
      },
      ping: {
        params: {action: 'ping'},
        method: 'GET',
        isArray: false
      },
      news: {
        params: {action: 'news'},
        method: 'POST',
        isArray: false
      },
      cities: {
        params: {action: 'cities'},
        method: 'POST',
        isArray: true
      },
      settings: {
        url: [hostName, 'api', 'settings'].join('/'),
        method: 'GET',
        isArray: false,
        cache: 'cache'
      }
    });
    this.targets = [];
    this.countries = [];
  }

  request(data) {
    return this.resource.request(data).$promise;
  }

  one(data) {
    return this.resource.one(data).$promise;
  }

  ping(data) {
    return this.resource.ping(data).$promise;
  }

  news(data) {
    return this.resource.news(data).$promise;
  }

  cities(data) {
    return this.resource.cities(data).$promise;
  }

  settings(data) {
    return this.resource.settings(data).$promise;
  }

  setSettings(settings) {
    this.targets = settings.deliveries;
    this.countries = settings.countries;
  }

  getTargets() {
    return this.targets;
  }

  getCountries() {
    return this.countries;
  }

  getTargetsObj() {
    var obj = {};
    this.targets.forEach(function (item) {
      obj[item.id] = {};
    });
    return obj;
  }
}

Tariff.$inject = ['$resource', '$location'];

export default Tariff;
