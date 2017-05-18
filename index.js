var express = require('express');
var app = express();
var cors = require('cors');
var bodyParser = require('body-parser');
var methodOverride = require('method-override');
var helmet = require('helmet');
var timeout = require('connect-timeout'); //express v4
var config = require('./conf');
var session = require('express-session');
var mongoStore = require('connect-mongo')(session);
var mongoose = require('mongoose');
var cookieParser = require('cookie-parser');
var logger = require('./api/helpers/logger');
var server;

// Connect to database
//mongoose.connect(config.mongo.uri, {});

//app.use(helmet());
//app.use(cookieParser('foo'));

app.set('trust proxy', 1);

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(methodOverride());

app.set('port', (process.env.PORT || 5000));
app.use('/', express.static(__dirname + '/dist'));
//app.use('/tariffs', express.static(__dirname + '/dist'));
//app.use('/news', express.static(__dirname + '/dist'));


var exitHandler = function (options, err) {
  if (err) {
    console.error(err.stack);
    logger.error(err);
  }
  if (options.exit) {
    setTimeout(function () {
      if (server && server.close) {
        server.close(function () {
          process.exit();
        });
      } else {
        process.exit();
      }
    }, 1000);
  }
};

process.on('uncaughtException', exitHandler.bind(null, {exit: false}));
process.on('SIGTERM', exitHandler.bind(null, {exit: true}));
//do something when app is closing
process.on('exit', exitHandler.bind(null, {exit: true}));
//catches ctrl+c event
process.on('SIGINT', exitHandler.bind(null, {exit: true}));

// Persist sessions with mongoStore
app.use(['/api*'], session({
  secret: 'cdek-secret',
  cookie: {path: '/', httpOnly: true, secure: false, maxAge: null },
  resave: true,
  saveUninitialized: true,
  /*store: new mongoStore({
    mongooseConnection: mongoose.connection,
    stringify:false
  })*/
}));

app.use('/api*', function (req, res, next) {
  if (!req.session.delivery) {
    var targets = require('./api/helpers/delivery').list();
    var obj = {};
    targets.forEach(function (item) {
      obj[item.id] = {complete: false, results: []};
    });
    req.session.delivery = obj;
  }
  next();
});

app.options('/api/*', cors());
app.post('/api/tariff/request', cors(), require('./api/tariff'));
app.get('/api/tariff/ping', cors(), require('./api/tariff/ping'));
app.post('/api/tariff/cities', cors(), require('./api/tariff/city'));
app.post('/api/tariff/news', cors(), require('./api/news'));

//require('./api/tariff')(
//  {session: {delivery: {}}, body: {
//    deliveries: ['ponyexpress'],
//    cities: [
      //{from: 'Москва', to: 'Москва'},
      //{from: 'Москва', to: 'Сидней', countryTo: 'Австралия'},
      //{from: 'Новосибирск', to: 'Москва', postcodeFrom: '630000', countryFromEngShort: 'RU', countryToEngShort: 'RU', postcodeTo: '119002', fromGooglePlaceId: 'ChIJl03MkOHl30IRhenT4XMGOps', toGooglePlaceId: 'ChIJybDUc_xKtUYRTM9XV8zWRD0', fromEngName: "Novosibirsk", fromEngFullName: "Novosibirsk, Novosibirsk Oblast, Russia", toEngName: "Moscow", toEngFullName: "Moscow, Russia"},
      //{from: 'Новосибирск', to: 'Москва', postcodeFrom: '119002', countryFromEngShort: 'RU', countryToEngShort: 'RU', postcodeTo: '630000', fromGooglePlaceId: 'ChIJl03MkOHl30IRhenT4XMGOps', toGooglePlaceId: 'ChIJybDUc_xKtUYRTM9XV8zWRD0', fromEngName: "Novosibirsk", fromEngFullName: "Novosibirsk, Novosibirsk Oblast, Russia", toEngName: "Moscow", toEngFullName: "Moscow, Russia"},
      //{from: 'Пушкино, Московская обл.', to: 'Новосибирск'},
      //{from: 'Москва', to: 'Новосибирск'},
      //{from: 'Челябинск', to: 'Владивосток'},
      //{from: 'Москва', to: 'Бангкок'},
      //{from: 'Москва', to: 'Абай', countryTo: 'Казахстан'},
      //{from: 'Москва', to: '', countryTo: 'Азербайджан'}
//    ],
//    weights: [1]
//  }},
//  {json: function () {}}
//);

//require('./api/news')(
//  {session: {delivery: {}}, body: {delivery: 'baikalsr', date: require('moment')().add(-3, 'month')}},
//  {json: function () {}}
//);

server = app.listen(app.get('port'), function() {
  console.log('Node app is running on port', app.get('port'));
});
