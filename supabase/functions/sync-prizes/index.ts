/**
 * Edge Function: /sync-prizes
 * Strategy: "Lazy Population" — every laureate author + book is persisted
 * in the shared catalogue (Author/Book tables) during sync.
 * Future requests are served from local DB, no external calls needed.
 */
// @ts-ignore deno
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { handleCors, json, error } from '../_shared/cors.ts';
import { sql } from '../_shared/db.ts';
import { getInventaireEntities, resolveImageUrl, getBatchInventaireSearchMetadata, getBestNativeCovers, fetchWikipediaSynopsis } from '../_shared/inventaire.api.ts';
import { getPrizeLaureates } from '../_shared/wikidata.ts';

// ─── Helpers ────────────────────────────────────────────────────────────────

const getLabel = (entity: any): string | null => {
  const labels = entity?.labels || {};
  return labels['fr'] || labels['en'] || null;
};

const getDescription = (entity: any): string | null => {
  const desc = entity?.descriptions || {};
  return desc['fr'] || desc['en'] || null;
};

const resolveEntityImage = (entity: any): string | null => {
  if (!entity?.image) return null;
  const raw = typeof entity.image === 'string'
    ? entity.image
    : (entity.image.url || entity.image.file || null);
  return resolveImageUrl(raw);
};

const getClaimValue = (entity: any, prop: string): string | null => {
  const values = entity?.claims?.[prop];
  return values?.[0] || null;
};

async function getPrizeWikidataDetails(qid: string): Promise<{ inceptionYear: number | null, founder: string | null } | null> {
  try {
    const sparql = `
        SELECT ?inception ?conferredByLabel ?founderLabel WHERE {
          OPTIONAL { wd:${qid} wdt:P571 ?inception . }
          OPTIONAL {
            wd:${qid} wdt:P1027 ?conferredBy .
            OPTIONAL { ?conferredBy rdfs:label ?lblFr. FILTER(LANG(?lblFr) = "fr") }
            OPTIONAL { ?conferredBy rdfs:label ?lblEn. FILTER(LANG(?lblEn) = "en") }
            BIND(COALESCE(?lblFr, ?lblEn) AS ?conferredByLabel)
          }
          OPTIONAL {
            wd:${qid} wdt:P112 ?founder .
            OPTIONAL { ?founder rdfs:label ?lblFounderFr. FILTER(LANG(?lblFounderFr) = "fr") }
            OPTIONAL { ?founder rdfs:label ?lblFounderEn. FILTER(LANG(?lblFounderEn) = "en") }
            BIND(COALESCE(?lblFounderFr, ?lblFounderEn) AS ?founderLabel)
          }
        } LIMIT 1
    `;
    const url = `https://query.wikidata.org/sparql?query=${encodeURIComponent(sparql)}&format=json`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'QuotexApp/1.0 (contact: support@quotex.app)',
        'Accept': 'application/sparql-results+json'
      }
    });
    if (!res.ok) return null;
    const data = await res.json();
    const binding = data.results?.bindings?.[0];
    if (!binding) return null;

    const inceptionRaw = binding.inception?.value;
    const inceptionYear = inceptionRaw ? parseInt(inceptionRaw.substring(0, 4)) : null;
    const founder = binding.conferredByLabel?.value || binding.founderLabel?.value || null;

    return { inceptionYear, founder };
  } catch (e) {
    console.error(`[sync-prizes] Error fetching SPARQL details for ${qid}:`, e);
    return null;
  }
}

// Batch fetch from Inventaire in chunks of 50
async function batchFetchEntities(uris: string[]): Promise<Record<string, any>> {
  const result: Record<string, any> = {};
  const CHUNK = 50;
  for (let i = 0; i < uris.length; i += CHUNK) {
    const chunk = uris.slice(i, i + CHUNK);
    const entities = await getInventaireEntities(chunk);
    Object.assign(result, entities);
  }
  return result;
}

// ─── Handler ────────────────────────────────────────────────────────────────

serve(async (req: Request) => {
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

  if (req.method !== 'POST') return error('Method not allowed', 405);

  try {
    const { prizeName, prizeUri, offset = 0, limit = 30 } = await req.json();
    let uri = prizeUri;

    // 1. Resolve URI if only a name was given
    if (!uri && prizeName) {
      console.log(`[sync-prizes] Searching for prize: ${prizeName}`);
      const wdUrl = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(prizeName)}&language=fr&format=json&origin=*&type=item`;
      const wdRes = await fetch(wdUrl, { headers: { 'User-Agent': 'QuotexApp/1.0' } });
      const wdData = await wdRes.json();
      if (wdData.search?.length > 0) {
        uri = `wd:${wdData.search[0].id}`;
      }
    }

    if (!uri) return error('Could not find prize URI', 404);
    if (!uri.startsWith('wd:')) return error('Only Wikidata URIs are supported', 400);

    const qid = uri.substring(3);

    // 2. Fetch prize details from Inventaire → upsert in LiteraryPrize
    console.log(`[sync-prizes] Fetching prize details for ${uri}`);
    const prizeEntities = await getInventaireEntities([uri]);
    const prizeEntity = prizeEntities[uri];
    if (!prizeEntity) return error('Prize entity not found on Inventaire', 404);

    const prizeName_ = getLabel(prizeEntity) || 'Unknown Prize';
    const prizeImage = resolveEntityImage(prizeEntity);

    // 2a. Resolve Wikipedia synopsis if possible
    const sitelinks = prizeEntity?.sitelinks || {};
    const wikipediaTitle = sitelinks['frwiki']?.title || sitelinks['enwiki']?.title || null;
    let prizeDesc = getDescription(prizeEntity);

    if (wikipediaTitle) {
      try {
        console.log(`[sync-prizes] Fetching Wikipedia synopsis for: ${wikipediaTitle}`);
        const wikiSynopsis = await fetchWikipediaSynopsis(wikipediaTitle, 'fr');
        if (wikiSynopsis) {
          prizeDesc = wikiSynopsis;
        }
      } catch (e) {
        console.warn(`[sync-prizes] Failed to fetch Wikipedia synopsis for ${wikipediaTitle}:`, e);
      }
    }

    // 2b. Fetch Wikidata details (inceptionYear, founder)
    let inceptionYear: number | null = null;
    let founder: string | null = null;
    try {
      console.log(`[sync-prizes] Fetching Wikidata SPARQL details for: ${qid}`);
      const extDetails = await getPrizeWikidataDetails(qid);
      if (extDetails) {
        inceptionYear = extDetails.inceptionYear;
        founder = extDetails.founder;
      }
    } catch (e) {
      console.warn(`[sync-prizes] Failed to fetch external Wikidata details for ${qid}:`, e);
    }

    const [prize] = await sql`
      INSERT INTO "LiteraryPrize" (name, description, image, "inventaireUri", "wikipediaTitle", "inceptionYear", "founder")
      VALUES (${prizeName_}, ${prizeDesc}, ${prizeImage}, ${uri}, ${wikipediaTitle}, ${inceptionYear}, ${founder})
      ON CONFLICT ("inventaireUri") DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        image = EXCLUDED.image,
        "wikipediaTitle" = EXCLUDED."wikipediaTitle",
        "inceptionYear" = EXCLUDED."inceptionYear",
        "founder" = EXCLUDED."founder"
      RETURNING id
    `;
    console.log(`[sync-prizes] Prize upserted: "${prizeName_}" (id=${prize.id})`);

    // 3. Fetch laureates list from Wikidata SPARQL
    console.log(`[sync-prizes] Fetching laureates for QID: ${qid}`);
    const laureates = await getPrizeLaureates(qid);
    // Slice based on pagination parameters
    const recentLaureates = laureates.slice(offset, offset + limit);
    console.log(`[sync-prizes] Processing batch of ${recentLaureates.length} laureates (offset: ${offset}, limit: ${limit})`);

    // 4. Collect all unique URIs to batch-fetch from Inventaire
    const authorUris = [...new Set(
      recentLaureates.filter(l => l.authorQid).map(l => `wd:${l.authorQid}`)
    )];
    const workUris = [...new Set(
      recentLaureates.filter(l => l.workQid).map(l => `wd:${l.workQid}`)
    )];

    console.log(`[sync-prizes] Batch-fetching ${authorUris.length} authors + ${workUris.length} works from Inventaire`);
    const [authorEntities, workEntities, workSearchMetadata, bestNativeCovers] = await Promise.all([
      batchFetchEntities(authorUris),
      batchFetchEntities(workUris),
      getBatchInventaireSearchMetadata(workUris),
      getBestNativeCovers(workUris),  // Same cover logic as full enrichment
    ]);

    // 5. For each laureate: upsert Author → upsert Book → upsert Laureate
    let synced = 0;
    let authorsCreated = 0;
    let booksCreated = 0;

    console.log(`[sync-prizes] Starting loop for ${recentLaureates.length} laureates...`);

    for (const l of recentLaureates) {
      try {
        if (!l.year || !l.authorQid) {
          console.log(`[sync-prizes] Skipping laureate ${l.year || 'unknown year'} (missing authorQid)`);
          continue;
        }

        const authorUri = `wd:${l.authorQid}`;
        const authorEntity = authorEntities[authorUri];

        // Upsert Author into shared catalogue
        const authorName = getLabel(authorEntity) || l.authorName;
        const authorDesc = getDescription(authorEntity);
        const authorImage = resolveEntityImage(authorEntity);
        const birthDate = getClaimValue(authorEntity, 'wdt:P569')?.substring(0, 4) || null;

        const [author] = await sql`
          INSERT INTO "Author" (name, description, image, "birthDate", "inventaireUri")
          VALUES (${authorName}, ${authorDesc}, ${authorImage}, ${birthDate}, ${authorUri})
          ON CONFLICT ("inventaireUri") DO UPDATE SET
            name        = COALESCE(EXCLUDED.name, "Author".name),
            description = COALESCE(EXCLUDED.description, "Author".description),
            image       = COALESCE(EXCLUDED.image, "Author".image),
            "birthDate" = COALESCE(EXCLUDED."birthDate", "Author"."birthDate")
          RETURNING id
        `;
        authorsCreated++;

        // Upsert Book into shared catalogue
        let bookId: number | null = null;
        if (l.workQid) {
          const workUri = `wd:${l.workQid}`;
          const workEntity = workEntities[workUri];
          const bookTitle = getLabel(workEntity) || l.workTitle || null;
          const bookDesc = getDescription(workEntity);
          // Use the same cover priority as enrichWorkMetadata:
          // 1. Best native edition cover (FR edition + /img/entities/ scan preferred)
          // 2. Search metadata image (fallback)
          // 3. Work entity image (last resort)
          let bookCover: string | null = bestNativeCovers[workUri] || null;
          if (!bookCover && workSearchMetadata[workUri]?.image) {
            bookCover = workSearchMetadata[workUri].image;
          }
          if (!bookCover) {
            bookCover = resolveEntityImage(workEntity);
          }
          const yearRaw = getClaimValue(workEntity, 'wdt:P577');
          const bookYear = yearRaw ? parseInt(yearRaw.substring(0, 4)) : null;

          if (bookTitle) {
            const [book] = await sql`
              INSERT INTO "Book" (title, description, cover, year, "authorId", "inventaireUri")
              VALUES (${bookTitle}, ${bookDesc}, ${bookCover}, ${bookYear}, ${author.id}, ${workUri})
              ON CONFLICT ("inventaireUri") DO UPDATE SET
                title       = COALESCE(EXCLUDED.title, "Book".title),
                description = COALESCE(EXCLUDED.description, "Book".description),
                cover       = COALESCE("Book".cover, EXCLUDED.cover),
                year        = COALESCE(EXCLUDED.year, "Book".year)
              RETURNING id
            `;
            bookId = book.id;
            booksCreated++;
          }
        }

        // Upsert Laureate
        await sql`
          INSERT INTO "Laureate" ("prizeId", year, "authorId", "bookId")
          VALUES (${prize.id}, ${l.year}, ${author.id}, ${bookId})
          ON CONFLICT ("prizeId", year, "authorId") DO UPDATE SET
            "bookId" = EXCLUDED."bookId"
        `;

        synced++;
        if (synced % 10 === 0) {
          console.log(`[sync-prizes] Progress: ${synced}/${recentLaureates.length} laureates synced...`);
        }
      } catch (itemError: any) {
        console.error(`[sync-prizes] ❌ Error on laureate ${l.year}/${l.authorName}:`, itemError.message);
      }
    }

    console.log(`[sync-prizes] ✅ SUCCESS: ${synced} laureates, ${authorsCreated} authors, ${booksCreated} books updated in catalogue.`);

    return json({
      success: true,
      prizeId: prize.id,
      prizeName: prizeName_,
      laureatesCount: synced,
      hasMore: offset + limit < laureates.length,
    });

  } catch (e: any) {
    console.error('[sync-prizes] Fatal error:', e);
    return error(e.message, 500);
  }
});
