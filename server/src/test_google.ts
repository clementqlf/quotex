import { searchGoogleBooks } from './services/googleBooks';

async function test() {
    const books = await searchGoogleBooks("la maison vide laurent mauvignier");
    console.log(JSON.stringify(books[0], null, 2));
}

test().catch(console.error);
