export interface GeminiAnalysis {
  interpretation: string;
  theme: string;
}

export async function analyzeQuoteWithGemini(
  text: string,
  author: string,
  book: string
): Promise<GeminiAnalysis> {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured in Supabase secrets.");
  }

  const prompt = `
Tu es un expert littéraire, historien et critique littéraire chevronné. Analyse la citation suivante de manière concise, captivante et informative.

Détails de la citation :
- Citation : "${text}"
- Auteur : ${author}
- Livre : ${book}

Instructions pour ton analyse (à synthétiser en un seul paragraphe fluide de 3 à 5 phrases maximum en français) :
1. **Mise en contexte** : Remets brièvement la citation dans son contexte (l'intrigue du livre, l'époque historique ou la vie de l'auteur).
2. **Fact-checking (Vérification des faits)** : Si la citation contient des données chiffrées, des déclarations factuelles, historiques ou scientifiques, vérifie brièvement leur exactitude.
3. **Conséquences & Impact** : Mentionne l'impact historique, social ou littéraire qu'a eu ce livre ou cette citation s'il y en a eu.
4. **Liens & Parallèles** : Fais des parallèles pertinents avec d'autres œuvres, d'autres auteurs célèbres ou des mouvements littéraires/artistiques similaires.

Le ton doit être premium, hautement instructif, culturel et intellectuellement stimulant. Évite les banalités ou les généralités creuses.

Format de retour STRICT : Renvoie UNIQUEMENT un objet JSON valide sans aucun formatage Markdown (pas de blocs de code triples \`\`\`json ou \`\`\`), avec exactement cette structure :
{
  "interpretation": "Ton paragraphe d'analyse fluide ici...",
  "theme": "Le thème principal en 1-2 mots"
}
`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
        },
      }),
    }
  );

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${errText}`);
  }

  const data = await response.json();
  const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!textResponse) {
    throw new Error("Empty response from Gemini API.");
  }

  return JSON.parse(textResponse.trim()) as GeminiAnalysis;
}
