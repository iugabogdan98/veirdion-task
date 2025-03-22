import {Request, Response} from "express";
import axios, {AxiosError, AxiosResponse} from "axios";
import * as cheerio from "cheerio";
import {CheerioAPI} from "cheerio";
import {parse} from "csv-parse";
import * as fs from "fs";
import {configs} from "../configs";
import pLimit from "p-limit";
import {constants} from "../constants";

interface ScrapeResult {
    success: boolean;
    url: string;
    phoneNumbers?: string;
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

const outputFailsByCodeInFile = (fails: Map<string, ScrapeResult[]>) => {
    let failsString = "";
    fails.forEach(
        (value, key) =>
            (failsString += `${key}: ${value.length} error\n ${value.map((elem) => `${elem.url} -> ${elem.error}\n`)}\n`)
    );

    fs.writeFileSync("failed_requests_log.txt", failsString);
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


const handleContactPage = async ($: CheerioAPI, url: string) => {
    const possibleLinks = $('a[href]')
        .map((i, el) => $(el).attr('href'))
        .get()
        .filter(href =>
            href.match(constants.contactPageRegex.default)
        );

    const finalLink = possibleLinks.map(link => new URL(link, url).href)[0];

    const contactPage = await axios.get(url, axiosOptions).then((response: AxiosResponse) => response.data).catch((error: AxiosError) => {
        console.log('Ignoring Error fetching contact page: ', finalLink);
        return error;
    });

    const $contactPage = cheerio.load(contactPage ?? "");
    $contactPage('script, style').remove();
    const textContent = $contactPage('body').text();

    return [...new Set(textContent.match(constants.phoneNumberRegex.default) || [])];
}

const handleAndParseResponse = async (response: AxiosResponse, url: string) => {
    const $ = cheerio.load(response.data);
    // Remove script and style elements to clean up the content
    $('script, style').remove();
    const textContent = $('body').text();

    let phoneNumbers = [...new Set(textContent.match(constants.phoneNumberRegex.default) || [])];

    const contactPageMatches = [...new Set(textContent.match(constants.contactPageRegex.default) || [])];
    const contactLinks = contactPageMatches.filter(elem => elem.length < 20); // remove long strings, likely not contact pages

    if (contactLinks.length > 0) {
        const phoneNumbersContactPage = await handleContactPage($, url);
        phoneNumbers = [...new Set([...phoneNumbers.map((number) => number.trim()), ...phoneNumbersContactPage.map((number) => number.trim())])];
    }

    return {success: true, url, phoneNumbers: phoneNumbers.toString(), errorCode: ""};
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

    const limit = pLimit(configs.P_LIMIT);
    const urls: string[] = (await parseDomainsFromCsv(configs.COMPANIES_PATH))
    // .splice(0, 100);


    const promises = urls.map((url) =>
        limit(() =>
            axios
                .get(url, axiosOptions)
                .then((response) => {
                    return handleAndParseResponse(response, url);
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

    res.status(200).json({
        successCount: results.length,
        successPhoneNumbersCount: results.reduce((acc, curr) => acc + (curr.phoneNumbers ? 1 : 0), 0),
        failCount: failsCount,
        successResults: results
    });

    console.log("Scraping completed");
    console.log("Results #:", results.length);
    console.log("Fails #:", failsCount);
    outputFailsByCodeInFile(fails);
};
