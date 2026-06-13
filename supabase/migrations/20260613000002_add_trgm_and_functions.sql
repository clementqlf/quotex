-- Migration pour activer pg_trgm et recréer les fonctions/triggers critiques manquants en PROD

-- 1. Activer l'extension pg_trgm
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. Recréer la fonction unicode_translate
CREATE OR REPLACE FUNCTION public.unicode_translate(text text, from_text text, to_text text)
 RETURNS text
 LANGUAGE plpgsql
AS $function$ BEGIN RETURN text; END; $function$;

-- 3. Recréer la fonction et le trigger d'inscription d'utilisateurs (auth.users -> Profile)
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  INSERT INTO public."Profile" (id, username, name, image)
  VALUES (
    new.id, 
    COALESCE(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)), 
    new.raw_user_meta_data->>'name', 
    new.raw_user_meta_data->>'image'
  );
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- 4. Recréer la fonction et le trigger de mise à jour des notes de livres (Reviews -> Book.rating)
CREATE OR REPLACE FUNCTION public.update_book_rating()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  -- Si insertion ou mise à jour, recalculer la note du nouveau livre
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    UPDATE "Book"
    SET rating = COALESCE((SELECT AVG(rating)::float FROM "Review" WHERE "bookId" = NEW."bookId"), 0)
    WHERE id = NEW."bookId";
  END IF;

  -- Si suppression, ou mise à jour du bookId, recalculer la note de l'ancien livre
  IF TG_OP = 'DELETE' OR (TG_OP = 'UPDATE' AND OLD."bookId" IS DISTINCT FROM NEW."bookId") THEN
    UPDATE "Book"
    SET rating = COALESCE((SELECT AVG(rating)::float FROM "Review" WHERE "bookId" = OLD."bookId"), 0)
    WHERE id = OLD."bookId";
  END IF;

  RETURN NULL;
END;
$function$;

DROP TRIGGER IF EXISTS trg_update_book_rating ON public."Review";
CREATE TRIGGER trg_update_book_rating AFTER INSERT OR DELETE OR UPDATE ON public."Review" FOR EACH ROW EXECUTE FUNCTION update_book_rating();
