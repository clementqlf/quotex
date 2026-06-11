#!/bin/bash
set -e

PROJECT_ID="@quotex/quotex"

echo "Création des channels OTA pour $PROJECT_ID..."

eas channel:create dev --projectId $PROJECT_ID
eas channel:create staging --projectId $PROJECT_ID
eas channel:create production --projectId $PROJECT_ID

echo "Channels créés avec succès !"
echo ""
echo "Pour publier une update sur le channel dev:"
echo "  eas update --branch dev --message 'Description de la mise à jour'"
echo ""
echo "Pour publier une update sur le channel staging:"
echo "  eas update --branch staging --message 'Description de la mise à jour'"
echo ""
echo "Pour publier une update sur le channel production:"
echo "  eas update --branch production --message 'Description de la mise à jour'"
