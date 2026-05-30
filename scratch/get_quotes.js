const fetchQuotes = async () => {
  try {
    const res = await fetch('https://neurbzkkfxrjzjykthtn.supabase.co/functions/v1/quotes');
    const quotes = await res.json();
    console.log("Found", quotes.length, "quotes");
    quotes.slice(0, 5).forEach(q => {
      console.log(`- Quote ID: ${q.id}, Text snippet: "${q.text.substring(0, 60)}...", Has AI Interpretation: ${!!q.aiInterpretation}`);
      if (q.blockData?.recommendedBooks) {
        console.log("  Recommended books:", JSON.stringify(q.blockData.recommendedBooks, null, 2));
      }
    });
  } catch (e) {
    console.error(e);
  }
};
fetchQuotes();
