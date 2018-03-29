'use strict';
//=============================================================================
if(process.env.NODE_ENV != 'production') {
  require('dotenv').config();
}
// dependencies
const
  express = require('express'),
  bParser = require('body-parser');

// variables
let {PORT, ENV} = process.env;

if(!ENV) {
  ENV = 'development';
}

// config

const app = express();
app.disable('x-powered-by');
app.set('port', PORT);
app.set('env', ENV);

if(ENV != 'production') {
    app.use(require('morgan')('dev'));
    require('clarify');
}

const server = http.createServer(app);

// middleware pipeline
app.use(bParser.json());
app.use(bParser.urlencoded({extended: true}));

// routes
app.get('/test', (req, res) => res.status(200).json('OK!'));

const routes = require('./routes');

app.use('/', routes);

// export module
module.exports = app;
