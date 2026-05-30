const check = async () => {
  try {
    const res = await fetch('https://neurbzkkfxrjzjykthtn.supabase.co/functions/v1/quotes/167');
    const quote = await res.json();
    console.log("Quote blockData:");
    console.log(JSON.stringify(quote.blockData, null, 2));
  } catch (e) {
    console.error(e);
  }
};
check();
