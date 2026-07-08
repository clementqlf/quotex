-- Drop the existing incorrect constraints on Laureate
ALTER TABLE "Laureate" 
DROP CONSTRAINT IF EXISTS "Laureate_authorId_fkey",
DROP CONSTRAINT IF EXISTS "Laureate_bookId_fkey";

-- Re-create constraints with ON DELETE CASCADE
ALTER TABLE "Laureate"
ADD CONSTRAINT "Laureate_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "Author"("id") ON UPDATE CASCADE ON DELETE CASCADE,
ADD CONSTRAINT "Laureate_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON UPDATE CASCADE ON DELETE CASCADE;
