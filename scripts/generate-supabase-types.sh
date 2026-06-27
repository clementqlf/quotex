#!/bin/bash

# Script pour générer les types TypeScript de la base de données Supabase
# Nécessite le CLI Supabase installé : npm install -g supabase

# Couleurs pour les messages
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Chemin du fichier de sortie
OUTPUT_FILE="./src/shared/types/database.ts"

# Vérifier que le CLI Supabase est installé
if ! command -v supabase &> /dev/null && ! npx supabase --version &> /dev/null; then
    echo -e "${RED}❌ Erreur : Le CLI Supabase n'est pas installé.${NC}"
    echo "Installez-le avec : npm install -g supabase"
    exit 1
fi

# Déterminer les fichiers d'environnement à tester dans l'ordre de priorité
# Si l'argument $1 est "production" / "prod" ou si NODE_ENV est "production", on cible la production
if [ "$1" = "production" ] || [ "$1" = "prod" ] || [ "$NODE_ENV" = "production" ]; then
    FILES_TO_CHECK=(".env.production" ".env.production.local" ".env" ".env.development" ".env.development.local" ".env.local")
else
    FILES_TO_CHECK=(".env.development" ".env.development.local" ".env.local" ".env" ".env.production" ".env.production.local")
fi

# Charger les variables d'environnement depuis les fichiers .env si nécessaire
for env_file in "${FILES_TO_CHECK[@]}"; do
    if [ -f "$env_file" ]; then
        if [ -z "$EXPO_PUBLIC_SUPABASE_URL" ]; then
            VAL=$(grep "^EXPO_PUBLIC_SUPABASE_URL=" "$env_file" | cut -d'=' -f2- | tr -d '\r' | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")
            if [ -n "$VAL" ]; then
                export EXPO_PUBLIC_SUPABASE_URL="$VAL"
                echo -e "${YELLOW}📝 URL Supabase chargée depuis $env_file${NC}"
            fi
        fi
        if [ -z "$SUPABASE_ACCESS_TOKEN" ]; then
            TOKEN_VAL=$(grep "^SUPABASE_ACCESS_TOKEN=" "$env_file" | cut -d'=' -f2- | tr -d '\r' | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")
            if [ -n "$TOKEN_VAL" ]; then
                export SUPABASE_ACCESS_TOKEN="$TOKEN_VAL"
                echo -e "${YELLOW}📝 Access token chargé depuis $env_file${NC}"
            fi
        fi
    fi
done

# Vérifier si le premier argument est une URL
ARG_URL=""
if echo "$1" | grep -qE "^https?://"; then
    ARG_URL="$1"
fi

# Extraire le project-id depuis l'URL Supabase (format: https://PROJECT_ID.supabase.co)
SUPABASE_URL=${EXPO_PUBLIC_SUPABASE_URL:-$ARG_URL}

if [ -z "$SUPABASE_URL" ]; then
    echo -e "${RED}❌ Erreur : L'URL Supabase n'est pas définie.${NC}"
    echo "Passez l'URL en argument ou définissez EXPO_PUBLIC_SUPABASE_URL"
    exit 1
fi

# Extraire le project-id de l'URL
PROJECT_ID=$(echo "$SUPABASE_URL" | sed -n 's|https://\([^.]*\).supabase.co|\1|p')

if [ -z "$PROJECT_ID" ]; then
    echo -e "${RED}❌ Erreur : Impossible d'extraire le project-id de l'URL : $SUPABASE_URL${NC}"
    exit 1
fi

# Afficher les informations
echo -e "${YELLOW}🔍 Détecté project-id: $PROJECT_ID${NC}"
echo -e "${YELLOW}📁 Fichier de sortie: $OUTPUT_FILE${NC}"

# Générer les types
 echo -e "${YELLOW}🚀 Génération des types Supabase...${NC}"

# Utiliser le CLI Supabase pour générer les types
# Note: supabase gen types nécessite un access token qui peut être obtenu via:
# - SUPABASE_ACCESS_TOKEN environnement variable
# - Ou en étant connecté via `supabase login`
npx supabase gen types typescript --project-id "$PROJECT_ID" > "$OUTPUT_FILE"

# Vérifier que le fichier a été créé
if [ -f "$OUTPUT_FILE" ]; then
    echo -e "${GREEN}✅ Types générés avec succès dans $OUTPUT_FILE${NC}"
else
    echo -e "${RED}❌ Erreur : Le fichier $OUTPUT_FILE n'a pas été créé.${NC}"
    echo "Assurez-vous que :"
    echo "1. Vous avez un access token valide (supabase login ou SUPABASE_ACCESS_TOKEN)"
    echo "2. Le project-id est correct"
    exit 1
fi
