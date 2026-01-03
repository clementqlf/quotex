
import { searchExternalAuthors } from './services/externalAuthor';

async function main() {
    try {
        console.log("Starting search for 'Victor Hugo'...");
        const results = await searchExternalAuthors("Victor Hugo");
        console.log("Results:", JSON.stringify(results, null, 2));
    } catch (e) {
        console.error("Error:", e);
    }
}

main();
