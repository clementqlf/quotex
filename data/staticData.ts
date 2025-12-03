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
