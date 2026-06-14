-- Migration: Créer la table UserFollow pour gérer les abonnements entre utilisateurs
-- Date: 2026-06-14

-- 1. Création de la table de liaison UserFollow
CREATE TABLE IF NOT EXISTS public."UserFollow" (
  "id" BIGSERIAL PRIMARY KEY,
  "followerId" UUID NOT NULL,
  "followingId" UUID NOT NULL,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
  
  -- Contraintes d'intégrité
  CONSTRAINT "UserFollow_followerId_fkey" FOREIGN KEY ("followerId") REFERENCES public."Profile" ("id") ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT "UserFollow_followingId_fkey" FOREIGN KEY ("followingId") REFERENCES public."Profile" ("id") ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT "UserFollow_followerId_followingId_key" UNIQUE ("followerId", "followingId"),
  
  -- Empêcher de s'abonner à soi-même
  CONSTRAINT "UserFollow_no_self_follow" CHECK ("followerId" <> "followingId")
);

-- 2. Index pour optimiser les performances des requêtes d'abonnements
CREATE INDEX IF NOT EXISTS "idx_userfollow_follower" ON public."UserFollow"("followerId");
CREATE INDEX IF NOT EXISTS "idx_userfollow_following" ON public."UserFollow"("followingId");

-- 3. Fonction et Trigger pour mettre à jour les compteurs followers/following dans Profile
CREATE OR REPLACE FUNCTION public.update_profile_follow_counts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Incrémenter l'abonnement pour celui qui s'abonne
    UPDATE public."Profile"
    SET "following" = "following" + 1
    WHERE id = NEW."followerId";

    -- Incrémenter le nombre d'abonnés pour celui qui est suivi
    UPDATE public."Profile"
    SET "followers" = "followers" + 1
    WHERE id = NEW."followingId";
  ELSIF TG_OP = 'DELETE' THEN
    -- Décrémenter l'abonnement pour celui qui se désabonne
    UPDATE public."Profile"
    SET "following" = GREATEST("following" - 1, 0)
    WHERE id = OLD."followerId";

    -- Décrémenter le nombre d'abonnés pour celui qui était suivi
    UPDATE public."Profile"
    SET "followers" = GREATEST("followers" - 1, 0)
    WHERE id = OLD."followingId";
  END IF;
  RETURN NULL;
END;
$function$;

DROP TRIGGER IF EXISTS trg_update_profile_follow_counts ON public."UserFollow";
CREATE TRIGGER trg_update_profile_follow_counts
AFTER INSERT OR DELETE ON public."UserFollow"
FOR EACH ROW
EXECUTE FUNCTION public.update_profile_follow_counts();

-- 4. Activer RLS sur la table UserFollow
ALTER TABLE public."UserFollow" ENABLE ROW LEVEL SECURITY;

-- 5. Créer les politiques RLS
DROP POLICY IF EXISTS "Anyone authenticated can view user follows" ON public."UserFollow";
CREATE POLICY "Anyone authenticated can view user follows"
ON public."UserFollow" FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Users can follow others" ON public."UserFollow";
CREATE POLICY "Users can follow others"
ON public."UserFollow" FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = "followerId");

DROP POLICY IF EXISTS "Users can unfollow others" ON public."UserFollow";
CREATE POLICY "Users can unfollow others"
ON public."UserFollow" FOR DELETE
TO authenticated
USING (auth.uid() = "followerId");
