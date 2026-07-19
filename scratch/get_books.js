const fetchBooks = async () => {
  try {
    const res = await fetch('https://neurbzkkfxrjzjykthtn.supabase.co/functions/v1/books');
    const books = await res.json();
    const targets = [8073, 8074, 8075, 8076];
    const filtered = books.filter(b => targets.includes(Number(b.id)));
    console.log(JSON.stringify(filtered, null, 2));
  } catch (e) {
    console.error(e);
  }
};
fetchBooks();
