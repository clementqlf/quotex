import { getBestNativeCovers, enrichWorkMetadata } from './server/src/services/inventaire';

async function test() {
    const workUri = "wd:Q25338"; // Le Petit Prince
    console.log("Testing getBestNativeCovers for:", workUri);
    const covers = await getBestNativeCovers([workUri]);
    console.log("Resulting Cover:", covers[workUri]);

    console.log("\nTesting enrichWorkMetadata for:", workUri);
    const result = await enrichWorkMetadata(workUri);
    console.log("Enriched image:", result.image);
    
    // Check for another book
    const workUri2 = "wd:Q43361"; // HP 1
    console.log("\nTesting getBestNativeCovers for:", workUri2);
    const covers2 = await getBestNativeCovers([workUri2]);
    console.log("HP 1 Cover:", covers2[workUri2]);
}

test().catch(console.error);
