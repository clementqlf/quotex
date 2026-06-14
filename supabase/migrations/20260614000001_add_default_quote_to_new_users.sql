-- Migration: Ajouter la citation modèle de Blaise Pascal pour chaque nouvel utilisateur
-- Date: 2026-06-14

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_author_id INTEGER;
  v_book_id INTEGER;
BEGIN
  -- 1. Création du profil utilisateur
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
