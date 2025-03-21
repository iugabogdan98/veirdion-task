import {Request, Response} from "express";
import axios from "axios";
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

export const scrape = async (req: Request, res: Response) => {
    const results: ScrapeResult[] = [];
    const fails: ScrapeResult[] = [];
    const limit = pLimit(configs.P_LIMIT);


    const urls: string[] = await parseDomainsFromCsv(configs.COMPANIES_PATH);

    const promises = urls.map(url =>
        limit(() =>
            axios.get(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
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
                    const errorMsg = error instanceof Error ? error.message : "Unknown error";

                    fails.push({url, error: errorMsg});
                    console.error(`Error scraping ${url}: ${errorMsg}`);
                })
        )
    );

    await Promise.all(promises);

    res.status(200).json({
        successCount: results.length,
        failCount: fails.length,
        successResults: results
    });

    console.log('Scraping completed');
    console.log('Results #:', results.length);
    console.log('Fails #:', fails.length);
}