export const constants = {
    phoneNumberRegex: {
        default: /\b(?:\+?\d{1,2}\s?)?\(?\d{2,4}\)?[-.\s]?\d{2,4}[-.\s]?\d{2,4}\b/g,
    },
    socialMediaRegex: {
        default: /https?:\/\/(www\.)?(twitter\.com|x\.com|facebook\.com|instagram\.com|youtube\.com|tiktok\.com|linkedin\.com|reddit\.com|pinterest\.com|snapchat\.com)(\/[A-Za-z0-9._%+-]+\/?)?/
    },
    contactPageRegex: {
        default: /.*(contact|about).*/i,
    }
}