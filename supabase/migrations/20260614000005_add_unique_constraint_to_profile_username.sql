-- Migration: Ajouter une contrainte UNIQUE sur la colonne username de la table Profile
-- Date: 2026-06-14

-- 1. Nettoyer les doublons existants en ajoutant un suffixe unique
WITH duplicates AS (
  SELECT id, username,
         ROW_NUMBER() OVER (PARTITION BY LOWER(username) ORDER BY id) as rn
  FROM public."Profile"
)
UPDATE public."Profile" p
SET username = p.username || '_' || (d.rn - 1)
FROM duplicates d
WHERE p.id = d.id AND d.rn > 1;

-- 2. Ajouter la contrainte UNIQUE sur la colonne username
ALTER TABLE public."Profile" ADD CONSTRAINT "Profile_username_key" UNIQUE (username);
