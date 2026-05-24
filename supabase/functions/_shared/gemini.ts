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

Tu es un expert littéraire, historien et critique intellectuel. Analyse la citation suivante de manière concise, captivante et informative, en te focalisant exclusivement sur la substance des arguments avancés dans le texte.

Détails de la citation :
- Citation : "${text}"
- Auteur : ${author}
- Livre : ${book}

Instructions pour ton analyse (à synthétiser en un seul paragraphe fluide de 3 à 5 phrases maximum en français) :
1. **Structure de départ OBLIGATOIRE** : Ne fais aucune introduction sur l'auteur ou le livre. Commence ton analyse immédiatement par une phrase analysant le sens intrinsèque de la citation (ex: "Cette citation...", "Ce propos dépeint...", "L'argument avancé ici...").
2. **Fact-checking et Rigueur historique** : C'est le point prioritaire. Analyse la validité des faits, des dates et des décisions juridiques mentionnées. Cite brièvement les réalités juridiques ou historiques contradictoires si la citation comporte des simplifications ou des inexactitudes factuelles. 
3. **Analyse de la portée** : Analyse la portée du propos sur le débat d'idées en soulignant comment cette rhétorique s'articule par rapport aux courants de pensée contemporains ou historiques, sans t'attarder sur le succès médiatique de l'œuvre.

Instructions impératives pour le champ "theme" :
Choisis OBLIGATOIREMENT l'un des thèmes suivants :
- Philosophie & Sagesse
- Amour & Relations
- Condition Humaine
- Temps & Mort
- Art & Littérature
- Politique & Société
- Liberté & Justice
- Bonheur & Existence
- Nature & Sciences
- Savoir & Vérité
- Destin & Choix

Format de retour STRICT : Renvoie UNIQUEMENT un objet JSON valide, sans aucun formatage Markdown (pas de blocs de code triples), avec exactement cette structure :
{
  "interpretation": "Ton paragraphe d'analyse fluide ici...",
  "theme": "Le thème choisi"
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

export async function chatAboutQuoteWithGemini(
  text: string,
  author: string,
  book: string,
  initialAnalysis: string,
  messages: { role: 'user' | 'model'; content: string }[]
): Promise<string> {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured in Supabase secrets.");
  }

  const systemPrompt = `Tu es un expert littéraire, historien et critique littéraire chevronné. 
L'utilisateur te pose des questions sur la citation suivante :
- Citation : "${text}"
- Auteur : ${author}
- Livre : ${book}

Tu as déjà fourni l'analyse initiale suivante :
"${initialAnalysis}"

Réponds de manière concise, captivante, premium et intellectuellement stimulante en français. Rédige une réponse fluide de 2 à 5 lignes maximum, sauf si l'utilisateur te demande explicitement des détails approfondis. Conserve un ton culturel, intelligent et accessible.`;

  // Format messages for Gemini API
  const contents = [
    {
      role: 'user',
      parts: [{ text: `Système: ${systemPrompt}\n\nCommençons la discussion.` }]
    },
    ...messages.map(m => ({
      role: m.role === 'model' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }))
  ];

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents,
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

  return textResponse.trim();
}
