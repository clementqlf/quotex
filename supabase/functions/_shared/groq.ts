// Définition des interfaces
export interface RecommendedBook {
  title: string;
  author: string;
}

export interface AnalysisResult {
  interpretation: string;
  theme: string;
  recommendedBooks?: RecommendedBook[];
}

export async function analyzeQuoteWithGroq(
  text: string,
  author: string,
  book: string
): Promise<AnalysisResult> {
  const apiKey = Deno.env.get("GROQ_API_KEY");
  if (!apiKey) {
    throw new Error("GROQ_API_KEY is not configured in Supabase secrets.");
  }

  const prompt = `Tu es un expert littéraire, historien et critique intellectuel. Analyse la citation suivante de manière concise, captivante et informative, en te focalisant exclusivement sur la substance des arguments avancés dans le texte.

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

Instructions pour le champ "recommendedBooks" :
Propose une liste de 5 à 7 livres recommandés (d'auteurs différents de préférence, ou d'autres œuvres majeures du même auteur si c'est particulièrement pertinent) qui traitent du même sujet ou approfondissent les thématiques ou courants d'idées abordés dans la citation. Pour chaque livre, indique uniquement le titre exact ("title") et le nom de l'auteur ("author").

Format de retour STRICT : Renvoie UNIQUEMENT un objet JSON valide, sans aucun formatage Markdown (pas de blocs de code triples), avec exactement cette structure :
{
  "interpretation": "Ton paragraphe d'analyse fluide ici...",
  "theme": "Le thème choisi",
  "recommendedBooks": [
    {
      "title": "Titre du livre recommandé",
      "author": "Nom de l'auteur"
    }
  ]
}
`;

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: "Tu es un expert littéraire et critique intellectuel. Tu réponds toujours en JSON strict sans aucun formatage Markdown." },
        { role: "user", content: prompt }
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Groq API error: ${response.status} - ${errText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("Empty response from Groq API.");
  }

  return JSON.parse(content) as AnalysisResult;
}

export async function chatAboutQuoteWithGroq(
  text: string,
  author: string,
  book: string,
  initialAnalysis: string,
  messages: { role: 'user' | 'model'; content: string }[]
): Promise<string> {
  const apiKey = Deno.env.get("GROQ_API_KEY");
  if (!apiKey) {
    throw new Error("GROQ_API_KEY is not configured in Supabase secrets.");
  }

  const systemPrompt = `Tu es un expert littéraire, historien et critique littéraire chevronné. 
L'utilisateur te pose des questions sur la citation suivante :
- Citation : "${text}"
- Auteur : ${author}
- Livre : ${book}

Tu as déjà fourni l'analyse initiale suivante :
"${initialAnalysis}"

Réponds de manière concise, captivante, premium et intellectuellement stimulante en français. Rédige une réponse fluide de 2 à 5 lignes maximum, sauf si l'utilisateur te demande explicitement des détails approfondis. Conserve un ton culturel, intelligent et accessible.`;

  const formattedMessages = [
    { role: 'system', content: systemPrompt },
    ...messages.map(m => ({
      role: m.role === 'model' ? 'assistant' : 'user',
      content: m.content
    }))
  ];

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: formattedMessages,
      temperature: 0.7
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Groq API error: ${response.status} - ${errText}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() || "";
}