"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.seed = void 0;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const seed = () => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    console.log('Starting enrichment seed...');
    // --- Users ---
    const usersData = [
        {
            username: "@clementqlf",
            name: "Clément QLF",
            image: "https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=200&h=200&fit=crop",
            bio: "Passionné par la littérature classique et la philosophie. Je partage ici les citations qui façonnent ma pensée.",
            website: "clement-lectures.com",
            followers: 512,
            following: 89
        },
        {
            username: "@sophiereads",
            name: "Sophie Martin",
            image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop",
            bio: "Exploratrice de la science-fiction et des mondes imaginaires. Chaque citation est une porte vers un autre univers.",
            website: "sophies-books.com",
            followers: 1243,
            following: 432
        },
        {
            username: "@lucas_books",
            name: "Lucas Bernard",
            image: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&h=200&fit=crop",
            bio: "Historien amateur et grand lecteur de biographies. J'aime comprendre les gens qui ont fait l'Histoire.",
            website: "lucas-history.net",
            followers: 89,
            following: 12
        },
        {
            username: "@emma_art",
            name: "Emma Dubois",
            image: "https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=200&h=200&fit=crop",
            bio: "L'art est ma vie. La poésie est mon souffle. Je cherche la beauté dans chaque ligne.",
            website: "emma-atelier.fr",
            followers: 3405,
            following: 150
        },
        {
            username: "@tom_tech",
            name: "Thomas Durand",
            image: "https://images.unsplash.com/photo-1633332755192-727a05c4013d?w=200&h=200&fit=crop",
            bio: "Tech lead le jour, lecteur avide la nuit. Science, Innovation et Futur.",
            website: "tom-tech-blog.io",
            followers: 45,
            following: 300
        }
    ];
    const users = {};
    for (const u of usersData) {
        const user = yield prisma.user.upsert({
            where: { username: u.username },
            update: u,
            create: u,
        });
        users[u.username] = user;
        console.log(`Upserted user: ${u.username}`);
    }
    // --- Authors ---
    const authorsData = [
        {
            name: "Steve Jobs",
            description: "Co-founder of Apple Inc. Visionary entrepreneur.",
            image: "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=400&h=400&fit=crop",
            nationality: "American",
            birthDate: "24 février 1955"
        },
        {
            name: "Albert Einstein",
            description: "Theoretical physicist. Developed the theory of relativity.",
            image: "https://images.unsplash.com/photo-1541560052-77ec1bbc09f7?w=400&h=400&fit=crop",
            nationality: "German",
            birthDate: "14 mars 1879"
        },
        {
            name: "J.K. Rowling",
            description: "Author of the Harry Potter fantasy series.",
            image: "https://images.unsplash.com/photo-1611601322175-8759d8e33441?w=400&h=400&fit=crop",
            nationality: "British",
            birthDate: "31 juillet 1965"
        },
        {
            name: "Frank Herbert",
            description: "Science fiction author, best known for the novel Dune.",
            image: "https://images.unsplash.com/photo-1455390582262-044cdead277a?w=400&h=400&fit=crop", // Abstract space-like
            nationality: "American",
            birthDate: "8 octobre 1920"
        },
        {
            name: "Marcus Aurelius",
            description: "Roman emperor and Stoic philosopher.",
            image: "https://images.unsplash.com/photo-1595166671408-72e7371994b7?w=400&h=400&fit=crop", // Statue
            nationality: "Roman",
            birthDate: "26 avril 121"
        },
        {
            name: "Victor Hugo",
            description: "French poet, novelist, and dramatist of the Romantic movement.",
            image: "https://images.unsplash.com/photo-1474932430478-367dbb6832c1?w=400&h=400&fit=crop", // Paris feel
            nationality: "French",
            birthDate: "26 février 1802"
        },
        {
            name: "Walter Isaacson",
            description: "American writer and journalist.",
            image: "https://images.unsplash.com/photo-1613287393999-d3913027a1a6?w=400&h=400&fit=crop",
            nationality: "American",
            birthDate: "20 mai 1952"
        },
        {
            name: "Ryan Holiday",
            description: "Auteur américain de philosophie stoïcienne.",
            image: "https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=400&h=400&fit=crop",
            nationality: "Américain",
            birthDate: "16 juin 1987"
        },
        {
            name: "Paulo Coelho",
            description: "Romancier brésilien célèbre pour L'Alchimiste.",
            image: "https://images.unsplash.com/photo-1568602471122-7832951cc4c5?w=400&h=400&fit=crop",
            nationality: "Brésilien",
            birthDate: "24 août 1947"
        },
        {
            name: "George Eliot",
            description: "Romancière anglaise de l'époque victorienne.",
            image: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&h=400&fit=crop",
            nationality: "Anglaise",
            birthDate: "22 novembre 1819"
        },
        {
            name: "George Orwell",
            description: "English novelist and essayist, critic of totalitarianism.",
            image: "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=400&h=400&fit=crop",
            nationality: "British",
            birthDate: "25 juin 1903"
        },
        {
            name: "Franz Kafka",
            description: "German-speaking Bohemian novelist and short-story writer.",
            image: "https://images.unsplash.com/photo-1455390582262-044cdead277a?w=400&h=400&fit=crop",
            nationality: "Austro-Hungarian",
            birthDate: "3 juillet 1883"
        }
    ];
    const authors = {};
    for (const a of authorsData) {
        const author = yield prisma.author.upsert({
            where: { name: a.name },
            update: a,
            create: a,
        });
        authors[a.name] = author;
        console.log(`Upserted author: ${a.name}`);
    }
    // --- Update Authors (for Similar Authors) ---
    // Manually linking some similar authors for demo
    const similarAuthorsMap = {
        "Walter Isaacson": ["Ryan Holiday"],
        "Ryan Holiday": ["Walter Isaacson"],
        "Paulo Coelho": ["Ryan Holiday"],
        "George Eliot": ["J.K. Rowling"]
    };
    for (const [authorName, similarNames] of Object.entries(similarAuthorsMap)) {
        const authorId = (_a = authors[authorName]) === null || _a === void 0 ? void 0 : _a.id;
        if (!authorId)
            continue;
        const similarIds = similarNames
            .map(name => { var _a; return (_a = authors[name]) === null || _a === void 0 ? void 0 : _a.id; })
            .filter(id => id !== undefined);
        if (similarIds.length > 0) {
            yield prisma.author.update({
                where: { id: authorId },
                data: {
                    similarAuthors: {
                        connect: similarIds.map(id => ({ id }))
                    }
                }
            });
            console.log(`Linked similar authors for: ${authorName}`);
        }
    }
    // --- Books ---
    const booksData = [
        {
            title: "Steve Jobs",
            realAuthorName: "Walter Isaacson",
            year: 2011,
            pages: 656,
            cover: "https://images.unsplash.com/photo-1519682337058-a94d519337bc?w=400&h=600&fit=crop",
            genre: "Biography",
            rating: 4.7,
            buyLinks: JSON.stringify([
                { store: "Amazon", url: "https://amazon.com", price: "24.99€" },
                { store: "FNAC", url: "https://fnac.com", price: "24.99€" },
                { store: "Libraires", url: "https://lalibrairie.com", price: "25.50€" }
            ])
        },
        {
            title: "Einstein: His Life and Universe",
            realAuthorName: "Walter Isaacson",
            year: 2007,
            pages: 704,
            cover: "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=400&h=600&fit=crop",
            genre: "Biography",
            rating: 4.6,
            buyLinks: JSON.stringify([
                { store: "Amazon", url: "https://amazon.com", price: "18.99€" },
                { store: "Recyclivre", url: "https://recyclivre.com", price: "8.50€" }
            ])
        },
        {
            title: "Harry Potter and the Chamber of Secrets",
            realAuthorName: "J.K. Rowling",
            year: 1998,
            pages: 341,
            cover: "https://images.unsplash.com/photo-1551029506-0807df4e2031?w=400&h=600&fit=crop",
            genre: "Fantasy",
            rating: 4.8,
            buyLinks: JSON.stringify([
                { store: "Amazon", url: "https://amazon.com", price: "22.00€" },
                { store: "FNAC", url: "https://fnac.com", price: "22.50€" }
            ])
        },
        {
            title: "Dune",
            realAuthorName: "Frank Herbert",
            year: 1965,
            pages: 412,
            cover: "https://images.unsplash.com/photo-1541963463532-d68292c34b19?w=400&h=600&fit=crop",
            genre: "Science Fiction",
            rating: 4.9,
            buyLinks: JSON.stringify([
                { store: "Amazon", url: "https://amazon.com", price: "10.00€" }
            ])
        },
        {
            title: "Meditations",
            realAuthorName: "Marcus Aurelius",
            year: 180,
            pages: 254,
            cover: "https://images.unsplash.com/photo-1555447405-05842c375627?w=400&h=600&fit=crop",
            genre: "Philosophy",
            rating: 4.8
        },
        {
            title: "Les Misérables",
            realAuthorName: "Victor Hugo",
            year: 1862,
            pages: 1462,
            cover: "https://images.unsplash.com/photo-1543002588-bfa74002ed7e?w=400&h=600&fit=crop",
            genre: "Classic",
            rating: 4.9
        },
        {
            title: "The Obstacle Is the Way",
            realAuthorName: "Ryan Holiday",
            year: 2014,
            pages: 224,
            cover: "https://images.unsplash.com/photo-1524995767962-b624634ad030?w=400&h=600&fit=crop",
            genre: "Philosophie",
            rating: 4.7,
            buyLinks: JSON.stringify([
                { store: "Amazon", url: "https://amazon.com", price: "15.99€" }
            ])
        },
        {
            title: "The Alchemist",
            realAuthorName: "Paulo Coelho",
            year: 1988,
            pages: 163,
            cover: "https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=400&h=600&fit=crop",
            genre: "Philosophie",
            rating: 4.6,
            buyLinks: JSON.stringify([
                { store: "Amazon", url: "https://amazon.com", price: "12.00€" },
                { store: "FNAC", url: "https://fnac.com", price: "12.00€" }
            ])
        },
        {
            title: "Middlemarch",
            realAuthorName: "George Eliot",
            year: 1871,
            pages: 880,
            cover: "https://images.unsplash.com/photo-1588666307646-86b1d359a381?w=400&h=600&fit=crop",
            genre: "Classique",
            rating: 4.2,
            buyLinks: JSON.stringify([
                { store: "Amazon", url: "https://amazon.com", price: "10.50€" }
            ])
        }
    ];
    const books = {};
    for (const b of booksData) {
        const author = authors[b.realAuthorName];
        if (!author) {
            console.error(`Author not found for book: ${b.title}`);
            continue;
        }
        const book = yield prisma.book.upsert({
            where: {
                title_authorId: {
                    title: b.title,
                    authorId: author.id
                }
            },
            update: {
                year: b.year,
                pages: b.pages,
                cover: b.cover,
                genre: b.genre,
                rating: b.rating,
                buyLinks: b.buyLinks,
                authorId: author.id
            },
            create: {
                title: b.title,
                year: b.year,
                pages: b.pages,
                cover: b.cover,
                genre: b.genre,
                rating: b.rating,
                buyLinks: b.buyLinks,
                authorId: author.id
            }
        });
        books[b.title] = book;
        console.log(`Upserted book: ${b.title}`);
    }
    // --- Update Books (for Similar Books) ---
    const similarBooksMap = {
        "The only way to do great work is to love what you do.": ["Einstein: His Life and Universe"], // Mapping key mismatch logic?
        // Wait, similarBooks was keyed by Quote in static data?
        // No, similarBooks in staticData was Key: QuoteText -> Value: BookTitles[]. that's weird.
        // Usually similar books are Book -> Book.
        // Let's assume standard Book -> Book similarity.
        "Steve Jobs": ["Einstein: His Life and Universe", "The Obstacle Is the Way"],
        "Einstein: His Life and Universe": ["Steve Jobs"],
        "The Obstacle Is the Way": ["Steve Jobs", "The Alchemist"]
    };
    for (const [bookTitle, similarTitles] of Object.entries(similarBooksMap)) {
        const bookId = (_b = books[bookTitle]) === null || _b === void 0 ? void 0 : _b.id;
        if (!bookId)
            continue;
        const similarIds = similarTitles
            .map(title => { var _a; return (_a = books[title]) === null || _a === void 0 ? void 0 : _a.id; })
            .filter(id => id !== undefined);
        if (similarIds.length > 0) {
            yield prisma.book.update({
                where: { id: bookId },
                data: {
                    similarBooks: {
                        connect: similarIds.map(id => ({ id }))
                    }
                }
            });
            console.log(`Linked similar books for: ${bookTitle}`);
        }
    }
    // --- Quotes ---
    const quotesData = [
        {
            text: "The only way to do great work is to love what you do.",
            book: "Steve Jobs",
            author: "Steve Jobs",
            user: "@clementqlf",
            theme: "Travail",
            likesCount: 12,
            aiInterpretation: "Cette citation de Steve Jobs souligne l'importance de la passion. L'excellence ne peut être atteinte que lorsque nous sommes profondément investis émotionnellement. C'est un rappel que la satisfaction professionnelle et le succès sont intimement liés.",
            definitions: JSON.stringify([
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
            ])
        },
        {
            text: "In the middle of difficulty lies opportunity.",
            book: "Einstein: His Life and Universe",
            author: "Albert Einstein",
            user: "@sophiereads",
            theme: "Résilience",
            likesCount: 8,
            aiInterpretation: "Einstein nous invite à adopter une perspective optimiste face aux défis. Chaque obstacle contient en son cœur le potentiel de croissance. C'est dans l'adversité que se forgent les plus grandes avancées.",
            definitions: JSON.stringify([
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
            ])
        },
        {
            text: "It is our choices that show what we truly are, far more than our abilities.",
            book: "Harry Potter and the Chamber of Secrets",
            author: "J.K. Rowling",
            user: "@clementqlf",
            theme: "Choix",
            likesCount: 24,
            aiInterpretation: "J.K. Rowling nous rappelle que notre identité n'est pas définie par nos talents innés, mais par nos décisions. Le caractère se révèle dans nos actions quotidiennes.",
            definitions: JSON.stringify([
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
            ])
        },
        {
            text: "The only impossible journey is the one you never begin.",
            book: "The Alchemist",
            author: "Paulo Coelho",
            user: "@sophiereads",
            theme: "Aventure",
            likesCount: 142
        },
        {
            text: "It is never too late to be what you might have been.",
            book: "Middlemarch",
            author: "George Eliot",
            user: "@lucas_books",
            theme: "Espoir",
            likesCount: 89
        },
        {
            text: "Two things are infinite: the universe and human stupidity; and I'm not sure about the universe.",
            book: "Einstein: His Life and Universe",
            author: "Albert Einstein",
            user: "@sophiereads",
            theme: "Humour",
            likesCount: 256
        },
        {
            text: "The man who does not read has no advantage over the man who cannot read.",
            book: "The Obstacle Is the Way",
            author: "Ryan Holiday",
            user: "@lucas_books",
            theme: "Lecture",
            likesCount: 112
        },
        {
            text: "I must not fear. Fear is the mind-killer.",
            book: "Dune",
            author: "Frank Herbert",
            user: "@sophiereads",
            theme: "Courage",
            likesCount: 890
        },
        {
            text: "He who has a why to live can bear almost any how.",
            book: "Dune",
            author: "Frank Herbert",
            user: "@lucas_books",
            theme: "Philosophie",
            likesCount: 42
        },
        {
            text: "You have power over your mind - not outside events. Realize this, and you will find strength.",
            book: "Meditations",
            author: "Marcus Aurelius",
            user: "@clementqlf",
            theme: "Stoïcisme",
            likesCount: 312
        },
        {
            text: "The soul becomes dyed with the color of its thoughts.",
            book: "Meditations",
            author: "Marcus Aurelius",
            user: "@emma_art",
            theme: "Spiritualité",
            likesCount: 210
        },
        {
            text: "Even the darkest night will end and the sun will rise.",
            book: "Les Misérables",
            author: "Victor Hugo",
            user: "@emma_art",
            theme: "Espoir",
            likesCount: 567
        },
        {
            text: "To love another person is to see the face of God.",
            book: "Les Misérables",
            author: "Victor Hugo",
            user: "@lucas_books",
            theme: "Amour",
            likesCount: 123
        }
    ];
    const allQuotes = [];
    for (const q of quotesData) {
        let author = authors[q.author];
        if (!author) {
            const record = yield prisma.author.findUnique({ where: { name: q.author } });
            author = record;
        }
        const book = books[q.book];
        const user = users[q.user];
        if (author && book && user) {
            const quote = yield prisma.quote.create({
                data: {
                    text: q.text,
                    authorId: author.id,
                    bookId: book.id,
                    userId: user.id,
                    theme: q.theme,
                    likesCount: q.likesCount,
                    date: new Date(),
                    aiInterpretation: q.aiInterpretation,
                    definitions: q.definitions
                }
            });
            allQuotes.push(quote);
            console.log(`Created quote: "${q.text.substring(0, 20)}..."`);
        }
        else {
            console.log(`Missing link for quote: ${q.text} (Author: ${!!author}, Book: ${!!book}, User: ${!!user})`);
        }
    }
    // --- Likes ---
    console.log("Seeding Likes...");
    const allUsers = Object.values(users);
    for (const q of allQuotes) {
        const numLikes = Math.floor(Math.random() * 4);
        const shuffledUsers = allUsers.sort(() => 0.5 - Math.random());
        const selectedUsers = shuffledUsers.slice(0, numLikes);
        for (const liker of selectedUsers) {
            try {
                yield prisma.like.upsert({
                    where: {
                        userId_quoteId: {
                            userId: liker.id,
                            quoteId: q.id
                        }
                    },
                    update: {},
                    create: {
                        userId: liker.id,
                        quoteId: q.id
                    }
                });
            }
            catch (e) {
                // Ignore if exists
            }
        }
        if (Math.random() > 0.5) {
            const mainUser = users["@clementqlf"];
            if (mainUser) {
                yield prisma.like.upsert({
                    where: { userId_quoteId: { userId: mainUser.id, quoteId: q.id } },
                    update: {},
                    create: { userId: mainUser.id, quoteId: q.id }
                });
            }
        }
    }
    // --- Reviews ---
    const reviewsData = [
        {
            user: "@clementqlf",
            book: "Dune",
            rating: 5,
            comment: "Un chef-d'œuvre absolu de la science-fiction. L'univers est d'une richesse incroyable."
        },
        {
            user: "@sophiereads",
            book: "Dune",
            rating: 4,
            comment: "Un peu dense au début, mais une fois plongé dedans, impossible de le lâcher."
        },
        {
            user: "@tom_tech",
            book: "Steve Jobs",
            rating: 5,
            comment: "Inspirant pour tout entrepreneur. La complexité du personnage est bien rendue."
        },
        {
            user: "@emma_art",
            book: "Les Misérables",
            rating: 5,
            comment: "Bouleversant. Hugo décrit la misère et la rédemption avec une puissance inégalée."
        },
        {
            user: "@lucas_books",
            book: "Meditations",
            rating: 5,
            comment: "Un livre de chevet indispensable pour rester stoïque face aux épreuves."
        },
        {
            user: "@clementqlf",
            book: "Harry Potter and the Chamber of Secrets",
            rating: 4,
            comment: "Toujours un plaisir de se replonger dans cet univers, même adulte."
        }
    ];
    for (const r of reviewsData) {
        const user = users[r.user];
        const book = books[r.book];
        if (user && book) {
            yield prisma.review.create({
                data: {
                    userId: user.id,
                    bookId: book.id,
                    rating: r.rating,
                    comment: r.comment,
                    createdAt: new Date()
                }
            });
            console.log(`Created review for ${r.book} by ${r.user}`);
        }
    }
    console.log('Enrichment seed completed.');
});
exports.seed = seed;
