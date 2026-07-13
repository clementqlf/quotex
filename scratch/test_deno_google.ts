const apiKey = "AIzaSyDNzlGWD0VYDwZHJcpn6BPTTf8pn1NZFBk";
const query = 'inauthor:"Nicolas Dufourcq"';
const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=20&langRestrict=fr&key=${apiKey}`;

console.log("Fetching with Deno standard fetch...");
try {
  const res = await fetch(url);
  console.log("Status without headers:", res.status);
} catch (e) {
  console.error("Error standard:", e);
}

console.log("Fetching with browser User-Agent...");
try {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
  });
  console.log("Status with browser UA:", res.status);
} catch (e) {
  console.error("Error browser UA:", e);
}

console.log("Fetching with Quotex User-Agent...");
try {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "QuotexApp/1.0 (contact: support@quotex.app)"
    }
  });
  console.log("Status with Quotex UA:", res.status);
} catch (e) {
  console.error("Error Quotex UA:", e);
}
