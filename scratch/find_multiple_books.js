const findBooks = async () => {
  try {
    const res = await fetch('https://neurbzkkfxrjzjykthtn.supabase.co/functions/v1/books');
    const books = await res.json();
    const matched = books.filter(b => b.title.includes('Identité') || b.title.includes('Occident') || b.title.includes('Condition'));
    console.log("Matched books total:", matched.length);
    matched.forEach(b => {
      console.log(`- ID: ${b.id}, Title: "${b.title}", Cover: "${b.cover || 'none'}"`);
    });
  } catch (e) {
    console.error(e);
  }
};
findBooks();
