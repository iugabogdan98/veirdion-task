const os = require('os');

export const configs = {
    HTTP_NON_SECURE: "http://",
    HTTP_SECURE: "https://",
    P_LIMIT: os.cpus().length * 3,
    WEBSITE_READ_TIMEOUT: 23000,
    COMPANIES_PATH: './src/input/sample-websites.csv',
    COMPANIES_WITH_NAMES_PATH: './src/input/sample-websites-company-names.csv',
    SUCCESS_OUTPUT_PATH: './output/successful_scrapes.csv',
    FAILED_OUTPUT_PATH: './output/failed_requests_log.txt',
    OUTPUT_PATH: './output/',
}