const inspect = async () => {
  try {
    const quotesRes = await fetch('https://neurbzkkfxrjzjykthtn.supabase.co/functions/v1/quotes');
    const quotes = await quotesRes.json();
    
    const booksRes = await fetch('https://neurbzkkfxrjzjykthtn.supabase.co/functions/v1/books');
    const books = await booksRes.json();
    
    console.log(`=== QUOTES IN DATABASE (${quotes.length}) ===`);
    quotes.forEach(q => {
      console.log(`\nQuote ID: ${q.id}`);
      console.log(`Text: "${q.text.substring(0, 100)}..."`);
      const recs = q.blockData?.recommendedBooks || [];
      console.log(`Recommended Books (${recs.length}):`);
      recs.forEach(b => {
        const dbBook = books.find(db => Number(db.id) === Number(b.id));
        console.log(`  - ID: ${b.id}, Title: "${b.title}", Author: "${b.author}", Cover in Quote JSON: "${b.cover || 'none'}"`);
        if (dbBook) {
          console.log(`    -> MATCHED in DB! Title: "${dbBook.title}", Cover in DB: "${dbBook.cover || 'none'}", isEnriching: ${dbBook.isEnriching}`);
        } else {
          console.log(`    -> NOT MATCHED in DB!`);
        }
      });
    });
  } catch (e) {
    console.error(e);
  }
};
inspect();
