import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const seed = async () => {
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

    const users: Record<string, any> = {};
    for (const u of usersData) {
        const user = await prisma.user.upsert({
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

    const authors: Record<string, any> = {};
    for (const a of authorsData) {
        const author = await prisma.author.upsert({
            where: { name: a.name },
            update: a,
            create: a,
        });
        authors[a.name] = author;
        console.log(`Upserted author: ${a.name}`);
    }

    // --- Books ---
    const booksData = [
        {
            title: "Steve Jobs",
            authorName: "Steve Jobs", // Note: actually Walter Isaacson wrote it, but sticking to current schema logic where author links usually
            // Wait, schema links Book -> Author. The field is authorId. 
            // In staticData.ts, Author of "Steve Jobs" book was "Walter Isaacson".
            // Let's stick to the Authors we created above for simplicity or create Walter Isaacson if we want realism.
            // Let's create Walter Isaacson as an Author to be correct.
            realAuthorName: "Walter Isaacson",
            year: 2011,
            pages: 656,
            cover: "https://images.unsplash.com/photo-1519682337058-a94d519337bc?w=400&h=600&fit=crop",
            genre: "Biography",
            rating: 4.7
        },
        {
            title: "Einstein: His Life and Universe",
            realAuthorName: "Walter Isaacson",
            year: 2007,
            pages: 704,
            cover: "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=400&h=600&fit=crop",
            genre: "Biography",
            rating: 4.6
        },
        {
            title: "Harry Potter and the Chamber of Secrets",
            realAuthorName: "J.K. Rowling",
            year: 1998,
            pages: 341,
            cover: "https://images.unsplash.com/photo-1551029506-0807df4e2031?w=400&h=600&fit=crop",
            genre: "Fantasy",
            rating: 4.8
        },
        {
            title: "Dune",
            realAuthorName: "Frank Herbert",
            year: 1965,
            pages: 412,
            cover: "https://images.unsplash.com/photo-1541963463532-d68292c34b19?w=400&h=600&fit=crop",
            genre: "Science Fiction",
            rating: 4.9
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
        }
    ];

    // Walter Isaacson is now in authorsData array


    const books: Record<string, any> = {};
    for (const b of booksData) {
        const author = authors[b.realAuthorName] || authors[b.authorName!];
        if (!author) {
            console.error(`Author not found for book: ${b.title}`);
            continue;
        }

        const book = await prisma.book.upsert({
            where: { title: b.title },
            update: {
                year: b.year,
                pages: b.pages,
                cover: b.cover,
                genre: b.genre,
                rating: b.rating,
                authorId: author.id
            },
            create: {
                title: b.title,
                year: b.year,
                pages: b.pages,
                cover: b.cover,
                genre: b.genre,
                rating: b.rating,
                authorId: author.id
            }
        });
        books[b.title] = book;
        console.log(`Upserted book: ${b.title}`);
    }

    // --- Quotes ---
    const quotesData = [
        {
            text: "The only way to do great work is to love what you do.",
            book: "Steve Jobs",
            author: "Steve Jobs", // Attributed to subject often
            user: "@clementqlf",
            theme: "Travail",
            likes: 12
        },
        {
            text: "Stay hungry, stay foolish.",
            book: "Steve Jobs",
            author: "Steve Jobs",
            user: "@tom_tech",
            theme: "Innovation",
            likes: 45
        },
        {
            text: "In the middle of difficulty lies opportunity.",
            book: "Einstein: His Life and Universe",
            author: "Albert Einstein",
            user: "@sophiereads",
            theme: "Résilience",
            likes: 8
        },
        {
            text: "Imagination is more important than knowledge.",
            book: "Einstein: His Life and Universe",
            author: "Albert Einstein",
            user: "@emma_art",
            theme: "Créativité",
            likes: 156
        },
        {
            text: "It is our choices that show what we truly are, far more than our abilities.",
            book: "Harry Potter and the Chamber of Secrets",
            author: "J.K. Rowling",
            user: "@clementqlf",
            theme: "Choix",
            likes: 24
        },
        {
            text: "I must not fear. Fear is the mind-killer.",
            book: "Dune",
            author: "Frank Herbert",
            user: "@sophiereads",
            theme: "Courage",
            likes: 890
        },
        {
            text: "He who has a why to live can bear almost any how.",
            book: "Dune", // Often misattributed or referenced, actually Nietzsche but fits the vibe
            author: "Frank Herbert",
            user: "@lucas_books",
            theme: "Philosophie",
            likes: 42
        },
        {
            text: "You have power over your mind - not outside events. Realize this, and you will find strength.",
            book: "Meditations",
            author: "Marcus Aurelius",
            user: "@clementqlf",
            theme: "Stoïcisme",
            likes: 312
        },
        {
            text: "The soul becomes dyed with the color of its thoughts.",
            book: "Meditations",
            author: "Marcus Aurelius",
            user: "@emma_art",
            theme: "Spiritualité",
            likes: 210
        },
        {
            text: "Even the darkest night will end and the sun will rise.",
            book: "Les Misérables",
            author: "Victor Hugo",
            user: "@emma_art",
            theme: "Espoir",
            likes: 567
        },
        {
            text: "To love another person is to see the face of God.",
            book: "Les Misérables",
            author: "Victor Hugo",
            user: "@lucas_books",
            theme: "Amour",
            likes: 123
        }
    ];

    for (const q of quotesData) {
        // Find Author ID (using the attributed author or book author if needed)
        // For simplicity, we search author by name
        let author = authors[q.author];
        // If not found (e.g. Steve Jobs the person vs the book), try to find/create or fallback?
        // We created Steve Jobs as author earlier.
        if (!author) {
            // Maybe Walter Isaacson wrote the book, but quote is by Steve Jobs.
            // We have Steve Jobs in authors list.
            const record = await prisma.author.findUnique({ where: { name: q.author } });
            author = record;
        }

        const book = books[q.book];
        const user = users[q.user];

        if (author && book && user) {
            await prisma.quote.create({
                data: {
                    text: q.text,
                    authorId: author.id,
                    bookId: book.id,
                    userId: user.id,
                    theme: q.theme,
                    likes: q.likes,
                    // Since we seed for everyone, let's leave isLiked false by default or true if it's "User 1's" seed.
                    // Let's set it to true only if user is clementqlf (ID 1 usually)
                    isLiked: q.user === "@clementqlf",
                    date: new Date()
                }
            });
            console.log(`Created quote: "${q.text.substring(0, 20)}..."`);
        } else {
            console.log(`Missing link for quote: ${q.text} (Author: ${!!author}, Book: ${!!book}, User: ${!!user})`);
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
            await prisma.review.create({
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
};
