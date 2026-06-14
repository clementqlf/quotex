-- Migration pour corriger le type de la colonne id dans la table quotes
-- Problème : Les IDs générés côté client (Date.now()) dépassent la limite de integer (2^31-1 = 2147483647)
-- Solution : Passer de integer à bigint pour supporter des IDs plus grands

DO $$
BEGIN
	-- Le schéma initial utilise "Quote" (identifiant sensible à la casse).
	IF to_regclass('public."Quote"') IS NOT NULL THEN
		ALTER TABLE public."Like" DROP CONSTRAINT IF EXISTS "Like_quoteId_fkey";
		ALTER TABLE public."UserQuote" DROP CONSTRAINT IF EXISTS "UserQuote_quoteId_fkey";

		ALTER TABLE public."Quote"
			ALTER COLUMN "id" TYPE bigint;

		ALTER TABLE public."Like"
			ALTER COLUMN "quoteId" TYPE bigint;

		ALTER TABLE public."UserQuote"
			ALTER COLUMN "quoteId" TYPE bigint;

		ALTER TABLE public."Like"
			ADD CONSTRAINT "Like_quoteId_fkey"
			FOREIGN KEY ("quoteId") REFERENCES public."Quote" ("id") ON UPDATE CASCADE ON DELETE CASCADE;

		ALTER TABLE public."UserQuote"
			ADD CONSTRAINT "UserQuote_quoteId_fkey"
			FOREIGN KEY ("quoteId") REFERENCES public."Quote" ("id") ON UPDATE CASCADE ON DELETE CASCADE;
	ELSIF to_regclass('public.quotes') IS NOT NULL THEN
		-- Compatibilité si une table non-quotée `quotes` existe dans certains environnements.
		ALTER TABLE public.quotes
			ALTER COLUMN id TYPE bigint;
	ELSE
		RAISE NOTICE 'Table Quote/quotes introuvable, migration ignorée.';
	END IF;
END
$$;
