var responseHelper = require('../../helpers/response');
var deliveryHelper = require('../../helpers/delivery');
var commonHelper = require('../../helpers/common');
var async = require('async');
var request = commonHelper.request;
var cheerio = require('cheerio');
var config = require('../../../conf');
var _ = require('underscore');
var moment = require('moment');
var logger = require('../../helpers/logger');
var delivery = 'ups';

var getReq = function (item) {
  item = item || {};
  return {
    timeOnlyRts:false,
    ctcModPkgType:null,
    ivrPkgType:null,
    ctcModAccountFlag: 'show',
    ctcModLoginStatus:null,
    ctcModuleWeight:null,
    ctcModuleWeightType:null,
    importFlag: '',
    assume: '',
    rtsFlag: '',
    destCtyCurrency: '',
    destCtyDimUnit: '',
    destCtyUom: '',
    destCtyUomKey: '',
    afcity:null,
    afpostal:null,
    afcountry:null,
    prefCity:null,
    prefPostal:null,
    prefcountry:null,
    addressCountry:null,
    userId: '',
    A_Resi:null,
    isResidential:null,
    addressDiffFromBook: 'NO',
    addressBookCompanyOrName: '',
    addresseName: '',
    addressLine1: '',
    addressLine2: '',
    addressLine3: '',
    addressCity:null,
    addressZip:null,
    resComDet:null,
    addressBookState:null,
    requestor: '',
    taxIndicator:null,
    DeSurInd:null,
    AccNum:null,
    returnURL:null,
    page: 'shipping/wwdt/tim(1ent).html',
    loc: 'ru_RU',
    lanCancelURL: '',
    packageLetter:null,
    selectedAccountNumber: '',
    selectedAccountClassification:null,
    isSelectedAccountABREnabled: '',
    isSelectedAccountGBPalletEnabled:null,
    accImsFlag:false,
    accType:null,
    accSelectedCountry:null,
    jsDisabled:null,
    isAccountSelected:null,
    modDestResidetail:null,
    destRes:null,
    modWeightUnit:null,
    modDimUnit:null,
    modContainer:null,
    modWeight:null,
    modLength:null,
    modWidth:null,
    modHeight:null,
    modDeclValue:null,
    modDropOfChoice:null,
    modPickUpMethod:null,
    modDailyPickUp:null,
    modValueAdded:null,
    modPickUpMethod1:null,
    modPickupAdded:null,
    modRequestor:null,
    modCustomValue:null,
    modSameValue:null,
    isModifyClicked:null,
    modOrigCity:null,
    modOrigZip:null,
    modOrigCountry:null,
    modDestCity:null,
    modDestZip:null,
    modDestCountry:null,
    selectpackaging:null,
    mypacking: 'Собственная упаковка',
    upsletter: 'Конверт UPS Express Envelope',
    expressbox: 'Коробка UPS Express Box',
    smallbox: 'Коробка UPS Express Box - Small',
    mediumbox: 'Коробка UPS Express Box - Medium',
    largebox: 'Коробка UPS Express Box - Large',
    tube: 'Тубус UPS Express Tube',
    pack: 'Пакет UPS Express Pak',
    tenkg: 'UPS Worldwide Express 10KG Box',
    twentyfivekg: 'UPS Worldwide Express 25KG Box',
    palletPkgType: 'Паллет',
    timeOnlyCountries: 'AS,AD,AI,AG,AM,AW,BB,BY,BZ,BJ,BT,BW,VG,BN,BF,KH,CV,CF,TD,CG,CK,DM,GQ,ER,FO,FJ,GF,PF,GA,GM,GE,GL,GD,GP,GU,GN,GW,GY,HT,IS,JM,KI,LA,LB,LS,LR,LI,MK,MG,MV,ML,MH,MQ,MR,FM,MC,MN,MS,MP,ME,NA,NP,AN,NC,NE,NF,PW,PG,RE,SM,SN,SC,SL,SB,KN,LC,VC,SR,SZ,SY,TJ,TG,TO,TT,TC,TV,UA,UZ,VU,WF,WS,YE',
    isOrigDestDutiable:false,
    promoDiscountEligible: '',
    billableWeightIndicator:'',
    customerClassificationCode:'',
    abrEligible: '',
    useAcc:null,
    modAccNumIn:null,
    ctcModuleLogin:null,
    quoteTypeQcc: 'estimateTimeCost.x',
    origtype: '',
    datevalue: '',
    noofpackages: 1,
    quoteselected: 'estimateTimeCost.x',
    nextclicked: 'next',
    fromaddORcountry: '',
    itsQuickquote: 'no',
    onChangeAccValue: '',
    quickQuoteTypePackageLetter: '',
    transitTimeSelected: '',
    shipmentTypeFreight: 'smallORPallet',
    origCurrency: 'RUB',
    usPR: '',
    dismissLink: '',
    metricUnit:'CM',
    containerSelected: '',
    fromCountryChange:false,
    toCountryChange:false,
    ratingQuoteTypeTime:null,
    ratingQuoteTypeDetail:null,
    ratingQuoteTypePackage:null,
    ratingQuoteTypeLetter:null,
    ratingHowWillRetail:null,
    ratingHowWillDriver:null,
    ratingHowWillDotCom:null,
    ratingHowWillOneEight:null,
    ratingDailyPick:null,
    ratingPackType:null,
    ratingDestTypeRes:null,
    ratingOrigTypeRes: '',
    ratingDestTypeComm:null,
    preferenceaddresskey:'000',
    palletselected:0,
    refreshmod1: '',
    js_on:true,
    shipDate: moment().add(7, 'days').format('YYYY-MM-DD'),
    accountPrefpickup:null,
    accountPrefgiveDriver:null,
    palletEligable:null,
    imsStatus:null,
    ipaParameter: '',
    DAF: '',
    HFP: '',
    ddoPref:false,
    pickupSupportIndicator:false,
    countriesToCheckDropOffLocations:false,
    countriesSupportingPickupsDomestic: 'US,PR',
    shipmenttype: 'smallPkg',
    inTranslation: 'дюймы',
    cmTranslation: 'см',
    lbsTranslation: 'фунт',
    kgsTranslation: 'кг',
    weightTranslation: 'вес',
    widthTranslation: 'Ширина',
    heightTranslation: 'Высота',
    pageRenderName: 'summaryResults',
    quoteType: 'estimateTimeCost.x',
    origCountry: item.countryFromEngShort,
    origCity: '',
    origPostal: item.postcodeFrom,
    origLocale: 'ru_RU',
    origRIFClient: 'CTC',
    shipmentType: 'smallPkg',
    destCountry: item.countryToEngShort,
    destCity: '',
    destPostal: item.postcodeTo,
    destLocale: 'ru_RU',
    destRIFClient: 'CTC',
    txt_locationId: '',
    uapDetails_locationId: '',
    uapDetails_CompanyName: '',
    uapDetails_AddressLine1: '',
    uapDetails_AddressLine2: '',
    uapDetails_City: '',
    uapDetails_State: '',
    uapDetails_Zip: '',
    uapDetails_Phone: '',
    uapDetails_Country: '',
    pickerDate:  moment().add(7, 'days').format('DD.MM.YYYY'),
    currencyScalar: '1',
    currencyUnits: 'RUB',
    weight:1,
    weightType: 'KGS',
    packagesMod1:1,
    pickupPrefSel:0,
    deliveryPrefSel:0,
    recalculateAccessorials: '',
    container: '02',
    length1: '',
    width1: '',
    height1: '',
    diUnit: 'CM',
    weight1:1,
    shipWeightUnit: 'KGS',
    packages:1,
    sameValues: 'YES',
    currency1:1,
    declaredValCurrencyUnit: 'RUB',
    //page:'accessorialModule',
    currency:null,
    destinationCountryRequiresCODAmount:true,
    defaultCODCurrencyForDestination: 'RUB',
    codAmount: '',
    signRequiredALL: 'DSS',
    return_label: 'ERL',
    return_label_coc: 'ERL',
    pickupMethod1:1,
    WWEFMT: '',
    WWEFIT: '',
    ctc_second_submit:10
  };
};

module.exports = function (req, cities) {
  var deliveryData = deliveryHelper.get(delivery);
  var requests = [];
  var timestamp = global[delivery];
  async.auto({
    getCountries: function (callback) {
      var opts = Object.assign({}, deliveryData.countriesUrl);
      async.retry(config.retryOpts, function (callback) {
        request(opts, callback)
      }, function (err, r, b) {
        var result = {
          countriesFrom: [],
          countriesTo: [],
          cookie: ''
        };
        if (err) {
          return callback(null, result);
        }
        var $ = cheerio.load(b);
        var fromOpts = $('#origCountryValue').find('option');
        var toOpts = $('#destCountryValue').find('option');
        fromOpts.each(function (index, item) {
          if ($(item).attr('value')) {
            result.countriesFrom.push({
              id: $(item).attr('value'),
              name: $(item).text().trim().toLowerCase()
            });
          }
        });
        toOpts.each(function (index, item) {
          if ($(item).attr('value')) {
            result.countriesTo.push({
              id: $(item).attr('value'),
              name: $(item).text().trim().toLowerCase()
            });
          }
        });
        callback(null, result);
      });
    },
    getCities: ['getCountries', function (results, callback) {
      var countryFromObj = _.indexBy(results.getCountries.countriesFrom, 'name');
      var countryToObj = _.indexBy(results.getCountries.countriesTo, 'name');
      async.mapSeries(cities, function (city, callback) {
        if (!city.from || !city.to) {
          city.error = commonHelper.CITIESREQUIRED;
          return async.nextTick(function () {
            callback(null, city);
          });
        }
        if (!city.postcodeFrom) {
          city.error = commonHelper.POSTCODEFROMNOTFOUND;
          return async.nextTick(function () {
            callback(null, city);
          });
        }
        if (!city.postcodeTo) {
          city.error = commonHelper.POSTCODETONOTFOUND;
          return async.nextTick(function () {
            callback(null, city);
          });
        }
        if (!city.countryFrom) {
          city.countryFrom = "россия";
        }
        if (!city.countryTo) {
          city.countryTo = "россия";
        }
        if (typeof countryFromObj[city.countryFrom.toLowerCase()] === 'undefined') {
          city.error = commonHelper.COUNTRYFROMNOTFOUND;
          return async.nextTick(function () {
            callback(null, city);
          });
        }
        if (typeof countryToObj[city.countryTo.toLowerCase()] === 'undefined') {
          city.error = commonHelper.COUNTRYNOTFOUND;
          return async.nextTick(function () {
            callback(null, city);
          });
        }
        callback(null, city);
      }, callback);
    }],
    parseCities: ['getCities', function (results, callback) {
      logger.tariffsInfoLog(delivery, results.getCities, 'getCities');
      var tempRequests = [];
      results.getCities.forEach(function (item) {
        if (item.error) {
          requests = requests.concat(commonHelper.getResponseArray(req.body.weights, item, delivery, item.error));
        } else {
          tempRequests.push({
            city: {
              initialCityFrom: item.from,
              initialCityTo: item.to,
              from: item.from,
              to: item.to,
              countryFrom: item.countryFrom,
              countryTo: item.countryTo
            },
            req: getReq(item),
            delivery: delivery,
            tariffs: []
          });
        }
      });
      tempRequests.forEach(function (item) {
        req.body.weights.forEach(function (weight) {
          var obj = Object.assign({}, item);
          obj.weight = weight;
          obj.req.weight = weight;
          obj.req.weight1 = weight;
          requests.push(obj);
        });
      });
      callback(null);
    }],
    requests: ['parseCities', function (results, callback) {
      async.mapLimit(requests, 2, function (item, callback) {
        if (global[delivery] > timestamp) {
          return callback({abort: true});
        }
        if (item.error) {
          return async.nextTick(function () {
            callback(null, item);
          });
        }
        var opts = _.extend({}, deliveryData.calcUrl);
        opts.form = item.req;
        opts.headers['X-Requested-With'] = 'XMLHttpRequest';
        setTimeout(function () {
          async.retry(config.retryOpts, function (callback) {
            request(opts, callback)
          }, function (err, r, b) {
            if (err) {
              item.error = commonHelper.getResponseError(err);
              return callback(null, item);
            }
            var $ = cheerio.load(b);
            var trs = $('.dataTable.noTableHeader').find('tbody').find('tr');
            $('.secBody').each(function (index, tr) {
              if (index !== 0) {
                var service = $($(tr).find('p')[0]).find('a').text().replace(/[\r\n\t]/g, "");
                if (!service) {
                  service = $($(tr).find('p')[0]).text().replace(/[\r\n\t]/g, "");
                }
                if (service) {
                  var time = "";
                  var timeTemp = null;
                  try {
                    var timeTemp = $($('.outHozFlex').find('dt')[1]).text().replace(new RegExp(String.fromCharCode(160), "gi"), " ").replace(/\r\n\t/g, "").split("\t\t\t\t\t\t\t\t")[2].replace(/\t/g, "").trim();
                  } catch (e) {

                  }
                  if (timeTemp) {
                    var momentDate = moment(timeTemp, 'DD MMMM YYYY', 'ru');
                    if (momentDate.isValid()) {
                      time = momentDate.diff(moment().add(7, 'days'), 'days') + 1;
                    }
                  }
                  var cost = $(tr).find('.ship_total').text().replace(/[^0-9,.]/g, "").trim();
                  item.tariffs.push(commonHelper.createTariff(service, cost, time));
                }
              }
            });
            if (!item.tariffs.length) {
              item.error = commonHelper.getNoResultError();
            }
            return callback(null, item);
          });
        }, commonHelper.randomInteger(500, 1000));
      }, callback);
    }]
  }, function (err, results) {
    logger.tariffsInfoLog(delivery, results.requests, 'getTariffs');
    commonHelper.saveResults(req, err, {
      delivery: delivery,
      timestamp: timestamp,
      cities: cities,
      items: results.requests || []
    });
  });
};