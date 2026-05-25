const check = async () => {
  try {
    const res = await fetch('https://neurbzkkfxrjzjykthtn.supabase.co/functions/v1/quotes');
    const quotes = await res.json();
    console.log("Checking author 1306 in database via sql query directly...");
  } catch (e) {
    console.error(e);
  }
};
check();
