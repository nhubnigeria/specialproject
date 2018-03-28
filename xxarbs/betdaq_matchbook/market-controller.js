'use strict';
if(process.env.NODE_ENV != 'production') {
  require('dotenv').config();
}
//=============================================================================
const
  Promise = require('bluebird'),
  accounting = require('accounting'),
  mongoose = require('mongoose'),
  //request = require('superagent'),
  log = require('./helpers').getLogger('APP'),
  SelectionDocModel = require('./models/selection-docs'),
  SelectionArbsDocModel = require('./models/selection-arbs-docs'),
  sendEmail = require('./send-mail'),
  SELECTION = process.argv[2],
  eventIdentifiers = JSON.parse(process.argv[3]),
  EVENT_LABEL = eventIdentifiers.eventLabel,
  SPORT = eventIdentifiers.sport,
  EVENT_DATE = eventIdentifiers.eventDate,
  DBURL = process.env.DBURL,
  MSG_EMAIL = 'simon@percayso.com, paul@percayso.com',
  ENDPOINT = process.env.ENDPOINT;

let arbTrigger = {
  matchbook: {
    l0: {
      odds: null, liquidity: null
    },
    b0: {
      odds: null, liquidity: null
    },
  },
  betdaq: {
    l0: {
      odds: null, liquidity: null
    },
    b0: {
      odds: null, liquidity: null
    },
  }
};

let
  matchbookDeltas = {
    b0: null,
    b1: null,
    b2: null,
    l0: null,
    l1: null,
    l2: null,
    matchedAmount: null
  },
  betdaqDeltas = {
    b0: null,
    b1: null,
    b2: null,
    l0: null,
    l1: null,
    l2: null,
    matchedAmount: null
  };

let
  MATCHBOOK,
  BETDAQ,
  currentArb,
  ARBS = {};


// helper functions
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
    console.log('Selection dBase connection closed due to app termination');
    process.exit(0);
  });
});

process.on('message', data => {
  if(!!data.alert) {
    const reason = 'race started';
    let timestamp = new Date();
    timestamp = timestamp.toISOString();
    return endcurrentArb(timestamp, currentArb, reason);
  }
  else {
    const {exchange, payload} = data;
    log.info(`Market controller for ${SELECTION} received data from event-controller`);
    log.info(payload);
    checkForArbs(exchange, payload);
    return saveBotData(exchange, payload);
  }
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
       console.info(`Market Controller successfully connected to ${DBURL}`);
       return resolve(true);
     });
     db.once('disconnected', () => {
       console.log('Market Controller successfully disconnected from ' + DBURL);
     });
   });
 }

async function createSelectionDeltaDoc() {
  let selectionDoc = {
    eventLabel: EVENT_LABEL,
    eventDate: EVENT_DATE,
    selection: SELECTION,
    b: [],
    s: []
  };

  // create selectionDoc for selection if NOT exists
  const query = SelectionDocModel.findOne({eventLabel: EVENT_LABEL, selection: SELECTION});
  const foundDoc = await query.exec();
  if(!!foundDoc && (foundDoc.eventLabel == selectionDoc.eventLabel) && (foundDoc.selection == selectionDoc.selection)) {
    console.log(`${foundDoc.selection} for ${foundDoc.eventLabel} already exists...`);
    console.log(foundDoc);
    return Promise.resolve(true);
  } else {
    const newSelectionDoc = new SelectionDocModel(selectionDoc);
    const saveNewSelectionDoc = await newSelectionDoc.save();
    if((saveNewSelectionDoc.eventLabel == selectionDoc.eventLabel) && (saveNewSelectionDoc.selection == selectionDoc.selection)) {
      console.log(`successfully created selectionDoc for ${saveNewSelectionDoc.selection} on ${saveNewSelectionDoc.eventLabel}`);
      console.log(saveNewSelectionDoc);
      return Promise.resolve(true);
    } else {
      console.error(`failed to create selectionDoc for ${saveNewSelectionDoc.selection} on ${selectionDoc.eventLabel}`);
      const newErr = new Error(`failed to create selectionDoc for ${saveNewSelectionDoc.selection} on ${selectionDoc.eventLabel}`);
      return Promise.reject(newErr);
    }
  }
}

async function createSelectionArbsDoc() {
  let selectionArbsDoc = {
    eventLabel: EVENT_LABEL,
    eventDate: EVENT_DATE,
    selection: SELECTION,
    arbs: []
  };
  const query = SelectionArbsDocModel.findOne({eventLabel: EVENT_LABEL, selection: SELECTION});
  const foundDoc = await query.exec();
  if(!!foundDoc && (foundDoc.eventLabel == selectionArbsDoc.eventLabel) && (foundDoc.selection == selectionArbsDoc.selection)) {
    console.log(`${foundDoc.selection} for ${foundDoc.eventLabel} arbs doc already exists...`);
    console.log(foundDoc);
    return Promise.resolve(true);
  } else {
    const newSelectionArbsDoc = new SelectionArbsDocModel(selectionArbsDoc);
    const saveNewSelectionArbsDoc = await newSelectionArbsDoc.save();
    if((saveNewSelectionArbsDoc.eventLabel == selectionArbsDoc.eventLabel) && (saveNewSelectionArbsDoc.selection == selectionArbsDoc.selection)) {
      console.log(`successfully created selectionArbsDoc for ${saveNewSelectionArbsDoc.selection} on ${saveNewSelectionArbsDoc.eventLabel}`);
      console.log(saveNewSelectionArbsDoc);
      return Promise.resolve(true);
    } else {
      console.error(`failed to create selectionArbsDoc for ${saveNewSelectionArbsDoc.selection} on ${saveNewSelectionArbsDoc.eventLabel}`);
      const newErr = new Error(`failed to create selectionArbsDoc for ${saveNewSelectionArbsDoc.selection} on ${saveNewSelectionArbsDoc.eventLabel}`);
      return Promise.reject(newErr);
    }
  }
}

function saveBotData(exchange, data) {
  // check which exchange is reporting the data
  if(exchange == 'matchbook') {
    return saveMatchbookData(data);
  }else if(exchange == 'betdaq') {
    return saveBetdaqData(data);
  }
}

function saveMatchbookData(data) {
  if(!matchbookDeltas[data.betType]) {// check if first time cell seen
    matchbookDeltas[data.betType] = {
      odds: data.odds,
      liquidity: data.liquidity
    };
    matchbookDeltas.matchedAmount = data.matchedAmount;
    return saveData(data);
  }
  else {// cell already exists
    // check if matched amount has changed
    if(matchbookDeltas.matchedAmount == data.matchedAmount) {// has NOT changed don't save new matchedAmount
    delete data.matchedAmount;
    }
    else {// has changed, update matchbookDeltas.matchedAmount and save new matchedAmount
    matchbookDeltas.matchedAmount = data.matchedAmount;
    }
    // save new info for matchbookDeltas
    matchbookDeltas[data.betType] = {
      odds: data.odds,
      liquidity: data.liquidity
    };
    return saveData(data);
  }

  async function saveData(data) {
    // push data obj into 'matchbook' array
    const query = SelectionDocModel.findOneAndUpdate({eventLabel: EVENT_LABEL, selection: SELECTION}, {$push: {
        b: data
      }});
    try {
      const addedNewMatchbookData = await query.exec();
      console.log('addedNewMatchbookData...');
      console.log(addedNewMatchbookData);
      return Promise.resolve(true);
    }
    catch (err) {
      console.error('failed to update new matchbook data...');
      const newErr = new Error(`failed to update new matchbook data... for ${SELECTION}`);
      return Promise.reject(newErr);
    }
  }
}

function saveBetdaqData(data) {
  if(!betdaqDeltas[data.betType]) {// check if first time cell seen
    betdaqDeltas[data.betType] = {
      odds: data.odds,
      liquidity: data.liquidity
    };
    betdaqDeltas.matchedAmount = data.matchedAmount;
    return saveData(data);
  }
  else {// cell already exists
    // check if matched amount has changed
    if(betdaqDeltas.matchedAmount == data.matchedAmount) {// has NOT changed don't save new matchedAmount
    delete data.matchedAmount;
    }
    else {// has changed, update betdaqDeltas.matchedAmount and save new matchedAmount
    betdaqDeltas.matchedAmount = data.matchedAmount;
    }
    // save new info for betdaqDeltas
    betdaqDeltas[data.betType] = {
      odds: data.odds,
      liquidity: data.liquidity
    };
    return saveData(data);
  }

  async function saveData(data) {
    // push data obj into 'betdaq' array
    const query = SelectionDocModel.findOneAndUpdate({eventLabel: EVENT_LABEL, selection: SELECTION}, {$push: {
        s: data
      }});
    try {
      const addedNewBetdaqData = await query.exec();
      console.log('addedNewBetdaqData...');
      console.log(addedNewBetdaqData);
      return Promise.resolve(true);
    }
    catch (err) {
      console.error('failed to update new betdaq data...');
      const newErr = new Error(`failed to update new betdaq data... for ${SELECTION}`);
      return Promise.reject(newErr);
    }
  }
}

function checkForArbs(exchange, data) {
  console.log(`checkForArbs invoked for ${exchange}`);
  if((exchange == 'matchbook') && ((data.betType == 'b0') || (data.betType == 'l0'))) {
    if(data.betType == 'b0') {// check if b0
      if((!arbTrigger.betdaq.l0.odds) || (!arbTrigger.betdaq.l0.liquidity)) {// check if betdaq l0 odds not initialized
        arbTrigger.matchbook.b0 = {
          odds: data.odds,
          liquidity: data.liquidity
        };
        log.info('matchbook b0 seen - no betdaq l0');
        return log.info(arbTrigger);
      }
      else {// check if arbs candidate exists
        const
          B0O = data.odds,
          B0L = data.liquidity,
          L0O = arbTrigger.betdaq.l0.odds,
          L0L = arbTrigger.betdaq.l0.liquidity;
        if(((B0O - 1) / (L0O - 1)) > 1.02) {// candidate exists
          log.info('candidate arb seen triggered by matchbook b0...');
          // create shallow copy of matchbookDeltas, betdaqDeltas and currentArb
          let
            B = Object.assign({}, matchbookDeltas),
            S = Object.assign({}, betdaqDeltas),
            C_Arb = Object.assign({}, currentArb);
          log.info('created shallow copies of matchbookDeltas, betdaqDeltas and currentArb...');
          // update the B.b0 to new values
          B.b0 = {
            odds: B0O,
            liquidity: B0L
          };
          // update the S.l0 to new values
          S.l0 = {
            odds: L0O,
            liquidity: L0L
          };
          // derive target liquidity, max liquidity, win amount and lose amount
          /*let
            targetLiquidity,
            maxLiquidity;
          if(B0L > L0L) {
            targetLiquidity = L0L;
            maxLiquidity = B0L;
          }
          else {
            targetLiquidity = B0L;
            maxLiquidity = L0L;
          }*/
          let maxLiquidity;
          if(B0L > L0L) {
            maxLiquidity = L0L;
          }
          else {
            maxLiquidity = B0L;
          }
          const targetLiquidity = 2;
          let WINAMT = (targetLiquidity * B0O * 0.98) - (targetLiquidity * L0O);
          let LOSEAMT = ((targetLiquidity * 0.98) - (targetLiquidity)) * (-1);
          //WINAMT = Number(WINAMT.toFixed(2));
          WINAMT = accounting.formatMoney(Number(WINAMT.toFixed(2)), "£ ");
          //LOSEAMT = Number(LOSEAMT.toFixed(2));
          LOSEAMT = accounting.formatMoney(Number(LOSEAMT.toFixed(2)), "£ ");

          //const targetOdds = (B0O + L0O) / 2;

          // create arbsDoc object
          const arbsDoc = {
            B0O,
            L0O,
            targetLiquidity,
            selection: SELECTION,
            timestampFrom: data.timestamp,
            timestampTo: '',
            summary: `Bet ${SELECTION} on Matchbook for £${targetLiquidity} at ${B0O}, Lay on Betdaq for £${targetLiquidity} at ${L0O}. Win: ${WINAMT}. Lose: ${LOSEAMT}, Max: £${maxLiquidity}`,
            b: B,
            s: S
          };
          // update in memory arbTrigger with new matchbook.b0 values
          arbTrigger.matchbook.b0 = {
            odds: B0O,
            liquidity: B0L
          };
          if(!!C_Arb.timestampFrom && ((B0O < C_Arb.B0O) || (L0O > C_Arb.L0O) || (targetLiquidity < C_Arb.targetLiquidity))) {// check if conditions exist to end currentArb
            // send placeBet msg
            process.send({
              placeBet: true,
              payload: {
                B0O,
                L0O,
                selection: SELECTION,
                liquidity: targetLiquidity,
                back: 'b',
                lay: 's'
              }});
            // end currentArb and save new one
            const reason = 'delta';
            return saveArbs(arbsDoc, C_Arb, reason);
          }
          else if(!C_Arb.timestampFrom) {// confirm no currentArb
            // send placeBet msg
            process.send({
              placeBet: true,
              payload: {
                B0O,
                L0O,
                selection: SELECTION,
                liquidity: targetLiquidity,
                back: 'b',
                lay: 's'
              }});
            // save arbDoc
            return saveArbs(arbsDoc, null, null);
          }
        }
        else {// candidate does NOT exist
          // update in memory arbTrigger with new matchbook.b0 values
          arbTrigger.matchbook.b0 = {
            odds: data.odds,
            liquidity: data.liquidity
          };
          log.info('updated arbTrigger due to no arbs n no inplay currentArb via matchbook b0...');
          return log.info(arbTrigger);
        }
      }
    }
    else if(data.betType == 'l0') {// check if l0
      if((!arbTrigger.betdaq.b0.odds) || (!arbTrigger.betdaq.b0.liquidity)) {// check if betdaq b0 not initialized
        arbTrigger.matchbook.l0 = {
          odds: data.odds,
          liquidity: data.liquidity
        };
        log.info('matchbook l0 seen - no betdaq b0');
        return log.info(arbTrigger);
      }
      else {// check if arbs candidate exists
        const
          L0O = data.odds,
          L0L = data.liquidity,
          B0O = arbTrigger.betdaq.b0.odds,
          B0L = arbTrigger.betdaq.b0.liquidity;
        if(((B0O - 1) / (L0O - 1)) > 1.02) {// candidate exists
          log.info('candidate arb seen triggered by matchbook l0...');
          // create shallow copy of matchbookDeltas, betdaqDeltas and currentArb
          let
            B = Object.assign({}, matchbookDeltas),
            S = Object.assign({}, betdaqDeltas),
            C_Arb = Object.assign({}, currentArb);
          log.info('created shallow copies of matchbookDeltas, betdaqDeltas and currentArb...');
          // update the B.l0 to new values
          B.l0 = {
            odds: L0O,
            liquidity: L0L
          };
          // update the S.b0 to new values
          S.b0 = {
            odds: B0O,
            liquidity: B0L
          };
          // derive target liquidity, max liquidity, win amount and lose amount
          /*let
            targetLiquidity,
            maxLiquidity;
          if(B0L > L0L) {
            targetLiquidity = L0L;
            maxLiquidity = B0L;
          }
          else {
            targetLiquidity = B0L;
            maxLiquidity = L0L;
          }*/
          let maxLiquidity;
          if(B0L > L0L) {
            maxLiquidity = L0L;
          }
          else {
            maxLiquidity = B0L;
          }
          const targetLiquidity = 2;
          let WINAMT = (targetLiquidity * B0O * 0.98) - (targetLiquidity * L0O);
          let LOSEAMT = ((targetLiquidity * 0.98) - (targetLiquidity)) * (-1);
          WINAMT = accounting.formatMoney(Number(WINAMT.toFixed(2)), "£ ");
          LOSEAMT = accounting.formatMoney(Number(LOSEAMT.toFixed(2)), "£ ");

          //const targetOdds = (B0O + L0O) / 2;

          // create arbsDoc object
          const arbsDoc = {
            B0O,
            L0O,
            targetLiquidity,
            selection: SELECTION,
            timestampFrom: data.timestamp,
            timestampTo: '',
            summary: `Bet ${SELECTION} on Betdaq for £${targetLiquidity} at ${B0O}, Lay on Matchbook for £${targetLiquidity} at ${L0O}. Win: ${WINAMT}. Lose: ${LOSEAMT}, Max: £${maxLiquidity}`,
            b: B,
            s: S
          };
          // update in memory arbTrigger with new matchbook.l0 values
          arbTrigger.matchbook.l0 = {
            odds: L0O,
            liquidity: L0L
          };
          if(!!C_Arb.timestampFrom && ((B0O < C_Arb.B0O) || (L0O > C_Arb.L0O) || (targetLiquidity < C_Arb.targetLiquidity))) {
            // send placeBet msg
            process.send({
              placeBet: true,
              payload: {
                B0O,
                L0O,
                selection: SELECTION,
                liquidity: targetLiquidity,
                back: 's',
                lay: 'b'
              }});
            const reason = 'delta';
            return saveArbs(arbsDoc, C_Arb, reason);
          }
          else if(!C_Arb.timestampFrom) {
            // send placeBet msg
            process.send({
              placeBet: true,
              payload: {
                B0O,
                L0O,
                selection: SELECTION,
                liquidity: targetLiquidity,
                back: 's',
                lay: 'b'
              }});
            return saveArbs(arbsDoc, null, null);
          }
        }
        else {// candidate does NOT exist
          arbTrigger.matchbook.l0 = {
            odds: data.odds,
            liquidity: data.liquidity
          };
          log.info('updated arbTrigger due to no arbs n no inplay currentArb via matchbook l0...');
          return log.info(arbTrigger);
        }
      }
    }
  }
  else if((exchange == 'betdaq') && ((data.betType == 'b0') || (data.betType == 'l0'))) {
    if(data.betType == 'b0') {// check if b0
      if((!arbTrigger.matchbook.l0.odds) || (!arbTrigger.matchbook.l0.liquidity)) {// check if matchbook l0 not initialized
        arbTrigger.betdaq.b0 = {
          odds: data.odds,
          liquidity: data.liquidity
        };
        log.info('betdaq b0 seen - no matchbook l0');
        return log.info(arbTrigger);
      }
      else {// check if arbs candidate exists
        const
          B0O = data.odds,
          B0L = data.liquidity,
          L0O = arbTrigger.matchbook.l0.odds,
          L0L = arbTrigger.matchbook.l0.liquidity;
        if(((B0O - 1) / (L0O - 1)) > 1.02) {// candidate exists
          log.info('candidate arb seen triggered by betdaq b0...');
          // create shallow copy of matchbookDeltas, betdaqDeltas and currentArb
          let
            B = Object.assign({}, matchbookDeltas),
            S = Object.assign({}, betdaqDeltas),
            C_Arb = Object.assign({}, currentArb);
          log.info('created shallow copies of matchbookDeltas, betdaqDeltas and currentArb...');
          // update the B.l0 to new values
          B.l0 = {
            odds: L0O,
            liquidity: L0L
          };
          // update the S.b0 to new values
          S.b0 = {
            odds: B0O,
            liquidity: B0L
          };
          // derive target liquidity, max liquidity, win amount and lose amount
          /*let
            targetLiquidity,
            maxLiquidity;
          if(B0L > L0L) {
            targetLiquidity = L0L;
            maxLiquidity = B0L;
          }
          else {
            targetLiquidity = B0L;
            maxLiquidity = L0L;
          }*/
          let maxLiquidity;
          if(B0L > L0L) {
            maxLiquidity = L0L;
          }
          else {
            maxLiquidity = B0L;
          }
          const targetLiquidity = 2;
          let WINAMT = (targetLiquidity * B0O * 0.98) - (targetLiquidity * L0O);
          let LOSEAMT = ((targetLiquidity * 0.98) - (targetLiquidity)) * (-1);
          WINAMT = accounting.formatMoney(Number(WINAMT.toFixed(2)), "£ ");
          LOSEAMT = accounting.formatMoney(Number(LOSEAMT.toFixed(2)), "£ ");

          const targetOdds = (B0O + L0O) / 2;

          // create arbsDoc object
          const arbsDoc = {
            B0O,
            L0O,
            targetLiquidity,
            selection: SELECTION,
            timestampFrom: data.timestamp,
            timestampTo: '',
            summary: `Bet ${SELECTION} on Betdaq for £${targetLiquidity} at ${B0O}, Lay on Matchbook for £${targetLiquidity} at ${L0O}. Win: ${WINAMT}. Lose: ${LOSEAMT}, Max: £${maxLiquidity}`,
            b: B,
            s: S
          };
          // update in memory arbTrigger with new betdaq.b0 values
          arbTrigger.betdaq.b0 = {
            odds: B0O,
            liquidity: B0L
          };
          // save the arbDoc
          if(!!C_Arb.timestampFrom && ((B0O < C_Arb.B0O) || (L0O > C_Arb.L0O) || (targetLiquidity < C_Arb.targetLiquidity))) {// check if conditions exist to end currentArb
            // send placeBet msg
            process.send({
              placeBet: true,
              payload: {
                B0O,
                L0O,
                selection: SELECTION,
                liquidity: targetLiquidity,
                back: 's',
                lay: 'b'
              }});
            // end currentArb and save new one
            const reason = 'delta';
            return saveArbs(arbsDoc, C_Arb, reason);
          }
          else if(!C_Arb.timestampFrom) {// confirm no currentArb
            // send placeBet msg
            process.send({
              placeBet: true,
              payload: {
                B0O,
                L0O,
                selection: SELECTION,
                liquidity: targetLiquidity,
                back: 's',
                lay: 'b'
              }});
            // save arbDoc
            return saveArbs(arbsDoc, null, null);
          }
        }
        else {// candidate does NOT exist
          // update in memory arbTrigger with new betdaq.b0 values
          arbTrigger.betdaq.b0 = {
            odds: data.odds,
            liquidity: data.liquidity
          };
          log.info('updated arbTrigger due to no arbs n no inplay currentArb via betdaq b0...');
          return log.info(arbTrigger);
        }
      }
    }
    else if(data.betType == 'l0') {// check if l0
      if((!arbTrigger.matchbook.b0.odds) || (!arbTrigger.matchbook.b0.liquidity)) {// check if oppossing cell not initialized
        arbTrigger.betdaq.l0 = {
          odds: data.odds,
          liquidity: data.liquidity
        };
        log.info('betdaq l0 seen - no matchbook b0');
        return log.info(arbTrigger);
      }
      else {// check if arbs candidate exists
        const
          L0O = data.odds,
          L0L = data.liquidity,
          B0O = arbTrigger.matchbook.b0.odds,
          B0L = arbTrigger.matchbook.b0.liquidity;
        if(((B0O - 1) / (L0O - 1)) > 1.02) {// candidate exists
          log.info('candidate arb seen triggered by betdaq l0...');
          // create shallow copy of matchbookDeltas, betdaqDeltas and currentArb
          let
            B = Object.assign({}, matchbookDeltas),
            S = Object.assign({}, betdaqDeltas),
            C_Arb = Object.assign({}, currentArb);
          log.info('created shallow copies of matchbookDeltas, betdaqDeltas and currentArb...');
          // update the B.b0 to new values
          B.b0 = {
            odds: B0O,
            liquidity: B0L
          };
          // update the S.l0 to new values
          S.l0 = {
            odds: L0O,
            liquidity: L0L
          };
          // derive target liquidity, max liquidity, win amount and lose amount
          /*let
            targetLiquidity,
            maxLiquidity;
          if(B0L > L0L) {
            targetLiquidity = L0L;
            maxLiquidity = B0L;
          }
          else {
            targetLiquidity = B0L;
            maxLiquidity = L0L;
          }*/
          let maxLiquidity;
          if(B0L > L0L) {
            maxLiquidity = L0L;
          }
          else {
            maxLiquidity = B0L;
          }
          const targetLiquidity = 2;
          let WINAMT = (targetLiquidity * B0O * 0.98) - (targetLiquidity * L0O);
          let LOSEAMT = ((targetLiquidity * 0.98) - (targetLiquidity)) * (-1);
          WINAMT = accounting.formatMoney(Number(WINAMT.toFixed(2)), "£ ");
          LOSEAMT = accounting.formatMoney(Number(LOSEAMT.toFixed(2)), "£ ");

          const targetOdds = (B0O + L0O) / 2;

          // create arbsDoc object
          const arbsDoc = {
            B0O,
            L0O,
            targetLiquidity,
            selection: SELECTION,
            timestampFrom: data.timestamp,
            timestampTo: '',
            summary: `Bet ${SELECTION} on Matchbook for £${targetLiquidity} at ${B0O}, Lay on Betdaq for £${targetLiquidity} at ${L0O}. Win: ${WINAMT}. Lose: ${LOSEAMT}, Max: £${maxLiquidity}`,
            b: B,
            s: S
          };
          // update in memory arbTrigger with new betdaq.l0 values
          arbTrigger.betdaq.l0 = {
            odds: L0O,
            liquidity: L0L
          };
          if(!!C_Arb.timestampFrom && ((B0O < C_Arb.B0O) || (L0O > C_Arb.L0O) || (targetLiquidity < C_Arb.targetLiquidity))) {// check if conditions exist to end currentArb
            // send placeBet msg
            process.send({
              placeBet: true,
              payload: {
                B0O,
                L0O,
                selection: SELECTION,
                liquidity: targetLiquidity,
                back: 'b',
                lay: 's'
              }});
            // end currentArb and save new one
            const reason = 'delta';
            return saveArbs(arbsDoc, C_Arb, reason);
          }
          else if(!C_Arb.timestampFrom) {// confirm no currentArb
            // send placeBet msg
            process.send({
              placeBet: true,
              payload: {
                B0O,
                L0O,
                selection: SELECTION,
                liquidity: targetLiquidity,
                back: 'b',
                lay: 's'
              }});
            // save arbDoc
            return saveArbs(arbsDoc, null, null);
          }
        }
        else {// candidate does NOT exist
          // update in memory arbTrigger with new betdaq.l0 values
          arbTrigger.betdaq.l0 = {
            odds: data.odds,
            liquidity: data.liquidity
          };
          log.info('updated arbTrigger due to no arbs n no inplay currentArb via betdaq l0...');
          return log.info(arbTrigger);
        }
      }
    }
  }
}

function saveArbs(arbsDoc, C_Arb, reason) {
  if(!reason) {// check if first time arbs detected
    log.info('no currentArb... setting it to received data..');
    currentArb = arbsDoc;
    return saveData(arbsDoc, null);
  }
  else {// set timestampTo of existing arbsDoc to timestampFrom of new arbs doc
    log.info('currentArb exists...');
    // setup
    let
      start = new Date(C_Arb.timestampFrom),
      end = new Date(arbsDoc.timestampFrom);
    start = start.valueOf();
    end = end.valueOf();
    const duration = (end - start) / 1000;
    let endTime = new Date(arbsDoc.timestampFrom);
    endTime = endTime.toISOString();
    const newSummary = C_Arb.summary + `. Duration: ${duration} seconds. Reason: ${reason}`;
    C_Arb.timestampTo = endTime;
    C_Arb.summary = newSummary;
    // update timestampTo of currentArb
    if(C_Arb.timestampFrom in ARBS) {
      log.info('found C_Arb in ARBS... ready to update');
      currentArb = arbsDoc;
      saveData(C_Arb, true);
      log.info('updated C_Arb... saving arbsDoc');
      return saveData(arbsDoc, null);
    }
    else {
      return log.error('C_Arb NOT found in ARBS');
    }
  }

  async function saveData(arbsDoc, flag) {
    log.info('saveData called...');
    log.info('arbsDoc...');
    log.info(arbsDoc);
    // push data obj into 'arbs' array
    ARBS[arbsDoc.timestampFrom] = arbsDoc;
    if(arbsDoc.timestampFrom in ARBS) {
      log.info('successfully saved new arb');
      log.info(ARBS);
      if(flag) {
        const query = SelectionArbsDocModel.findOneAndUpdate({eventLabel: EVENT_LABEL, selection: SELECTION}, {$push: {
            arbs: arbsDoc
          }});
        try{
          const addedNewArbsDocData = await query.exec();
          log.info('addedNewArbsDocData...');
          log.info(addedNewArbsDocData);
          const used = process.memoryUsage().heapUsed / 1024 / 1024;
          const BODY = `${arbsDoc.summary}. TimestampFrom: ${arbsDoc.timestampFrom}`;
          return sendEmail(EVENT_LABEL, BODY);
          /*return request
            .post(ENDPOINT)
            .set('Accept', 'application/json')
            .send({
              "transport": "ses",
              "from": "noreply@valueservices.uk",
              "to": MSG_EMAIL,
              "subject": EVENT_LABEL,
              "emailbody": BODY,
              "templateName": "GenericEmail"
            })
            .then(resp => {
              log.info('msg sending response...');
              log.info(resp.statusCode);
              log.info(`The process uses approximately ${used} MB`);
              return Promise.resolve(true);
            })
            .catch(err => {
              log.error('email sending err...');
              return log.error(err);
            });*/
        }
        catch(err) {
          log.error('failed to add new data to selectonArbsDoc...');
          log.error(err);
          const newErr = new Error(`failed to add new data to selectonArbsDoc`);
          return Promise.reject(newErr);
        }
      }
      else {
        return log.info('new arb saved to memory');
      }
    }
    else {
      log.error('failed to save new arb');
      return log.error(arbsDoc);
    }
  }
}

function endcurrentArb(timestamp, C_Arb, reason) {
  log.info('endcurrentArb... C_Arb');
  // setup
  let
    start = new Date(C_Arb.timestampFrom),
    end = new Date(timestamp);
  start = start.valueOf();
  end = end.valueOf();
  const duration = (end - start) / 1000;
  let endTime = new Date(timestamp);
  endTime = endTime.toISOString();
  const newSummary = C_Arb.summary + `. Duration: ${duration} seconds. Reason: ${reason}`;
  // update timestampTo of in-play currenArbs
  C_Arb.timestampTo = endTime;
  C_Arb.summary = newSummary;
  // update timestampTo of currenArbs
  if(C_Arb.timestampFrom in ARBS) {
    log.info('setting currentArb to null');
    currentArb = null;
    log.info(currentArb);
    log.info('found C_Arb in ARBS... ready to update');
    return saveData(C_Arb);
  }
  else {
    return log.error('C_Arb NOT found in ARBS');
  }

  async function saveData(arbsDoc) {
    log.info('saveData called...');
    log.info('arbsDoc...');
    log.info(arbsDoc);
    // push data obj into 'arbs' array
    ARBS[arbsDoc.timestampFrom] = arbsDoc;
    if(arbsDoc.timestampFrom in ARBS) {
      log.info('successfully ended existing arb');
      log.info(ARBS);
      const used = process.memoryUsage().heapUsed / 1024 / 1024;
      const BODY = `${arbsDoc.summary}. TimestampFrom: ${arbsDoc.timestampFrom}`;
      const query = SelectionArbsDocModel.findOneAndUpdate({eventLabel: EVENT_LABEL, selection: SELECTION}, {$push: {
          arbs: arbsDoc
        }});
      try{
        const endedOldArbsDocData = await query.exec();
        log.info('endedOldArbsDocData...');
        log.info(endedOldArbsDocData);
        const used = process.memoryUsage().heapUsed / 1024 / 1024;
        const BODY = `${arbsDoc.summary}. TimestampFrom: ${arbsDoc.timestampFrom}`;
        return sendEmail(EVENT_LABEL, BODY);
        /*return request
          .post(ENDPOINT)
          .set('Accept', 'application/json')
          .send({
            "transport": "ses",
            "from": "noreply@valueservices.uk",
            "to": MSG_EMAIL,
            "subject": EVENT_LABEL,
            "emailbody": BODY,
            "templateName": "GenericEmail"
          })
          .then(resp => {
            log.info('msg sending response...');
            log.info(resp.statusCode);
            log.info(`The process uses approximately ${used} MB`);
            return Promise.resolve(true);
          })
          .catch(err => {
            log.error('email sending err...');
            return log.error(err);
          });*/
      }
      catch(err) {
        log.error('failed to end old arbs doc in db...');
        log.error(err);
        const newErr = new Error(`failed to end old arbs doc in db`);
        return Promise.reject(newErr);
      }
    }
    else {
      log.error('failed to end old arbs doc in RAM');
      return log.error(arbsDoc);
    }
  }
}

// execute
connectToDB()
  .then(ok => createSelectionDeltaDoc())
  .then(ok => createSelectionArbsDoc())
  .then(ok => console.log(`all good from market-controller for ${SELECTION}`))
  .catch(err => console.error(err));
