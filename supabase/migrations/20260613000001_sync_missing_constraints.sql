-- Migration de synchronisation pour ajouter les contraintes d'unicité manquantes en PROD

-- 1. Ajouter la contrainte UNIQUE sur ForbiddenWord (word)
ALTER TABLE "ForbiddenWord" ADD CONSTRAINT "ForbiddenWord_word_key" UNIQUE ("word");

-- 2. Ajouter la contrainte UNIQUE sur Report (reporterId, reviewId)
ALTER TABLE "Report" ADD CONSTRAINT "Report_reporterId_reviewId_key" UNIQUE ("reporterId", "reviewId");

-- 3. Ajouter la contrainte UNIQUE sur UserBlock (blockerId, blockedId)
ALTER TABLE "UserBlock" ADD CONSTRAINT "UserBlock_blockerId_blockedId_key" UNIQUE ("blockerId", "blockedId");
