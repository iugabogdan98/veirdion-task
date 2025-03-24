import fs from "fs";
import {parse} from "csv-parse";
import {configs} from "../configs";

interface ContactData {
    domain: string;
    phoneNumbers?: string;
    socialMediaLinks?: string;
    addresses?: string;
}

interface CompanyNameData {
    domain: string,
    company_commercial_name?: string,
    company_legal_name?: string,
    company_all_available_names?: string,
}

export interface FullCompanyData extends CompanyNameData, ContactData {
}

const parseCompanyNamesData = async (path: string): Promise<CompanyNameData[]> => {
    const companyNameData: CompanyNameData[] = [];
    const stream = fs.createReadStream(path, "utf-8")
        .pipe(parse({columns: true, skip_empty_lines: true}));

    for await (const row of stream) {
        if (row)
            companyNameData.push(row as CompanyNameData);
    }

    return companyNameData;

}

const parseScrapedDataFromCsv = async (path: string): Promise<ContactData[]> => {
    const contactData: ContactData[] = [];
    let stream
    try {
        stream = fs.createReadStream(path, "utf-8")
            .pipe(parse({columns: true, skip_empty_lines: true}));
    } catch (e) {
        console.error('No output file, first run /scrape endpoint to rebuild it:', e);
        return [];
    }
    for await (const row of stream) {
        if (row)
            contactData.push(row as ContactData);
    }

    return contactData;
};

export const mergeCompanyData = (companyNameData: CompanyNameData[], contactData: ContactData[]): FullCompanyData[] => {

    return companyNameData.map((nameData) => {
        const contact = contactData.find((contact) => contact?.domain?.trim() === nameData?.domain?.trim());
        return {
            ...nameData,
            phoneNumbers: contact?.phoneNumbers ?? '',
            socialMediaLinks: contact?.socialMediaLinks ?? '',
            addresses: contact?.addresses ?? '',
        }
    })
}


export const getMergedInputData = async () => {
    const contactData = await parseScrapedDataFromCsv(configs.SUCCESS_OUTPUT_PATH);
    const companyNamesData = await parseCompanyNamesData(configs.COMPANIES_WITH_NAMES_PATH);
    return mergeCompanyData(companyNamesData, contactData);
}