import {Request, Response} from "express";
import axios, {AxiosError, AxiosResponse} from "axios";
import * as cheerio from "cheerio";
import {CheerioAPI} from "cheerio";
import {parse} from "csv-parse";
import * as fs from "fs";
import {configs} from "../configs";
import pLimit from "p-limit";
import {constants} from "../utils/constants";
import {Browser} from 'puppeteer';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import {initializeSearch} from "./search";
import {getMergedInputData} from "../utils/merge-input-data";


interface ScrapeResult {
    success: boolean;
    url: string;
    phoneNumbers?: string;
    socialMediaLinks?: string;
    addresses?: string;
    title?: string;
    error?: string;
    errorCode: string;
}


const axiosOptions = {
    headers: {
        "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
        Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        Connection: "keep-alive",
        "Upgrade-Insecure-Requests": "1",
    },
    timeout: configs.WEBSITE_READ_TIMEOUT,
};

const outputInFile = (fails: Map<string, ScrapeResult[]>, path: string) => {
    let failsString = "";
    fails.forEach(
        (value, key) =>
            (failsString += `${key}: ${value.length} error\n ${value.map((elem) => `${elem.url} -> ${elem.error}\n`)}\n`)
    );

    fs.writeFileSync(path, failsString);
};

const escapeCSVField = (field: string | undefined): string => {
    if (!field) return '';
    if (field.includes(',') || field.includes('"') || field.includes('\n')) {
        return `"${field.replace(/"/g, '""')}"`;
    }
    return field
};

const outputInFileSuccessCSV = (results: ScrapeResult[], path: string) => {
    const header = "domain,phoneNumbers,socialMediaLinks,addresses\n";
    const rows = results.map((elem) => {
        const url = elem.url.split(configs.HTTP_NON_SECURE)[1] || elem.url;
        const phoneNumbers = escapeCSVField(elem.phoneNumbers);
        const socialMediaLinks = escapeCSVField(elem.socialMediaLinks);
        const addresses = escapeCSVField(elem.addresses);
        return `${url},${phoneNumbers},${socialMediaLinks},${addresses}\n`;
    }).join('');
    fs.writeFileSync(path, header + rows);
};

const parseDomainsFromCsv = async (path: string): Promise<string[]> => {
    const domains: string[] = [];
    const stream = fs
        .createReadStream(path, "utf-8")
        .pipe(parse({columns: true, skip_empty_lines: true}));

    for await (const row of stream) {
        if (row.domain) {
            domains.push(configs.HTTP_NON_SECURE + row.domain);
        }
    }

    return domains;
};

const setOfPhoneNumbers = (textContent: string) => {
    return [...new Set(textContent.match(constants.phoneNumberRegex.default)?.map(
            (phoneNumber) => phoneNumber.replace(/[\n\r\t\s]+/g, ' ').trim())
        ?? [])];
}

const setOfSocialMediaLinks = ($: CheerioAPI) => {
    return [...new Set($('a[href]')
        .map((i, el) => $(el).attr('href'))
        .get()
        .filter(href =>
            href.match(constants.socialMediaRegex.default) && href.length < 100
        )?.map(link => link.replace(/[\n\r\t\s]+/g, ' ').trim()) || [])];
}

const setOfAddresses = (textContent: string) => {
    return [...new Set(textContent.match(constants.addressRegex.default)?.map(
            (address) => address.replace(/[\n\r\t\s]+/g, ' ').trim())
        ?? [])];
}

const handleContactPage = async ($: CheerioAPI, url: string) => {
    const possibleLinks = [...new Set($('a[href]')
        .map((i, el) => $(el).attr('href'))
        .get()
        .filter(href =>
            href.match(constants.contactPageRegex.default)
        ))];

    let contactAndAboutLinks = '';
    const finalLinks = possibleLinks.map(link => new URL(link, url).href);

    for (let link of finalLinks)
        contactAndAboutLinks += await axios.get(link, axiosOptions).then((response: AxiosResponse) => response.data).catch((error: AxiosError) => {
            return error;
        });

    const $contactPage = cheerio.load(contactAndAboutLinks ?? "");
    $contactPage('script, style').remove();
    const textContent = $contactPage('body').text();

    return {
        phoneNumbers: [...setOfPhoneNumbers(textContent)],
        socialMediaLinks: [...setOfSocialMediaLinks($contactPage)],
        addresses: [...setOfAddresses(textContent)]
    };
}

const parseTextFromPage = async (textContent: string, $: CheerioAPI, url: string) => {
    let phoneNumbers = [...setOfPhoneNumbers(textContent)];
    let socialMediaLinks = [...setOfSocialMediaLinks($)];
    let addresses = [...setOfAddresses(textContent)];

    const contactPageMatches = [...new Set(textContent.match(constants.contactPageRegex.default) || [])];
    const contactLinks = contactPageMatches.filter(elem => elem.length < 100); // remove long strings, likely not contact pages

    if (contactLinks.length > 0) {
        const contactAndAboutUsPages = await handleContactPage($, url);
        phoneNumbers = [...new Set([...phoneNumbers.map((number) => number.trim()),
            ...contactAndAboutUsPages.phoneNumbers.map((number) => number.trim())])];
        socialMediaLinks = [...new Set([...socialMediaLinks.map((link) => link.trim()),
            ...contactAndAboutUsPages.socialMediaLinks.map((link) => link.trim())])];
        addresses = [...new Set([...addresses.map((address) => address.trim()),
            ...contactAndAboutUsPages.addresses.map((address) => address.trim())])];
    }
    console.log("Success scraping: ", url);
    //clean up dataset and return it
    return {
        success: true,
        url,
        phoneNumbers: phoneNumbers.join(' | '),
        socialMediaLinks: socialMediaLinks.join(' | '),
        addresses: addresses.join(' | '),
        errorCode: ""
    };
}

const scrapePageWithPuppeteer = async (url: string, browser: Browser) => {
    try {
        const page = await browser.newPage()
        await page.setUserAgent(
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Safari/537.36'
        );
        await page.setExtraHTTPHeaders({
            'Accept-Language': 'en-US,en;q=0.9',
        });

        await page.goto(url, {waitUntil: 'networkidle2'});
        const puppeteerPage = await page.evaluate(() => document.body.innerHTML) ?? '';
        const $puppeteer = cheerio.load(puppeteerPage);
        $puppeteer('script, style').remove();
        return $puppeteer('body').text();
    } catch (error) {
        return '';
    }
};

const handleAndParseResponse = async (response: AxiosResponse, url: string, browser: Browser) => {
    const $ = cheerio.load(response.data);
    $('script, style').remove();
    let textContent = $('body').text();

    if (textContent.trim().length < 200) { // likely a page with JS, scrape with puppeteer
        textContent += await scrapePageWithPuppeteer(url, browser) ?? '';
    }

    return await parseTextFromPage(textContent, $, url);
}

const handleErrorAxios = (error: AxiosError, url: string) => {
    const errorMsg = error.message ?? "Unknown error";
    const errorCode: string = error?.code ?? "Unknown error";
    return ({success: false, url, error: errorMsg, errorCode});
}

export const scrape = async (req: Request, res: Response) => {
    const results: ScrapeResult[] = [];
    const fails: Map<string, ScrapeResult[]> = new Map();
    let failsCount = 0;

    puppeteer.use(StealthPlugin());
    const browser = await puppeteer.launch({
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-blink-features=AutomationControlled',
        ],
    });


    const limit = pLimit(configs.P_LIMIT);
    const urls: string[] = (await parseDomainsFromCsv(configs.COMPANIES_PATH));


    const promises = urls.map((url) =>
        limit(() =>
            axios
                .get(url, axiosOptions)
                .then((response) => {
                    return handleAndParseResponse(response, url, browser);
                })
                .catch((error) => {
                    return handleErrorAxios(error, url);
                })
        )
    );

    const outcomes = await Promise.all(promises);

    outcomes.forEach((outcome) => {
        if (outcome.success) {
            results.push(outcome);
        } else {
            if (!fails.has(outcome.errorCode)) {
                fails.set(outcome.errorCode, [outcome]);
            } else {
                fails.get(outcome.errorCode)?.push(outcome);
            }
            failsCount++;
        }
    });

    await browser.close();
    outputInFile(fails, configs.FAILED_OUTPUT_PATH);
    outputInFileSuccessCSV(results, configs.SUCCESS_OUTPUT_PATH);

    initializeSearch(await getMergedInputData());


    res.status(200).json({
        successCount: results.length,
        successPhoneNumbersCount: results.reduce((acc, curr) => acc + (curr.phoneNumbers ? 1 : 0), 0),
        socialMediaLinksCount: results.reduce((acc, curr) => acc + (curr.socialMediaLinks ? 1 : 0), 0),
        addressCount: results.reduce((acc, curr) => acc + (curr.addresses ? 1 : 0), 0),
        failCount: failsCount,
        successResults: results
    });

    console.log("Scraping completed");
    console.log("Results #:", results.length);
    console.log("Fails #:", failsCount);
};
