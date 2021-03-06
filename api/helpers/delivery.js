import _ from 'lodash';
import { userAgent } from '../../conf';

const targets = [
  {
    id: 'cdek',
    name: 'CDEK',
    country: 'ru',
    cookieUrl: {method: 'GET', uri: 'https://cdek.ru/calculate?utm_referrer=', followAllRedirects: true},
    calcUrl: {method: 'POST', uri: 'https://cdek.ru/graphql'},
  },
  {
    id: 'pochta',
    name: 'Pochta.ru',
    country: 'ru',
    pageUrl: {method: 'GET', uri: 'https://www.pochta.ru/parcels'},
    calcUrl: {method: 'POST', uri: 'https://www.pochta.ru/portal-portlet/delegate/calculator/v1/api/delivery.time.cost.get'},
    citiesUrl: {method: 'POST', uri: 'https://www.pochta.ru/suggestions/v1/suggestion.find-addresses'},
    citiesIndexUrl: {method: 'POST', uri: 'https://www.pochta.ru/suggestions/v1/suggestion.find-indices-by-address'},
    citiesPostofficesUrl: {method: 'POST', uri: 'https://www.pochta.ru/suggestions/v1/suggestion.find-postoffices-by-address'},
    countriesUrl: {method: 'GET', uri: 'https://www.pochta.ru/nsi/v1/countries/by.name'},
    dictionaryUrl: {method: 'GET', uri: 'https://www.pochta.ru/portal-portlet/delegate/calculator/v1/api/dictionary'},
    newsUrl: {method: 'GET', uri: 'http://www.emspost.ru/ru/'},
    rssUrl: {method: 'GET', uri: 'http://www.emspost.ru'}
  },
  {
    id: 'majorexpress',
    name: 'Major-express',
    country: 'ru',
    pageUrl: {method: 'GET', uri: 'https://www.major-express.ru/calculator.aspx'},
    calcUrl: {method: 'POST', uri: 'https://www.major-express.ru/Calculator.aspx/Calculate'},
    citiesUrl: {method: 'POST', uri: 'https://www.major-express.ru/calculator.aspx'},
    reloadCitiesUrl: {method: 'POST', uri: 'https://www.major-express.ru/Calculator.aspx/CheckReloadCities'},
    newsUrl: {method: 'GET', uri: 'https://www.major-express.ru/News.aspx'}
  },
  {
    id: 'dpd',
    name: 'DPD',
    country: 'ru',
    calcUrl: {method: 'POST', uri: 'https://www.dpd.ru/ols/calc/calc.do2'},
    calcInternationalUrl: {method: 'POST', uri: 'https://www.dpd.ru/ols/calcint/offire.do2'},
    citiesUrl: {method: 'POST', uri: 'https://www.dpd.ru/ols/calc/cities.do2'},
    citiesInternationalUrl: {method: 'POST', uri: 'https://www.dpd.ru/ols/calcint/city_ru.do2'},
    countriesUrl: {method: 'GET', uri: 'https://www.dpd.ru/ols/calcint/show.do2'},
    newsUrl: {method: 'GET', uri: 'http://www.dpd.ru/dpd/o-dpd/informacionnyj-centr/novosti.do2'},
    baseUrl: 'http://www.dpd.ru'
  },
  {
    id: 'dimex',
    name: 'Dimex',
    country: 'ru',
    cookieUrl: {method: 'GET', uri: 'https://www.dimex.ws/kalkulyator/ekspress/'},
    calcUrl: {method: 'GET', uri: 'https://rus.tech-dimex.ru/calculator/calcestnew?'},
    citiesUrl: {method: 'GET', uri: 'https://rus.tech-dimex.ru/calculator/autocompletecity?'},
    countriesUrl: {method: 'POST', uri: 'https://rus.tech-dimex.ru/calculator/getajaxForm'},
    newsUrl: {method: 'GET', uri: 'http://www.dimex.ws/novosti-kompanii/arhiv-novostey/'},
    baseUrl: 'http://www.dimex.ws'
  },
  {
    id: 'flippost',
    name: 'Flippost',
    country: 'ru',
    calcFlipUrl: {method: 'POST', uri: 'https://flippost.com/instruments/stoimdost/'},
    calcOtdoUrl: {method: 'GET', uri: 'http://otdo.ru/calc/calc/delivery-russia/?'},
    calcOtdoIntUrl: {method: 'GET', uri: 'http://otdo.ru/calc/calc/world/?'},
    citiesUrl: {method: 'GET', uri: 'https://flippost.com/ajax/api/?action=cities_suggestions&city='},
    //newsUrl: {method: 'GET', uri: ''}
  },
  {
    id: 'ponyexpress',
    name: 'Ponyexpress',
    country: 'ru',
    calcUrl: {method: 'POST', uri: 'https://www.ponyexpress.ru/local/ajax/tariff.php'},
    citiesUrl: {method: 'GET', uri: 'https://www.ponyexpress.ru/autocomplete/city?term='},
    countriesUrl: {method: 'GET', uri: 'https//www.ponyexpress.ru/autocomplete/country?term='},
    newsUrl: {method: 'GET', uri: 'https://www.ponyexpress.ru/about/press-center/news/'},
    baseUrl: 'https://www.ponyexpress.ru'
  },
  {
    id: 'cse',
    name: 'CSE',
    country: 'ru',
    calcPageUrl: {method: 'GET', uri: 'https://www.cse.ru/ovb/order/'},
    calcUrl: {method: 'GET', uri: 'https://lk.cse.ru/api/calc?'},
    citiesUrl: {method: 'GET', uri: 'https://lk.cse.ru/api/settlements?'},
    newsUrl: {method: 'GET', uri: 'http://cse.ru/sitecontent/city-mosrus/lang-rus/news/#'}
  },
  {
    id: 'garantpost',
    name: 'Garantpost',
    country: 'ru',
    calcUrl1: {method: 'GET', uri: 'https://garantpost.ru/calc/test.php?url=https://api.garantpost.ru/cgi-bin/termCGI?'},
    calcUrl2: {method: 'GET', uri: 'https://garantpost.ru/calc/test.php?url=https://api.garantpost.ru/cgi-bin/tarZonesCGI?'},
    calcIntUrl: {method: 'GET', uri: 'https://garantpost.ru/calc/test.php?url=https://api.garantpost.ru/cgi-bin/tarCGI?calc=w&'},
    servicesUrl: {method: 'GET', uri: 'https://garantpost.ru/calc/test.php?url=https://api.garantpost.ru/cgi-bin/tarCGI?service=show&calc='},
    citiesUrl: {method: 'GET', uri: 'https://garantpost.ru/calc/test.php?url=https://api.garantpost.ru/cgi-bin/tarZonesCGI?okato='},
    countriesUrl: {method: 'GET', uri: 'https://garantpost.ru/calc/test.php?url=https://api.garantpost.ru/cgi-bin/tarCGI?calc=w&okato=show'},
    newsUrl: {method: 'GET', uri: 'http://garantpost.ru/news'},
    baseUrl: 'http://garantpost.ru'
  },
  {
    id: 'iml',
    name: 'Iml',
    country: 'ru',
    calcUrl: {method: 'POST', uri: 'https://iml.ru/perscalc'},
    citiesUrl: {method: 'GET', uri: 'https://iml.ru/perscalc'},
    newsUrl: {method: 'GET', uri: 'http://iml.ru/news'},
    baseUrl: 'http://iml.ru'
  },
  {
    id: 'cityexpress',
    name: 'Cityexpress',
    country: 'ru',
    calcUrl: {method: 'POST', uri: 'https://clients.cityexpress.ru/Calculator/GetTariffs'},
    citiesUrl: {method: 'POST', uri: 'https://clients.cityexpress.ru/Data/GetAdrressOneBoxList'},
    newsUrl: {method: 'GET', uri: 'http://www.cityexpress.ru/news'},
    baseUrl: 'http://www.cityexpress.ru'
  },
  {
    id: 'dellin',
    name: 'Dellin',
    country: 'ru',
    calcUrl: {method: 'GET', uri: 'https://www.dellin.ru/api/calculation.json?'},
    citiesUrl: {method: 'GET', uri: 'https://www.dellin.ru/api/cities/search.json?q='},
    terminalsUrl: {method: 'GET', uri: 'https://www.dellin.ru/api/v1/terminals?code='},
    newsUrl: {method: 'GET', uri: 'https://www.dellin.ru/api/news/filter.json?categories%5B%5D=1&categories%5B%5D=2&categories%5B%5D=3&categories%5B%5D=4&categories%5B%5D=7&categories%5B%5D=6&categories%5B%5D=5&'},
    baseUrl: 'https://www.dellin.ru'
  },
  {
    id: 'pecom',
    name: 'Pecom',
    country: 'ru',
    pageUrl: {method: 'GET', uri: 'https://pecom.ru/services-are/shipping-request/'},
    calcUrl: {method: 'POST', uri: 'https://pecom.ru/ajax/'},
    citiesUrl: {method: 'GET', uri: 'https://pecom.ru/services-are/the-calculation-of-the-cost/'},
    newsUrl: {method: 'GET', uri: 'https://pecom.ru/news/'},
    baseUrl: 'https://pecom.ru'
  },
  {
    id: 'vozovoz',
    name: 'Vozovoz',
    country: 'ru',
    pageUrl: {method: 'GET', uri: 'https://vozovoz.ru/order/create/'},
    tokenUrl: {method: 'GET', uri: 'https://vozovoz.ru/order/create/'},
    calcUrl: {method: 'POST', uri: 'https://api.vozovoz.ru/order/get-price'},
    terminalUrl: {method: 'POST', uri: 'https://api.vozovoz.ru/terminal/all'},
    calcUrlAdditional: {method: 'POST', uri: 'https://vozovoz.ru/shipping-term/change-dispatch/'},
    citiesUrl: {method: 'POST', uri: 'https://api.vozovoz.ru/location/get'},
    newsUrl: {method: 'POST', uri: 'https://vozovoz.ru/article/ajax-get-news/'},
    baseUrl: 'https://vozovoz.ru'
  },
  {
    id: 'kit',
    name: 'TK-kit',
    country: 'ru',
    tokenUrl: {method: 'GET', uri: 'https://gtdel.com/'},
    calcUrl: {method: 'POST', uri: 'https://gtdel.com/site/calculate_end?send=1&location=home'},
    calcValidateUrl: {method: 'POST', uri: 'https://gtdel.com/site/calculate_validate?location=home'},
    calcUrlAdditional: {method: 'GET', uri: 'http://tk-kit.ru/calculate/rx_gocalc_multi.php?'},
    citiesUrl: {method: 'GET', uri: 'https://gtdel.com/site/autocomplete-city?is_active=1&term='},
    newsUrl: {method: 'GET', uri: 'http://tk-kit.ru/about/news/'},
    baseUrl: 'http://tk-kit.ru'
  },
  {
    id: 'expressauto',
    name: 'Expressauto',
    country: 'ru',
    calcUrl: {method: 'POST', uri: 'http://expressauto.ru/ajax/'},
    citiesUrl: {method: 'POST', uri: 'http://expressauto.ru/ajax/'},
    newsUrl: {method: 'GET', uri: 'http://expressauto.ru/news/'},
    baseUrl: 'http://expressauto.ru'
  },
  {
    id: 'dhl',
    name: 'DHL',
    country: 'ru',
    authorizeUrl: {method: 'POST', uri: 'https://express.dhl.ru/api/authorize'},
    calcUrl: {method: 'POST', uri: 'https://express.dhl.ru/api/calculateprice'},
    calcUrlAdditional: {method: 'POST', uri: 'https://express.dhl.ru/api/getServicePoints'},
    citiesUrl: {method: 'POST', uri: 'https://express.dhl.ru/api/autocomplete'},
    newsUrl: {method: 'GET', uri: 'http://www.dhl.ru/ru/press/releases'}
  },
  {
    id: 'jde',
    name: 'Jde',
    country: 'ru',
    pageUrl: {method: 'GET', uri: 'https://www.jde.ru/'},
    page2Url: {method: 'GET', uri: 'https://i.jde.ru/rq/'},
    calcUrl: {method: 'POST', uri: 'https://i.jde.ru/rqst/CalcAPI/'},
    citiesUrl: {method: 'GET', uri: 'https://i.jde.ru/rqst/GetAddr/'},
    routesFromUrl: {method: 'GET', uri: 'https://i.jde.ru/rqst/GetNearOtpr/'},
    routesToUrl: {method: 'GET', uri: 'https://i.jde.ru/rqst/GetNearNazn/'},
    codeUrl: {method: 'GET', uri: 'https://i.jde.ru/rqst/GetSessionIdCloud'},
    servicesUrl: {method: 'POST', uri: 'https://i.jde.ru/rqst/ListDopUslugiOTPR'},
    newsUrl: {method: 'GET', uri: 'http://www.jde.ru/company/news/'},
    baseUrl: 'http://www.jde.ru'
  },
  {
    id: 'fedex',
    name: 'Fedex',
    country: 'ru',
    calcUrl: {method: 'POST', uri: 'https://www.fedex.com/ratefinder/standalone?method=getQuickQuote'},
    countriesUrl: {method: 'GET', uri: 'https://www.fedex.com/ratefinder/home?cc=ru&language=ru'},
    newsFirstUrl: {method: 'GET', uri: 'http://about.van.fedex.com/newsroom/global-english/'},
    newsUrl: {method: 'POST', uri: 'http://about.van.fedex.com/wp-admin/admin-ajax.php'}
  },
  {
    id: 'ups',
    name: 'UPS',
    country: 'ru',
    calcUrl: {method: 'POST', uri: 'https://wwwapps.ups.com/ctc/results'},
    countriesUrl: {method: 'POST', uri: 'https://wwwapps.ups.com/cac/cacws/cacService/getCACInitValue'},
    citiesUrl: {method: 'POST', uri: 'https://wwwapps.ups.com/cac/cacws/cacService/getCityValues'},
    newsUrl: {method: 'GET', uri: 'https://www.pressroom.ups.com/pressroom/news-assets/pagination/fetchbyconcept.page?ConceptType=PressReleases&language=ru&start='},
    baseUrl: 'https://www.pressroom.ups.com'
  },
  {
    id: 'baikalsr',
    name: 'Baikalsr',
    country: 'ru',
    calcUrl: {method: 'POST', uri: 'https://www.baikalsr.ru/json/api_calculator.json'},
    citiesUrl: {method: 'GET', uri: 'https://www.baikalsr.ru/json/api_fias_cities.json?text='},
    newsUrl: {method: 'GET', uri: 'https://www.baikalsr.ru/json/news.json?'},
    baseUrl: 'https://www.baikalsr.ru'
  },

  {
    id: 'dpdby',
    name: 'DPD',
    country: 'by',
    calcUrl: {method: 'POST', uri: 'https://mydpd.dpd.by/ols/calc/calc.do2'},
    calcInternationalUrl: {method: 'POST', uri: 'https://mydpd.dpd.by/ols/calcint/offire.do2'},
    citiesUrl: {method: 'POST', uri: 'https://mydpd.dpd.by/ols/calc/cities.do2'},
    citiesInternationalUrl: {method: 'POST', uri: 'https://mydpd.dpd.by/ols/calcint/city_ru.do2'},
    countriesUrl: {method: 'GET', uri: 'https://mydpd.dpd.by/ols/calcint/show.do2'},
    newsUrl: {method: 'GET', uri: 'https://mydpd.dpd.by/dpd/o-dpd/informacionnyj-centr/novosti.do2'},
    baseUrl: 'https://mydpd.dpd.by'
  },
  {
    id: 'globel24by',
    name: 'Globel24',
    country: 'by',
    calcUrl: {method: 'POST', uri: 'https://globel24.by/local/templates/html_dev/components/db.calc.fiz.new/globel_calc/main/ajax/ajax.php'},
    citiesUrl: {method: 'GET', uri: 'https://globel24.by/calculator/'},
    newsUrl: {method: 'GET', uri: 'http://globel24.by/about/news/'},
    baseUrl: 'http://globel24.by'
  },
  {
    id: 'autolightby',
    name: 'Autolight',
    country: 'by',
    calcUrl: {method: 'POST', uri: 'http://autolight.by/user-account/make_order/getAvailableServices.php'},
    citiesUrl: {method: 'GET', uri: 'http://autolight.by/ajax/get_cities_autocomplete.php?term='},
    newsUrl: {method: 'GET', uri: 'http://autolight.by/autolight_express/infocentr/newscompany/'},
    baseUrl: 'http://autolight.by'
  },
  {
    id: 'vozimby',
    name: 'Vozim',
    country: 'by',
    calcUrl: {method: 'POST', uri: 'https://api.vozim.by/?r=aping/calculator'},
    citiesUrl: {method: 'GET', uri: 'https://api.vozim.by//?r=aping/location'},
    baseUrl: 'http://vozim.by'
  },
  {
    id: 'dimexby',
    name: 'Dimex',
    country: 'by',
    calcUrl: {method: 'GET', uri: 'http://bel.tech-dimex.ru/calculator/calcestnew?'},
    citiesUrl: {method: 'GET', uri: 'http://bel.tech-dimex.ru/calculator/autocompletecity?'},
    countriesUrl: {method: 'POST', uri: 'http://bel.tech-dimex.ru/calculator/getajaxForm'}
  },
  {
    id: 'belpostby',
    name: 'Belpost',
    country: 'by',
    calcUrl: {method: 'POST', uri: 'http://tarifikator.belpost.by/forms/internal/ems.php'},
    calcInternationalUrl: {method: 'POST', uri: 'http://tarifikator.belpost.by/forms/international/ems.php'},
    citiesUrl: {method: 'GET', uri: 'http://tarifikator.belpost.by/forms/internal/ems.php'},
    countriesUrl: {method: 'GET', uri: 'http://tarifikator.belpost.by/forms/international/ems.php'},
  },
  {
    id: 'korexby',
    name: 'Korex',
    country: 'by',
    calcUrl: {method: 'POST', uri: 'http://korex.by/ajax/calc.php', json: true},
    citiesUrl: {method: 'POST', uri: 'http://korex.by/ajax/search_address.php', json: true}
  },
  {
    id: 'ponyexpressby',
    name: 'Ponyexpress',
    country: 'by',
    calcUrl: {method: 'POST', uri: 'http://ponyexpress.by/local/ajax/courier.php', json: true},
    citiesUrl: {method: 'GET', uri: 'http://ponyexpress.by/autocomplete/city?term=', json: true},
    countriesUrl: {method: 'GET', uri: 'http://ponyexpress.by/autocomplete/country?term='}
  },
  {
    id: 'alemtatkz',
    name: 'Alemtat',
    country: 'kz',
    calcUrl: {method: 'POST', uri: 'http://www.alemtat.kz/api.php'},
    citiesUrl: {method: 'POST', uri: 'http://www.alemtat.kz/api.php'},
    countriesUrl: {method: 'POST', uri: 'http://www.alemtat.kz/calc/cis.php'},
    baseUrl: 'http://www.alemtat.kz'
  },
  {
    id: 'exlinekz',
    name: 'Exline',
    country: 'kz',
    calcUrl: {method: 'GET', uri: 'https://api.exline.systems/public/v1/calculate?'},
    deliveryUrl: {method: 'GET', uri: 'https://api.exline.systems/public/v1/trails?'},
    citiesFromUrl: {method: 'GET', uri: 'https://api.exline.systems/public/v1/regions/origin?title='},
    citiesToUrl: {method: 'GET', uri: 'https://api.exline.systems/public/v1/regions/destination?title='},
    baseUrl: 'https://www.exline.kz'
  },
  {
    id: 'avislogisticskz',
    name: 'Avislogistics',
    country: 'kz',
    calcUrl: {method: 'POST', uri: 'https://avislogistics.kz/TariffCalculator/IndexStepThree'},
    citiesUrl: {method: 'POST', uri: 'https://avislogistics.kz/TariffCalculator/GetListsCitiesInCountry'},
    countriesUrl: {method: 'POST', uri: 'https://avislogistics.kz/TariffCalculator/GetListsCountries'},
    baseUrl: 'http://avislogistics.kz'
  },
  {
    id: 'dpdkz',
    name: 'DPD',
    country: 'kz',
    calcUrl: {method: 'POST', uri: 'http://mydpd.dpd.kz/ols/calc/calc.do2'},
    calcInternationalUrl: {method: 'POST', uri: 'http://mydpd.dpd.kz/ols/calcint/offire.do2'},
    citiesUrl: {method: 'POST', uri: 'http://mydpd.dpd.kz/ols/calc/cities.do2'},
    citiesInternationalUrl: {method: 'POST', uri: 'http://mydpd.dpd.kz/ols/calcint/city_ru.do2'},
    countriesUrl: {method: 'GET', uri: 'http://mydpd.dpd.kz/ols/calc/'},
    newsUrl: {method: 'GET', uri: 'http://mydpd.dpd.kz/dpd/o-dpd/informacionnyj-centr/novosti.do2'},
    baseUrl: 'http://mydpd.dpd.kz'
  },
  {
    id: 'ponyexpresskz',
    name: 'Ponyexpress',
    country: 'kz',
    calcUrl: {method: 'POST', uri: 'http://ponyexpress.kz/local/ajax/tariff.php'},
    citiesUrl: {method: 'GET', uri: 'https://www.ponyexpress.ru/autocomplete/city?term='},
    countriesUrl: {method: 'GET', uri: 'https//www.ponyexpress.ru/autocomplete/country?term='},
    baseUrl: 'http://ponyexpress.kz'
  },
  {
    id: 'postexpresskz',
    name: 'Postexpress',
    country: 'kz',
    calcUrl: {method: 'POST', uri: 'http://postexpress.baseinform.com/API/index.php/calc/'},
    citiesUrl: {method: 'GET', uri: 'http://postexpress.baseinform.com/API/index.php/towns/get_towns'},
    baseUrl: 'http://postexpress.kz'
  },
  {
    id: 'rikakz',
    name: 'Rika',
    country: 'kz',
    calcUrl: {method: 'POST', uri: 'http://rika.kz/calc/'},
    calcInternationalUrl: {method: 'POST', uri: 'http://rika.kz/calc/?type=world'},
    citiesUrl: {method: 'GET', uri: 'http://rika.kz/calc/?type=kz'},
    countriesUrl: {method: 'GET', uri: 'http://rika.kz/calc'},
    baseUrl: 'http://rika.kz'
  },
  {
    id: 'blitspostkz',
    name: 'Blitspost',
    country: 'kz',
    citiesFromUrl: {method: 'GET', uri: 'http://api.blitspost.work/public/v1/regions/origin?title='},
    citiesToUrl: {method: 'GET', uri: 'http://api.blitspost.work/public/v1/regions/destination?title='},
    calcUrl: {method: 'GET', uri: 'http://api.blitspost.work/public/v1/calculate?'},
    baseUrl: 'http://blitspost.kz'
  },
  {
    id: 'dhlkz',
    name: 'DHL',
    country: 'kz',
    calcUrl: {method: 'POST', uri: 'https://mydhl.express.dhl/api/rates/products/wcc',},
    citiesUrl: {method: 'GET', uri: 'https://mydhl.express.dhl/api/addressbook/search?city='}
  },
  {
    id: 'dimexkz',
    name: 'Dimex',
    country: 'kz',
    calcUrl: {method: 'GET', uri: 'http://kzh.tech-dimex.ru/calculator/calcestnew?'},
    citiesUrl: {method: 'GET', uri: 'http://kzh.tech-dimex.ru/calculator/autocompletecity?'},
    countriesUrl: {method: 'POST', uri: 'http://kzh.tech-dimex.ru/calculator/getajaxForm'}
  },

  /*{
    id: 'spsr',
    calcUrl: {method: 'POST', uri: 'http://www.spsr.ru/ru/system/ajax'},
    citiesUrl: {method: 'GET', uri: 'http://www.spsr.ru/ru/service/calculator?q=/spsr/cc_autocomplete/'},
    newsUrl: {method: 'GET', uri: 'http://www.spsr.ru/ru/news'},
    calcGetUrl: {method: 'GET', uri: 'http://www.spsr.ru/ru/service/calculator'}
  },*!/
  {
    id: 'spsr',
    name: 'Spsr',
    country: 'ru',
    calcUrl: {method: 'GET', uri: 'http://www.spsr.ru/webapi/calculator?'},
    citiesUrl: {method: 'GET', uri: 'http://www.spsr.ru/webapi/autocomplete_city?city='},
    newsUrl: {method: 'GET', uri: 'http://www.spsr.ru/ru/news/collection/novosti-i-press-relizy'}
  },
  ,








  {
    id: 'rateksib',
    name: 'Rateksib',
    country: 'ru',
    calcUrl: {method: 'POST', uri: 'http://rateksib.ru/ajax/calc'},
    citiesUrl: {method: 'POST', uri: 'http://rateksib.ru/ajax/calccity'},
    newsUrl: {method: 'GET', uri: 'http://rateksib.ru/novosti/'}
  },


  {
    id: 'tnt',
    name: 'TNT',
    country: 'ru',
    calcUrl: {method: 'POST', uri: 'https://www.tnt.com/publicapis/v1/quotes'},
    citiesUrl: {method: 'GET', uri: 'https://mytnt.tnt.com/service/address-search-v2/location?limit=30&locale=ru_RU&q='},
    newsUrl: {method: 'GET', uri: 'https://www.tnt.com/express/ru_ru/site/home/the-company/press/press_releases.html'},
    baseUrl: 'https://www.tnt.com'
  },

  {
    id: 'nashapochtaby',
    name: 'Nashapochta',
    country: 'by',
    calcUrl: {method: 'POST', uri: 'https://nashapochta.by/calculator/'},
    citiesUrl: {method: 'GET', uri: 'https://nashapochta.by/ajax/cities.php'},
    baseUrl: 'https://nashapochta.by'
  },



  {
    id: 'vivipostkz',
    name: 'Vivipost',
    country: 'kz',
    apiUrl: {method: 'POST', uri: 'http://vivipost.kz/bitrix/templates/innet_corp2_6/components/dev/empty/calculator2/ajax.php'},
    baseUrl: 'http://vivipost.kz'
  },

  {
    id: 'spdexkz',
    name: 'Spdex',
    country: 'kz',
    citiesUrl: {method: 'GET', uri: 'http://mypost.spdex.kz/api/Cities?filter=%7B%22order%22:%22name%22,%22include%22:%5B%22cityCountry%22,%22citySite%22%5D%7D'},
    calcUrl: {method: 'GET', uri: 'http://mypost.spdex.kz/RateCalc.html'},
    baseUrl: 'http://spdex.kz'
  },

  {
    id: 'postkz',
    name: 'Post.kz',
    country: 'kz',
    citiesUrl: {method: 'GET', uri: 'http://api.blitspost.work/public/v1/regions/origin?title=', json: true},
    calcUrl: {method: 'GET', uri: 'https://post.kz/mail/calc'},
    baseUrl: 'https://post.kz'
  },


  */
];

const targetObj = _.keyBy(targets, 'id');

export const list = () => {
  return targets;
};

export const countries = () => {
  return [
    {id: 'ru', name: 'Россия'},
    {id: 'by', name: 'Беларусь'},
    {id: 'kz', name: 'Казахстан'}
  ]
};

export const getOne = function (id) {
  if (targetObj[id]) {
    for (let key in targetObj[id]) {
      if (targetObj[id][key] instanceof Object) {
        targetObj[id][key].headers = {
          'User-Agent': userAgent
        }
      }
    }
  }
  return { ...targetObj[id] };
};

export const dimexCountryChanger = (country) => {
  if (!country) {
    return country;
  }
  if (country.toLowerCase() === 'южная корея') {
    country = 'Корея (Южная)';
  }
  if (country.toLowerCase() === 'белоруссия') {
    country = 'Беларусь';
  }
  if (country.toLowerCase() === 'молдавия') {
    country = 'Молдова';
  }
  if (country.toLowerCase() === 'ирландия') {
    country = 'Ирландия, республика';
  }
  if (country.toLowerCase() === 'англия') {
    country = 'Великобритания';
  }
  return country;
};

export const pochtaCountryChanger = (country) => {
  if (!country) {
    return country;
  }
  if (country.toLowerCase() === 'англия') {
    country = 'Великобритания';
  }
  return country;
};

export const majorExpressCountryChanger = (country) => {
  if (!country) {
    return country;
  }
  if (country.toLowerCase() === 'англия') {
    country = 'Великобритания';
  }
  return country;
};

export const dpdCountryChanger = (country) => {
  if (!country) {
    return country;
  }
  if (country.toLowerCase() === 'южная корея') {
    country = 'Корея Респ.';
  }
  if (country.toLowerCase() === 'молдавия') {
    country = 'Молдова Респ.';
  }
  if (country.toLowerCase() === 'англия') {
    country = 'Великобритания';
  }
  return country;
};

export const ponyCountryChanger = (country) => {
  if (!country) {
    return country;
  }
  if (country.toLowerCase() === 'белоруссия') {
    country = 'беларусь';
  }
  return country;
};

export const DIMEXCOUNTRIES = ['Абхазия', 'Азербайджан', 'Армения', 'Афганистан', 'Беларусь', 'Грузия', 'Казахстан', 'Кыргызстан', 'Латвия', 'Молдова', 'Эстония'];
export const PONYCOUNTRIES = ['азербайджан', 'армения', 'беларусь', 'казахстан', 'кыргызстан', 'молдавия', 'молдова', 'таджикистан', 'туркменистан', 'турция', 'узбекистан', 'украина', 'латвия', 'литва', 'эстония', 'грузия', 'россия'];