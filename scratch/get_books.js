const fetchBooks = async () => {
  try {
    const res = await fetch('https://neurbzkkfxrjzjykthtn.supabase.co/functions/v1/books');
    const books = await res.json();
    console.log("Found", books.length, "books");
    books.forEach(b => {
      console.log(`- Title: "${b.title}", Cover: "${b.cover || 'none'}"`);
    });
  } catch (e) {
    console.error(e);
  }
};
fetchBooks();
