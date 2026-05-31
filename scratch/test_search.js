async function main() {
  const url = 'https://neurbzkkfxrjzjykthtn.supabase.co/functions/v1/search?q=9782070360598';
  console.log("Using API_BASE_URL:", url);

  try {
    const res = await fetch(url);
    console.log("Status:", res.status);
    const data = await res.json();
    console.log(JSON.stringify(data, null, 2));
  } catch(e) {
    console.error(e);
  }
}
main();
