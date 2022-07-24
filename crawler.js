const puppeteer = require("puppeteer-extra")
const StealthPlugin = require('puppeteer-extra-plugin-stealth')
const fs = require('fs');
const os = require("os");
const path = require('path');
var dateTime = require('node-datetime');
const website_url = "https://hempelf.com";

const readEnvVars = () => fs.readFileSync('envf', "utf-8").split("\n");
const getEnvValue = (key) => {
    const matchedLine = readEnvVars().find((line) => line.split("=")[0] === key);
    return matchedLine !== undefined ? matchedLine.split("=")[1].replace(/\r?\n|\r/g, "") : null;
};

function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

var browserWSEndpoint = '';

; (async () => {
    try {
        console.log('Started');
        puppeteer.use(StealthPlugin());
        const browser = await puppeteer.launch({headless: false, args: ['--no-sandbox']});
        const page = await browser.newPage();

        await page.setDefaultNavigationTimeout(60000);
        browserWSEndpoint = browser.wsEndpoint();

        console.log('Navigating to URL');
        await page.goto(website_url, {waitUntil: 'networkidle0'});
        await sleep(getSleepTime(2000, 5000));

        let age_limit_check = await page.evaluate(() => {
            let el = document.querySelector("#age-check-prompt");
            return el ? el.src : "";
        })

        if (age_limit_check != "") {
            console.log("Age Prompt appeared");
            const [button] = await page.$x('//*[@id="submit_birthdate"]');
            if (button) {
                await button.click();
            }
        }

        await sleep(getSleepTime(2000, 4000));

        await page.evaluate(() => {
            window.scrollTo(0, 1900);
        });

        await sleep(getSleepTime(4000, 8000));

        let email_modal_blocker = await page.evaluate(() => {
            let el = document.querySelectorAll(".jquery-modal.blocker.current")
            return el ? el.src : ""
        });

        if (email_modal_blocker != "") {
            console.log("Email for coupon modal prompt");
            const [button] = await page.$x('//*[@id="ex1"]/a');
            if (button) {
                await button.click();
            }
        }

        const homepage_items = await page.evaluate(() => {
            return Array.from(document.querySelector('.grid.grid--uniform.grid--view-items').children);
        })

        console.log("Result:", homepage_items.length);
        let noProductsToScan = getSleepTime(parseInt(getEnvValue("minProduct")), parseInt(getEnvValue("maxProduct")));
        console.log("Adding " + noProductsToScan + " products to cart");
        var productsArray = [];
        for (let i = 1; i <= noProductsToScan; i++) {
            let randomProduct = getSleepTime(0, homepage_items.length - 1);
            if (productsArray.includes(randomProduct)) {
                i--;
            } else {
                productsArray.push(randomProduct);
            }
        }

        console.log("Scanning products :" + productsArray);
        for (product of productsArray) {
            await page.bringToFront();
            console.log("Opening Product: " + product)
            await sleep(getSleepTime(1000, 3000));
            let el = homepage_items[product];
            await page.evaluate(selector => {
                const scrollableSection = selector;
                scrollableSection.scrollTop = scrollableSection.offsetHeight;
            }, el);

            console.log("Opening product in new page");
            let options = {button: 'middle'};
            await page.click(".grid.grid--uniform.grid--view-items > div:nth-of-type(" + product + ")", options);
            await sleep(5000);
            let pages = await browser.pages();
            let page2 = pages[2];
            await page2.bringToFront();

            console.log(page2.url());
            await sleep(2000);


            let [add_to_cart_btn] = await page2.$x('//*[@id="AddToCart-product-template"]');
            if (add_to_cart_btn) {
                await page2.evaluate(selector => {
                    const scrollableSection = selector;
                    scrollableSection.scrollTop = scrollableSection.offsetHeight;
                }, add_to_cart_btn);
                await sleep(2000, 4000);
                await add_to_cart_btn.click();
                await sleep(getSleepTime(5000, 8000));
                console.log("Product :" + product + " added to cart successfully");
            }

            [add_to_cart_btn] = await page2.$x('//*[@id="AddToCart-product-template-w-tables"]');
            if (add_to_cart_btn) {
                await page2.evaluate(selector => {
                    const scrollableSection = selector;
                    scrollableSection.scrollTop = scrollableSection.offsetHeight;
                }, add_to_cart_btn);
                await sleep(2000, 4000);
                await add_to_cart_btn.click();
                await sleep(getSleepTime(5000, 8000));
                console.log("Product :" + product + " added to cart successfully");
            }


            await page2.close();
        }

        await page.reload({waitUntil: ["networkidle0", "domcontentloaded"]});

        await sleep(getSleepTime(2000, 3000));
        console.log("Navigating to checkout page");

        let [button] = await page.$x('//*[@id="burger"]');
        if (button) {
            await button.click();
        }

        await sleep(getSleepTime(3000, 7000));
        console.log("Clicking checkout button");
        [button] = await page.$x('//*[@id="nav"]/div/div[3]/div[3]/a');
        await Promise.all([
            await button.click(),
            await page.waitForNavigation({waitUntil: 'networkidle0'}),
        ]);

        console.log("Clicking 2nd checkout button");
        [button] = await page.$x('//*[@id="shopify-section-cart-template"]/div[1]/div[2]/div[1]/div[2]/div[2]/div/a[2]');
        let [i_agree_checkbox] = await page.$x('//*[@id="agree"]');
        await Promise.all([
            await i_agree_checkbox.click(),
            await sleep(2000),
            await button.click(),
            await page.waitForNavigation({waitUntil: 'networkidle0'}),
        ]);

        console.log("Completed Successfully");
        console.log("Terminating");
        await sleep(10000);
        fs.writeFileSync('.last', dateTime.create().format('Y-m-d H:M:S'));
        process.exit();
    }
    catch (e) {
        console.log(e);
        fs.writeFileSync('.last',"Error Occured Excel Scrapper :"+ dateTime.create().format('Y-m-d H:M:S'));
        process.exit();
    }
})();


function getSleepTime(min, max) {
    return Math.ceil(Math.random() * (max - min) ) + min;
}
