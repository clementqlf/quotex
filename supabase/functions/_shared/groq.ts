// Définition des interfaces
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

export interface RecommendedBook {
  title: string;
  author: string;
}

const AnalysisResultSchema = z.object({
  isValid: z.boolean(),
  interpretation: z.string().min(10),
  theme: z.enum([
    "Philosophie & Sagesse", "Amour & Relations", "Condition Humaine", 
    "Temps & Mort", "Art & Littérature", "Politique & Société", 
    "Liberté & Justice", "Bonheur & Existence", "Nature & Sciences", 
    "Savoir & Vérité", "Destin & Choix"
  ]),
  recommendedBooks: z.array(z.object({
    title: z.string().min(1),
    author: z.string().min(1)
  })).max(7).optional()
});

// ✅ Type inféré depuis le schéma — jamais de désynchronisation
export type AnalysisResult = z.infer<typeof AnalysisResultSchema>;

const fallbackAnalysis: AnalysisResult = {
  isValid: true,
  interpretation: "Analyse indisponible.",
  theme: "Savoir & Vérité",
  recommendedBooks: []
};

export async function analyzeQuoteWithGroq(
  text: string,
  author: string,
  book: string
): Promise<AnalysisResult> {
  const apiKey = Deno.env.get("GROQ_API_KEY");
  if (!apiKey) {
    console.warn('[Groq] API key missing, returning fallback analysis');
    return fallbackAnalysis;
  }

  const prompt = `Tu es un expert multidisciplinaire (littérature, histoire, philosophie, politique et économie) et critique intellectuel. Analyse la citation suivante de manière rigoureuse.

Détails de la citation :
- Citation : "${text}"
- Auteur : ${author}
- Livre : ${book}

Instructions de validation de la citation (RÈGLES DE VALIDITÉ) :
1. Évalue si la citation est valide en renseignant le champ "isValid" (true/false) :
   - Si la citation est absurde ("ubuesque"), manifestement factice, erronée ou faussement attribuée à l'auteur ou au livre spécifié : "isValid" doit être false.
   - Si l'auteur et/ou le livre sont "Inconnu" :
     - Si le texte de la citation correspond à une citation célèbre ou à un proverbe connu : "isValid" doit être true. Mentionne l'auteur et le livre réels dans l'analyse.
     - Si le texte est une réflexion cohérente d'intérêt général (sans auteur célèbre) : "isValid" doit être true. Analyse le sens de manière générale sans forcer d'attribution.
     - Si le texte est un charabia, un texte vide, incompréhensible, absurde ou trop court (ex: "abc", "test", "lol", etc.) : "isValid" doit être false.
   - Sinon, si la citation est correcte et correspond bien à l'auteur et au livre indiqués : "isValid" doit être true.

Instructions pour ton champ "interpretation" (en français) :
- Si "isValid" est true (citation valide), respecte STRICTEMENT ces instructions (à synthétiser en un seul paragraphe fluide de 3 à 5 phrases maximum en français) :
  - **Adaptation du ton** : Adapte ton ton et tes critères à la nature de la citation. S'il s'agit d'un essai politique, économique, historique ou d'actualité, privilégie le fact-checking, la logique rationnelle de l'argument et la véracité des faits, plutôt qu'une analyse de style esthétique ou purement philosophique.
  1. **Structure de départ OBLIGATOIRE** : Ne fais aucune introduction sur l'auteur ou le livre. Commence ton analyse immédiatement par une phrase analysant le sens intrinsèque ou l'argument de la citation (ex: "Cette citation...", "Ce propos avance...", "L'argument économique/politique présenté ici...").
  2. **Fact-checking et Rigueur des faits** : C'est le point prioritaire. Analyse la validité des faits, des chiffres, des dates, des concepts économiques/politiques et des décisions mentionnées. Réfute ou rectifie brièvement toute inexactitude ou simplification factuelle.
  3. **Analyse de la portée et des idées** : Analyse la portée du propos sur le débat d'idées ou la théorie en question en soulignant comment cet argument s'articule par rapport aux courants contemporains ou historiques.
  4. **Comparaisons et citations d'autres œuvres (Facultatif)** : Si et seulement si cela apporte une réelle valeur ajoutée à l'analyse, tu peux comparer ce propos avec un auteur ou une œuvre de ton choix. Si tu choisis de le faire, utilise STRICTEMENT le format "[[Livre:Titre du Livre|Auteur:Nom de l'Auteur]]" ou "[[Auteur:Nom de l'Auteur]]" (par exemple : "... comme l'explique [[Auteur:Jean-Jacques Rousseau]] dans [[Livre:Du contrat social|Auteur:Jean-Jacques Rousseau]]..."). Ne force jamais de comparaison si elle n'est pas pertinente.
- Si "isValid" est false (citation invalide/erronée) : Ne cherche pas à interpréter le faux, ni à philosopher ou sur-analyser. Rédige une explication TRÈS COURTE, SYNTHÉTIQUE et FACTUELLE d'UNE SEULE PHRASE (maximum 2 phrases très courtes) expliquant pourquoi le texte n'est pas une citation littéraire ou cohérente (ex: "Ce texte semble être un élément de configuration informatique et ne constitue pas une citation littéraire." ou "Cette citation présente une erreur d'attribution majeure, n'apparaissant pas dans l'œuvre de cet auteur.").

Instructions impératives pour le champ "theme" :
Choisis OBLIGATOIREMENT l'un des thèmes suivants (même en cas d'erreur, choisis le thème le plus proche, par exemple "Savoir & Vérité" pour une erreur d'attribution) :
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
- Si "isValid" est true : Propose une liste de 5 à 7 livres réels et mondialement connus qui approfondissent la thématique.
- Si "isValid" est false : Ne propose aucun livre recommandé (renvoie un tableau vide []).

CONSTRAINTS IMPÉRATIVES pour éviter les hallucinations sur les livres recommandés (uniquement quand "isValid" est true) :
1. Tu dois OBLIGATOIREMENT proposer des livres RÉELS, LARGEMENT PUBLIÉS dans le monde (qui possèdent leur propre article Wikipédia ou sont mondialement référencés).
2. N'invente JAMAIS d'œuvres.
3. Évite absolument les ouvrages confidentiels, de niche, auto-publiés ou obscurs.
4. Écris toujours le titre officiel et complet du livre en français (ou dans sa version traduite de référence) ainsi que le nom de l'auteur de manière exacte.

Format de retour STRICT : Renvoie UNIQUEMENT un objet JSON valide, sans aucun formatage Markdown (pas de blocs de code triples), avec exactement cette structure :
{
  "isValid": true/false,
  "interpretation": "Ton paragraphe d'analyse fluide ou d'explication de l'erreur...",
  "theme": "Le thème choisi",
  "recommendedBooks": [
    {
      "title": "Titre du livre recommandé",
      "author": "Nom de l'auteur"
    }
  ]
}
`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: "Tu es un expert multidisciplinaire (littérature, histoire, politique, économie) et critique intellectuel. Tu réponds toujours en JSON strict sans aucun formatage Markdown." },
          { role: "user", content: prompt }
        ],
        response_format: { type: "json_object" },
        temperature: 0,
      }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[Groq] API error: ${response.status} - ${errText}`);
      return fallbackAnalysis;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      console.error('[Groq] Empty response from API');
      return fallbackAnalysis;
    }

    try {
      const parsed = JSON.parse(content);
      return AnalysisResultSchema.parse(parsed);
    } catch (parseError) {
      console.error('[Groq] Invalid response format:', parseError);
      return fallbackAnalysis;
    }
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('[Groq] API timeout after 15s');
      return fallbackAnalysis;
    }
    console.error('[Groq] Unexpected error:', error);
    return fallbackAnalysis;
  }
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
    console.warn('[Groq] API key missing for chat');
    return "Désolé, le service d'analyse est temporairement indisponible.";
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

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
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
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[Groq Chat] API error: ${response.status} - ${errText}`);
      return "Désolé, je n'ai pas pu générer de réponse. Veuillez réessayer plus tard.";
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content?.trim() || "";
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('[Groq Chat] API timeout after 15s');
      return "Désolé, la réponse a pris trop de temps. Veuillez réessayer.";
    }
    console.error('[Groq Chat] Unexpected error:', error);
    return "Désolé, une erreur est survenue. Veuillez réessayer plus tard.";
  }
}