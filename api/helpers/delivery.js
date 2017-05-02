var _ = require('underscore');

var targets = [
  {
    id: 'emspost',
    /*calcUrl: {method: 'POST', uri: 'http://www.emspost.ru/default.aspx/MakeCalculation'},*/ //old
    calcUrl: {method: 'POST', uri: 'http://www.emspost.ru/default.aspx/getConditions'},
    calcInternationalUrl: {method: 'POST', uri: 'http://www.emspost.ru/default.aspx/getForeignPrice'},
    citiesUrl: {method: 'GET', uri: 'http://www.emspost.ru/ru/'},
    newsUrl: {method: 'GET', uri: 'http://www.emspost.ru/ru/'},
    rssUrl: {method: 'GET', uri: 'http://www.emspost.ru'}
  },
  {
    id: 'majorexpress',
    calcUrl: {method: 'POST', uri: 'https://major-express.ru/calculator.aspx'},
    citiesUrl: {method: 'POST', uri: 'https://major-express.ru/calculator.aspx'},
    newsUrl: {method: 'GET', uri: 'https://www.major-express.ru/News.aspx'}
  },
  /*{
    id: 'spsr',
    calcUrl: {method: 'POST', uri: 'http://www.spsr.ru/ru/system/ajax'},
    citiesUrl: {method: 'GET', uri: 'http://www.spsr.ru/ru/service/calculator?q=/spsr/cc_autocomplete/'},
    newsUrl: {method: 'GET', uri: 'http://www.spsr.ru/ru/news'},
    calcGetUrl: {method: 'GET', uri: 'http://www.spsr.ru/ru/service/calculator'}
  },*/
  {
    id: 'spsr',
    calcUrl: {method: 'GET', uri: 'http://www.spsr.ru/webapi/calculator?'},
    citiesUrl: {method: 'GET', uri: 'http://www.spsr.ru/webapi/autocomplete_city?city='},
    newsUrl: {method: 'GET', uri: 'http://www.spsr.ru/ru/news/collection/novosti-i-press-relizy'}
  },
  {
    id: 'dpd',
    calcUrl: {method: 'POST', uri: 'http://www.dpd.ru/ols/calc/calc.do2'},
    calcInternationalUrl: {method: 'POST', uri: 'http://www.dpd.ru/ols/calcint/offire.do2'},
    citiesUrl: {method: 'POST', uri: 'http://www.dpd.ru/ols/calc/cities.do2'},
    citiesInternationalUrl: {method: 'POST', uri: 'http://www.dpd.ru/ols/calcint/city_ru.do2'},
    countriesUrl: {method: 'GET', uri: 'http://www.dpd.ru/ols/calcint/show.do2'},
    newsUrl: {method: 'GET', uri: 'http://www.dpd.ru/dpd/o-dpd/informacionnyj-centr/novosti.do2'},
    baseUrl: 'http://www.dpd.ru'
  },
  {
    id: 'dimex',
    calcUrl: {method: 'GET', uri: 'http://rus.tech-dimex.ru/calculator/calcestnew?'},
    citiesUrl: {method: 'GET', uri: 'http://rus.tech-dimex.ru/calculator/autocompletecity?'},
    countriesUrl: {method: 'POST', uri: 'http://rus.tech-dimex.ru/calculator/getajaxForm'},
    newsUrl: {method: 'GET', uri: 'http://www.dimex.ws/novosti-kompanii/arhiv-novostey/'},
    baseUrl: 'http://www.dimex.ws'
  },
  {
    id: 'flippost',
    calcFlipUrl: {method: 'GET', uri: 'http://flippost.com/proxy.php?dbAct=getTarif&'},
    calcOtdoUrl: {method: 'GET', uri: 'http://otdo.ru/calc/delivery-russia/?'},
    calcOtdoIntUrl: {method: 'GET', uri: 'http://otdo.ru/calc/world/?'},
    citiesUrl: {method: 'GET', uri: 'http://flippost.com/proxy.php?dbAct=getCities&'},
    //newsUrl: {method: 'GET', uri: 'http://www.dimex.ws/novosti-kompanii/arhiv-novostey/'}
  },
  {
    id: 'ponyexpress',
    calcUrl: {method: 'POST', uri: 'http://www.ponyexpress.ru/local/ajax/tariff.php'},
    citiesUrl: {method: 'GET', uri: 'http://www.ponyexpress.ru/autocomplete/city?term='},
    countriesUrl: {method: 'GET', uri: 'http://www.ponyexpress.ru/autocomplete/country?term='},
    newsUrl: {method: 'GET', uri: 'http://www.ponyexpress.ru/about/press-center/news/'}, /*year_2017/?ajax=Y&PAGEN_1=2*/
  },
  {
    id: 'cse',
    calcUrl: {method: 'POST', uri: 'http://web.cse.ru:5000/External/CSETest/Calc.aspx?city=%u041c%u043e%u0441%u043a%u0432%u0430'},
    citiesUrl: {method: 'GET', uri: 'http://web.cse.ru:5000/Scripts/Autocomplete.ashx?'},
    countriesUrl: {method: 'GET', uri: 'http://web.cse.ru:5000/External/CSETest/Calc.aspx?city=%D0%9C%D0%BE%D1%81%D0%BA%D0%B2%D0%B0'},
    newsUrl: {method: 'GET', uri: 'http://cse.ru/sitecontent/city-mosrus/lang-rus/news/#'}
  },
  {
    id: 'garantpost',
    calcUrl1: {method: 'GET', uri: 'http://garantpost.ru/calc/test.php?url=http://api.garantpost.ru/cgi-bin/termCGI?'},
    calcUrl2: {method: 'GET', uri: 'http://garantpost.ru/calc/test.php?url=http://api.garantpost.ru/cgi-bin/tarZonesCGI?'},
    calcIntUrl: {method: 'GET', uri: 'http://garantpost.ru/calc/test.php?url=http://api.garantpost.ru/cgi-bin/tarCGI?calc=w&'},
    servicesUrl: {method: 'GET', uri: 'http://garantpost.ru/calc/test.php?url=http://api.garantpost.ru/cgi-bin/tarCGI?service=show&calc='},
    citiesUrl: {method: 'GET', uri: 'http://garantpost.ru/calc/test.php?url=http://api.garantpost.ru/cgi-bin/tarZonesCGI?okato='},
    countriesUrl: {method: 'GET', uri: 'http://garantpost.ru/calc/test.php?url=http://api.garantpost.ru/cgi-bin/tarCGI?calc=w&okato=show'},
    newsUrl: {method: 'GET', uri: 'http://garantpost.ru/news'}
  },
  {
    id: 'iml',
    calcUrl: {method: 'POST', uri: 'http://iml.ru/wats/calc2.php'},
    citiesUrl: {method: 'GET', uri: 'http://iml.ru/wats/calc2.php'},
    newsUrl: {method: 'GET', uri: 'http://iml.ru/news/#'}
  },
  {
    id: 'cityexpress',
    calcUrl: {method: 'POST', uri: 'http://clients.cityexpress.ru/Customers/Calc.aspx'},
    citiesUrl: {method: 'POST', uri: 'http://clients.cityexpress.ru/Customers/GEstAutoComplete.asmx/GetFullCompletionList'},
    newsUrl: {method: 'GET', uri: 'http://www.cityexpress.ru/news'}
  },
  {
    id: 'dellin',
    calcUrl: {method: 'GET', uri: 'https://www.dellin.ru/api/calculation.json?'},
    citiesUrl: {method: 'GET', uri: 'https://www.dellin.ru/api/cities/search.json?q='},
    terminalsUrl: {method: 'GET', uri: 'https://www.dellin.ru/api/get_terminal_data.json?'},
    newsUrl: {method: 'GET', uri: 'https://www.dellin.ru/news/'}
  },
  {
    id: 'pecom',
    calcUrl: {method: 'GET', uri: 'https://pecom.ru/ajax/calc.php?requrl=%2Fbitrix%2Fcomponents%2Fpecom%2Fcalc%2Fajax.php%3Fpage_type%3Dcalc%26'},
    citiesUrl: {method: 'GET', uri: 'https://pecom.ru/services-are/the-calculation-of-the-cost/'},
    newsUrl: {method: 'GET', uri: 'https://pecom.ru/news/'}
  },
  {
    id: 'vozovoz',
    tokenUrl: {method: 'GET', uri: 'https://vozovoz.ru/order/create/'},
    calcUrl: {method: 'POST', uri: 'https://vozovoz.ru/order/get-price/'},
    calcUrlAdditional: {method: 'POST', uri: 'https://vozovoz.ru/shipping-term/change-dispatch/'},
    citiesUrl: {method: 'POST', uri: 'https://vozovoz.ru/location/get/'},
    newsUrl: {method: 'GET', uri: 'https://vozovoz.ru/news/'}
  },
  {
    id: 'kit',
    calcUrl: {method: 'GET', uri: 'http://tk-kit.ru/calculate/get_form_hash.php?'},
    calcUrlAdditional: {method: 'GET', uri: 'http://tk-kit.ru/calculate/rx_gocalc_multi.php?'},
    citiesUrl: {method: 'GET', uri: 'http://tk-kit.ru/calculate/ajax/get_city_list.php'},
    newsUrl: {method: 'GET', uri: 'http://tk-kit.ru/about/news/'}
  },
  {
    id: 'rateksib',
    calcUrl: {method: 'POST', uri: 'http://rateksib.ru/ajax/calc'},
    citiesUrl: {method: 'POST', uri: 'http://rateksib.ru/ajax/calccity'},
    newsUrl: {method: 'GET', uri: 'http://rateksib.ru/novosti'}
  },
  {
    id: 'expressauto',
    calcUrl: {method: 'POST', uri: 'http://expressauto.ru/ajax/'},
    citiesUrl: {method: 'POST', uri: 'http://expressauto.ru/ajax/'},
    newsUrl: {method: 'GET', uri: 'http://expressauto.ru/news'}
  },
  {
    id: 'dhl',
    authorizeUrl: {method: 'POST', uri: 'http://zakaz.dhl.ru/api/authorize'},
    calcUrl: {method: 'POST', uri: 'http://zakaz.dhl.ru/api/calculatePrice'},
    calcUrlAdditional: {method: 'POST', uri: 'http://zakaz.dhl.ru/api/getServicePoints'},
    citiesUrl: {method: 'POST', uri: 'http://zakaz.dhl.ru/api/GetPlaceDetails'},
    newsUrl: {method: 'GET', uri: 'http://www.dhl.ru/ru/press/releases.html'}
  },
  {
    id: 'tnt',
    calcUrl: {method: 'POST', uri: 'https://www.tnt.com/publicapis/v1/quotes'},
    citiesUrl: {method: 'GET', uri: 'https://mytnt.tnt.com/service/address-search-v2/location?limit=30&locale=ru_RU&q='},
    newsUrl: {method: 'GET', uri: 'https://www.tnt.com/express/ru_ru/site/home/the-company/press/press_releases.html'}
  }
  /*{
    id: 'jde',
    calcUrl: {method: 'POST', uri: 'http://www.jde.ru/ajax/calculator.html'},
    citiesUrl: {method: 'POST', uri: 'http://www.jde.ru/ajax/branch.html'},
    newsUrl: {method: 'GET', uri: 'http://www.jde.ru/company/news.html'}
  }*/
  /*
  {id: 'ups', name: 'UPS'},
  {id: 'fedex', name: 'Fedex'},
  {id: 'baikalsr', name: 'Baikalsr'}*/
];

var targetObj = _.indexBy(targets, 'id');

exports.list = function () {
  return targets;
};

exports.get = function (id) {
  if (targetObj[id]) {
    for (var key in targetObj[id]) {
      if (targetObj[id][key] instanceof Object) {
        targetObj[id][key].headers = {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.81 Safari/537.36'
        }
      }
    }
  }
  return targetObj[id];
};