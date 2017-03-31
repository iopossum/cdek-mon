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

process.on('uncaughtException', function (err) {
  setTimeout(function(){
    if (server && server.close) {
      server.close(function () {
        process.exit(1);
      });
    } else {
      process.exit(1);
    }
  }, 1000)
});
process.on('SIGTERM', function () {
  if (server && server.close) {
    server.close(function () {
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
});

// Persist sessions with mongoStore
app.use(['/api*'], session({
  secret: 'foo',
  cookie: {path: '/', httpOnly: true, secure: false, maxAge: null },
  resave: true,
  saveUninitialized: true,
  /*store: new mongoStore({
    mongooseConnection: mongoose.connection,
    stringify:false
  })*/
}));

app.use('/api*', function (req, res, next) {
  if (!req.session.user) {
    req.session.user = {};
  }
  next();
});

app.options('/api/*', cors());
app.post('/api/tariff/request', cors(), require('./api/tariff'));
app.get('/api/tariff/ping', cors(), require('./api/tariff/ping'));
app.post('/api/tariff/news', cors(), require('./api/news'));

//require('./api/tariff')(
//  {session: {user: {}}, body: {/*delivery: 'majorexpress', */date: require('moment')().add(-10, 'month')}},
//  {json: function () {}}
//);

//require('./api/news')(
//  {session: {user: {}}, body: {delivery: 'spsr', date: require('moment')().add(-3, 'month')}},
//  {json: function () {}}
//);

server = app.listen(app.get('port'), function() {
  console.log('Node app is running on port', app.get('port'));
});
