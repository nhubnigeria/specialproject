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
    EMAIL_SELECTOR = '#username',
    PWD_SELECTOR = '#password',
    LOGIN_BTN_SELECTOR = '#client-loginDialog > div.gep-content > form > input[type="submit"]:nth-child(4)',
    SELECTIONS_CONTAINER_SELECTOR = 'table.dataTable.marketViewSelections',
    MATCHED_AMOUNT_SELECTOR = 'span.gep-matchedamount',
    FRAME_NAME = 'mainFrame';
    RACE_START_SELECTOR = '#main-wrapper > div > div.scrollable-panes-height-taker > div > div.page-content.nested-scrollable-pane-parent > div > div.bf-col-xxl-17-24.bf-col-xl-16-24.bf-col-lg-16-24.bf-col-md-15-24.bf-col-sm-14-24.bf-col-14-24.center-column.bfMarketSettingsSpace.bf-module-loading.nested-scrollable-pane-parent > div:nth-child(1) > div > div > div > div > div.event-header > div > span.race-status.default',
    RUNNERS_SELECTOR = '#market_12031905 > div.gep-marketcontent > div > div.gep-marketSelections > table > tbody:nth-child(1) > tr.gep-icon-row > td:nth-child(1) > div > div.gep-runningstatus.gep-icon-currentlyinrunning',
    BET_SELECTOR = 'tr.gep-bslip-bet.gep-bslip-betBB',
    RUNNER_NAME_SELECTOR = '#client-betslippane > div > div.gep-rightnav-scroll > div.gep-bslip > div.gep-bslip-bets > div.gep-bslip-bets-scroll > div.gep-bslip-bets-back > table > tbody > tr:nth-child(3) > td.gep-bslip-betName.gep-bslip-td-sel > div.gep-ellipsis.gep-bold > span',
    BET_VALUES_SELECTOR = 'td.gep-bslip-bet-oddsW',
    PRICE_INPUT_SELECTOR = 'input.gep-bslip-bet-odds',
    SIZE_INPUT_SELECTOR = 'input.gep-bslip-bet-stake.gep-input-number',
    SUBMIT_BET_SELECTOR = 'input.gep-bslip-placebet',
    SCREEN_SHOT_DIR = './screenshots/';

const
    EVENT_TIME_ARRAY = EVENT_LABEL.split('|'),
    EVENT_TIME_STR = EVENT_TIME_ARRAY[1];
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
    // wait for EMAIL and PWD selectors to be available
    await page.waitForSelector(EMAIL_SELECTOR, { timeout: 30000 });
    await page.waitForSelector(PWD_SELECTOR, { timeout: 30000 });
    // enter email
    await page.type(EMAIL_SELECTOR, EMAIL, { delay: 100 });
    await page.waitFor(2 * 1000);
    //enter password
    await page.type(PWD_SELECTOR, PWD, { delay: 100 });
    await page.waitFor(2 * 1000);
    // click login button
    await page.click(LOGIN_BTN_SELECTOR);
    await page.waitFor(30 * 1000);
    // ensure race container selector available
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
            (target, MATCHED_AMOUNT_SELECTOR, EVENT_TIME_STR, RACE_START_SELECTOR) => {
                // listen for raceStart
                function raceStarts() {
                    // get target time from eventLabel and present time
                    const
                        targetTime = new Date(EVENT_TIME_STR),
                        presentTime = new Date(),
                        targetTimeValue = targetTime.valueOf(),
                        presentTimeValue = presentTime.valueOf(),
                        delay = targetTimeValue - presentTimeValue;

                    async function verifyRaceStarts() {
                        const started = await page.waitForSelector(RACE_START_SELECTOR, {
                            timeout: 60000
                        });
                        if (!!started) {
                            const
                                msg = { alert: 'race has started' },
                                outpt = JSON.stringify(msg);
                            return console.log(output);
                        }
                        else {
                            return setTimeout(verifyRaceStarts, 10000);
                        }
                    }
                    return setTimeout(verifyRaceStarts, delay);
                }

                raceStarts();

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
                                    selection: SELECTION

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

            }, MATCHED_AMOUNT_SELECTOR, EVENT_TIME_STR, RACE_START_SELECTOR);

        // implement PLACEBET feature
        async function placeBet(SELECTION, TYPE, TARGET_ODDS, TARGET_LIQUIDITY) {
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
            // ensure runners selector available
            await page.waitForSelector(RUNNERS_SELECTOR, {
                timeout: 180000
            });

            // get RUNNERS
            await page.$$eval(RUNNERS_SELECTOR, (targets, SELECTION, TYPE) => {
                try {

                    targets.filter(target => {// filter for SELECTION
                        if (target.parentElement.parentElement.parentElement.parentElement.children[0].children[2].children[0].children[0].children[2].children[0].innerText == SELECTION) {
                            if (TYPE == 'bet') {
                                //not done
                                target.children[3].firstChild.click();
                                return true
                            }
                            else if (TYPE == 'lay') {
                                //not done
                                target.children[4].firstChild.click();
                                return true;
                            }
                            else {
                                return false;
                            }
                        }
                    });
                }
                catch (err) {
                    return Promise.reject(err);
                }
            }, SELECTION, TYPE);
            // ensure BET_SELECTOR available
            await page.waitForSelector(BET_SELECTOR, {
                timeout: 180000
            });

            // ensure RUNNER_NAME_SELECTOR available
            await page.waitForSelector(RUNNER_NAME_SELECTOR, {
                timeout: 180000
            });

            const runnerName = await page.$eval(RUNNER_NAME_SELECTOR, el => el.innerText);

            // confirm runnerName == SELECTION

            if (runnerName == SELECTION) {
                // ensure BET_VALUES_SELECTOR available
                await page.waitForSelector(BET_VALUES_SELECTOR, {
                    timeout: 180000
                });
                // ensure PRICE_INPUT_SELECTOR available
                await page.waitForSelector(PRICE_INPUT_SELECTOR, {
                    timeout: 180000
                });
                // set value of PRICE_INPUT_SELECTOR to TARGET_ODDS
                await page.$eval(PRICE_INPUT_SELECTOR, (el, TARGET_ODDS) => el.value = TARGET_ODDS, TARGET_ODDS);
                // ensure SIZE_INPUT_SELECTOR available
                await page.waitForSelector(SIZE_INPUT_SELECTOR, {
                    timeout: 180000
                });
                // select SIZE_INPUT_SELECTOR
                await page.click(SIZE_INPUT_SELECTOR);
                // set value of SIZE_INPUT_SELECTOR to TARGET_LIQUIDITY
                await page.type(SIZE_INPUT_SELECTOR, TARGET_LIQUIDITY.toString(), { delay: 100 });
                // ensure SUBMIT_BET_SELECTOR available
                await page.waitForSelector(SUBMIT_BET_SELECTOR, {
                    timeout: 180000
                });
                // submit the BET
                await page.click(SUBMIT_BET_SELECTOR);
                // wait 10 secs for results to be displayed
                await page.waitFor(10 * 1000);
                // take screenshot
                let timestamp = new Date();
                timestamp = timestamp.toISOString();
                const screenshotFile = `${SCREEN_SHOT_DIR}betfair-${SELECTION}-${TYPE}-${timestamp}.png`;
                const info = `${TYPE} ${SELECTION}`;
                await page.screenshot({
                    path: screenshotFile,
                    fullPage: true
                });
                // send msg to fire email
                const msg = {
                    info,
                    screenshot: screenshotFile
                };
                const output = JSON.stringify(msg);
                console.log(output);
                // CLOSE IN 10 SECS
                setTimeout(() => page.close(), 10000);
            }
            else {
                const err = new Error('runnerName != SELECTION');
                return Promise.reject(err);
            }
        }

        process.on('message', data => {
            const { selection, type, odds, liquidity } = data;
            return placeBet(selection, type, odds, '2.00');
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
