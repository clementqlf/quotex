
import { searchInventaireWorks, getBestNativeCovers, getInventaireEntities } from './server/src/services/inventaire';

async function test() {
    const query = "Le Petit Prince";
    console.log("Searching for:", query);
    const searchResults = await searchInventaireWorks(query, 1);
    console.log("Search Result Image:", searchResults[0]?.image);

    const workUri = "wd:Q25338";
    console.log("\nTesting getBestNativeCovers for:", workUri);
    const bestCovers = await getBestNativeCovers([workUri]);
    console.log("Best Native Cover:", bestCovers[workUri]);

    console.log("\nFetching entity directly:", workUri);
    const entities = await getInventaireEntities([workUri]);
    const entity = entities[workUri];
    console.log("Entity image field:", JSON.stringify(entity?.image, null, 2));
}

test().catch(console.error);
