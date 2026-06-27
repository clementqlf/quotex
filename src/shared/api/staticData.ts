import type { Quote } from '@/src/entities/quote/model/Quote';

export const aiInterpretations: { [key: string]: string } = {
  "The only way to do great work is to love what you do.": "Cette citation de Steve Jobs souligne l'importance de la passion. L'excellence ne peut être atteinte que lorsque nous sommes profondément investis émotionnellement. C'est un rappel que la satisfaction professionnelle et le succès sont intimement liés.",
  "In the middle of difficulty lies opportunity.": "Einstein nous invite à adopter une perspective optimiste face aux défis. Chaque obstacle contient en son cœur le potentiel de croissance. C'est dans l'adversité que se forgent les plus grandes avancées.",
  "It is our choices that show what we truly are, far more than our abilities.": "J.K. Rowling nous rappelle que notre identité n'est pas définie par nos talents innés, mais par nos décisions. Le caractère se révèle dans nos actions quotidiennes.",
};

export const definitions: { [key: string]: { term: string; genre: string; definition: string; example: string }[] } = {
  "The only way to do great work is to love what you do.": [
    {
      term: "Passion",
      genre: "nom féminin",
      definition: "Un sentiment intense d'enthousiasme et d'intérêt pour une activité, souvent associé à la motivation intrinsèque.",
      example: "Sa passion pour la peinture l'a menée à devenir une artiste reconnue."
    },
    {
      term: "Amour du travail",
      genre: "nom masculin",
      definition: "État de bien-être et de satisfaction professionnelle.",
      example: "L'amour du travail bien fait est la clé du succès personnel."
    }
  ],
  "In the middle of difficulty lies opportunity.": [
    {
      term: "Défi",
      genre: "nom masculin",
      definition: "Situation difficile qui demande des efforts et de la persévérance pour être surmontée.",
      example: "Relever un défi stimule notre créativité et renforce notre confiance."
    },
    {
      term: "Opportunité",
      genre: "nom féminin",
      definition: "Circonstance favorable qui se présente et peut être exploitée à son avantage.",
      example: "Une opportunité de carrière s'est présentée à lui au moment opportun."
    }
  ],
  "It is our choices that show what we truly are, far more than our abilities.": [
    {
      term: "Choix",
      genre: "nom masculin",
      definition: "Acte volontaire de sélection entre plusieurs options.",
      example: "Chaque choix que nous faisons façonne notre futur."
    },
    {
      term: "Caractère",
      genre: "nom masculin",
      definition: "Ensemble des qualités et défauts qui définissent la personnalité d'une personne.",
      example: "Le caractère d'une personne se révèle dans ses actions difficiles."
    }
  ],
};

export const authorDetails: { [key: string]: { description: string, image: string, birthDate: string, nationality: string } } = {
  "Walter Isaacson": {
    description: "Walter Isaacson est un journaliste et écrivain américain, ancien PDG de CNN. Il est connu pour ses biographies de figures emblématiques comme Steve Jobs et Albert Einstein.",
    image: "https://images.unsplash.com/photo-1613287393999-d3913027a1a6?w=400&h=400&fit=crop",
    birthDate: "20 mai 1952",
    nationality: "Américain",
  },
  "J.K. Rowling": {
    description: "J.K. Rowling est une écrivaine britannique mondialement connue pour la série Harry Potter, l'une des sagas littéraires les plus vendues de l'histoire.",
    image: "https://images.unsplash.com/photo-1611601322175-8759d8e33441?w=400&h=400&fit=crop",
    birthDate: "31 juillet 1965",
    nationality: "Britannique",
  },
  "Ryan Holiday": {
    description: "Ryan Holiday est un auteur américain qui écrit sur la philosophie stoïcienne et le marketing. Ses livres ont connu un grand succès auprès d'un large public.",
    image: "https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=400&h=400&fit=crop",
    birthDate: "16 juin 1987",
    nationality: "Américain",
  },
  "Paulo Coelho": {
    description: "Paulo Coelho est un romancier et interprète lyrique brésilien. Il est célèbre pour son roman L'Alchimiste, vendu à des millions d'exemplaires.",
    image: "https://images.unsplash.com/photo-1568602471122-7832951cc4c5?w=400&h=400&fit=crop",
    birthDate: "24 août 1947",
    nationality: "Brésilien",
  },
  "George Eliot": {
    description: "Mary Ann Evans, connue sous son nom de plume George Eliot, était une romancière, poétesse, journaliste et traductrice anglaise de l'époque victorienne.",
    image: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&h=400&fit=crop",
    birthDate: "22 novembre 1819",
    nationality: "Anglaise",
  },
  "Steve Jobs": {
    description: "Steve Jobs était un entrepreneur et inventeur américain, souvent considéré comme un visionnaire. Il est le cofondateur d'Apple Inc.",
    image: "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=400&h=400&fit=crop",
    birthDate: "24 février 1955",
    nationality: "Américain",
  },
  "Albert Einstein": {
    description: "Albert Einstein était un physicien théoricien d'origine allemande. Il a développé la théorie de la relativité, l'un des deux piliers de la physique moderne.",
    image: "https://images.unsplash.com/photo-1541560052-77ec1bbc09f7?w=400&h=400&fit=crop",
    birthDate: "14 mars 1879",
    nationality: "Américain",
  }
};
// J'ai supprimé authorDescriptions qui est maintenant remplacé par authorDetails

export const bookDescriptions: { [key: string]: { description: string; author: string; year: number; pages: number; rating: number; genre: string; cover: string; buyLinks?: { store: string; url: string; price: string }[] } } = {
  "Steve Jobs": {
    description: "La biographie définitive de Steve Jobs révèle l'homme derrière le mythe : un perfectionniste obsessionnel qui a révolutionné six industries.",
    year: 2011,
    pages: 656,
    author: "Walter Isaacson",
    rating: 4.7,
    genre: "Biographie",
    cover: "https://images.unsplash.com/photo-1519682337058-a94d519337bc?w=400&h=600&fit=crop",
    buyLinks: [
      { store: "Amazon", url: "https://amazon.com", price: "24.99€" },
      { store: "FNAC", url: "https://fnac.com", price: "24.99€" },
      { store: "Libraires", url: "https://lalibrairie.com", price: "25.50€" }
    ]
  },
  "Einstein: His Life and Universe": {
    description: "Walter Isaacson explore comment l'imagination scientifique d'Einstein a émergé de sa nature rebelle et de son esprit indépendant.",
    year: 2007,
    pages: 704,
    author: "Walter Isaacson",
    rating: 4.6,
    genre: "Biographie",
    cover: "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=400&h=600&fit=crop",
    buyLinks: [
      { store: "Amazon", url: "https://amazon.com", price: "18.99€" },
      { store: "Recyclivre", url: "https://recyclivre.com", price: "8.50€" }
    ]
  },
  "Harry Potter and the Chamber of Secrets": {
    description: "La deuxième année de Harry à Poudlard s'annonce périlleuse quand une mystérieuse créature commence à pétrifier les élèves.",
    year: 1998,
    pages: 341,
    author: "J.K. Rowling",
    rating: 4.8,
    genre: "Fantasy",
    cover: "https://images.unsplash.com/photo-1551029506-0807df4e2031?w=400&h=600&fit=crop",
    buyLinks: [
      { store: "Amazon", url: "https://amazon.com", price: "22.00€" },
      { store: "FNAC", url: "https://fnac.com", price: "22.50€" }
    ]
  },
  "The Obstacle Is the Way": {
    description: "Ryan Holiday nous enseigne comment transformer nos obstacles en avantages en s'inspirant de la philosophie stoïcienne.",
    year: 2014,
    pages: 224,
    author: "Ryan Holiday",
    rating: 4.7,
    genre: "Philosophie",
    cover: "https://images.unsplash.com/photo-1524995767962-b624634ad030?w=400&h=600&fit=crop",
    buyLinks: [
      { store: "Amazon", url: "https://amazon.com", price: "15.99€" }
    ]
  },
  "The Alchemist": {
    description: "L'Alchimiste raconte l'histoire de Santiago, un jeune berger andalou qui part à la recherche d'un trésor enfoui au pied des pyramides égyptiennes.",
    year: 1988,
    pages: 163,
    author: "Paulo Coelho",
    rating: 4.6,
    genre: "Philosophie",
    cover: "https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=400&h=600&fit=crop",
    buyLinks: [
      { store: "Amazon", url: "https://amazon.com", price: "12.00€" },
      { store: "FNAC", url: "https://fnac.com", price: "12.00€" }
    ]
  },
  "Middlemarch": {
    description: "Middlemarch, une étude de la vie de province, est un roman de George Eliot. Il est considéré comme l'un des plus grands romans en langue anglaise.",
    year: 1871,
    pages: 880,
    author: "George Eliot",
    rating: 4.2,
    genre: "Classique",
    cover: "https://images.unsplash.com/photo-1588666307646-86b1d359a381?w=400&h=600&fit=crop",
    buyLinks: [
      { store: "Amazon", url: "https://amazon.com", price: "10.50€" }
    ]
  },
};

export const similarBooks: { [key: string]: string[] } = {
  "The only way to do great work is to love what you do.": ["Einstein: His Life and Universe"],
  "In the middle of difficulty lies opportunity.": ["The Obstacle Is the Way", "Steve Jobs"],
  "It is our choices that show what we truly are, far more than our abilities.": [],
  "The only impossible journey is the one you never begin.": ["The Obstacle Is the Way"],
  "It is never too late to be what you might have been.": [],
};

export const similarAuthors: { [key: string]: string[] } = {
  "Walter Isaacson": ["Ryan Holiday"],
  "J.K. Rowling": [],
  "Ryan Holiday": ["Walter Isaacson"],
  "Paulo Coelho": ["Ryan Holiday"],
  "George Eliot": ["J.K. Rowling"],
};

export const mockReviews: { [key: string]: { id: string; user: { name: string; image?: string }; rating: number; comment: string; date: string }[] } = {
  "Steve Jobs": [
    { id: "1", user: { name: "Sophie Martin", image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop" }, rating: 5, comment: "Une source d'inspiration incroyable.", date: "Il y a 2 jours" },
    { id: "2", user: { name: "Lucas Bernard" }, rating: 4, comment: "Très complet mais parfois un peu long.", date: "Il y a 1 semaine" },
    { id: "4", user: { name: "Emma Dubois" }, rating: 5, comment: "À lire absolument pour comprendre le génie d'Apple.", date: "Il y a 2 semaines" }
  ],
  "Einstein: His Life and Universe": [
    { id: "3", user: { name: "Thomas Durand" }, rating: 5, comment: "Fascinant de bout en bout.", date: "Il y a 3 jours" }
  ]
};

export const localQuotesDB: Quote[] = [];

export const globalQuotesDB: Quote[] = [];

// --- Simulation de la base de données ---
