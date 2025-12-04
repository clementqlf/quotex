export interface Quote {
  id: number;
  text: string;
  book: string;
  author: string;
  date: string;
  likes: number;
  isLiked: boolean;
}

export interface SocialQuote {
  id: number;
  user: {
    id: string;
    name: string;
    username: string;
  };
  text: string;
  book: string;
  author: string;
  time: string;
  likes: number;
  comments: number;
  isLiked: boolean;
  isSaved: boolean;
}

export interface UserProfile {
  id: string;
  bio: string;
  website: string;
  stats: {
    citations: number;
    followers: number;
    following: number;
  };
}


export const aiInterpretations: { [key: string]: string } = {
    "The only way to do great work is to love what you do.": "Cette citation de Steve Jobs souligne l'importance de la passion. L'excellence ne peut être atteinte que lorsque nous sommes profondément investis émotionnellement. C'est un rappel que la satisfaction professionnelle et le succès sont intimement liés.",
    "In the middle of difficulty lies opportunity.": "Einstein nous invite à adopter une perspective optimiste face aux défis. Chaque obstacle contient en son cœur le potentiel de croissance. C'est dans l'adversité que se forgent les plus grandes avancées.",
    "It is our choices that show what we truly are, far more than our abilities.": "J.K. Rowling nous rappelle que notre identité n'est pas définie par nos talents innés, mais par nos décisions. Le caractère se révèle dans nos actions quotidiennes.",
};

export const authorDescriptions: { [key: string]: string } = {
    "Walter Isaacson": "Walter Isaacson est un journaliste et écrivain américain, ancien PDG de CNN. Il est connu pour ses biographies de figures emblématiques comme Steve Jobs et Albert Einstein.",
    "J.K. Rowling": "J.K. Rowling est une écrivaine britannique mondialement connue pour la série Harry Potter, l'une des sagas littéraires les plus vendues de l'histoire.",
    "Ryan Holiday": "Ryan Holiday est un auteur américain qui écrit sur la philosophie stoïcienne et le marketing. Ses livres ont connu un grand succès auprès d'un large public.",
};

export const bookDescriptions: { [key: string]: { description: string; author: string; year: number; pages: number; rating: number; genre: string; cover: string } } = {
    "Steve Jobs": {
        description: "La biographie définitive de Steve Jobs révèle l'homme derrière le mythe : un perfectionniste obsessionnel qui a révolutionné six industries.",
        year: 2011,
        pages: 656,
        author: "Walter Isaacson",
        rating: 4.7,
        genre: "Biographie",
        cover: "https://images.unsplash.com/photo-1519682337058-a94d519337bc?w=400&h=600&fit=crop",
    },
    "Einstein: His Life and Universe": {
        description: "Walter Isaacson explore comment l'imagination scientifique d'Einstein a émergé de sa nature rebelle et de son esprit indépendant.",
        year: 2007,
        pages: 704,
        author: "Walter Isaacson",
        rating: 4.6,
        genre: "Biographie",
        cover: "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=400&h=600&fit=crop",
    },
    "Harry Potter and the Chamber of Secrets": {
        description: "La deuxième année de Harry à Poudlard s'annonce périlleuse quand une mystérieuse créature commence à pétrifier les élèves.",
        year: 1998,
        pages: 341,
        author: "J.K. Rowling",
        rating: 4.8,
        genre: "Fantasy",
        cover: "https://images.unsplash.com/photo-1551029506-0807df4e2031?w=400&h=600&fit=crop",
    },
    "The Obstacle Is the Way": {
        description: "Ryan Holiday nous enseigne comment transformer nos obstacles en avantages en s'inspirant de la philosophie stoïcienne.",
        year: 2014,
        pages: 224,
        author: "Ryan Holiday",
        rating: 4.7,
        genre: "Philosophie",
        cover: "https://images.unsplash.com/photo-1524995767962-b624634ad030?w=400&h=600&fit=crop",
    },
};

export const similarBooks: { [key: string]: string[] } = {
    "The only way to do great work is to love what you do.": ["Einstein: His Life and Universe"],
    "In the middle of difficulty lies opportunity.": ["The Obstacle Is the Way", "Steve Jobs"],
    "It is our choices that show what we truly are, far more than our abilities.": [],
};

export const similarAuthors: { [key: string]: string[] } = {
    "Walter Isaacson": ["Ryan Holiday"],
    "J.K. Rowling": [],
    "Ryan Holiday": ["Walter Isaacson"],
};

export let localQuotesDB: Quote[] = [
  {
    id: 1,
    text: "The only way to do great work is to love what you do.",
    book: "Steve Jobs",
    author: "Walter Isaacson",
    date: "24/05/24",
    likes: 12,
    isLiked: true,
  },
  {
    id: 2,
    text: "In the middle of difficulty lies opportunity.",
    book: "Einstein: His Life and Universe",
    author: "Walter Isaacson",
    date: "12/01/24",
    likes: 5,
    isLiked: false,
  },
];

export let socialQuotes: SocialQuote[] = [
  {
    id: 101,
    user: { id: '1', name: 'Clément QLF', username: '@clementqlf' },
    text: "It is our choices that show what we truly are, far more than our abilities.",
    book: "Harry Potter and the Chamber of Secrets",
    author: "J.K. Rowling",
    time: "2h",
    likes: 15,
    comments: 3,
    isLiked: false,
    isSaved: true,
  },
  {
    id: 102,
    user: { id: '2', name: 'Sophie B.', username: '@sophie_books' },
    text: "In the middle of difficulty lies opportunity.",
    book: "The Obstacle Is the Way",
    author: "Ryan Holiday",
    time: "18h",
    likes: 42,
    comments: 8,
    isLiked: true,
    isSaved: false,
  },
];

export const userProfilesDB: { [key: string]: UserProfile } = {
  '1': {
    id: "1",
    bio: "Passionné par la littérature classique et la philosophie. Je partage ici les citations qui façonnent ma pensée.",
    website: "clement-lectures.com",
    stats: {
      citations: 42,
      followers: 512,
      following: 89
    },
  },
  '2': {
    id: "2",
    bio: "Exploratrice de la science-fiction et des mondes imaginaires. Chaque citation est une porte vers un autre univers.",
    website: "sophies-books.com",
    stats: {
      citations: 15,
      followers: 234,
      following: 102
    },
  },
  '0': {
    id: "0",
    bio: "Profil local pour les citations sauvegardées sur l'appareil.",
    website: "",
    stats: {
      citations: 0, // Sera recalculé
      followers: 0,
      following: 0
    },
  }
};

export const globalQuotesDB = [
  // Quotes from local DB
  ...localQuotesDB.map(q => ({
    ...q,
    user: { id: '0', name: 'Local User', username: '@local' }, // Placeholder user
    time: q.date,
    comments: 0,
    isSaved: false,
  })),
  // Quotes from social feed
  ...socialQuotes,
  // Additional quotes not in feeds
  {
    id: 201,
    user: { id: '1', name: 'Clément QLF', username: '@clementqlf' },
    text: "L'imagination est plus importante que le savoir.",
    book: "Einstein: His Life and Universe",
    author: "Albert Einstein",
    time: "3d",
    likes: 7,
    comments: 1,
    isLiked: false,
    isSaved: false,
  },
];
