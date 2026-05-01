import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Démarrage de la migration multi-utilisateurs ---');

  // 1. Récupérer l'utilisateur par défaut
  let user = await prisma.user.findFirst();
  if (!user) {
    console.log('Aucun utilisateur trouvé. Création d\'un utilisateur par défaut...');
    user = await prisma.user.create({
      data: {
        username: 'default_user',
        name: 'Utilisateur par défaut',
      }
    });
  }

  const userId = user.id;
  console.log(`Utilisation de l'utilisateur: ${user.username} (ID: ${userId})`);

  // 2. Migrer les Livres
  const savedBooks = await (prisma.book as any).findMany({
    where: { isSaved: true }
  });
  console.log(`Migration de ${savedBooks.length} livres sauvegardés...`);
  for (const book of savedBooks) {
    await prisma.userBook.upsert({
      where: { userId_bookId: { userId, bookId: book.id } },
      update: { status: book.readingStatus },
      create: { userId, bookId: book.id, status: book.readingStatus }
    });
  }

  // 3. Migrer les Auteurs
  const savedAuthors = await (prisma.author as any).findMany({
    where: { isSaved: true }
  });
  console.log(`Migration de ${savedAuthors.length} auteurs sauvegardés...`);
  for (const author of savedAuthors) {
    await prisma.userAuthor.upsert({
      where: { userId_authorId: { userId, authorId: author.id } },
      update: {},
      create: { userId, authorId: author.id }
    });
  }

  // 4. Migrer les Citations
  const savedQuotes = await (prisma.quote as any).findMany({
    where: { isSaved: true }
  });
  console.log(`Migration de ${savedQuotes.length} citations sauvegardées...`);
  for (const quote of savedQuotes) {
    await prisma.userQuote.upsert({
      where: { userId_quoteId: { userId, quoteId: quote.id } },
      update: {},
      create: { userId, quoteId: quote.id }
    });
  }

  console.log('--- Migration terminée avec succès ---');
}

main()
  .catch((e) => {
    console.error('Erreur lors de la migration:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
