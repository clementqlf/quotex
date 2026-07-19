import { analyzeQuoteWithGroq } from "../supabase/functions/_shared/groq.ts";

const apiKey = Deno.env.get("GROQ_API_KEY");
if (!apiKey) {
  console.error("ERREUR : La variable d'environnement GROQ_API_KEY n'est pas définie.");
  console.log("Veuillez l'exporter dans votre terminal avant de lancer le script :");
  console.log("  export GROQ_API_KEY=gsk_...");
  Deno.exit(1);
}

const testCases = [
  {
    name: "1. Citation valide complète",
    text: "Je pense, donc je suis",
    author: "René Descartes",
    book: "Discours de la méthode"
  },
  {
    name: "2. Citation avec attribution erronée / absurde",
    text: "Le Nutella est le moteur de la révolution industrielle",
    author: "Victor Hugo",
    book: "Les Misérables"
  },
  {
    name: "3. Citation connue sans auteur/livre",
    text: "Tout ce que je sais, c'est que je ne sais rien",
    author: "Inconnu",
    book: "Inconnu"
  },
  {
    name: "4. Réflexion anonyme cohérente",
    text: "La vie est parsemée de petits moments de joie qu'il faut savoir cueillir",
    author: "Inconnu",
    book: "Inconnu"
  },
  {
    name: "5. Charabia ou texte absurde sans auteur/livre",
    text: "asdfghjkl",
    author: "Inconnu",
    book: "Inconnu"
  }
];

console.log("=== DÉBUT DES TESTS DE VALIDATION GROQ ===");
for (const tc of testCases) {
  console.log(`\n---------------------------------------------\nTest : ${tc.name}`);
  console.log(`Entrées : \n - Citation : "${tc.text}"\n - Auteur : ${tc.author}\n - Livre : ${tc.book}`);
  
  try {
    const start = Date.now();
    const result = await analyzeQuoteWithGroq(tc.text, tc.author, tc.book);
    const duration = ((Date.now() - start) / 1000).toFixed(2);
    
    console.log(`Résultats (en ${duration}s) :`);
    console.log(` - Valide (isValid) : ${result.isValid}`);
    console.log(` - Thème : ${result.theme}`);
    console.log(` - Interprétation : "${result.interpretation}"`);
    console.log(` - Livres recommandés :`, JSON.stringify(result.recommendedBooks || []));
  } catch (err) {
    console.error(`Échec du test :`, err);
  }
}
console.log("\n=== FIN DES TESTS ===");
