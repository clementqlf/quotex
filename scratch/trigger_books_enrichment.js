const trigger = async () => {
  const ids = [8073, 8074, 8075, 8076];
  for (const id of ids) {
    try {
      console.log(`Triggering GET /books/${id} to enrich...`);
      const res = await fetch(`https://neurbzkkfxrjzjykthtn.supabase.co/functions/v1/books/${id}`);
      console.log(`Status for ${id}:`, res.status);
      const data = await res.json();
      console.log(`Book ${id} title:`, data.title, `cover:`, data.cover);
    } catch (e) {
      console.error(`Error for ${id}:`, e);
    }
  }
};
trigger();
