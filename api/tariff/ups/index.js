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
    "timeOnlyRts": "true",
    "ctcModPkgType": "null",
    "ivrPkgType": "null",
    "ctcModAccountFlag": "show",
    "ctcModLoginStatus": "null",
    "ctcModuleWeight": "null",
    "ctcModuleWeightType": "null",
    "importFlag": "",
    "assume": "",
    "rtsFlag": "",
    "destCtyCurrency": "",
    "destCtyDimUnit": "",
    "destCtyUom": "",
    "destCtyUomKey": "",
    "afcity": "null",
    "afpostal": "null",
    "afcountry": "null",
    "prefCity": "null",
    "prefPostal": "null",
    "prefcountry": "null",
    "addressCountry": "null",
    "userId": "",
    "A_Resi": "null",
    "isResidential": "null",
    "addressDiffFromBook": "NO",
    "addressBookCompanyOrName": "",
    "addresseName": "",
    "addressLine1": "",
    "addressLine2": "",
    "addressLine3": "",
    "addressCity": "null",
    "addressZip": "null",
    "resComDet": "null",
    "addressBookState": "null",
    "requestor": "",
    "taxIndicator": "null",
    "DeSurInd": "null",
    "AccNum": "null",
    "returnURL": "null",
    "page": "accessorialModule",
    "loc": "ru_RU",
    "lanCancelURL": "",
    "packageLetter": "null",
    "selectedAccountNumber": "",
    "selectedAccountClassification": "null",
    "isSelectedAccountABREnabled": "",
    "isSelectedAccountGBPalletEnabled": "null",
    "accImsFlag": "false",
    "accType": "null",
    "accSelectedCountry": "null",
    "jsDisabled": "null",
    "isAccountSelected": "null",
    "modDestResidetail": "null",
    "destRes": "null",
    "modWeightUnit": "null",
    "modDimUnit": "null",
    "modContainer": "null",
    "modWeight": "null",
    "modLength": "null",
    "modWidth": "null",
    "modHeight": "null",
    "modDeclValue": "null",
    "modDropOfChoice": "null",
    "modPickUpMethod": "null",
    "modDailyPickUp": "null",
    "modValueAdded": "null",
    "modPickUpMethod1": "null",
    "modPickupAdded": "null",
    "modRequestor": "null",
    "modCustomValue": "null",
    "modSameValue": "null",
    "isModifyClicked": "null",
    "modOrigCity": "null",
    "modOrigZip": "null",
    "modOrigCountry": "null",
    "modDestCity": "null",
    "modDestZip": "null",
    "modDestCountry": "null",
    "selectpackaging": "null",
    "mypacking": "Собственная упаковка",
    "upsletter": "Конверт UPS Express Envelope",
    "expressbox": "Коробка UPS Express Box",
    "smallbox": "Коробка UPS Express Box - Small",
    "mediumbox": "Коробка UPS Express Box - Medium",
    "largebox": "Коробка UPS Express Box - Large",
    "tube": "Тубус UPS Express Tube",
    "pack": "Пакет UPS Express Pak",
    "tenkg": "UPS Worldwide Express 10KG Box",
    "twentyfivekg": "UPS Worldwide Express 25KG Box",
    "palletPkgType": "Паллет",
    "timeOnlyCountries": "AS,AD,AI,AG,AM,AW,BB,BY,BZ,BJ,BT,BW,VG,BN,BF,KH,CV,CF,TD,CG,CK,DM,GQ,ER,FO,FJ,GF,PF,GA,GM,GE,GL,GD,GP,GU,GN,GW,GY,HT,IS,JM,KI,LA,LB,LS,LR,LI,MK,MG,MV,ML,MH,MQ,MR,FM,MC,MN,MS,MP,ME,NA,NP,AN,NC,NE,NF,PW,PG,RE,SM,SN,SC,SL,SB,KN,LC,VC,SR,SZ,SY,TJ,TG,TO,TT,TC,TV,UZ,VU,WF,WS,YE",
    "simpleRateXS": "Очень небольшой",
    "simpleRateS": "Небольшой",
    "simpleRateM": "Средний",
    "simpleRateL": "Большой",
    "simpleRateXL": "Очень Большой",
    "isOrigDestDutiable": "true",
    "nrfErrorFreightForward": "",
    "promoDiscountEligible": "",
    "billableWeightIndicator": "",
    "customerClassificationCode": "",
    "abrEligible": "",
    "useAcc": "null",
    "modAccNumIn": "null",
    "ctcModuleLogin": "null",
    "quoteTypeQcc": "estimateTimeCost.x",
    "origtype": "",
    "datevalue": "",
    "noofpackages": "1",
    "quoteselected": "estimateTimeCost.x",
    "nextclicked": "next",
    "fromaddORcountry": "",
    "itsQuickquote": "no",
    "onChangeAccValue": "",
    "quickQuoteTypePackageLetter": "",
    "transitTimeSelected": "",
    "shipmentTypeFreight": "smallORPallet",
    "origCurrency": "",
    "usPR": "",
    "dismissLink": "",
    "metricUnit": "CM",
    "containerSelected": "02",
    "fromCountryChange": "false",
    "toCountryChange": "false",
    "ratingQuoteTypeTime": "null",
    "ratingQuoteTypeDetail": "null",
    "ratingQuoteTypePackage": "null",
    "ratingQuoteTypeLetter": "null",
    "ratingHowWillRetail": "null",
    "ratingHowWillDriver": "null",
    "ratingHowWillDotCom": "null",
    "ratingHowWillOneEight": "null",
    "ratingDailyPick": "null",
    "ratingPackType": "null",
    "ratingDestTypeRes": "null",
    "ratingOrigTypeRes": "",
    "ratingDestTypeComm": "null",
    "preferenceaddresskey": "000",
    "palletselected": "0",
    "refreshmod1": "",
    "shipDate": moment().format('YYYY-MM-DD'),
    "accountPrefpickup": "null",
    "accountPrefgiveDriver": "null",
    "palletEligable": "null",
    "imsStatus": "null",
    "ipaParameter": "",
    "DAF": "",
    "HFP": "",
    "ddoPref": "false",
    "pickupSupportIndicator": "false",
    "countriesToCheckDropOffLocations": "false",
    "countriesSupportingPickupsDomestic": "US,PR",
    "shipmenttype": "smallPkg",
    "quoteType": "transitTimeOnly",
    "pageRenderName": "summaryResults",
    "origCountry": item.countryFromEngShort,
    "origCity": "",
    "origPostalCode": item.postcodeFrom,
    "origStates": "",
    "casuiStreetSearch": "",
    "casuiCitySearch": "",
    "casuiStateSearch": "emptyState",
    "casuiPostalCodeSearch": "",
    "casuiPrefix": "",
    "casuiId": "",
    "shipmentType": "smallPkg",
    "destCountry": item.countryToEngShort,
    "destCity": "",
    "destPostalCode": item.postcodeTo,
    "destStates": "",
    "uapDetails_locationId": "",
    "uapDetails_CompanyName": "",
    "uapDetails_AddressLine1": "",
    "uapDetails_AddressLine2": "",
    "uapDetails_City": "",
    "uapDetails_State": "",
    "uapDetails_Zip": "",
    "uapDetails_Phone": "",
    "uapDetails_Country": "",
    "pickerDate": moment().format('DD.MM.YYYY'),
    "shipmentDocsPallet": "02",
    "currencyScalar": "",
    "currencyUnits": "RUB",
    "weight": "1",
    "weightType": "KGS",
    "packagesMod1": "1",
    "pickupPrefSel": "0",
    "deliveryPrefSel": "0",
    "destPostal": item.postcodeTo,
    "origPostal": item.postcodeFrom,
    "recalculateAccessorials": "",
    "simpleRateSel": "",
    "panel2dropdownSR": "",
    "panel2dropdown": "",
    "btnSimpleRate": "on",
    "shipDimUnitSR": "IN",
    "packageLength": "",
    "packageWidth": "",
    "packageHeight": "",
    "container": "02",
    "length1": "",
    "width1": "",
    "height1": "",
    "diUnit": "CM",
    "weight1": "1",
    "shipWeightUnit": "KGS",
    "packages": "1",
    "sameValues": "YES",
    "currency1": "",
    "declaredValCurrencyUnit": "RUB",
    "currency": "null",
    "destinationCountryRequiresCODAmount": "false",
    "defaultCODCurrencyForDestination": "AUD",
    "inches": "дюймы",
    "signRequiredALL": "DSS",
    "noneSelCheck": "export",
    "import_label": "LDE",
    "return_label": "ERL",
    "pickupMethod1": "1",
    "WWEFMT": "",
    "WWEFIT": "",
    "session_panel1_input_data": "CTCPanel1InputDetailsBean__02",
    "ctc_second_submit": "10"
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
        req: {...item.req, weight1: weight, weight},
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
    opts.body = formData;
    const res = await requestWrapper({ format: 'text', req, ...opts });
    body = res.body;
  } catch(e) {
    request.error = getTariffErrorMessage('Изменилось API сайта');
  }
  request.req = {};
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
  } catch(e) {
    request.error = getTariffErrorMessage('Изменилось API сайта');
  }
  if (!request.tariffs.length && !request.error) {
    request.error = getNoResultError();
  }
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