-- Migration pour ajouter les politiques de sécurité RLS manquantes sur ForbiddenWord et UserBlock

-- 1. Autoriser la lecture des mots interdits pour les utilisateurs authentifiés
DROP POLICY IF EXISTS "Allow authenticated read access to ForbiddenWord" ON "ForbiddenWord";
CREATE POLICY "Allow authenticated read access to ForbiddenWord"
ON "ForbiddenWord" FOR SELECT
TO authenticated
USING (true);

-- 2. Autoriser les utilisateurs à voir leurs propres blocages (bloqueur ou bloqué)
DROP POLICY IF EXISTS "Users can view their own blocks" ON "UserBlock";
CREATE POLICY "Users can view their own blocks"
ON "UserBlock" FOR SELECT
USING (auth.uid() = "blockerId" OR auth.uid() = "blockedId");
