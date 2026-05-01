
import { enrichWorkMetadata } from './server/src/services/inventaire';

async function test() {
    const uri = 'wd:Q2858882'; // Apprendre à finir
    console.log(`Testing enrichment for ${uri}...`);
    const result = await enrichWorkMetadata(uri);
    console.log('Result:', JSON.stringify(result, null, 2));
}

test().catch(console.error);
