class Tariff {
  constructor($resource, $location) {
    var hostName = $location.$$protocol + '://' + $location.$$host;
    if ($location.$$port) {
      hostName += ':' + $location.$$port;
    }
    var url = [hostName, 'api', 'tariff', ':action'];
    this.resource = $resource(url.join('/'), {}, {
      request: {
        params: {action: 'request'},
        method: 'POST',
        isArray: false
      },
      ping: {
        params: {action: 'ping'},
        method: 'GET',
        isArray: false
      },
      news: {
        params: {action: 'news'},
        method: 'POST',
        isArray: true
      }
    });
    this.targets = [
      {id: 'emspost', name: 'EMSPost'},
      {id: 'majorexpress', name: 'Major-express'},
      {id: 'spsr', name: 'Spsr'},
      {id: 'dpd', name: 'DPD'},
      {id: 'dhl', name: 'DHL'},
      {id: 'dimex', name: 'Dimex'},
      {id: 'flippost', name: 'Flippost'},
      {id: 'ponyexpress', name: 'Ponyexpress'},
      {id: 'tnt', name: 'TNT'},
      {id: 'ups', name: 'UPS'},
      {id: 'cse', name: 'CSE'},
      {id: 'garantpost', name: 'Garantpost'},
      {id: 'cityexpress', name: 'Cityexpress'},
      {id: 'fedex', name: 'Fedex'},
      {id: 'dellin', name: 'Dellin'},
      {id: 'pecom', name: 'Pecom'},
      {id: 'vozovoz', name: 'Vozovoz'},
      {id: 'baikalsr', name: 'Baikalsr'},
      {id: 'kit', name: 'TK-kit'},
      {id: 'rateksib', name: 'Rateksib'},
      {id: 'expressauto', name: 'Expressauto'},
      {id: 'jde', name: 'Jde'},
      {id: 'ems', name: 'EMS'},
      {id: 'iml', name: 'Iml'}
    ];
  }

  request(data) {
    return this.resource.request(data).$promise;
  }

  ping(data) {
    return this.resource.ping(data).$promise;
  }

  news(data) {
    return this.resource.news(data).$promise;
  }

  getTargets() {
    return this.targets;
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
