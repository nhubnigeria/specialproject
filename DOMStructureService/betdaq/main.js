'use strict';

const { execFile } = require('child_process');
const sendMail = require('./utils/sendMail.js');


const child = execFile('node', ['./services/betdaq.js'], (error, stdout, stderr) => {
  if (error) { throw error; }
  else {
    if(stderr) {
      sendMail(stderr, 'Results for BETDAQ Service')
    } else {
      sendMail(stdout, 'Results for BETDAQ Service')
    }

  }
})
