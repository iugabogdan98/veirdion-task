import {Request, Response} from "express";
import axios, {AxiosError} from "axios";
import * as cheerio from "cheerio";
import {parse} from "csv-parse";
import * as fs from "fs";
import {configs} from "../configs";
import pLimit from "p-limit";


interface ScrapeResult {
    url: string;
    title?: string;
    error?: string;
}

const parseDomainsFromCsv = async (path: string): Promise<string[]> => {
    const domains: string[] = [];
    const stream = fs.createReadStream(path, "utf-8").pipe(
        parse({columns: true, skip_empty_lines: true})
    );

    for await (const row of stream) {
        if (row.domain) {
            domains.push(configs.HTTP_NON_SECURE + row.domain);
        }
    }

    return domains;
};

const outputFailsByCodeInFile = (fails: Map<string, ScrapeResult[]>) => {
    let failsString = '';
    fails.forEach((value, key) =>
        failsString += `${key}: ${value.length} error\n ${value.map(elem => `${elem.url} -> ${elem.error}\n`)}\n`);


    fs.writeFileSync("failed_requests_log.txt", failsString);
}

export const scrape = async (req: Request, res: Response) => {
    const results: ScrapeResult[] = [];
    const fails: Map<string, ScrapeResult[]> = new Map();

    const limit = pLimit(configs.P_LIMIT);


    const urls: string[] = (await parseDomainsFromCsv(configs.COMPANIES_PATH));

    const promises = urls.map(url =>
        limit(() =>
            axios.get(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.5',
                    'Connection': 'keep-alive',
                    'Upgrade-Insecure-Requests': '1',
                },
                timeout: configs.WEBSITE_READ_TIMEOUT,
            })
                .then(response => {
                    const $ = cheerio.load(response.data);
                    const title = $('title').text().trim();

                    results.push({url, title});
                    console.log(`Scraped ${url}: ${title}`);

                    return {url, title};
                })
                .catch(error => {
                    const errorMsg = error instanceof AxiosError ? error.message : "Unknown error";
                    const errorCode: string = error instanceof AxiosError ? (error?.code ?? "Unknown error") : "Unknown error";
                    const failValue = fails.get(errorCode) || [];
                    failValue.push({url, error: errorMsg})
                    fails.set(errorCode, failValue);
                    console.error(`Error scraping ${url}: ${errorMsg}`);
                })
        )
    );

    await Promise.all(promises);

    let failsCount = 0;
    fails.forEach(fail => failsCount += fail.length);

    res.status(200).json({
        successCount: results.length,
        failCount: failsCount,
        successResults: results
    });

    console.log('Scraping completed');
    console.log('Results #:', results.length);
    outputFailsByCodeInFile(fails);
}