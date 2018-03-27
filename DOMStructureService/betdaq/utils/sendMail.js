'use strict';
/**
 * Module dependencies
 */
//=============================================================================
const
  nodemailer = require('nodemailer'),
  // sgTransport = require('nodemailer-sendgrid-transport');
  sgTransport = require('nodemailer-smtp-transport');
//=============================================================================
/**
 * Module variables
 */
//=============================================================================
const
  // sgtOptions = {

  //   auth: {
  //     api_user: '',
  //     api_pass: ''
  //   }
  // },
  sgtOptions = {
    service: 'gmail',
    host: 'smtp.gmail.com',
    auth: {
      user: '',
      pass: ''
    }
  },
  mailer = nodemailer.createTransport(sgTransport(sgtOptions));

//=============================================================================
/**
 * Export Module
 */
//=============================================================================
module.exports = function (details, topic) {
  let msg;
  if (typeof details == 'object') {
    msg = {
      to: 'ernest.offiong@gmail.com',
      from: 'report@botservice.com',
      subject: topic,
      html: `<div><p>Hello,</p><p>${topic}</p>
             <br><b>${JSON.stringify(details, null, 2)}</b>
            <p>Have a splendid day</p>
      </div>`
    }
  } else {
    msg = {
      to: 'ernest.offiong@gmail.com',
      from: 'report@botservice.com',
      subject: topic,
      html: `<div><p>Hello,</p><p>${topic}</p>
             <br><b>${details}</b>
            <p>Have a splendid day</p>
      </div>`
    }
  }

  //send email
  mailer.sendMail(msg, function (err, res) {
    if (err) {
      return console.error(err);
    }
    return console.log(res);
  });
};
//=============================================================================
