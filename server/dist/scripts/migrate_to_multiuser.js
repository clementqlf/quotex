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
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log('--- Démarrage de la migration multi-utilisateurs ---');
        // 1. Récupérer l'utilisateur par défaut
        let user = yield prisma.user.findFirst();
        if (!user) {
            console.log('Aucun utilisateur trouvé. Création d\'un utilisateur par défaut...');
            user = yield prisma.user.create({
                data: {
                    username: 'default_user',
                    name: 'Utilisateur par défaut',
                }
            });
        }
        const userId = user.id;
        console.log(`Utilisation de l'utilisateur: ${user.username} (ID: ${userId})`);
        // 2. Migrer les Livres
        const savedBooks = yield prisma.book.findMany({
            where: { isSaved: true }
        });
        console.log(`Migration de ${savedBooks.length} livres sauvegardés...`);
        for (const book of savedBooks) {
            yield prisma.userBook.upsert({
                where: { userId_bookId: { userId, bookId: book.id } },
                update: { status: book.readingStatus },
                create: { userId, bookId: book.id, status: book.readingStatus }
            });
        }
        // 3. Migrer les Auteurs
        const savedAuthors = yield prisma.author.findMany({
            where: { isSaved: true }
        });
        console.log(`Migration de ${savedAuthors.length} auteurs sauvegardés...`);
        for (const author of savedAuthors) {
            yield prisma.userAuthor.upsert({
                where: { userId_authorId: { userId, authorId: author.id } },
                update: {},
                create: { userId, authorId: author.id }
            });
        }
        // 4. Migrer les Citations
        const savedQuotes = yield prisma.quote.findMany({
            where: { isSaved: true }
        });
        console.log(`Migration de ${savedQuotes.length} citations sauvegardées...`);
        for (const quote of savedQuotes) {
            yield prisma.userQuote.upsert({
                where: { userId_quoteId: { userId, quoteId: quote.id } },
                update: {},
                create: { userId, quoteId: quote.id }
            });
        }
        console.log('--- Migration terminée avec succès ---');
    });
}
main()
    .catch((e) => {
    console.error('Erreur lors de la migration:', e);
    process.exit(1);
})
    .finally(() => __awaiter(void 0, void 0, void 0, function* () {
    yield prisma.$disconnect();
}));
