import { getOne, dimexCountryChanger, DIMEXCOUNTRIES } from '../../helpers/delivery';
import {
  shouldAbort,
  findInArray,
  randomTimeout
} from '../../helpers/common';
import {
  CITIESREQUIRED,
  CITYORCOUNTRYFROMREQUIRED,
  COUNTRYFROMNOTFOUND,
  CITYFROMORTORU,
  CITYFROMNOTFOUND,
  CITYTONOTFOUND,
  CITYFROMREQUIRED,
  DELIVERYTIMEREG,
  COUNTRYFROMRUSSIA,
  CITYORCOUNTRYTOREQUIRED,
  CITYORCOUNTRYTONOTFOUND,
  UNABLETOGETTARIFF,
  COUNTRYTONOTFOUND,
  POSTCODEFROMNOTFOUND,
  POSTCODETONOTFOUND,
  COSTREG,
  getCity,
  allResultsError,
  getResponseError,
  getResponseErrorArray,
  getCountriesError,
  getCountryNoResultError,
  createTariff,
  getJSONChangedMessage,
  getRegionName,
  getNoResultError,
  getCityJsonError,
  getCityNoResultError,
  getDistrictName,
  getTariffErrorMessage,
  getContentChangedMessage,
  SNG, CITYTOREQUIRED
} from '../../helpers/tariff';
import {
  getBrowser,
  newPage,
  closeBrowser,
  closePage,
  refreshPage,
  waitForWrapper,
  waitForResponse,
  printPDF,
  requestWrapper
} from '../../helpers/browser';
const async = require('promise-async');
const cheerio = require('cheerio');
const logger = require('../../helpers/logger');
const _  = require('lodash');
const cfg = require('../../../conf');
const moment = require('moment');

const selectors = {
  countryFromOptions: '#origCountryId option',
  countryToOptions: '#destCountryId option',
  tariffResultsWrapper: '.secBody',
  tariffResults: '.dataTable tbody tr',
  tariffNoResults: '.contentsmall .error',
};

const getReq = (item) => {
  return {
    timeOnlyRts:true,
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
    timeOnlyCountries: 'AS,AD,AI,AG,AM,AW,BB,BY,BZ,BJ,BT,BW,VG,BN,BF,KH,CV,CF,TD,CG,CK,DM,GQ,ER,FO,FJ,GF,PF,GA,GM,GE,GL,GD,GP,GU,GN,GW,GY,HT,IS,JM,KI,LA,LB,LS,LR,LI,MK,MG,MV,ML,MH,MQ,MR,FM,MC,MN,MS,MP,ME,NA,NP,AN,NC,NE,NF,PW,PG,RE,SM,SN,SC,SL,SB,KN,LC,VC,SR,SZ,SY,TJ,TG,TO,TT,TC,TV,UZ,VU,WF,WS,YE',
    simpleRateXS: 'Очень небольшой',
    simpleRateS: 'Небольшой',
    simpleRateM: 'Средний',
    simpleRateL: 'Большой',
    simpleRateXL: 'Очень Большой',
    isOrigDestDutiable:true,
    nrfErrorFreightForward: '',
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
    containerSelected: '02',
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
    shipDate: moment().format('YYYY-MM-DD'),
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
    origPostalCode: item.postcodeFrom,
    origPostal: item.postcodeFrom,
    origLocale: 'ru_RU',
    origRIFClient: 'CTC',
    shipmentType: 'smallPkg',
    destCountry: item.countryToEngShort,
    destCity: '',
    destPostalCode: item.postcodeTo,
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
    pickerDate:  moment().format('DD.MM.YYYY'),
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
    ctc_second_submit:10,
    shipmentDocsPallet: '02'
  }
};

const getCities = async ({ cities, delivery, req, countriesFrom, countriesTo }) => {
  const countryFromObj = _.keyBy(countriesFrom, 'name');
  const countryToObj = _.keyBy(countriesTo, 'name');
  return await async.mapSeries(cities, async (item, callback) => {
    try {
      const city = {
        ...item,
        initialCityFrom: item.from,
        initialCityTo: item.to,
        initialCountryFrom: item.countryFrom,
        initialCountryTo: item.countryTo,
      };
      if (!city.from) {
        city.error = CITYFROMREQUIRED;
        return callback(null, city);
      }
      if (!city.to) {
        city.error = CITYTOREQUIRED;
        return callback(null, city);
      }
      if (!city.postcodeFrom) {
        city.error = POSTCODEFROMNOTFOUND;
        return callback(null, city);
      }
      if (!city.postcodeTo) {
        city.error = POSTCODETONOTFOUND;
        return callback(null, city);
      }
      if (!city.countryFrom) {
        city.countryFrom = "россия";
      }
      if (!city.countryTo) {
        city.countryTo = "россия";
      }
      if (!countryFromObj[city.countryFrom.toLowerCase()]) {
        city.error = COUNTRYFROMNOTFOUND;
        return callback(null, city);
      }
      if (!countryToObj[city.countryTo.toLowerCase()]) {
        city.error = COUNTRYTONOTFOUND;
        return callback(null, city);
      }
      callback(null, city);
    } catch(e) {
      callback(e);
    }
  });
};

const getRequests = ({ deliveryKey, cities, weights }) => {
  let requests = [];
  let errors = [];
  const tempRequests = [];
  cities.forEach((item) => {
    if (item.error) {
      errors = errors.concat(getResponseErrorArray({ deliveryKey, weights, city: item, error: item.error }));
    } else {
      tempRequests.push({
        city: {
          ...item
        },
        req: getReq(item),
        delivery: deliveryKey,
      });
    }
  });
  tempRequests.forEach((item) => {
    weights.forEach((weight) => {
      requests.push({
        ...item,
        city: {...item.city},
        weight,
        req: {...item.req, weight1: weight},
        tariffs: []
      });
    });
  });
  return {requests, errors};
};

const getCalcResults = async ({ request, delivery, req }) => {
  let body;
  try {
    const opts = {...delivery.calcUrl};
    const formData = new URLSearchParams();
    for (let key of Object.keys(request.req)) {
      formData.append(key, request.req[key]);
    }
    opts.headers['Content-Type'] = 'application/x-www-form-urlencoded; charset=UTF-8';
    opts.body = 'timeOnlyRts=true&ctcModPkgType=null&ivrPkgType=null&ctcModAccountFlag=show&ctcModLoginStatus=null&ctcModuleWeight=null&ctcModuleWeightType=null&importFlag=&assume=&rtsFlag=&destCtyCurrency=&destCtyDimUnit=&destCtyUom=&destCtyUomKey=&afcity=null&afpostal=null&afcountry=null&prefCity=null&prefPostal=null&prefcountry=null&addressCountry=null&userId=&A_Resi=null&isResidential=null&addressDiffFromBook=NO&addressBookCompanyOrName=&addresseName=&addressLine1=&addressLine2=&addressLine3=&addressCity=null&addressZip=null&resComDet=null&addressBookState=null&requestor=&taxIndicator=null&DeSurInd=null&AccNum=null&returnURL=null&page=shipping%2Fwwdt%2Ftim(1ent).html&loc=ru_RU&lanCancelURL=&packageLetter=null&selectedAccountNumber=&selectedAccountClassification=null&isSelectedAccountABREnabled=&isSelectedAccountGBPalletEnabled=null&accImsFlag=false&accType=null&accSelectedCountry=null&jsDisabled=null&isAccountSelected=null&modDestResidetail=null&destRes=null&modWeightUnit=null&modDimUnit=null&modContainer=null&modWeight=null&modLength=null&modWidth=null&modHeight=null&modDeclValue=null&modDropOfChoice=null&modPickUpMethod=null&modDailyPickUp=null&modValueAdded=null&modPickUpMethod1=null&modPickupAdded=null&modRequestor=null&modCustomValue=null&modSameValue=null&isModifyClicked=null&modOrigCity=null&modOrigZip=null&modOrigCountry=null&modDestCity=null&modDestZip=null&modDestCountry=null&selectpackaging=null&mypacking=%D0%A1%D0%BE%D0%B1%D1%81%D1%82%D0%B2%D0%B5%D0%BD%D0%BD%D0%B0%D1%8F+%D1%83%D0%BF%D0%B0%D0%BA%D0%BE%D0%B2%D0%BA%D0%B0&upsletter=%D0%9A%D0%BE%D0%BD%D0%B2%D0%B5%D1%80%D1%82+UPS+Express+Envelope&expressbox=%D0%9A%D0%BE%D1%80%D0%BE%D0%B1%D0%BA%D0%B0+UPS+Express+Box&smallbox=%D0%9A%D0%BE%D1%80%D0%BE%D0%B1%D0%BA%D0%B0+UPS+Express+Box+-+Small&mediumbox=%D0%9A%D0%BE%D1%80%D0%BE%D0%B1%D0%BA%D0%B0+UPS+Express+Box+-+Medium&largebox=%D0%9A%D0%BE%D1%80%D0%BE%D0%B1%D0%BA%D0%B0+UPS+Express+Box+-+Large&tube=%D0%A2%D1%83%D0%B1%D1%83%D1%81+UPS+Express+Tube&pack=%D0%9F%D0%B0%D0%BA%D0%B5%D1%82+UPS+Express+Pak&tenkg=UPS+Worldwide+Express+10KG+Box&twentyfivekg=UPS+Worldwide+Express+25KG+Box&palletPkgType=%D0%9F%D0%B0%D0%BB%D0%BB%D0%B5%D1%82&timeOnlyCountries=AS%2CAD%2CAI%2CAG%2CAM%2CAW%2CBB%2CBY%2CBZ%2CBJ%2CBT%2CBW%2CVG%2CBN%2CBF%2CKH%2CCV%2CCF%2CTD%2CCG%2CCK%2CDM%2CGQ%2CER%2CFO%2CFJ%2CGF%2CPF%2CGA%2CGM%2CGE%2CGL%2CGD%2CGP%2CGU%2CGN%2CGW%2CGY%2CHT%2CIS%2CJM%2CKI%2CLA%2CLB%2CLS%2CLR%2CLI%2CMK%2CMG%2CMV%2CML%2CMH%2CMQ%2CMR%2CFM%2CMC%2CMN%2CMS%2CMP%2CME%2CNA%2CNP%2CAN%2CNC%2CNE%2CNF%2CPW%2CPG%2CRE%2CSM%2CSN%2CSC%2CSL%2CSB%2CKN%2CLC%2CVC%2CSR%2CSZ%2CSY%2CTJ%2CTG%2CTO%2CTT%2CTC%2CTV%2CUZ%2CVU%2CWF%2CWS%2CYE&simpleRateXS=%D0%9E%D1%87%D0%B5%D0%BD%D1%8C+%D0%BD%D0%B5%D0%B1%D0%BE%D0%BB%D1%8C%D1%88%D0%BE%D0%B9&simpleRateS=%D0%9D%D0%B5%D0%B1%D0%BE%D0%BB%D1%8C%D1%88%D0%BE%D0%B9&simpleRateM=%D0%A1%D1%80%D0%B5%D0%B4%D0%BD%D0%B8%D0%B9&simpleRateL=%D0%91%D0%BE%D0%BB%D1%8C%D1%88%D0%BE%D0%B9&simpleRateXL=%D0%9E%D1%87%D0%B5%D0%BD%D1%8C+%D0%91%D0%BE%D0%BB%D1%8C%D1%88%D0%BE%D0%B9&isOrigDestDutiable=true&nrfErrorFreightForward=&promoDiscountEligible=&billableWeightIndicator=&customerClassificationCode=&abrEligible=&useAcc=null&modAccNumIn=null&ctcModuleLogin=null&quoteTypeQcc=estimateTimeCost.x&origtype=&datevalue=&noofpackages=1&quoteselected=estimateTimeCost.x&nextclicked=next&fromaddORcountry=&itsQuickquote=no&onChangeAccValue=&quickQuoteTypePackageLetter=&transitTimeSelected=&shipmentTypeFreight=smallORPallet&origCurrency=RUB&usPR=&dismissLink=&metricUnit=CM&containerSelected=02&fromCountryChange=false&toCountryChange=false&ratingQuoteTypeTime=null&ratingQuoteTypeDetail=null&ratingQuoteTypePackage=null&ratingQuoteTypeLetter=null&ratingHowWillRetail=null&ratingHowWillDriver=null&ratingHowWillDotCom=null&ratingHowWillOneEight=null&ratingDailyPick=null&ratingPackType=null&ratingDestTypeRes=null&ratingOrigTypeRes=&ratingDestTypeComm=null&preferenceaddresskey=000&palletselected=0&refreshmod1=&shipDate=2020-09-18&accountPrefpickup=null&accountPrefgiveDriver=null&palletEligable=null&imsStatus=null&ipaParameter=&DAF=&HFP=&ddoPref=false&pickupSupportIndicator=false&countriesToCheckDropOffLocations=false&countriesSupportingPickupsDomestic=US%2CPR&shipmenttype=smallPkg&quoteType=estimateTimeCost.x&pageRenderName=summaryResults&quoteType=quickTimeCost&quoteType=quickTimeCost&quoteType=estimateTimeCost.x&quoteType=transitTimeOnly&origCountry=RU&origCity=&origPostalCode=109012&origStates=&casuiStreetSearch=&casuiCitySearch=&casuiStateSearch=emptyState&casuiPostalCodeSearch=&casuiPrefix=&casuiId=&shipmentType=smallPkg&destCountry=AU&destCity=&destPostalCode=2000&destStates=&casuiStreetSearch=&casuiCitySearch=&casuiStateSearch=emptyState&casuiPostalCodeSearch=&casuiPrefix=&casuiId=&uapDetails_locationId=&uapDetails_CompanyName=&uapDetails_AddressLine1=&uapDetails_AddressLine2=&uapDetails_City=&uapDetails_State=&uapDetails_Zip=&uapDetails_Phone=&uapDetails_Country=&pickerDate=18.09.2020&shipmentDocsPallet=02&currencyScalar=&currencyUnits=RUB&weight=1&weightType=KGS&packagesMod1=1&pickupPrefSel=0&deliveryPrefSel=0&destPostal=2000&destCity=&origPostal=109012&origCity=&page=shipping%2Fwwdt%2Ftnc(2err).html&recalculateAccessorials=&simpleRateSel=&panel2dropdownSR=&panel2dropdown=&btnSimpleRate=on&shipDimUnitSR=IN&packageLength=&packageWidth=&packageHeight=&container=02&length1=&width1=&height1=&diUnit=CM&weight1=2&shipWeightUnit=KGS&packages=1&sameValues=YES&currency1=&declaredValCurrencyUnit=RUB&page=accessorialModule&origCurrency=&modValueAdded=null&currency=null&destinationCountryRequiresCODAmount=false&defaultCODCurrencyForDestination=AUD&inches=%D0%B4%D1%8E%D0%B9%D0%BC%D1%8B&signRequiredALL=DSS&noneSelCheck=export&import_label=LDE&return_label=ERL&pickupMethod1=1&WWEFMT=&WWEFIT=&session_panel1_input_data=CTCPanel1InputDetailsBean__02&session_panel1_input_data=CTCPanel1InputDetailsBean__02&ctc_second_submit=10';
    const res = await requestWrapper({ format: 'text', req, ...opts });
    body = res.body;
  } catch(e) {
    request.error = getTariffErrorMessage('Изменилось API сайта');
  }
  if (!body) {
    return request;
  }
  try {
    const $ = cheerio.load(body);
    const results = $(selectors.tariffResultsWrapper);
    const trs = $(results[0]).find(selectors.tariffResults);
    trs.each(function (index, tr) {
      if ($(tr).attr('id')) {
        const tds = $(tr).find('td');
        if (tds.length === 3) {
          let service = $($(tr).find('p')[0]).find('a').text().replace(/[\r\n\t]/g, "");
          if (!service) {
            service = $($(tr).find('p')[0]).text().replace(/[\r\n\t]/g, "");
          }
          let time = "";
          let timeTemp = null;
          try {
            timeTemp = $($(tds[1]).find('.ups-group p')[2]).text().trim().replace(/&nbsp;/gi, ' ').replace(new RegExp(String.fromCharCode(160), "gi"), " ").trim();
          } catch (e) {
          }
          if (timeTemp) {
            const momentDate = moment(timeTemp, 'DD MMM YYYY г.', 'ru');
            if (momentDate.isValid()) {
              time = momentDate.diff(moment(), 'days') + 1;
            }
          }
          const cost = $($(tds[2]).find('p')[0]).find('strong').text().trim();
          request.tariffs.push(createTariff(service, cost, time));
        }
      }
    });
    if ($(selectors.tariffNoResults).length) {
      throw new Error($(selectors.tariffNoResults).text().trim());
    }
  } catch(e) {
    request.error = getTariffErrorMessage('Изменилось API сайта');
  }
  if (!request.tariffs.length && !request.error) {
    request.error = getNoResultError();
  }
  console.log(request.tariffs)
  request.req = {};
  return request;
};

const getCountries = async ({ delivery, req }) => {
  const result = {
    countriesFrom: [],
    countriesTo: []
  };
  const requests = [
    {key: 'countriesFrom', req: {prefix: "orig"}},
    {key: 'countriesTo', req: {prefix: "dest"}}
  ];
  for (let item of requests) {
    try {
      const opts = { ...delivery.countriesUrl };
      const body = {
        OrigOrDest: "orig",
        address: "",
        addressBook: "",
        appId: "CTC",
        city: "",
        contactName: "",
        country: "",
        countryDialCode: "",
        email: "",
        locale: "ru_RU",
        name: "",
        phone: "",
        prefix: "orig",
        state: "",
        token: "REPLACE",
        userId: "",
        zipCode: "",
      };
      opts.body = JSON.stringify({ ...body, ...item.req });
      opts.headers['Content-Type'] = 'application/json';
      const res = await requestWrapper({ req, ...opts });
      const json = JSON.parse(res.body.countries);
      result[item.key] = json.map(v => ({ id: v.key, name: v.value.toLowerCase() }));
    } catch (e) {}
  }
  if (!result.countriesFrom.length || !result.countriesTo.length) {
    throw new Error(getCountriesError("Изменилось API сайта"));
  }
  return result;
};

module.exports = async function ({ deliveryKey, weights, cities, req}) {
  const delivery = getOne(deliveryKey);
  let results = [];

  try {
    const countriesObj = await getCountries({ delivery, req });
    if (shouldAbort(req)) {
      throw new Error('abort');
    }
    const citiesResults = await getCities({ cities, delivery, req, ...countriesObj });
    if (shouldAbort(req)) {
      throw new Error('abort');
    }
    const {requests, errors} = getRequests({ deliveryKey, cities: citiesResults, weights });
    results = results.concat(errors);
    for (let request of requests) {
      if (shouldAbort(req)) {
        break;
      }
      results.push(await getCalcResults({ request, delivery, req }));
    }
  } catch(error) {
    results = allResultsError({ deliveryKey, weights, cities, error });
  }

  return results;

};