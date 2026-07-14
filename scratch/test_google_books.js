async function test() {
  const url = "https://books.google.com/books/content?id=Lx-LEQAAQBAJ&printsec=frontcover&img=1&zoom=1&edge=curl&source=gbs_api";
  try {
    const res = await fetch(url);
    console.log("Status:", res.status, res.statusText);
    console.log("Headers:", JSON.stringify(Object.fromEntries(res.headers.entries()), null, 2));
  } catch (e) {
    console.error("Failed:", e);
  }
}

test();
