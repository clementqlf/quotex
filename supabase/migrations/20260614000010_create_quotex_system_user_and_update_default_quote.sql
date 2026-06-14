-- Migration: Créer le compte système Quotex et publier la citation par défaut depuis ce compte
-- Date: 2026-06-14

-- 1. Mettre à jour la fonction handle_new_user
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_author_id INTEGER;
  v_book_id INTEGER;
  v_quotex_quote_id INTEGER;
  v_quotex_uuid UUID := '00000000-0000-0000-0000-000000000000';
BEGIN
  -- 1. Création du profil utilisateur dans Profile
  INSERT INTO public."Profile" (id, username, name, image)
  VALUES (
    new.id, 
    COALESCE(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)), 
    new.raw_user_meta_data->>'name', 
    new.raw_user_meta_data->>'image'
  )
  ON CONFLICT (id) DO NOTHING;

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

  IF new.id = v_quotex_uuid THEN
    -- Si c'est le compte système Quotex, on crée la citation modèle globale
    SELECT id INTO v_quotex_quote_id FROM public."Quote" 
    WHERE text = 'Pesons le gain et la perte, en prenant croix que Dieu est. Estimons ces deux cas : si vous gagnez, vous gagnez tout; si vous perdez, vous ne perdez rien. Gagez donc qu''il est, sans hésiter.'
      AND "userId" = v_quotex_uuid LIMIT 1;
      
    IF v_quotex_quote_id IS NULL THEN
      INSERT INTO public."Quote" (text, "userId", "authorId", "bookId", "likesCount", theme, "isPublic")
      VALUES (
        'Pesons le gain et la perte, en prenant croix que Dieu est. Estimons ces deux cas : si vous gagnez, vous gagnez tout; si vous perdez, vous ne perdez rien. Gagez donc qu''il est, sans hésiter.',
        v_quotex_uuid,
        v_author_id,
        v_book_id,
        0,
        'Philosophie',
        true
      )
      RETURNING id INTO v_quotex_quote_id;
    END IF;
  ELSE
    -- Pour tout autre utilisateur, on trouve la citation modèle globale possédée par Quotex
    SELECT id INTO v_quotex_quote_id FROM public."Quote" 
    WHERE "userId" = v_quotex_uuid 
      AND text = 'Pesons le gain et la perte, en prenant croix que Dieu est. Estimons ces deux cas : si vous gagnez, vous gagnez tout; si vous perdez, vous ne perdez rien. Gagez donc qu''il est, sans hésiter.'
    LIMIT 1;

    -- Si elle existe, on l'associe (sauvegarde) par défaut pour cet utilisateur
    IF v_quotex_quote_id IS NOT NULL THEN
      INSERT INTO public."UserQuote" ("userId", "quoteId")
      VALUES (new.id, v_quotex_quote_id)
      ON CONFLICT ("userId", "quoteId") DO NOTHING;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- 2. Insérer le compte système Quotex s'il n'existe pas encore
INSERT INTO auth.users (
  id,
  email,
  raw_user_meta_data,
  created_at,
  updated_at,
  role,
  aud,
  email_confirmed_at,
  encrypted_password
)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  'contact@quotex.app',
  '{"username": "quotex", "name": "Quotex"}',
  now(),
  now(),
  'authenticated',
  'authenticated',
  now(),
  ''
)
ON CONFLICT (id) DO NOTHING;

-- S'assurer que le profil et la citation modèle sont bien créés pour Quotex
-- (Au cas où le trigger n'a pas été déclenché ou s'est comporté différemment)
INSERT INTO public."Profile" (id, username, name)
VALUES ('00000000-0000-0000-0000-000000000000', 'quotex', 'Quotex')
ON CONFLICT (id) DO NOTHING;

-- Insérer la citation pour Quotex si elle n'existe pas
DO $$
DECLARE
  v_author_id INTEGER;
  v_book_id INTEGER;
  v_quotex_quote_id INTEGER;
BEGIN
  SELECT id INTO v_author_id FROM public."Author" WHERE name = 'Blaise Pascal' LIMIT 1;
  SELECT id INTO v_book_id FROM public."Book" WHERE title = 'Pensées' AND "authorId" = v_author_id LIMIT 1;
  
  SELECT id INTO v_quotex_quote_id FROM public."Quote" 
  WHERE "userId" = '00000000-0000-0000-0000-000000000000' 
    AND text = 'Pesons le gain et la perte, en prenant croix que Dieu est. Estimons ces deux cas : si vous gagnez, vous gagnez tout; si vous perdez, vous ne perdez rien. Gagez donc qu''il est, sans hésiter.'
  LIMIT 1;

  IF v_quotex_quote_id IS NULL THEN
    INSERT INTO public."Quote" (text, "userId", "authorId", "bookId", "likesCount", theme, "isPublic")
    VALUES (
      'Pesons le gain et la perte, en prenant croix que Dieu est. Estimons ces deux cas : si vous gagnez, vous gagnez tout; si vous perdez, vous ne perdez rien. Gagez donc qu''il est, sans hésiter.',
      '00000000-0000-0000-0000-000000000000',
      v_author_id,
      v_book_id,
      0,
      'Philosophie',
      true
    )
    RETURNING id INTO v_quotex_quote_id;
  END IF;

  -- 3. Nettoyer les doublons de citations pour les utilisateurs existants et migrer vers UserQuote
  -- On associe d'abord les utilisateurs existants à la citation système
  INSERT INTO public."UserQuote" ("userId", "quoteId")
  SELECT "userId", v_quotex_quote_id
  FROM public."Quote"
  WHERE text = 'Pesons le gain et la perte, en prenant croix que Dieu est. Estimons ces deux cas : si vous gagnez, vous gagnez tout; si vous perdez, vous ne perdez rien. Gagez donc qu''il est, sans hésiter.'
    AND "userId" != '00000000-0000-0000-0000-000000000000'
  ON CONFLICT ("userId", "quoteId") DO NOTHING;

  -- On supprime les citations doublons appartenant aux utilisateurs individuels
  DELETE FROM public."Quote"
  WHERE text = 'Pesons le gain et la perte, en prenant croix que Dieu est. Estimons ces deux cas : si vous gagnez, vous gagnez tout; si vous perdez, vous ne perdez rien. Gagez donc qu''il est, sans hésiter.'
    AND "userId" != '00000000-0000-0000-0000-000000000000';
END $$;
