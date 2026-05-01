const fs = require('fs');
const file = './src/services/inventaire.ts';
let code = fs.readFileSync(file, 'utf8');

// 1. Rename enrichAuthorWithInventaire to syncAuthorProfile
code = code.replace(
    'export const enrichAuthorWithInventaire = async (authorId: number, authorName?: string, authorUri?: string, skipDiscovery: boolean = false): Promise<any> => {',
    'export const syncAuthorProfile = async (authorId: number, authorName?: string, authorUri?: string): Promise<any> => {'
);

// 2. Remove the TTL check for discovery inside syncAuthorProfile
code = code.replace(
    /const lastDiscovered = [^;]+;\n\s*const isDiscoveryFresh = [^;]+;\n\n\s*if \(isProfileFresh && \(skipDiscovery \|\| isDiscoveryFresh\)\) \{\n\s*console\.log[^}]+\}\n\s*return author;\n\s*\}/,
    `if (isProfileFresh) {\n            console.log(\`[Inventaire] Author \${author.name} profile is fresh. Skipping.\`);\n            return author;\n        }`
);

// 3. Update the DB save at the end of syncAuthorProfile to include lastEnrichedAt
code = code.replace(
    /const updatedAuthor = await prisma\.author\.update\(\{\n\s*where: \{ id: authorId \},\n\s*data: updateData\n\s*\}\);/,
    `updateData.lastEnrichedAt = new Date();\n        const updatedAuthor = await prisma.author.update({\n            where: { id: authorId },\n            data: updateData\n        });`
);

// 4. Extract the discovery part
const discoveryStart = code.indexOf('if (!skipDiscovery) {');
const discoveryEnd = code.indexOf('} // close skipDiscovery block');

if (discoveryStart > -1 && discoveryEnd > -1) {
    // Remove the discovery block from syncAuthorProfile
    const part1 = code.slice(0, discoveryStart);
    const part2 = code.slice(discoveryEnd + '} // close skipDiscovery block'.length);
    code = part1 + part2;
}

// 5. Add discoverAuthorWorks and the wrapper enrichAuthorWithInventaire
const newFunctions = `
export const discoverAuthorWorks = async (authorId: number, authorUri?: string): Promise<void> => {
    try {
        const author = await (prisma.author as any).findUnique({ where: { id: authorId } });
        if (!author) return;

        const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
        const now = new Date().getTime();
        const lastDiscovered = author.lastDiscoveredAt ? new Date(author.lastDiscoveredAt).getTime() : 0;
        const isDiscoveryFresh = (now - lastDiscovered) < SEVEN_DAYS;

        if (isDiscoveryFresh) {
            console.log(\`[Inventaire] Author \${author.name} works already discovered recently. Skipping.\`);
            return;
        }

        const uri = authorUri || author.inventaireUri;
        if (!uri) return;

        console.log(\`[Inventaire] Discovering all works for author: \${author.name} (\${uri})\`);
        const workUris = await getAuthorWorkUris(uri);

        if (workUris.length > 0) {
            console.log(\`[Inventaire] Found \${workUris.length} works for author \${author.name}\`);

            const limitedUris = workUris.slice(0, 100);
            const CHUNK_SIZE = 25;
            for (let i = 0; i < limitedUris.length; i += CHUNK_SIZE) {
                const chunk = limitedUris.slice(i, i + CHUNK_SIZE);
                const [workEntities, bestCovers] = await Promise.all([
                    getBatchInventaireDetails(chunk),
                    getBestNativeCovers(chunk)
                ]);

                for (const [wUri, details] of Object.entries(workEntities)) {
                    if (!details || !details.title) continue;

                    const bestCover = bestCovers[wUri];
                    const finalCover = bestCover || details.image || null;
                    const bookTitle = details.title.trim();

                    const existingBook = await prisma.book.findFirst({
                        where: {
                            OR: [
                                { inventaireUri: wUri },
                                { AND: [{ title: bookTitle }, { authorId: author.id }] }
                            ]
                        }
                    });

                    if (!existingBook) {
                        console.log(\`[Inventaire] Auto-importing discovered work: \${bookTitle} for Author ID: \${author.id}\`);
                        try {
                            await prisma.book.create({
                                data: {
                                    title: bookTitle,
                                    authorId: author.id,
                                    inventaireUri: wUri,
                                    cover: finalCover,
                                    year: details.year || 0,
                                    description: '',
                                    genre: ''
                                }
                            });
                        } catch (err: any) {
                            if (err.code === 'P2002') {
                                console.log(\`[Inventaire] Book "\${bookTitle}" already exists (race condition), skipping.\`);
                            }
                        }
                    } else if (!existingBook.inventaireUri) {
                        await prisma.book.update({
                            where: { id: existingBook.id },
                            data: { inventaireUri: wUri }
                        });
                    }
                }
            }
        }

        await prisma.author.update({
            where: { id: authorId },
            data: { lastDiscoveredAt: new Date() } as any
        });

    } catch (e) {
        console.error(\`[Inventaire] Author discovery error:\`, e);
    }
};

/**
 * Orchestrates complete enrichment for an author (metadata + biography + image + works)
 */
export const enrichAuthorWithInventaire = async (authorId: number, authorName?: string, authorUri?: string, skipDiscovery: boolean = false): Promise<any> => {
    const author = await syncAuthorProfile(authorId, authorName, authorUri);
    if (!author) return null;
    
    if (!skipDiscovery) {
        await discoverAuthorWorks(authorId, author.inventaireUri);
    }
    return author;
};
`;

code = code.replace('export const getBestNativeCovers', newFunctions + '\nexport const getBestNativeCovers');

fs.writeFileSync(file, code);
console.log("Done");
