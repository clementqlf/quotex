const SPARQL_ENDPOINT = 'https://data.bnf.fr/sparql';

const query = `
PREFIX foaf: <http://xmlns.com/foaf/0.1/>
PREFIX dcterms: <http://purl.org/dc/terms/>
PREFIX bnf-onto: <http://data.bnf.fr/ontology/bnf-onto/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT DISTINCT ?role
WHERE {
  ?author foaf:name "Victor Hugo" .
  ?work bnf-onto:contribution ?contribution .
  ?contribution bnf-onto:contributor ?author ;
                bnf-onto:role ?role .
}
LIMIT 20
`;

async function run() {
    console.log('Querying BnF for roles...');
    const url = `${SPARQL_ENDPOINT}?query=${encodeURIComponent(query)}&format=json`;

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status} - ${response.statusText}`);
        }

        const data = await response.json();
        const results = data.results.bindings;

        console.log(`Found ${results.length} roles:`);
        results.forEach((binding, index) => {
            console.log(`${index + 1}. ${binding.role.value}`);
        });

    } catch (err) {
        console.error('Failed to query BnF:', err);
    }
}

run();
