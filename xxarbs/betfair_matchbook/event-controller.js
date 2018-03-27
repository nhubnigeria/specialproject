'use strict';
if(process.env.NODE_ENV != 'production') {
  require('dotenv').config();
}
//=============================================================================
// dependencies
const
  {fork, spawn} = require('child_process'),
  {promisify} = require('util'),
  fs = require('fs'),
  readFileAsync = promisify(fs.readFile),
  unlinkFileAsync = promisify(fs.unlink),
  P = require('puppeteer'),
  Promise = require('bluebird'),
  mongoose = require('mongoose'),
  moment = require('moment'),
  //request = require('superagent'),
  AWS = require('aws-sdk'),
  DBURL = process.env.DBURL,
  EventCardModel = require('./models/event-cards'),
  sendEmail = require('./send-mail'),
  BUCKET = 'xx-arbs-bet-screenshots',
  SMARKETS_URL = process.env.SMARKETS_URL,
  BETFAIR_URL = process.env.BETFAIR_URL,
  MATCHBOOK_EVENTS_CONTAINER_SELECTOR = 'ul.contracts',
  MATCHBOOK_SELECTIONS_SELECTOR = 'div.contract-info',
  EVENT_END_URL = process.env.EVENT_END_URL,
  HR_EVENT_LINKS_SELECTOR = 'a.race-link',
  GENERIC_EVENT_LINKS_SELECTOR = 'span.event-name',
  MSG_EMAIL = 'simon@percayso.com, paul@percayso.com',
  ENDPOINT = process.env.ENDPOINT;

let
  selectionsList,
  marketControllers = {},
  BETFAIR,
  MATCHBOOK,
  SPORT,
  EVENT_LABEL,
  TARGETS,
  imgSize;

AWS.config.update({
  region: 'eu-west-2'
});

const s3 = new AWS.S3();

AWS.config.setPromisesDependency(Promise);
// helper functions

async function getSelections() {
  // setup
  let
    sport,
    flag;
  const URL_ARR = SMARKETS_URL.split('/');
  sport = URL_ARR[6];
  if(sport == 'horse-racing' ) {
    flag = 'HR';
    SPORT = 'horse-racing';
  } else {
    flag = 'GENERIC';
    SPORT = 'generic';
  }
  console.log(`sport: ${sport}...`);
  // instantiate browser
  const browser = await P.launch({
    headless: false,
    timeout: 180000
  });
  // create blank page
  const page = await browser.newPage();
  // set viewport to 1366*768
  await page.setViewport({width: 1366, height: 768});
  // set the user agent
  await page.setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko)');
  await page.goto(SMARKETS_URL, {
    waitUntil: 'networkidle2',
    timeout: 180000
  });
  await page.waitFor(10*1000);
  // ensure race container selector available
  await page.waitForSelector(SMARKETS_EVENTS_CONTAINER_SELECTOR);
  // allow 'page' instance to output any calls to browser log to node log
  page.on('console', data => console.log(data.text()));
  console.log('SMARKETS_EVENTS_CONTAINER_SELECTOR found, continuing...');
  // get list of selections
  selectionsList = await page.$$eval(SMARKETS_SELECTIONS_SELECTOR, (targets, flag) => {
    let selectionsList = [];
    if(flag == 'HR') {
      targets.filter(target => {
        if(target.parentElement.nextElementSibling.children[0].children[0].className == 'price-section') {
          const selection = target.children[1].children[0].children[0].innerText;
          console.log(`selection info for HR: ${selection}`);
          return selectionsList.push(selection);
        }
      });
    } else {
      targets.forEach(target => {
        const selection = target.innerText;
        console.log(`selection info for GENERIC: ${selection}`);
        return selectionsList.push(selection);
      });
    }
    return selectionsList;
  }, flag);
  await browser.close();
  return Promise.resolve(true);
}

