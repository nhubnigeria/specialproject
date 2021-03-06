//=============================================================================
'use strict';

//=============================================================================
// dependencies
const P = require('puppeteer');

// module variables
const
    EVENT_URL = 'https://www.betdaq.com/exchange/horse-racing/uk-racing/kempton-(23rd-march-2018)/17-45-kempton/4794257',
    SELECTIONS_CONTAINER_SELECTOR = 'table.dataTable.marketViewSelections',
    MATCHED_AMOUNT_SELECTOR = 'span.gep-matchedamount',
    FRAME_NAME = 'mainFrame';

async function bot() {
    // instantiate browser
    const browser = await P.launch({
        headless:true,
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

    await page.reload();

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

        page.on('console', data => console.log(data.text()))
        // bind to races container and lsiten for updates to , bets etc
        await frame.$eval(SELECTIONS_CONTAINER_SELECTOR,
            (target, MATCHED_AMOUNT_SELECTOR) => {
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

            }, MATCHED_AMOUNT_SELECTOR);

    } else {
        //will be executed when the frame not found
        console.log('Error, Frame not Found!!!');

    }
}

// execute scraper
bot()
    .catch(err => console.error(err));