-- Automatically generated schema dump from development database

CREATE SEQUENCE IF NOT EXISTS "Author_id_seq";
CREATE SEQUENCE IF NOT EXISTS "Book_id_seq";
CREATE SEQUENCE IF NOT EXISTS "Edition_id_seq";
CREATE SEQUENCE IF NOT EXISTS "ForbiddenWord_id_seq";
CREATE SEQUENCE IF NOT EXISTS "Laureate_id_seq";
CREATE SEQUENCE IF NOT EXISTS "Like_id_seq";
CREATE SEQUENCE IF NOT EXISTS "LiteraryPrize_id_seq";
CREATE SEQUENCE IF NOT EXISTS "Quote_id_seq";
CREATE SEQUENCE IF NOT EXISTS "Report_id_seq";
CREATE SEQUENCE IF NOT EXISTS "Review_id_seq";
CREATE SEQUENCE IF NOT EXISTS "SearchCache_id_seq";
CREATE SEQUENCE IF NOT EXISTS "UserBlock_id_seq";

CREATE TABLE IF NOT EXISTS "Author" (
  "id" INTEGER NOT NULL DEFAULT nextval('"Author_id_seq"'::regclass),
  "name" TEXT NOT NULL,
  "description" TEXT,
  "image" TEXT,
  "birthDate" TEXT,
  "nationality" TEXT,
  "inventaireUri" TEXT,
  "isEnriching" BOOLEAN NOT NULL DEFAULT false,
  "lastEnrichedAt" TIMESTAMP WITHOUT TIME ZONE,
  "lastDiscoveredAt" TIMESTAMP WITHOUT TIME ZONE,
  CONSTRAINT "Author_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Book" (
  "id" INTEGER NOT NULL DEFAULT nextval('"Book_id_seq"'::regclass),
  "title" TEXT NOT NULL,
  "description" TEXT,
  "year" INTEGER,
  "pages" INTEGER,
  "cover" TEXT,
  "genre" TEXT,
  "rating" DOUBLE PRECISION,
  "buyLinks" TEXT,
  "googleId" TEXT,
  "openLibraryId" TEXT,
  "inventaireUri" TEXT,
  "authorId" INTEGER,
  "isEnriching" BOOLEAN NOT NULL DEFAULT false,
  "lastEnrichedAt" TIMESTAMP WITHOUT TIME ZONE,
  "lastDiscoveredAt" TIMESTAMP WITHOUT TIME ZONE,
  CONSTRAINT "Book_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Edition" (
  "id" INTEGER NOT NULL DEFAULT nextval('"Edition_id_seq"'::regclass),
  "inventaireUri" TEXT NOT NULL,
  "isbn" TEXT,
  "title" TEXT,
  "publishDate" TEXT,
  "publisherUri" TEXT,
  "publisherName" TEXT,
  "languageUri" TEXT,
  "cover" TEXT,
  "pages" INTEGER,
  "bookId" INTEGER NOT NULL,
  "createdAt" TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Edition_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ForbiddenWord" (
  "id" INTEGER NOT NULL DEFAULT nextval('"ForbiddenWord_id_seq"'::regclass),
  "word" CHARACTER VARYING(255) NOT NULL,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT "ForbiddenWord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Laureate" (
  "id" INTEGER NOT NULL DEFAULT nextval('"Laureate_id_seq"'::regclass),
  "prizeId" INTEGER NOT NULL,
  "year" INTEGER NOT NULL,
  "authorId" INTEGER NOT NULL,
  "bookId" INTEGER,
  CONSTRAINT "Laureate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Like" (
  "id" INTEGER NOT NULL DEFAULT nextval('"Like_id_seq"'::regclass),
  "createdAt" TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "userId" UUID NOT NULL,
  "quoteId" INTEGER NOT NULL,
  CONSTRAINT "Like_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "LiteraryPrize" (
  "id" INTEGER NOT NULL DEFAULT nextval('"LiteraryPrize_id_seq"'::regclass),
  "name" TEXT NOT NULL,
  "description" TEXT,
  "image" TEXT,
  "inventaireUri" TEXT,
  "wikipediaTitle" TEXT,
  CONSTRAINT "LiteraryPrize_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Profile" (
  "id" UUID NOT NULL,
  "username" TEXT NOT NULL,
  "name" TEXT,
  "image" TEXT,
  "bio" TEXT,
  "website" TEXT,
  "followers" INTEGER NOT NULL DEFAULT 0,
  "following" INTEGER NOT NULL DEFAULT 0,
  "isPublic" BOOLEAN DEFAULT true,
  "isAdmin" BOOLEAN DEFAULT false,
  CONSTRAINT "Profile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Quote" (
  "id" INTEGER NOT NULL DEFAULT nextval('"Quote_id_seq"'::regclass),
  "text" TEXT NOT NULL,
  "userId" UUID,
  "authorId" INTEGER,
  "bookId" INTEGER,
  "likesCount" INTEGER NOT NULL DEFAULT 0,
  "date" TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "theme" TEXT,
  "aiInterpretation" TEXT,
  "blockData" TEXT,
  "isPublic" BOOLEAN DEFAULT true,
  CONSTRAINT "Quote_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Report" (
  "id" INTEGER NOT NULL DEFAULT nextval('"Report_id_seq"'::regclass),
  "reporterId" UUID NOT NULL,
  "reviewId" INTEGER,
  "reason" TEXT NOT NULL,
  "status" TEXT DEFAULT 'pending'::text,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Review" (
  "id" INTEGER NOT NULL DEFAULT nextval('"Review_id_seq"'::regclass),
  "rating" INTEGER NOT NULL,
  "comment" TEXT,
  "createdAt" TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "userId" UUID NOT NULL,
  "bookId" INTEGER NOT NULL,
  CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SearchCache" (
  "id" INTEGER NOT NULL DEFAULT nextval('"SearchCache_id_seq"'::regclass),
  "query" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "results" TEXT NOT NULL,
  "createdAt" TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP WITHOUT TIME ZONE NOT NULL,
  CONSTRAINT "SearchCache_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "UserAuthor" (
  "userId" UUID NOT NULL,
  "authorId" INTEGER NOT NULL,
  "addedAt" TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserAuthor_pkey" PRIMARY KEY ("userId", "authorId")
);

CREATE TABLE IF NOT EXISTS "UserBlock" (
  "id" INTEGER NOT NULL DEFAULT nextval('"UserBlock_id_seq"'::regclass),
  "blockerId" UUID NOT NULL,
  "blockedId" UUID NOT NULL,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT "UserBlock_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "UserBook" (
  "userId" UUID NOT NULL,
  "bookId" INTEGER NOT NULL,
  "status" TEXT,
  "addedAt" TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "addedViaQuote" BOOLEAN DEFAULT false,
  CONSTRAINT "UserBook_pkey" PRIMARY KEY ("userId", "bookId")
);

CREATE TABLE IF NOT EXISTS "UserQuote" (
  "userId" UUID NOT NULL,
  "quoteId" INTEGER NOT NULL,
  "addedAt" TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserQuote_pkey" PRIMARY KEY ("userId", "quoteId")
);

CREATE TABLE IF NOT EXISTS "_SimilarAuthors" (
  "A" INTEGER NOT NULL,
  "B" INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS "_SimilarBooks" (
  "A" INTEGER NOT NULL,
  "B" INTEGER NOT NULL
);

-- Foreign key constraints

ALTER TABLE "Book" ADD CONSTRAINT "Book_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "Author" ("id") ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE "Edition" ADD CONSTRAINT "Edition_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book" ("id") ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE "Laureate" ADD CONSTRAINT "Laureate_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "Author" ("id") ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE "Laureate" ADD CONSTRAINT "Laureate_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book" ("id") ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE "Laureate" ADD CONSTRAINT "Laureate_prizeId_fkey" FOREIGN KEY ("prizeId") REFERENCES "LiteraryPrize" ("id") ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE "Like" ADD CONSTRAINT "Like_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote" ("id") ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE "Like" ADD CONSTRAINT "Like_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Profile" ("id") ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE "Profile" ADD CONSTRAINT "Profile_id_fkey" FOREIGN KEY ("id") REFERENCES auth.users (id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "Author" ("id") ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book" ("id") ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Profile" ("id") ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE "Report" ADD CONSTRAINT "Report_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "Profile" ("id") ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE "Report" ADD CONSTRAINT "Report_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "Review" ("id") ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE "Review" ADD CONSTRAINT "Review_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book" ("id") ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE "Review" ADD CONSTRAINT "Review_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Profile" ("id") ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE "UserAuthor" ADD CONSTRAINT "UserAuthor_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "Author" ("id") ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE "UserAuthor" ADD CONSTRAINT "UserAuthor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Profile" ("id") ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE "UserBlock" ADD CONSTRAINT "UserBlock_blockedId_fkey" FOREIGN KEY ("blockedId") REFERENCES "Profile" ("id") ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE "UserBlock" ADD CONSTRAINT "UserBlock_blockerId_fkey" FOREIGN KEY ("blockerId") REFERENCES "Profile" ("id") ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE "UserBook" ADD CONSTRAINT "UserBook_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book" ("id") ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE "UserBook" ADD CONSTRAINT "UserBook_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Profile" ("id") ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE "UserQuote" ADD CONSTRAINT "UserQuote_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote" ("id") ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE "UserQuote" ADD CONSTRAINT "UserQuote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Profile" ("id") ON UPDATE CASCADE ON DELETE CASCADE;
