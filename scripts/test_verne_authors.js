
const authorName = "Jules Verne";
const query = `
SELECT ?auteur ?nomAuteur WHERE {
  ?auteur rdfs:label ?nomAuteur .
  FILTER(CONTAINS(LCASE(?nomAuteur), "${authorName.toLowerCase()}"))
  FILTER(LANG(?nomAuteur) = "fr")
  ?auteur wdt:P31 wd:Q5 .
}
`;

async function test() {
    const url = `https://query.wikidata.org/sparql?query=${encodeURIComponent(query)}&format=json`;
    const response = await fetch(url, {
        headers: {
            'User-Agent': 'Quotex/1.0',
            'Accept': 'application/sparql-results+json'
        }
    });
    const data = await response.json();
    console.log(`Found ${data.results.bindings.length} authors matching "${authorName}"`);
    data.results.bindings.forEach(b => {
        console.log(`- ${b.nomAuteur.value} (${b.auteur.value})`);
    });
}

test();
