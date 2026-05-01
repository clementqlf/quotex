import { findWorkUriByTitleAndAuthor, enrichWorkMetadata } from './services/inventaire';

async function test() {
    console.log('Searching for URI...');
    const uri = await findWorkUriByTitleAndAuthor("la maison vide", "laurent mauvignier");
    console.log('URI Found:', uri);
    
    if (uri) {
        console.log('Enriching work metadata...');
        const result = await enrichWorkMetadata(uri);
        console.log('Result:', JSON.stringify(result, null, 2));
    }
}

test().catch(console.error);
