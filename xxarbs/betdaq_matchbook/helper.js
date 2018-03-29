/**
* created by Eddie 27/03/2018
 */
'use strict';

const logger = require('log4js');

logger.configure({
  appenders: {
    APP: {
      type: 'file',
      filename: 'app.log'
    }
  },
  categories: {
    default: {
      appenders: ['APP'],
      level: 'info'
    }
  }
});

module.exports = logger;
