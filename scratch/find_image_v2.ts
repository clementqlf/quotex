import { getWorkEditionUris, getEditionsDetails } from './server/src/services/inventaire';

async function test() {
    const workUri = "wd:Q25338";
    const targetHash = "9537208d43654b509c9ecba0ce21d47598514a51";
    const edUris = await getWorkEditionUris(workUri);
    console.log("Found", edUris.length, "editions");
    
    // Fetch details in batches
    for (let i = 0; i < edUris.length; i += 30) {
        const chunk = edUris.slice(i, i + 30);
        const details = await getEditionsDetails(chunk);
        for (const ed of details) {
            if (ed.cover && ed.cover.includes(targetHash)) {
                console.log("!!! FOUND IT !!!");
                console.log("Edition:", ed.inventaireUri);
                console.log("Title:", ed.title);
                console.log("ISBN:", ed.isbn);
                return;
            }
        }
    }
    console.log("Did not find the hash in editions cover field.");
}

test().catch(console.error);
