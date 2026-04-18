import { Share2, MessageSquare, BookOpen, ShoppingCart, Sparkles, User, Quote, Book as BookIcon, Library } from 'lucide-react-native';

export type BlockKey =
    | 'reviews'
    | 'bookDescription'
    | 'buy'
    | 'notes'
    | 'author'
    | 'savedQuotes'
    | 'similarBooks'
    | 'similarAuthors'
    | 'dictionary'
    | 'definition'
    | 'editions'    // Inventaire.io editions block
    | 'bookInfo'; // bookInfo is usually for QuoteDetail to show book, whereas bookDescription is for BookDetail

export interface BlockConfig {
    key: BlockKey;
    label: string;
    icon: any; // Lucide icon component
    defaultVisible?: boolean;
}

export const BLOCK_CONFIGS: Record<BlockKey, BlockConfig> = {
    reviews: {
        key: 'reviews',
        label: 'Avis & Commentaires',
        icon: MessageSquare,
    },
    bookDescription: {
        key: 'bookDescription',
        label: 'À propos du livre',
        icon: BookOpen,
    },
    bookInfo: {
        key: 'bookInfo',
        label: 'À propos du livre',
        icon: BookOpen,
    },
    buy: {
        key: 'buy',
        label: 'Acheter ce livre',
        icon: ShoppingCart,
    },
    notes: {
        key: 'notes',
        label: 'Notes',
        icon: Sparkles,
    },
    author: {
        key: 'author',
        label: "À propos de l'auteur",
        icon: User,
    },
    savedQuotes: {
        key: 'savedQuotes',
        label: 'Mes citations sauvegardées',
        icon: Quote,
    },
    similarBooks: {
        key: 'similarBooks',
        label: 'Livres similaires',
        icon: BookIcon, // Assuming BookIcon is imported as Book from lucide
    },
    similarAuthors: {
        key: 'similarAuthors',
        label: 'Auteurs similaires',
        icon: User,
    },
    dictionary: {
        key: 'dictionary',
        label: 'Dictionnaire',
        icon: BookOpen,
    },
    definition: {
        key: 'definition',
        label: 'Définition',
        icon: BookOpen,
    },
    editions: {
        key: 'editions',
        label: 'Éditions',
        icon: Library,
    },
};

// Lists of available blocks for specific contexts to replace local lists
export const BOOK_DETAIL_BLOCK_OPTIONS: BlockKey[] = [
    'reviews',
    'bookDescription',
    'editions',
    'buy',
    'notes',
    'author',
    'savedQuotes',
    'similarBooks',
    'dictionary'
];

export const QUOTE_DETAIL_BLOCK_OPTIONS: BlockKey[] = [
    'definition',
    'notes',
    'bookInfo',
    'author',
    'similarBooks',
    'similarAuthors'
];
