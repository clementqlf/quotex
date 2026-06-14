-- Migration: Remplacer la citation par défaut (Georges Duhamel) par Blaise Pascal (les Pensées)
-- Date: 2026-06-14

-- 1. Mettre à jour la fonction handle_new_user pour les futurs inscrits
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_author_id INTEGER;
  v_book_id INTEGER;
BEGIN
  -- 1. Création du profil utilisateur dans Profile
  INSERT INTO public."Profile" (id, username, name, image)
  VALUES (
    new.id, 
    COALESCE(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)), 
    new.raw_user_meta_data->>'name', 
    new.raw_user_meta_data->>'image'
  );

  -- 2. Recherche ou création de l'auteur "Blaise Pascal"
  SELECT id INTO v_author_id FROM public."Author" WHERE name = 'Blaise Pascal' LIMIT 1;
  IF v_author_id IS NULL THEN
    INSERT INTO public."Author" (name)
    VALUES ('Blaise Pascal')
    RETURNING id INTO v_author_id;
  END IF;

  -- 3. Recherche ou création du livre "Pensées"
  SELECT id INTO v_book_id FROM public."Book" WHERE title = 'Pensées' AND "authorId" = v_author_id LIMIT 1;
  IF v_book_id IS NULL THEN
    INSERT INTO public."Book" (title, "authorId", year)
    VALUES ('Pensées', v_author_id, 1670)
    RETURNING id INTO v_book_id;
  END IF;

  -- 4. Création de la citation modèle
  INSERT INTO public."Quote" (text, "userId", "authorId", "bookId", "likesCount", theme, "isPublic")
  VALUES (
    'Pesons le gain et la perte, en prenant croix que Dieu est. Estimons ces deux cas : si vous gagnez, vous gagnez tout; si vous perdez, vous ne perdez rien. Gagez donc qu''il est, sans hésiter.',
    new.id,
    v_author_id,
    v_book_id,
    0,
    'Philosophie',
    true
  );

  RETURN NEW;
END;
$function$;

-- 2. Mettre à jour les données existantes des utilisateurs déjà inscrits qui ont l'ancienne citation
-- Auteur "Blaise Pascal"
INSERT INTO public."Author" (name)
SELECT 'Blaise Pascal'
WHERE NOT EXISTS (SELECT 1 FROM public."Author" WHERE name = 'Blaise Pascal');

-- Livre "Pensées"
INSERT INTO public."Book" (title, "authorId", year)
SELECT 'Pensées', (SELECT id FROM public."Author" WHERE name = 'Blaise Pascal' LIMIT 1), 1670
WHERE NOT EXISTS (
  SELECT 1 FROM public."Book" 
  WHERE title = 'Pensées' 
  AND "authorId" = (SELECT id FROM public."Author" WHERE name = 'Blaise Pascal' LIMIT 1)
);

-- Remplacement de la citation pour les comptes existants
UPDATE public."Quote"
SET 
  text = 'Pesons le gain et la perte, en prenant croix que Dieu est. Estimons ces deux cas : si vous gagnez, vous gagnez tout; si vous perdez, vous ne perdez rien. Gagez donc qu''il est, sans hésiter.',
  "authorId" = (SELECT id FROM public."Author" WHERE name = 'Blaise Pascal' LIMIT 1),
  "bookId" = (SELECT id FROM public."Book" WHERE title = 'Pensées' AND "authorId" = (SELECT id FROM public."Author" WHERE name = 'Blaise Pascal' LIMIT 1) LIMIT 1),
  theme = 'Philosophie'
WHERE text = 'Le romancier est l’historien du présent, alors que l’historien est le romancier du passé';
