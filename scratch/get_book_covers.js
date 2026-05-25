const checkCovers = async () => {
  try {
    const res = await fetch('https://neurbzkkfxrjzjykthtn.supabase.co/functions/v1/books');
    const books = await res.json();
    const targetIds = [3441, 3442, 3796, 3797];
    targetIds.forEach(id => {
      const b = books.find(x => x.id === id);
      if (b) {
        console.log(`Book ID ${id}: "${b.title}", Cover: "${b.cover || 'none'}"`);
      } else {
        console.log(`Book ID ${id} not found in all books`);
      }
    });
  } catch (e) {
    console.error(e);
  }
};
checkCovers();
