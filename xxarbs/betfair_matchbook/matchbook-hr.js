/**
 * created by Ajor on 27-03-2018
 */
//=============================================================================
'use strict';
if(process.env.NODE_ENV != 'production') {
  require('dotenv').config();
}
//=============================================================================
// dependencies
const P = require('puppeteer');

// module variables
const
  EMAIL = process.env.EMAIL,
  PWD = process.env.MATCHBOOK_PWD,
//   EVENT_URL = process.env.MATCHBOOK_URL,
  EVENT_URL = '',
  ACCESS_LOGIN_SELECTOR = '#mb-login-join-button',
  EMAIL_SELECTOR = 'body > div.ReactModalPortal > div > div > div > div.mb-modal__content > div > div.mb-login__section.mb-login__section--left > div.mb-login__container-form > span > div > form > div.mb-form__container-fields > div:nth-child(1) > div > input',
  PWD_SELECTOR = 'body > div.ReactModalPortal > div > div > div > div.mb-modal__content > div > div.mb-login__section.mb-login__section--left > div.mb-login__container-form > span > div > form > div.mb-form__container-fields > div:nth-child(2) > div > input',
  SHOW_PWD_SELECTOR = '',
  SIGNIN_BTN_SELECTOR = 'body > div.ReactModalPortal > div > div > div > div.mb-modal__content > div > div.mb-login__section.mb-login__section--left > div.mb-login__container-form > span > div > form > div.mb-form__container-buttons > a.mb-button.mb-button.mb-button--wider.mb-button--primary',
  SELECTIONS_CONTAINER_SELECTOR = '#app-next > div > div.mb-app__containerChildren > div > div > div.mb-event__markets.mb-event__markets--standalone > div:nth-child(1) > div.mb-market__runners',
  MATCHED_AMOUNT_SELECTOR = '#app-next > div > div.mb-app__containerChildren > div > div > div:nth-child(1) > div > div > span:nth-child(2)',
  RUNNERS_SELECTOR = '.mb-runner',
  BET_WIDGET_SELECTOR = '',
  BET_HEADER_SELECTOR = '',
  UP_ARROW_SELECTOR = '',
  PRICE_INPUT_SELECTOR = '',
  SIZE_INPUT_SELECTOR = '',
  SUBMIT_BET_SELECTOR = '',
  CONFIRM_SUBMIT_SELECTOR = '',
  SCREEN_SHOT_DIR = './screenshots/';

  // define scraper function

async function bot() {
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
  // navigate to EVENT_URL
  await page.goto(EVENT_URL, {
    waitUntil: 'networkidle2',
    timeout: 180000
  });
  // ensure ACCESS_LOGIN_SELECTOR is available
  await page.waitForSelector(ACCESS_LOGIN_SELECTOR);
  // click the button to access login
  await page.click(ACCESS_LOGIN_SELECTOR);
  // wait for EMAIL and PWD selectors to be available
  await page.waitForSelector(EMAIL_SELECTOR);
  await page.waitForSelector(PWD_SELECTOR);
  // enter email
  await page.type(EMAIL_SELECTOR, EMAIL, {delay: 100});
  await page.waitFor(2*1000);
  // click show pwd btn
  await page.click(SHOW_PWD_SELECTOR);
  //enter password
  await page.type(PWD_SELECTOR, PWD, {delay: 100});
  await page.waitFor(2*1000);
  // click login button
  await page.click(SIGNIN_BTN_SELECTOR);
  await page.waitFor(30*1000);
  // ensure race container selector available
  await page.waitForSelector(SELECTIONS_CONTAINER_SELECTOR, {
    timeout: 180000
  });
  // allow 'page' instance to output any calls to browser log to process obj
  page.on('console', data => process.send(data.text()));
  // bind to races container and lsiten for updates to odds, bets etc
  await page.$eval(SELECTIONS_CONTAINER_SELECTOR,
    (target, MATCHED_AMOUNT_SELECTOR) => {

        const observer = new MutationObserver((mutations) => {
            mutations.forEach(function (ed) {
                const e = {
                    mutation: ed,
                    el: ed.target,
                    value: ed.target.textContent,
                    oldValue: ed.oldValue
                };

                let
                    betType,
                    odds,
                    liquidity,
                    SELECTION;
                SELECTION = e.el.parentElement.children[0].innerText;

                if ((e.el.children[1].className == 'mb-price__odds') && (e.el.className == 'mb-price mb-price--back  mb-price--level0 ')) {
                    betType = 'b0';
                    odds = e.el.children[1].textContent;
                    liquidity = e.el.children[2].textContent;

                }
                else if ((e.el.children[1].className == 'mb-price__odds') && (e.el.className == 'mb-price mb-price--lay  mb-price--level0 ')) {

                    betType = 'l0';
                    odds = e.el.children[1].textContent;
                    liquidity = e.el.children[2].textContent;
                }
                else if ((e.el.children[0].className == 'mb-price__odds') && (e.el.className == 'mb-price mb-price--back  mb-price--level1 ')) {
                    betType = 'b1';
                    odds = e.el.children[0].textContent;
                    liquidity = e.el.children[1].textContent;

                }
                else if ((e.el.children[0].className == 'mb-price__odds') && (e.el.className == 'mb-price mb-price--lay  mb-price--level1 ')) {
                    betType = 'l1';
                    odds = e.el.children[0].textContent;
                    liquidity = e.el.children[1].textContent;


                }
                else if ((e.el.children[0].className == 'mb-price__odds') && (e.el.className == 'mb-price mb-price--back  mb-price--level2 ')) {
                    betType = 'b2';
                    odds = e.el.children[0].textContent;
                    liquidity = e.el.children[1].textContent;

                }
                else if ((e.el.children[0].className == 'mb-price__odds') && (e.el.className == 'mb-price mb-price--lay  mb-price--level2 ')) {
                    betType = 'l2';
                    odds = e.el.children[0].textContent;
                    liquidity = e.el.children[1].textContent;

                }
                else if ((e.el.children[2].className == 'mb-price__amount') && (e.el.className == 'mb-price mb-price--back  mb-price--level0 ')) {
                    betType = 'b0';
                    odds = e.el.children[1].textContent;
                    liquidity = e.el.children[2].textContent;

                }
                else if ((e.el.children[2].className == 'mb-price__amount') && (e.el.className == 'mb-price mb-price--lay  mb-price--level0 ')) {
                    betType = 'l0';
                    odds = e.el.children[1].textContent;
                    liquidity = e.el.children[2].textContent;

                }
                else if ((e.el.children[2].className == 'mb-price__amount') && (e.el.className == 'mb-price mb-price--back  mb-price--level1 ')) {
                    betType = 'b1';
                    odds = e.el.children[1].textContent;
                    liquidity = e.el.children[2].textContent;


                }
                else if ((e.el.children[2].className == 'mb-price__amount') && (e.el.className == 'mb-price mb-price--lay  mb-price--level1 ')) {
                    betType = 'l1';
                    odds = e.el.children[1].textContent;
                    liquidity = e.el.children[2].textContent;

                }
                else if ((e.el.children[2].className == 'mb-price__amount') && (e.el.className == 'mb-price mb-price--back  mb-price--level2 ')) {
                    betType = 'b2';
                    odds = e.el.children[1].textContent;
                    liquidity = e.el.children[2].textContent;

                }
                else if ((e.el.children[2].className == 'mb-price__amount') && (e.el.className == 'mb-price mb-price--lay  mb-price--level2 ')) {
                    betType = 'l2';
                    odds = e.el.children[1].textContent;
                    liquidity = e.el.children[2].textContent;

                }

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
                        selection: SELECTION.replace(/\d|\n/g, ''),

                    };
                    //convert data JSON before outputting it
                    const output = JSON.stringify(data);
                    console.log(output);
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


  // implement PLACEBET feature
}

// execute scraper
bot()
  .catch(err => console.error(err));
//=============================================================================
