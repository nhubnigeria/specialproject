'use strict';
//=============================================================================
if(process.env.NODE_ENV != 'production') {
  require('dotenv').config();
}

// dependencies
const
  http = require('http'),
  axios = require('axios'),
  Promise = require('bluebird'),
  app = require('./app');

// variables
let {PORT, ENV, EMAIL, BETFAIR_PWD, LOGIN_URL, APP_KEY} = process.env;

if(!ENV) {
  ENV = 'development';
}

// helpers

async function getSessionToken(EMAIL, BETFAIR_PWD, LOGIN_URL, APP_KEY) {
  try {
    const request = await axios.post(LOGIN_URL, {
      "username": EMAIL,
      "password": BETFAIR_PWD
    }, {
      headers: {
        'Accept': 'application/json',
        'Content-type': 'application/json',
        'X-Application': APP_KEY
      }
    });
    if(!!request && request.status == "SUCCESS") {
      process.env.SESSION_TOKEN = request.token;
      return Promise.resolve(request.token);
    }
  }
  catch(err) {
    const errMsg = `failed to retrieve session Token`;
    return Promise.reject({msg: errMsg, err: err});
  }
}

getSessionToken(EMAIL, BETFAIR_PWD, LOGIN_URL, APP_KEY)
  .then(ok => {
    // listen for connections
    return server.listen(PORT, () => console.log(`BETTING API Server up on port:${server.address().port} in ${ENV} mode`));
  })
  .catch(err => console.error(err));
