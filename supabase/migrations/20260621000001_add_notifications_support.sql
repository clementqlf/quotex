-- Migration: Support de notifications push (Likes et Abonnements)
-- Date: 2026-06-21

-- 1. Activer l'extension pg_net si nécessaire (requis pour envoyer des requêtes HTTP depuis Postgres)
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Ajouter la colonne expoPushToken et les préférences de notifications à la table Profile
ALTER TABLE public."Profile" ADD COLUMN IF NOT EXISTS "expoPushToken" TEXT;
ALTER TABLE public."Profile" ADD COLUMN IF NOT EXISTS "notifyOnFollow" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public."Profile" ADD COLUMN IF NOT EXISTS "notifyOnLike" BOOLEAN NOT NULL DEFAULT true;

-- 3. Fonction pour envoyer les notifications push de façon asynchrone
CREATE OR REPLACE FUNCTION public.handle_notification_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_target_user_id uuid;
  v_sender_name text;
  v_notification_title text;
  v_notification_body text;
  v_recipient_token text;
  v_notify_enabled boolean := true;
BEGIN
  -- Déterminer le destinataire et le contenu selon la table
  IF TG_TABLE_NAME = 'UserFollow' THEN
    v_target_user_id := NEW."followingId";
    
    -- Vérifier si le destinataire veut être notifié pour les abonnements
    SELECT "notifyOnFollow" INTO v_notify_enabled
    FROM public."Profile"
    WHERE id = v_target_user_id;

    IF NOT COALESCE(v_notify_enabled, true) THEN
      RETURN NEW;
    END IF;
    
    -- Récupérer le nom de celui qui s'abonne
    SELECT COALESCE(name, username) INTO v_sender_name 
    FROM public."Profile" 
    WHERE id = NEW."followerId";
    
    v_notification_title := 'Nouveau follower !';
    v_notification_body := v_sender_name || ' s''est abonné à votre profil.';
    
  ELSIF TG_TABLE_NAME = 'Like' THEN
    -- Récupérer le propriétaire de la citation
    SELECT "userId" INTO v_target_user_id 
    FROM public."Quote" 
    WHERE id = NEW."quoteId";
    
    -- Ne pas notifier si l'utilisateur aime sa propre citation
    IF v_target_user_id = NEW."userId" THEN
      RETURN NEW;
    END IF;
    
    -- Vérifier si le destinataire veut être notifié pour les likes
    SELECT "notifyOnLike" INTO v_notify_enabled
    FROM public."Profile"
    WHERE id = v_target_user_id;

    IF NOT COALESCE(v_notify_enabled, true) THEN
      RETURN NEW;
    END IF;
    
    -- Récupérer le nom de celui qui aime
    SELECT COALESCE(name, username) INTO v_sender_name 
    FROM public."Profile" 
    WHERE id = NEW."userId";
    
    v_notification_title := 'Citation aimée';
    v_notification_body := v_sender_name || ' a aimé votre citation.';
  ELSE
    RETURN NEW;
  END IF;

  -- Récupérer le token du destinataire
  IF v_target_user_id IS NOT NULL THEN
    SELECT "expoPushToken" INTO v_recipient_token 
    FROM public."Profile" 
    WHERE id = v_target_user_id;
    
    -- Si le token existe, poster sur l'API Expo
    IF v_recipient_token IS NOT NULL AND v_recipient_token <> '' THEN
      BEGIN
        PERFORM net.http_post(
          url := 'https://exp.host/--/api/v2/push/send',
          headers := '{"Content-Type": "application/json", "Accept": "application/json"}'::jsonb,
          body := json_build_object(
            'to', v_recipient_token,
            'title', v_notification_title,
            'body', v_notification_body,
            'sound', 'default'
          )::jsonb
        );
      EXCEPTION WHEN OTHERS THEN
        -- Intercepter toute erreur pour ne pas faire échouer la transaction principale
        RAISE WARNING 'Push notification failed to enqueue: %', SQLERRM;
      END;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- 4. Associer la fonction aux déclencheurs (triggers)

-- Trigger pour les nouveaux abonnements
DROP TRIGGER IF EXISTS trg_notification_follow ON public."UserFollow";
CREATE TRIGGER trg_notification_follow
AFTER INSERT ON public."UserFollow"
FOR EACH ROW
EXECUTE FUNCTION public.handle_notification_on_insert();

-- Trigger pour les likes de citations
DROP TRIGGER IF EXISTS trg_notification_like ON public."Like";
CREATE TRIGGER trg_notification_like
AFTER INSERT ON public."Like"
FOR EACH ROW
EXECUTE FUNCTION public.handle_notification_on_insert();
