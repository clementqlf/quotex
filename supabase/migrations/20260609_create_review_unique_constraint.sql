ALTER TABLE "Review" ADD CONSTRAINT "Review_userId_bookId_key" UNIQUE ("userId", "bookId");
