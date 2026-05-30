const check = async () => {
  try {
    const res = await fetch('https://neurbzkkfxrjzjykthtn.supabase.co/functions/v1/quotes');
    const quotes = await res.json();
    quotes.forEach(q => {
      console.log(`Quote ID: ${q.id}`);
      console.log(`Interpretation: "${q.aiInterpretation || 'none'}"`);
      console.log(`Recommended Books in blockData:`);
      console.log(JSON.stringify(q.blockData?.recommendedBooks, null, 2));
      console.log('-----------------');
    });
  } catch (e) {
    console.error(e);
  }
};
check();
