export interface BuyStore {
    name: string;
    generateUrl: (query: string) => string;
    priceLabel: string;
}

export const BUY_STORES: BuyStore[] = [
    {
        name: 'Amazon FR',
        generateUrl: (query: string) => `https://www.amazon.fr/s?k=${query}&i=stripbooks`,
        priceLabel: 'Voir'
    },
    {
        name: 'FNAC',
        generateUrl: (query: string) => `https://www.fnac.com/SearchResult/ResultList.aspx?Search=${query}`,
        priceLabel: 'Voir'
    },
    {
        name: 'AbeBooks',
        generateUrl: (query: string) => `https://www.abebooks.fr/servlet/SearchResults?kn=${query}`,
        priceLabel: 'Occasion'
    },
    {
        name: 'Alibris',
        generateUrl: (query: string) => `https://www.alibris.com/booksearch?keyword=${query}`,
        priceLabel: 'Rare'
    },
    {
        name: 'WorldCat',
        generateUrl: (query: string) => `https://www.worldcat.org/search?q=${query}`,
        priceLabel: 'Biblio'
    },
    {
        name: 'Indigo.ca',
        generateUrl: (query: string) => `https://www.indigo.ca/en-ca/search/?keywords=${query}`,
        priceLabel: 'Canada'
    },
    {
        name: 'Audible',
        generateUrl: (query: string) => `https://www.audible.fr/search?keywords=${query}`,
        priceLabel: 'Audio'
    },
    {
        name: 'Kobo',
        generateUrl: (query: string) => `https://www.kobo.com/fr/fr/search?query=${query}`,
        priceLabel: 'Ebook'
    },
    {
        name: 'Les Libraires',
        generateUrl: (query: string) => `https://www.leslibraires.fr/recherche/?q=${query}`,
        priceLabel: 'Indépendants'
    },
    {
        name: 'Google Books',
        generateUrl: (query: string) => `https://www.google.com/search?tbm=bks&q=${query}`,
        priceLabel: 'Numérique'
    }
];
