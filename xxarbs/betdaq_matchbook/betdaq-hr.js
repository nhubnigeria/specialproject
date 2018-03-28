//=============================================================================
'use strict';

if (process.env.NODE_ENV != 'production') {
    require('dotenv').config();
}
//=============================================================================
// dependencies
const P = require('puppeteer');

// module variables
const

    EVENT_URL = process.env.BETDAQ_URL,
    EVENT_LABEL = process.argv[2],
    SELECTIONS_CONTAINER_SELECTOR = 'table.dataTable.marketViewSelections',
    MATCHED_AMOUNT_SELECTOR = 'span.gep-matchedamount',
    FRAME_NAME = 'mainFrame';
    RACE_START_SELECTOR = '#market_12031905 > div.gep-marketcontent > div > div.gep-marketSelections > table > tbody:nth-child(1) > tr.gep-icon-row > td:nth-child(1) > div > div.gep-runningstatus.gep-icon-currentlyinrunning';
    // EMAIL_SELECTOR = 'input#username',
    // PWD_SELECTOR = 'input#password',
    // LOGIN_BTN_SELECTOR = '#client-loginDialog > div.gep-content > form > input[type="submit"]:nth-child(4)',
     // SIZE_INPUT_SELECTOR = 'input.gep-bslip-bet-stake.gep-input-number',
   // RUNNERS_SELECTOR = 'tr.marketViewSelectionRow.gep-row',
   // BET_SELECTOR = 'tr.gep-bslip-bet.gep-bslip-betBB',
    //RUNNER_NAME_SELECTOR = '#client-betslippane > div > div.gep-rightnav-scroll > div.gep-bslip > div.gep-bslip-bets > div.gep-bslip-bets-scroll > div.gep-bslip-bets-back > table > tbody > tr:nth-child(3) > td.gep-bslip-betName.gep-bslip-td-sel > div.gep-ellipsis.gep-bold > span',
   // BET_VALUES_SELECTOR = 'td.gep-bslip-bet-oddsW',
   // PRICE_INPUT_SELECTOR = 'input.gep-bslip-bet-odds',
  //  SUBMIT_BET_SELECTOR = 'input.gep-bslip-placebet',
  //  SCREEN_SHOT_DIR = './screenshots/';

// const
//     EVENT_TIME_ARRAY = EVENT_LABEL.split('|'),
//     EVENT_TIME_STR = EVENT_TIME_ARRAY[1];
async function bot() {
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
    // navigate to EVENT_URL
    await page.goto(EVENT_URL, {
        waitUntil: 'networkidle2',
        timeout: 180000
    });
    await page.waitFor(30 * 1000);
   
    await page.waitForSelector(SELECTIONS_CONTAINER_SELECTOR, {
        timeout: 180000
    });

    const frame = await page.frames().find(f => f.name() === FRAME_NAME);
    //checks if frame with name mainFrame is available
    if (!!frame) {
        // ensure race container selector available
        await frame.waitForSelector(SELECTIONS_CONTAINER_SELECTOR, {
            timeout: 180000
        }).catch((error) => {
            console.log('Selector Not Found', error);
            process.exit(1);
        });

        // allow 'page' instance to output any calls to browser log to process obj
        page.on('console', data => process.send(data.text()));
        // bind to races container and lsiten for updates to , bets etc
        await page.$eval(SELECTIONS_CONTAINER_SELECTOR,
            (target, MATCHED_AMOUNT_SELECTOR) => {
                // listen for raceStart
                // function raceStarts() {
                //     // get target time from eventLabel and present time
                //     const
                //         targetTime = new Date(EVENT_TIME_STR),
                //         presentTime = new Date(),
                //         targetTimeValue = targetTime.valueOf(),
                //         presentTimeValue = presentTime.valueOf(),
                //         delay = targetTimeValue - presentTimeValue;

                //     async function verifyRaceStarts() {
                //         const started = await page.waitForSelector(RACE_START_SELECTOR, {
                //             timeout: 60000
                //         });
                //         if (!!started) {
                //             const
                //                 msg = { alert: 'race has started' },
                //                 outpt = JSON.stringify(msg);
                //             return console.log(output);
                //         }
                //         else {
                //             return setTimeout(verifyRaceStarts, 10000);
                //         }
                //     }
                //     return setTimeout(verifyRaceStarts, delay);
                // }

                // raceStarts();

                const observer = new MutationObserver((mutations) => {
                    mutations.forEach(function (ed) {
                        const e = {
                            mutation: ed,
                            el: ed.target,
                            value: ed.target.textContent,
                            oldValue: ed.oldValue
                        };
                        if (e.el.parentElement.parentElement.parentElement.parentElement.className == ('marketViewSelectionRow gep-altrow' || 'marketViewSelectionRow gep-row')) {
                            // define variables

                            let
                                betType,
                                odds,
                                liquidity,
                                SELECTION;
                            SELECTION = e.el.parentElement.parentElement.parentElement.parentElement.children[0].children[2].children[0].children[0].children[2].children[0].innerText
                            // check 12 conditions

                            if ((e.el.className == 'price') && (e.el.parentElement.parentElement.parentElement.className == 'priceBox backCell_0')) {
                                betType = 'b0';
                                odds = e.el.innerText;
                                liquidity = e.el.parentElement.children[1].innerText;
                            }
                            else if ((e.el.className == 'price') && (e.el.parentElement.parentElement.parentElement.className == 'priceBox layCell_0')) {
                                betType = 'l0';
                                odds = e.el.innerText;
                                liquidity = e.el.parentElement.children[1].innerText;
                            }
                            else if ((e.el.className == 'price') && (e.el.parentElement.parentElement.parentElement.className == 'priceBox backCell_1')) {
                                betType = 'b1';
                                odds = e.el.innerText;
                                liquidity = e.el.parentElement.children[1].innerText;
                            }
                            else if ((e.el.className == 'price') && (e.el.parentElement.parentElement.parentElement.className == 'priceBox layCell_1')) {
                                betType = 'l1';
                                odds = e.el.innerText;
                                liquidity = e.el.parentElement.children[1].innerText;
                            }
                            else if ((e.el.className == 'price') && (e.el.parentElement.parentElement.parentElement.className == 'priceBox backCell_2')) {
                                betType = 'b2';
                                odds = e.el.innerText;
                                liquidity = e.el.parentElement.children[1].innerText;
                            }
                            else if ((e.el.className == 'price') && (e.el.parentElement.parentElement.parentElement.className == 'priceBox layCell_2')) {
                                betType = 'l2';
                                odds = e.el.innerText;
                                liquidity = e.el.parentElement.children[1].innerText;
                            }
                            else if ((e.el.className == 'stake') && (e.el.parentElement.parentElement.parentElement.className == 'priceBox backCell_0')) {
                                betType = 'b0';
                                odds = e.el.parentElement.children[0].innerText;
                                liquidity = e.el.innerText;
                            }
                            else if ((e.el.className == 'stake') && (e.el.parentElement.parentElement.parentElement.className == 'priceBox layCell_0')) {
                                betType = 'l0';
                                odds = e.el.parentElement.children[0].innerText;
                                liquidity = e.el.innerText;
                            }
                            else if ((e.el.className == 'stake') && (e.el.parentElement.parentElement.parentElement.className == 'priceBox backCell_1')) {
                                betType = 'b1';
                                odds = e.el.parentElement.children[0].innerText;
                                liquidity = e.el.innerText;
                            }
                            else if ((e.el.className == 'stake') && (e.el.parentElement.parentElement.parentElement.className == 'priceBox layCell_1')) {
                                betType = 'l1';
                                odds = e.el.parentElement.children[0].innerText;
                                liquidity = e.el.innerText;
                            }
                            else if ((e.el.className == 'stake') && (e.el.parentElement.parentElement.parentElement.className == 'priceBox backCell_2')) {
                                betType = 'b2';
                                odds = e.el.parentElement.children[0].innerText;
                                liquidity = e.el.innerText;
                            }
                            else if ((e.el.className == 'stake') && (e.el.parentElement.parentElement.parentElement.className == 'priceBox layCell_2')) {
                                betType = 'l2';
                                odds = e.el.parentElement.children[0].innerText;
                                liquidity = e.el.innerText;
                            }

                            //checks for trutiness of  data selected 
                            if (!!betType && !!odds && !!liquidity && !!SELECTION) {
                                let timestamp = new Date();
                                timestamp = timestamp.toISOString();
                                let matchedAmount = document.querySelector(MATCHED_AMOUNT_SELECTOR).innerText;
                                matchedAmount = Number(matchedAmount.replace(/\D/g, ''));
                                const data = {
                                    betType,
                                    matchedAmount,
                                    timestamp,
                                    odds: Number(odds),
                                    liquidity: Number(liquidity.slice(1)),
                                    selection: SELECTION,

                                };
                                const output = JSON.stringify(data);
                                console.log(output);
                            }
                        }
                    });
                });
                observer.observe(target, {
                    attributes: true,
                    childList: false,
                    characterData: false,
                    characterDataOldValue: false,
                    subtree: true
                });

            }, MATCHED_AMOUNT_SELECTOR);

        process.on('message', data => {
            const { selection, type, odds, liquidity } = data;
           // return placeBet(selection, type, odds, '2.00');
            //return placeBet(selection, type, odds, liquidity);
        });
    } else {
        //will be executed when the frame not found
        console.log('Error, Frame not Found!!!');
    }
}

// execute scraper
bot()
    .catch(err => console.error(err));
//=============================================================================
