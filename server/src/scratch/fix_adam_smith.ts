import { prisma } from '../lib/prisma';
import { enrichAuthorWithInventaire } from '../services/inventaire';

async function main() {
    const author = await prisma.author.findUnique({
        where: { name: 'Adam smith' }
    });

    if (!author) {
        console.log('Author "Adam smith" not found in database.');
        return;
    }

    console.log(`Found author ID: ${author.id}. Current URI: ${author.inventaireUri}`);
    
    // The economist URI
    const correctUri = 'wd:Q9381';
    
    // FORCE CLEAR description to bypass the guard in enrichment service
    console.log('Clearing current incorrect description to force refresh...');
    await prisma.author.update({
        where: { id: author.id },
        data: { description: null } // Setting to null ensures length < 50 check passes
    });

    console.log(`Triggering re-enrichment with correct URI: ${correctUri}...`);
    const result = await enrichAuthorWithInventaire(author.id, author.name, correctUri);
    
    if (result) {
        console.log('Successfully re-enriched author!');
        console.log('New Description:', result.description?.substring(0, 200) + '...');
        console.log('New URI:', result.inventaireUri);
    } else {
        console.log('Failed to re-enrich author.');
    }
}

main().finally(() => prisma.$disconnect());
