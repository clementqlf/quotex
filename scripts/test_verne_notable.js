
const authorName = "Jules Verne";
const query = `
      SELECT ?oeuvre ?oeuvreLabel ?article ?openLibraryID ?cover WHERE {
        ?hugo rdfs:label "${authorName}"@fr .
        ?hugo wdt:P31 wd:Q5 . # Ensure it's a human (Author)
        
        # Œuvres notables (P800)
        ?hugo wdt:P800 ?oeuvre .

        # Page Wikipédia en français de l'œuvre
        OPTIONAL {
          ?article schema:about ?oeuvre ;
                   schema:isPartOf <https://fr.wikipedia.org/> .
        }

        # Récupérer l'ID Open Library (P648)
        OPTIONAL { ?oeuvre wdt:P648 ?openLibraryID. }

        # Récupérer la couverture (P18)
        OPTIONAL { ?oeuvre wdt:P18 ?cover. }

        SERVICE wikibase:label { bd:serviceParam wikibase:language "fr,en". }
      }
      ORDER BY ?oeuvreLabel
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
    console.log(`NOTABLE_WORKS: ${data.results.bindings.length}`);
    data.results.bindings.forEach(b => {
        console.log(`TITLE: ${b.oeuvreLabel?.value} | QID: ${b.oeuvre.value}`);
    });
}

test();
