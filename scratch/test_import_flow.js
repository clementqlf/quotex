async function importBook(bookData) {
    const url = 'https://neurbzkkfxrjzjykthtn.supabase.co/functions/v1/books/import';
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bookData)
    });
    console.log(`POST /books/import Status:`, response.status);
    const text = await response.text();
    try {
        return JSON.parse(text);
    } catch {
        console.log(`Response body:`, text);
        return null;
    }
}

async function getEditions(bookId) {
    const url = `https://neurbzkkfxrjzjykthtn.supabase.co/functions/v1/books/${bookId}/editions`;
    const response = await fetch(url);
    return await response.json();
}

async function main() {
    // We already imported the book "La Peste" under ID 4119, but it didn't have inventaireUri.
    // Now let's trigger import/update with the correct parameters so that it links and enriches it!
    const bookPayload = {
        title: "La Peste",
        inventaireUri: "wd:Q321156",
        cover: "https://inventaire.io/img/entities/4ea1ff2aff8ec604b2e3acd3aff4d88f94574782",
        authors: ["Albert Camus"],
        authorUris: ["wd:Q34670"]
    };
    
    console.log("--- Testing Import / Update of Book ---");
    const result = await importBook(bookPayload);
    if (result) {
        console.log(`Import Result: ID: ${result.id}, Title: "${result.title}", cover: "${result.cover}", genre: "${result.genre}", lastEnrichedAt: ${result.lastEnrichedAt}`);
        
        // Fetch editions of this book to verify they were inserted
        const eds = await getEditions(result.id);
        console.log(`Found ${eds.length} editions in DB for this book.`);
        if (eds.length > 0) {
            console.log(`First edition:`, JSON.stringify(eds[0], null, 2));
        }
    }
}

main();
