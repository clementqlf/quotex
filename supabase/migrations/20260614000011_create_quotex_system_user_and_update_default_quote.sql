-- Migration: Créer le compte système Quotex et publier la citation par défaut depuis ce compte
-- Date: 2026-06-14

CREATE OR REPLACE FUNCTION public.seed_quotex_static_content()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_author_id INTEGER;
  v_book_id INTEGER;
  v_quote_id INTEGER;
  v_quotex_uuid UUID := '00000000-0000-0000-0000-000000000000';
  v_quotex_image TEXT := 'https://neurbzkkfxrjzjykthtn.supabase.co/storage/v1/object/public/avatars/00000000-0000-0000-0000-000000000000/Icon-iOS-Default-1024x1024@1x.png';
  r RECORD;
BEGIN
  UPDATE public."Profile"
  SET image = COALESCE(image, v_quotex_image)
  WHERE id = v_quotex_uuid;

  FOR r IN
    SELECT *
    FROM (VALUES
      ('The only way to do great work is to love what you do.', 'Steve Jobs', 'Steve Jobs', 2011, 'Passion et excellence', 'wd:Q19837', 'wd:Q480332'),
      ('In the middle of difficulty lies opportunity.', 'Albert Einstein', 'Einstein: His Life and Universe', 2007, 'Résilience et opportunité', 'wd:Q937', 'wd:Q5349791'),
      ('It is our choices that show what we truly are, far more than our abilities.', 'J.K. Rowling', 'Harry Potter and the Chamber of Secrets', 1998, 'Choix et identité', 'wd:Q34660', 'wd:Q172784'),
      ('The only impossible journey is the one you never begin.', 'Paulo Coelho', 'The Alchemist', 1988, 'Motivation et voyage', 'wd:Q128560', 'wd:Q178825'),
      ('It is never too late to be what you might have been.', 'George Eliot', 'Middlemarch', 1871, 'Potentiel et temps', 'wd:Q191228', 'wd:Q692882'),
      ('The man who does not read has no advantage over the man who cannot read.', 'Ryan Holiday', 'The Obstacle Is the Way', 2014, 'Lecture et discipline', 'wd:Q7384160', 'wd:Q17515437'),
      ('Two things are infinite: the universe and human stupidity; and I''m not sure about the universe.', 'Albert Einstein', 'Einstein: His Life and Universe', 2007, 'Humour et science', 'wd:Q937', 'wd:Q5349791')
    ) AS seed(text, author_name, book_title, book_year, theme, author_uri, book_uri)
  LOOP
    v_author_id := NULL;
    v_book_id := NULL;
    v_quote_id := NULL;

    SELECT id INTO v_author_id FROM public."Author" WHERE name = r.author_name OR "inventaireUri" = r.author_uri LIMIT 1;
    IF v_author_id IS NULL THEN
      INSERT INTO public."Author" (name, "inventaireUri")
      VALUES (r.author_name, r.author_uri)
      RETURNING id INTO v_author_id;
    ELSE
      UPDATE public."Author" SET "inventaireUri" = r.author_uri WHERE id = v_author_id AND "inventaireUri" IS NULL;
    END IF;

    SELECT id INTO v_book_id FROM public."Book" WHERE (title = r.book_title AND "authorId" = v_author_id) OR "inventaireUri" = r.book_uri LIMIT 1;
    IF v_book_id IS NULL THEN
      INSERT INTO public."Book" (title, "authorId", year, "inventaireUri")
      VALUES (r.book_title, v_author_id, r.book_year, r.book_uri)
      RETURNING id INTO v_book_id;
    ELSE
      UPDATE public."Book" SET "inventaireUri" = r.book_uri WHERE id = v_book_id AND "inventaireUri" IS NULL;
    END IF;

    SELECT id INTO v_quote_id FROM public."Quote"
    WHERE text = r.text
      AND "userId" = v_quotex_uuid
    LIMIT 1;

    IF v_quote_id IS NULL THEN
      INSERT INTO public."Quote" (text, "userId", "authorId", "bookId", "likesCount", theme, "isPublic")
      VALUES (
        r.text,
        v_quotex_uuid,
        v_author_id,
        v_book_id,
        0,
        r.theme,
        true
      )
      RETURNING id INTO v_quote_id;
    END IF;
  END LOOP;
END;
$function$;

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
  v_quotex_image TEXT := 'https://raw.githubusercontent.com/clementqlf/quotex/feat%2Fexpo-56-upgrade/assets/images/quotex_logo.png';
BEGIN
  -- 1. Création du profil utilisateur dans Profile
  INSERT INTO public."Profile" (id, username, name, image)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'name',
    CASE WHEN new.id = v_quotex_uuid THEN v_quotex_image ELSE new.raw_user_meta_data->>'image' END
  )
  ON CONFLICT (id) DO NOTHING;

  -- 2. Recherche ou création de l'auteur "Blaise Pascal"
  SELECT id INTO v_author_id FROM public."Author" WHERE name = 'Blaise Pascal' OR "inventaireUri" = 'wd:Q1290' LIMIT 1;
  IF v_author_id IS NULL THEN
    INSERT INTO public."Author" (name, "inventaireUri")
    VALUES ('Blaise Pascal', 'wd:Q1290')
    RETURNING id INTO v_author_id;
  ELSE
    UPDATE public."Author" SET "inventaireUri" = 'wd:Q1290' WHERE id = v_author_id AND "inventaireUri" IS NULL;
  END IF;

  -- 3. Recherche ou création du livre "Pensées"
  SELECT id INTO v_book_id FROM public."Book" WHERE (title = 'Pensées' AND "authorId" = v_author_id) OR "inventaireUri" = 'wd:Q17360856' LIMIT 1;
  IF v_book_id IS NULL THEN
    INSERT INTO public."Book" (title, "authorId", year, "inventaireUri")
    VALUES ('Pensées', v_author_id, 1670, 'wd:Q17360856')
    RETURNING id INTO v_book_id;
  ELSE
    UPDATE public."Book" SET "inventaireUri" = 'wd:Q17360856' WHERE id = v_book_id AND "inventaireUri" IS NULL;
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

    PERFORM public.seed_quotex_static_content();
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
INSERT INTO public."Profile" (id, username, name, image)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  'quotex',
  'Quotex',
  'https://raw.githubusercontent.com/clementqlf/quotex/feat%2Fexpo-56-upgrade/assets/images/quotex_logo.png'
)
ON CONFLICT (id) DO NOTHING;

-- Insérer les citations et la photo de profil Quotex si elles n'existent pas
DO $$
BEGIN
  PERFORM public.seed_quotex_static_content();
END $$;