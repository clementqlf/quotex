/**
 * Script pour créer les index un par un via le client PostgreSQL
 * Évite l'erreur "CREATE INDEX CONCURRENTLY cannot run inside a transaction block"
 * 
 * Usage:
 *   node supabase/migrations/create-indexes.mjs
 * 
 * Prérequis:
 *   - Node.js 16+
 *   - Installer pg: npm install pg
 *   - Configurer SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY dans .env.local
 */

import { execSync } from 'child_process';

console.log('✅ Supabase CLI prêt à l\'utilisation.');

function runCliQuery(sql) {
  const escapedSql = sql.replace(/'/g, "'\\''");
  const command = `supabase db query --linked '${escapedSql}'`;
  
  let output = '';
  try {
    output = execSync(command, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
  } catch (error) {
    const combinedOutput = (error.stdout || '') + (error.stderr || '');
    const start = combinedOutput.indexOf('{');
    const end = combinedOutput.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
      try {
        const jsonErr = JSON.parse(combinedOutput.substring(start, end + 1));
        return { error: jsonErr };
      } catch {}
    }
    return { error: { message: error.message || 'Unknown CLI execution error' } };
  }
  
  const start = output.indexOf('{');
  const end = output.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    try {
      return JSON.parse(output.substring(start, end + 1));
    } catch (err) {
      return { error: { message: `JSON parsing error: ${err.message}` } };
    }
  }
  return { error: { message: `No JSON object found in output: ${output}` } };
}

// Liste de tous les index à créer (par priorité)
const INDEXES = [
  // ===== PRIORITÉ 1: Index les plus utilisés =====
  'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_quote_userid ON "Quote"("userId")',
  'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_quote_authorid ON "Quote"("authorId")',
  'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_quote_bookid ON "Quote"("bookId")',
  'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_book_authorid ON "Book"("authorId")',
  
  // ===== PRIORITÉ 2: Tables de jointure =====
  'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_userbook_userid_bookid ON "UserBook"("userId", "bookId")',
  'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_userbook_bookid ON "UserBook"("bookId")',
  'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_userquote_userid_quoteid ON "UserQuote"("userId", "quoteId")',
  'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_userquote_quoteid ON "UserQuote"("quoteId")',
  'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_like_userid_quoteid ON "Like"("userId", "quoteId")',
  'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_like_quoteid ON "Like"("quoteId")',
  'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_userauthor_userid_authorid ON "UserAuthor"("userId", "authorId")',
  'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_userauthor_authorid ON "UserAuthor"("authorId")',
  'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_edition_bookid ON "Edition"("bookId")',
  'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_edition_isbn ON "Edition"(isbn)',
  'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_edition_inventaireuri ON "Edition"("inventaireUri")',
  'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_laureate_bookid ON "Laureate"("bookId")',
  'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_laureate_prizeid ON "Laureate"("prizeId")',
  'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_laureate_authorid ON "Laureate"("authorId")',
  
  // ===== PRIORITÉ 3: Index de tri =====
  'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_quote_date ON "Quote"("date" DESC)',
  'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_book_rating ON "Book"(rating DESC)',
  'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_book_year ON "Book"(year DESC)',
  'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_profile_username ON "Profile"(username)',
  'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_profile_id ON "Profile"(id)',
  'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_book_inventaireuri ON "Book"("inventaireUri")',
  'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_book_googleid ON "Book"("googleId")',
  'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_book_openlibraryid ON "Book"("openLibraryId")',
  
  // ===== PRIORITÉ 4: Index Full-Text Search (GIN) =====
  "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_quote_text_fts ON \"Quote\" USING GIN (to_tsvector('french', text))",
  "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_quote_theme_fts ON \"Quote\" USING GIN (to_tsvector('french', theme))",
  "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_book_title_fts ON \"Book\" USING GIN (to_tsvector('french', title))",
  "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_author_name_fts ON \"Author\" USING GIN (to_tsvector('french', name))",
];

// Délai entre chaque index (en millisecondes)
const DELAY_MS = 2000; // 2 secondes

/**
 * Exécute une requête SQL via le client PostgreSQL (Supabase CLI)
 */
async function executeQuery(query) {
  try {
    const res = runCliQuery(query);
    if (res.error) {
      console.error(`   ❌ Erreur: ${res.error.message || JSON.stringify(res.error)}`);
      return false;
    }
    return true;
  } catch (error) {
    console.error(`   ❌ Exception: ${error.message}`);
    return false;
  }
}

/**
 * Vérifie si un index existe déjà
 */
async function indexExists(indexName) {
  try {
    const res = runCliQuery(`SELECT 1 FROM pg_indexes WHERE indexname = '${indexName}' LIMIT 1;`);
    if (res.error) return false;
    return res.rows && res.rows.length > 0;
  } catch {
    return false;
  }
}

/**
 * Extrait le nom de l'index à partir de la commande CREATE INDEX
 */
function extractIndexName(createIndexQuery) {
  const match = createIndexQuery.match(/CREATE INDEX\s+CONCURRENTLY\s+IF NOT EXISTS\s+(\w+)/i);
  return match ? match[1] : '';
}

/**
 * Fonction principale
 */
async function main() {
  console.log(`📊 Nombre d'index à créer: ${INDEXES.length}`);
  console.log(`⏱️  Délai entre chaque: ${DELAY_MS / 1000}s\n`);
  
  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;
  
  for (let i = 0; i < INDEXES.length; i++) {
    const query = INDEXES[i];
    const indexName = extractIndexName(query);
    
    // Vérifier si l'index existe déjà
    const exists = await indexExists(indexName);
    if (exists) {
      console.log(`✅ [${i + 1}/${INDEXES.length}] ${indexName} - Déjà existe, ignoré`);
      skipCount++;
      continue;
    }
    
    console.log(`🔄 [${i + 1}/${INDEXES.length}] Création de ${indexName}...`);
    
    const success = await executeQuery(query);
    
    if (success) {
      console.log(`✅ [${i + 1}/${INDEXES.length}] ${indexName} - Créé avec succès`);
      successCount++;
    } else {
      console.log(`❌ [${i + 1}/${INDEXES.length}] ${indexName} - Échec`);
      errorCount++;
    }
    
    // Attendre avant de passer à l'index suivant
    if (i < INDEXES.length - 1) {
      await new Promise(resolve => setTimeout(resolve, DELAY_MS));
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 RÉSUMÉ:');
  console.log(`   ✅ Créés: ${successCount}`);
  console.log(`   ⏭️  Ignorés (déjà existants): ${skipCount}`);
  console.log(`   ❌ Échecs: ${errorCount}`);
  console.log('='.repeat(60));
  
  if (errorCount > 0) {
    console.log('\n⚠️  Certains index ont échoué. Vérifiez les erreurs ci-dessus.');
    console.log('   Vous pouvez relancer le script pour réessayer.');
  } else {
    console.log('\n🎉 Tous les index ont été créés avec succès !');
  }
}

// Exécuter
main().catch(console.error);
