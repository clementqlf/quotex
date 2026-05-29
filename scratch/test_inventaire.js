async function main() {
    try {
        const res = await fetch('https://neurbzkkfxrjzjykthtn.supabase.co/functions/v1/books');
        console.log(`GET /books Status:`, res.status);
        const text = await res.text();
        console.log(`GET /books Response:`, text.substring(0, 500));
        
        const books = JSON.parse(text);
        console.log(`Found ${books.length} books in DB.`);
        if (books.length === 0) return;
        
        // Find a book with an inventaireUri
        const bookWithUri = books.find(b => b.inventaireUri);
        if (!bookWithUri) {
            console.log("No book with inventaireUri found.");
            return;
        }
        
        console.log(`Selected book: "${bookWithUri.title}" (ID: ${bookWithUri.id}, Uri: ${bookWithUri.inventaireUri})`);
        
        const edUrl = `https://neurbzkkfxrjzjykthtn.supabase.co/functions/v1/books/${bookWithUri.id}/editions`;
        console.log(`Fetching editions from: ${edUrl}`);
        const edRes = await fetch(edUrl);
        console.log(`GET /books/:id/editions Status:`, edRes.status);
        const edText = await edRes.text();
        console.log(`GET /books/:id/editions Response:`, edText.substring(0, 1000));
    } catch(e) {
        console.error("Error:", e);
    }
}

main();
