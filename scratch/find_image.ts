import { getWorkEditionUris, getEditionsDetails } from './server/src/services/inventaire';

async function test() {
    const workUri = "wd:Q25338";
    const edUris = await getWorkEditionUris(workUri);
    console.log("Found", edUris.length, "editions");
    
    // Fetch details in batches
    for (let i = 0; i < edUris.length; i += 20) {
        const chunk = edUris.slice(i, i + 20);
        const details = await getEditionsDetails(chunk);
        for (const ed of details) {
            if (ed.cover) {
                console.log("Edition:", ed.inventaireUri, "Cover:", ed.cover);
                if (ed.cover.includes("9537208d43654b509c9ecba0ce21d47598514a51")) {
                    console.log("!!! FOUND IT !!!");
                }
            }
        }
    }
}

test().catch(console.error);
