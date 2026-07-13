const apiKey = "AIzaSyDNzlGWD0VYDwZHJcpn6BPTTf8pn1NZFBk";
const query = 'inauthor:"Nicolas Dufourcq"';

const urlWithAll = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=20&langRestrict=fr&key=${apiKey}`;

fetch(urlWithAll, {
  headers: {
    "User-Agent": "QuotexApp/1.0 (contact: support@quotex.app)"
  }
})
.then(res => {
  console.log("Status with User-Agent & langRestrict:", res.status);
  return res.text();
})
.then(text => {
  console.log("Response starts with:", text.slice(0, 300));
})
.catch(err => console.error("Error:", err));
