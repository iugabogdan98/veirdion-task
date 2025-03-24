import {Request, Response} from "express";
import {FullCompanyData} from "../utils/merge-input-data";
import MiniSearch from "minisearch";

let miniSearch: MiniSearch<FullCompanyData>;

export function initializeSearch(data: FullCompanyData[]) {
    miniSearch = new MiniSearch({
        fields: ['company_all_available_names', 'domain', 'phoneNumbers', 'socialMediaLinks'], // Searchable fields
        storeFields: [
            'company_commercial_name',
            'company_legal_name',
            'company_all_available_names',
            'domain',
            'phoneNumbers',
            'socialMediaLinks',
            'addresses'
        ],
        searchOptions: {
            boost: {
                domain: 4,
                company_all_available_names: 3,
                phoneNumbers: 1.5,
                socialMediaLinks: 1.5
            },
            fuzzy: 0.1,
            prefix: true,
            combineWith: 'OR'
        },
    });

    miniSearch.addAll(data.map((doc, id) => ({id, ...doc})));
    console.log('Search index initialized');
}

export async function searchCompany(query: {
    name?: string;
    website?: string;
    phoneNumber?: string;
    facebook?: string;
}): Promise<FullCompanyData> {
    const searchTerms: string[] = [];
    if (query.name) searchTerms.push(query.name);
    if (query.website) searchTerms.push(query.website);
    if (query.phoneNumber) searchTerms.push(query.phoneNumber);
    if (query.facebook) searchTerms.push(query.facebook);
    
    const result = miniSearch.search(searchTerms.join(' '))[0];
    return {
        company_commercial_name: result.company_commercial_name,
        company_legal_name: result.company_legal_name,
        company_all_available_names: result.company_all_available_names,
        domain: result.domain,
        phoneNumbers: result.phoneNumbers,
        socialMediaLinks: result.socialMediaLinks,
        addresses: result.addresses
    };
}

export const search = async (req: Request, res: Response) => {
    const {
        name,
        website,
        phoneNumber,
        facebook
    } = req.query as { name?: string, website?: string, phoneNumber?: string, facebook?: string };

    if (!name && !website && !phoneNumber && !facebook) {
        return res.status(400).json({error: 'At least one search parameter is required'});
    }

    try {
        const result = await searchCompany({
            name,
            website,
            phoneNumber,
            facebook
        });

        if (result) {
            res.json(result);
        } else {
            res.status(400).json({message: 'No matching company found'});
        }
    } catch (error) {
        res.status(500).json({error: 'Search failed'});
    }
};