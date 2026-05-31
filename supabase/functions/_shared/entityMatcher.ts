/**
 * Entity Matching Service
 * Shared matching logic for authors and books
 * Used by both /quotes and /sync-quotes endpoints
 */
import { sql } from './db.ts';

/**
 * Normalizes a string for fuzzy matching:
 * - Converts to lowercase
 * - Trims whitespace
 * - Removes accents (diacritics)
 * - Removes punctuation
 */
export function normalizeName(name: string): string {
  if (!name || typeof name !== 'string') return '';
  
  return name
    .toLowerCase()
    .trim()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ');
}

/**
 * Result from author lookup
 */
export interface AuthorMatchResult {
  id: number;
  name: string;
  wasCreated: boolean;
  originalName: string;
}

/**
 * Finds an author by fuzzy matching on name
 * Tries multiple strategies: exact match, normalized match, partial match, then creates new
 */
export async function matchAuthor(authorName: string | null | undefined, createIfNotFound: boolean = true): Promise<AuthorMatchResult | null> {
  if (!authorName || !authorName.trim()) return null;

  const cleanName = authorName.trim();
  const normalizedName = normalizeName(cleanName);

  if (!normalizedName) return null;

  // Strategy 1: Try exact match first
  let authorRows: any[] = await sql`
    SELECT id, name FROM "Author" 
    WHERE name = ${cleanName} 
    LIMIT 1
  `;
  
  if (authorRows.length) {
    return {
      id: authorRows[0].id,
      name: authorRows[0].name,
      wasCreated: false,
      originalName: cleanName
    };
  }

  // Strategy 2: Try normalized match
  authorRows = await sql`
    SELECT id, name FROM "Author" 
    WHERE LOWER(
      UNICODE_TRANSLATE(
        name, 
        'ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞß',
        'aaaaaaaceeeeiiiidnoooooouuuuyybs'
      )
    ) = ${normalizedName}
    LIMIT 1
  `;
  
  if (authorRows.length) {
    return {
      id: authorRows[0].id,
      name: authorRows[0].name,
      wasCreated: false,
      originalName: cleanName
    };
  }

  // Strategy 3: Try fuzzy match with word reversal (handles "Hugo, Victor" vs "Victor Hugo")
  const words = cleanName.split(/[,\s]+/).filter(w => w.length > 1);
  if (words.length >= 2) {
    const reversedName = words.reverse().join(' ');
    authorRows = await sql`
      SELECT id, name FROM "Author" 
      WHERE LOWER(
        UNICODE_TRANSLATE(
          name, 
          'ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞß',
          'aaaaaaaceeeeiiiidnoooooouuuuyybs'
        )
      ) = ${normalizeName(reversedName)}
      LIMIT 1
    `;
    
    if (authorRows.length) {
      return {
        id: authorRows[0].id,
        name: authorRows[0].name,
        wasCreated: false,
        originalName: cleanName
      };
    }
  }

  // Strategy 4: Try partial match
  authorRows = await sql`
    SELECT id, name FROM "Author" 
    WHERE LOWER(
      UNICODE_TRANSLATE(
        name, 
        'ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞß',
        'aaaaaaaceeeeiiiidnoooooouuuuyybs'
      )
    ) LIKE ${'%' + normalizedName + '%'}
    ORDER BY 
      CASE 
        WHEN LOWER(UNICODE_TRANSLATE(name, 'ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞß', 'aaaaaaaceeeeiiiidnoooooouuuuyybs')) = ${normalizedName} THEN 1
        ELSE 2
      END
    LIMIT 1
  `;
  
  if (authorRows.length) {
    return {
      id: authorRows[0].id,
      name: authorRows[0].name,
      wasCreated: false,
      originalName: cleanName
    };
  }

  // Strategy 5: Create new author
  if (!createIfNotFound) return null;
  
  // Use ON CONFLICT to handle race conditions from concurrent sync requests
  const newAuthor = await sql`
    INSERT INTO "Author" (name, "isEnriching") 
    VALUES (${cleanName}, true) 
    ON CONFLICT (name) DO UPDATE 
    SET "isEnriching" = "Author"."isEnriching"
    RETURNING id, name
  `;
  
  return {
    id: newAuthor[0].id,
    name: newAuthor[0].name,
    wasCreated: true,
    originalName: cleanName
  };
}

/**
 * Result from book lookup
 */
export interface BookMatchResult {
  id: number;
  title: string;
  wasCreated: boolean;
  originalTitle: string;
}

/**
 * Finds a book by fuzzy matching on title and author
 */
export async function matchBook(bookTitle: string | null | undefined, authorId: number | null, createIfNotFound: boolean = true): Promise<BookMatchResult | null> {
  if (!bookTitle || !bookTitle.trim()) return null;

  const cleanTitle = bookTitle.trim();
  const normalizedTitle = normalizeName(cleanTitle);

  if (!normalizedTitle) return null;

  // Strategy 1: Try exact match with author
  if (authorId) {
    let bookRows: any[] = await sql`
      SELECT id, title FROM "Book" 
      WHERE title = ${cleanTitle} AND "authorId" = ${authorId}
      LIMIT 1
    `;
    
    if (bookRows.length) {
      return {
        id: bookRows[0].id,
        title: bookRows[0].title,
        wasCreated: false,
        originalTitle: cleanTitle
      };
    }
  }

  // Strategy 2: Try normalized match with author
  if (authorId) {
    let bookRows: any[] = await sql`
      SELECT id, title FROM "Book" 
      WHERE LOWER(
        UNICODE_TRANSLATE(
          title, 
          'ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞß',
          'aaaaaaaceeeeiiiidnoooooouuuuyybs'
        )
      ) = ${normalizedTitle} 
      AND "authorId" = ${authorId}
      LIMIT 1
    `;
    
    if (bookRows.length) {
      return {
        id: bookRows[0].id,
        title: bookRows[0].title,
        wasCreated: false,
        originalTitle: cleanTitle
      };
    }
  }

  // Strategy 3: Try without author (book with same title, any author)
  let bookRows: any[] = await sql`
    SELECT id, title, "authorId" FROM "Book" 
    WHERE LOWER(
      UNICODE_TRANSLATE(
        title, 
        'ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞß',
        'aaaaaaaceeeeiiiidnoooooouuuuyybs'
      )
    ) = ${normalizedTitle}
    ORDER BY 
      CASE 
        WHEN "authorId" = ${authorId} THEN 1
        ELSE 2
      END
    LIMIT 1
  `;
  
  if (bookRows.length) {
    return {
      id: bookRows[0].id,
      title: bookRows[0].title,
      wasCreated: false,
      originalTitle: cleanTitle
    };
  }

  // Strategy 4: Try partial match
  const titleWords = normalizedTitle.split(' ').filter(w => w.length > 2);
  if (titleWords.length > 0) {
    bookRows = await sql`
      SELECT id, title FROM "Book" 
      WHERE LOWER(
        UNICODE_TRANSLATE(
          title, 
          'ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞß',
          'aaaaaaaceeeeiiiidnoooooouuuuyybs'
        )
      ) LIKE ${'%' + titleWords[0] + '%'}
      AND (
        ${authorId ? sql`"authorId" = ${authorId} OR` : sql``} 
        ${titleWords.length > 1 ? sql`LOWER(UNICODE_TRANSLATE(title, 'ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞß', 'aaaaaaaceeeeiiiidnoooooouuuuyybs')) LIKE ${'%' + titleWords[1] + '%'}` : sql`true`}
      )
      LIMIT 1
    `;
    
    if (bookRows.length) {
      return {
        id: bookRows[0].id,
        title: bookRows[0].title,
        wasCreated: false,
        originalTitle: cleanTitle
      };
    }
  }

  // Strategy 5: Create new book
  if (!createIfNotFound) return null;

  // Use try-catch to handle race conditions from concurrent sync requests
  let newBook;
  try {
    newBook = await sql`
      INSERT INTO "Book" (title, "authorId", "isEnriching") 
      VALUES (${cleanTitle}, ${authorId}, true) RETURNING id, title
    `;
  } catch (err: any) {
    if (err.code === '23505') { // unique_violation
      const existing = await sql`
        SELECT id, title FROM "Book" 
        WHERE title = ${cleanTitle} AND "authorId" ${authorId ? sql`= ${authorId}` : sql`IS NULL`}
        LIMIT 1
      `;
      if (existing.length) {
        return {
          id: existing[0].id,
          title: existing[0].title,
          wasCreated: false,
          originalTitle: cleanTitle
        };
      }
    }
    throw err;
  }
  
  return {
    id: newBook[0].id,
    title: newBook[0].title,
    wasCreated: true,
    originalTitle: cleanTitle
  };
}
