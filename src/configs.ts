const os = require('os');

export const configs = {
    HTTP_NON_SECURE: "http://",
    HTTP_SECURE: "https://",
    P_LIMIT: os.cpus().length * 3,
    WEBSITE_READ_TIMEOUT: 20000,
    COMPANIES_PATH: './src/input/sample-websites.csv',
    COMPANIES_WITH_NAMES_PATH: './input/sample-websites-company-names.csv',
    OUTPUT_PATH: './output/',
}