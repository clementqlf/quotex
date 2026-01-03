
const authorName = "Jules Verne";
const query = `
        SELECT ?oeuvre ?title ?openLibraryID ?cover ?pubDate ?genres WHERE {
          {
            SELECT ?oeuvre (SAMPLE(?openLibraryID_val) as ?openLibraryID) (SAMPLE(?cover_val) as ?cover) (SAMPLE(?pubDate_val) as ?pubDate) (GROUP_CONCAT(DISTINCT ?genreLabel; separator=", ") as ?genres) 
            WHERE {
              # Auteur identifié par son nom
              ?auteur rdfs:label ?nomAuteur .
              FILTER(CONTAINS(LCASE(?nomAuteur), "${authorName.toLowerCase()}"))
              FILTER(LANG(?nomAuteur) = "fr")

              # Ses œuvres
              ?oeuvre wdt:P50 ?auteur .

              # Page Wikipédia en français (filtre de pertinence)
              ?article schema:about ?oeuvre ;
                       schema:isPartOf <https://fr.wikipedia.org/> .

              # Open Library ID (obligatoire)
              ?oeuvre wdt:P648 ?openLibraryID_val .

              # Données optionnelles
              OPTIONAL { ?oeuvre wdt:P18 ?cover_val. }
              OPTIONAL { ?oeuvre wdt:P577 ?pubDate_val. }
              
              # Genres (récupération manuelle du label pour group_concat)
              OPTIONAL { 
                ?oeuvre wdt:P136 ?genre. 
                ?genre rdfs:label ?genreLabel .
                FILTER(LANG(?genreLabel) = "fr")
              }
            }
            GROUP BY ?oeuvre
          }
          # Récupération explicite des labels pour éviter les QID
          OPTIONAL { ?oeuvre rdfs:label ?lblFr . FILTER(LANG(?lblFr) = "fr") }
          OPTIONAL { ?oeuvre rdfs:label ?lblEn . FILTER(LANG(?lblEn) = "en") }
          BIND(COALESCE(?lblFr, ?lblEn) AS ?title)
        }
        ORDER BY ?title
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
    console.log(`Found ${data.results.bindings.length} results`);
    data.results.bindings.slice(0, 10).forEach(b => {
        console.log(`- ${b.title?.value} (${b.oeuvre.value})`);
    });
}

test();
