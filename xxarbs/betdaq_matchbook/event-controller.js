'use strict';
if (process.env.NODE_ENV != 'production') {
  require('dotenv').config();
}
//=============================================================================
// dependencies
const
  { fork, spawn } = require('child_process'),
  { promisify } = require('util'),
  fs = require('fs'),
  readFileAsync = promisify(fs.readFile),
  unlinkFileAsync = promisify(fs.unlink),
  P = require('puppeteer'),
  Promise = require('bluebird'),
  mongoose = require('mongoose'),
  moment = require('moment'),
  DBURL = process.env.DBURL,
  EventCardModel = require('./models/event-cards'),
  BETDAQ_URL = process.env.BETDAQ_URL,
  MATCHBOOK_URL = process.env.MATCHBOOK_URL,
  BETDAQ_EVENTS_CONTAINER_SELECTOR = 'table.dataTable.marketViewSelections',
  BETDAQ_SELECTIONS_SELECTOR = 'table > tbody > tr > td.gep-namesection',
  EVENT_END_URL = process.env.EVENT_END_URL,
  HR_EVENT_LINKS_SELECTOR = '#gep-popular-links > div > ul > li.gep-home-links.gep-popular-event-100004 > a';
 

let
  selectionsList,
  marketControllers = {},
  MATCHBOOK,
  BETDAQ,
  SPORT,
  EVENT_LABEL,
  TARGETS;

async function getSelections() {
  // setup
  let
    sport,
    flag;
  const URL_ARR = BETDAQ_URL.split('/');
  sport = URL_ARR[4];
  if (sport == 'horse-racing') {
    flag = 'HR';
    SPORT = 'horse-racing';
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
  await page.setViewport({ width: 1366, height: 768 });
  // set the user agent
  await page.setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko)');
  await page.goto(BETDAQ_URL, {
    waitUntil: 'networkidle2',
    timeout: 180000
  });
  await page.waitFor(10 * 1000);
  // ensure race container selector available
  await page.waitForSelector(BETDAQ_EVENTS_CONTAINER_SELECTOR);
  // allow 'page' instance to output any calls to browser log to node log
  page.on('console', data => console.log(data.text()));
  console.log('BETDAQ_EVENTS_CONTAINER_SELECTOR found, continuing...');
  // get list of selections
  selectionsList = await page.$$eval(BETDAQ_SELECTIONS_SELECTOR, (targets, flag) => {
    let selectionsList = [];
    if (flag == 'HR') {
      targets.filter(target => {
        if (target.parentElement.parentElement.parentElement.parentElement.parentElement.className == 'marketViewSelectionRow gep-row') {
          const selection = target.children[0].innerText;
          console.log(`selection info for HR: ${selection}`);
          return selectionsList.push(selection);
        }
      });
    } 
    return selectionsList;
  }, flag);
  await browser.close();
  return Promise.resolve(true);
}

async function createEventCard() {

  // setup
  let
    sport,
    eventLabel,
    eventDate,
    EVENT_ARR,
    timeLabel = moment().format('L'),
    formattedDate;
  timeLabel = timeLabel.split('/').reverse().join('-');
  let URL_ARR = BETDAQ_URL.split('/');
  sport = URL_ARR[4];
  if (sport == 'horse-racing') {
    EVENT_ARR = URL_ARR.slice(6);
    EVENT_ARR = (EVENT_ARR[0] + '-' + EVENT_ARR[1]).replace(/\(|\)/g, '').split("-");
    formattedDate = EVENT_ARR[2] + '' + EVENT_ARR[1] + ',' + EVENT_ARR[3];
    formattedDate = moment(formattedDate, 'MMMM D, YYYY').format('D-M-YYYY');

    eventLabel = EVENT_ARR[0] + '|' + formattedDate + ' ' + EVENT_ARR[4] + ':' + EVENT_ARR[5];
    EVENT_LABEL = eventLabel;
  } else {
    const eventName = URL_ARR.pop();
    eventLabel = eventName + '|' + timeLabel;
    EVENT_LABEL = eventLabel;
  }
  eventDate = formattedDate;
  // create initial EVENT Card
  let eventCard = {
    eventLabel,
    eventDate,
    sport,
    selectionsList,
    country: 'GB',
    outcome: 'WIN'
  };
  console.log('eventCard...');
  console.log(eventCard);
  // create eventCard for event if NOT exists
  const query = EventCardModel.findOne({ eventLabel: eventCard.eventLabel, sport: eventCard.sport });
  const alreadyExists = await query.exec();
  if (!!alreadyExists && (alreadyExists.eventLabel == eventCard.eventLabel)) {
    console.log(`${alreadyExists.eventLabel} already exists...`);
    return Promise.resolve({ eventLabel: alreadyExists.eventLabel, sport: sport, eventDate: alreadyExists.eventDate });
  } else {
    const newEventCard = new EventCardModel(eventCard);
    const saveNewEventCard = await newEventCard.save();
    if (saveNewEventCard.eventLabel == eventCard.eventLabel) {
      console.log(`successfully created eventCard for ${saveNewEventCard.eventLabel}`);
      return Promise.resolve({ eventLabel: saveNewEventCard.eventLabel, sport: sport, eventDate: saveNewEventCard.eventDate });
    } else {
      console.error(`failed to create eventCard for ${eventCard.eventLabel}`);
      const newErr = new Error(`failed to create eventCard for ${eventCard.eventLabel}`);
      return Promise.reject(newErr);
    }
  }
}

function forkMarketController(SELECTION, eventIdentifiers) {
  const SELECTION_INFO = JSON.stringify(eventIdentifiers);
  console.log(`launching MARKET-CONTROLLER for ${SELECTION}...`);
  const cp = fork('./market-controller.js', [SELECTION, SELECTION_INFO]);
   marketControllers[SELECTION] = cp;
  return Promise.resolve(true);
}

function spawnBots() {
  // spawn the BOTS
  console.log(`spawning the streaming bots`);
  spawnMatchbookBot();
  spawnBetdaqBot();
  return Promise.resolve(true);
}

function spawnMatchbookBot() {

  const regx = /['"]/;

  console.log(`Spawning Matchbook BOT`);

  MATCHBOOK = spawn('node', ['./matchbbok-hr.js', EVENT_LABEL], {
    stdio: ['pipe', 'ipc', 'pipe']
  });

  // listen for data
  MATCHBOOK.on('message', data => {
    console.log('data from Matchbook..');
    const dataObj = JSON.parse(data);
    if (!!dataObj.alert) {
      return selectionsList.forEach(marketController => {
        if (marketController in marketControllers) {
          marketControllers[marketController].send({
            exchange: 'betdaq',
            alert: 'race started'
          });
          return marketControllers[marketController].send({
            exchange: 'matchbook',
            alert: 'race started'
          });
        }
      });
    }
    else {
      let target = dataObj.selection;
      target = target.toLowerCase();
      target = target.replace(regx, '');
      const marketControllerArray = selectionsList.filter(val => {
        let newVal = val.toLowerCase();
        newVal = newVal.replace(regx, '');
        return newVal == target;
      });
      const marketController = marketControllerArray[0];
      if (marketController in marketControllers) {
        return marketControllers[marketController].send({
          exchange: 'matchbook',
          payload: dataObj
        });
      }
    }
  });

  MATCHBOOK.stderr.on('data', err => {
    console.error(`MATCHBOOK bot err`);
    console.error(err.toString());
    console.log(`terminating existing Matchbook BOT`);
    process.kill(MATCHBOOK.pid);
    console.log(`respawning Matchbook BOT`);
    return spawnMatchbookBot();
  });

  MATCHBOOK.on('error', err => {
    console.error(`MATCHBOOK CP err`);
    console.error(err);
    console.log(`terminating existing Matchbook BOT`);
    process.kill(MATCHBOOK.pid);
    console.log(`respawning Matchbook BOT`);
    return spawnMatchbookBot();
  });

  MATCHBOOK.on('close', code => {
    if (code < 1) {
      return console.log(`MATCHBOOK BOT closed normally...`);
    } else {
      return console.error(`MATCHBOOK BOT closed abnormally...`);
    }
  });
}

function spawnBetdaqBot() {
  console.log(`Spawning Betdaq BOT`);

  BETDAQ = spawn('node', ['./betdaq-hr.js'], {
    stdio: ['pipe', 'ipc', 'pipe']
  });

  // listen for data
  BETDAQ.on('message', data => {
    console.log('data from Betdaq...');
    const dataObj = JSON.parse(data);
  });

  BETDAQ.stderr.on('data', err => {
    console.error(`BETDAQ BOT err`);
    console.error(err.toString());
    console.log(`terminating existing Betdaq BOT`);
    process.kill(BETDAQ.pid);
    console.log(`respawning Betdaq BOT`);
    return spawnBetdaqBot();
  });

  BETDAQ.on('error', err => {
    console.error(`BETDAQ CP err`);
    console.error(err);
    console.log(`terminating existing Betdaq BOT`);
    process.kill(BETDAQ.pid);
    console.log(`respawning Betdaq BOT`);
    return spawnBetdaqBot();
  });

  BETDAQ.on('close', code => {
    if (code < 1) {
      return console.log(`BETDAQ BOT closed normally`);
    } else {
      return console.error(`BETDAQ BOT closed abnormally`);
    }
  });
}

// connect to DBURL
let db;
const options = {
  promiseLibrary: Promise,
  reconnectTries: Number.MAX_VALUE,
  reconnectInterval: 500,
  poolSize: 10,
  socketTimeoutMS: 0,
  keepAlive: true,
  autoIndex: false
};

process.on('SIGINT', () => {
  mongoose.connection.close(() => {
    console.log('Event-Controller dBase connection closed due to app termination');
    process.exit(0);
  });
});


function connectToDB() {
  return new Promise((resolve, reject) => {
    console.log(`Attempting to connect to ${DBURL}...`);
    mongoose.connect(DBURL, options);
    db = mongoose.connection;
    db.on('error', err => {
      console.error('There was a db connection error');
      return reject('There was an error connecting to mongodb')
    });
    db.once('connected', () => {
      console.info(`Event-Controller successfully connected to ${DBURL}`);
      return resolve(true);
    });
    db.once('disconnected', () => {
      console.info('Event-Controller successfully disconnected from ' + DBURL);
    });
  });
}

async function listenForCloseEvent(flag) {
  if (flag == 'HR') {
    return listenForHREventClose();
  }
}

async function listenForHREventClose() {
  // instantiate browser
  const browser = await P.launch({
    headless: false,
    timeout: 180000
  });
  // create blank page
  const page = await browser.newPage();
  // set viewport to 1366*768
  await page.setViewport({ width: 1366, height: 768 });
  // set the user agent
  await page.setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko)');
  // navigate to RACE_URL
  await page.goto(EVENT_END_URL, {
    waitUntil: 'networkidle2',
    timeout: 180000
  });
  // wait for 30 secs
  await page.waitFor(30 * 1000);
  // define checkEventEnd function
  async function checkEventEnd() {
    console.log('checkEventEnd invoked...');
    // get all events on page
    const events = await page.$$eval(HR_EVENT_LINKS_SELECTOR, (events, MATCHBOOK_URL) => {
      console.log('querying for events...');
      const eventNotEnded = events.filter(event => event.href == MATCHBOOK_URL);
      console.log('eventNotEnded obj...');
      console.log(eventNotEnded);
      return eventNotEnded;
    }, MATCHBOOK_URL);
    if (events.length > 0) {// event has NOT ended
      console.log(`event has NOT ended for ${EVENT_LABEL}...`);
      console.log('closing puppeteer browser and rechecking in 5 mins...');
      await browser.close();
      return setTimeout(listenForHREventClose, 30000);// 30 seconds timer
    } else {
      console.log(`event has ended for ${EVENT_LABEL}...`);
      console.log('terminating BOTs and market-controller processes...');
      process.kill(MATCHBOOK.pid);
      process.kill(BETDAQ.pid);
      const marketControllersKeysArray = Object.keys(marketControllers);
      marketControllersKeysArray.forEach(key => process.kill(marketControllers[key].pid));
      await browser.close();
      return process.exit(0);
    }
  }
  const
    EVENT_TIME_ARRAY = EVENT_LABEL.split('|'),
    EVENT_TIME_STR = EVENT_TIME_ARRAY[1],
    targetTime = new Date(EVENT_TIME_STR),
    presentTime = new Date(),
    targetTimeValue = targetTime.valueOf(),
    presentTimeValue = presentTime.valueOf(),
    delay = targetTimeValue - presentTimeValue;

  return setTimeout(checkEventEnd, delay);
}


connectToDB()
  .then(ok => {
    console.log('getting selections...');
    return getSelections();
  })
  .then(ok => {
    console.log('selectionsList...');
    console.log(selectionsList);
    return Promise.resolve(true);
  })
  .then(ok => createEventCard())
  .then(eventIdentifiers => {
    console.log('all good...');
    console.log('launching MARKET-CONTROLLERs...');
    // create 1 MARKET-CONTROLLER per selection
    if (eventIdentifiers.sport != 'horse-racing') {
      TARGETS = selectionsList.filter(selection => selection.toLowerCase() != 'draw');
      console.log('event-controller closing db connection...');
      db.close();
      return forkMarketController(selectionsList[0], eventIdentifiers);
      //return selectionsList.forEach(selection => forkMarketController(selection, eventIdentifiers));
    } else {
      console.log('event-controller closing db connection...');
      db.close();
      return forkMarketController(selectionsList[0], eventIdentifiers);
      //return selectionsList.forEach(selection => forkMarketController(selection, eventIdentifiers));
    }
  })
  .then(ok => spawnBots())
  .then(ok => {
    console.log('ready to listen for event ended');
    let flag;
    if (SPORT == 'horse-racing') {
      flag = 'HR';
    }
    return listenForCloseEvent(flag);
  })
  .catch(err => console.error(err));
