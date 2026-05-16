-- CreateTable
CREATE TABLE "public"."LiteraryPrize" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "image" TEXT,
    "inventaireUri" TEXT,
    "wikipediaTitle" TEXT,

    CONSTRAINT "LiteraryPrize_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Laureate" (
    "id" SERIAL NOT NULL,
    "prizeId" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "authorId" INTEGER,
    "bookId" INTEGER,
    "authorName" TEXT NOT NULL,
    "bookTitle" TEXT,
    "authorQid" TEXT,
    "workQid" TEXT,

    CONSTRAINT "Laureate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Laureate_prizeId_year_authorName_key" ON "public"."Laureate"("prizeId", "year", "authorName");

-- CreateIndex
CREATE UNIQUE INDEX "LiteraryPrize_name_key" ON "public"."LiteraryPrize"("name");

-- CreateIndex
CREATE UNIQUE INDEX "LiteraryPrize_inventaireUri_key" ON "public"."LiteraryPrize"("inventaireUri");

-- AddForeignKey
ALTER TABLE "public"."Laureate" ADD CONSTRAINT "Laureate_prizeId_fkey" FOREIGN KEY ("prizeId") REFERENCES "public"."LiteraryPrize"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Laureate" ADD CONSTRAINT "Laureate_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "public"."Author"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Laureate" ADD CONSTRAINT "Laureate_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "public"."Book"("id") ON DELETE SET NULL ON UPDATE CASCADE;
