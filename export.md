# Exportation d'un IPA iOS avec un Compte Apple Gratuit

Ce document détaille la procédure pour générer un fichier `.ipa` signé pour vos
appareils de test personnels à l'aide d'un compte Apple gratuit.

---

> [!WARNING]
> **Limitations des comptes gratuits :**
>
> - L'application expirera et cessera de fonctionner sur votre iPhone après **7
>   jours** (limite imposée par Apple pour les certificats gratuits). Il faudra
>   alors répéter la procédure.
> - Le fichier `.ipa` ne fonctionnera **que** sur les appareils de test
>   enregistrés sur votre compte personnel.

---

## 📋 Prérequis dans Xcode

Avant de lancer le script d'export, vous devez archiver le projet avec les
bonnes signatures de développement :

1. Connectez votre iPhone en USB à votre Mac.
2. Ouvrez votre projet dans Xcode (`ios/Quotex.xcworkspace`).
3. Sélectionnez le projet dans le panneau de gauche, puis allez dans l'onglet
   **Signing & Capabilities**.
4. Cochez **Automatically manage signing**.
5. Dans **Team**, sélectionnez votre compte Apple personnel gratuit (affiché
   sous la forme `Votre Nom (Personal Team)`).
6. Choisissez la cible de build **Any iOS Device (arm64)** dans la barre
   supérieure de Xcode.
7. Lancez l'archivage via le menu **Product** > **Archive**.

---

## 🛠️ Script de conversion en `.ipa`

Une fois l'archive générée, ouvrez votre terminal et exécutez les commandes
suivantes pour extraire le fichier `.app` et le packager au format `.ipa` sur
votre Bureau :

```bash
# 1. Naviguez vers le dossier de votre archive du jour
cd "/Users/chantreau/Library/Developer/Xcode/Archives/2026-06-14"

# 2. Créez un dossier temporaire nommé Payload
mkdir -p Payload

# 3. Copiez le fichier .app de l'archive dans ce dossier Payload
cp -r "Quotex.xcarchive/Products/Applications/Quotex.app" Payload/

# 4. Compressez le dossier Payload au format .ipa directement sur votre Bureau
zip -r "/Users/chantreau/Desktop/Quotex.ipa" Payload

# 5. Nettoyez le dossier temporaire Payload
rm -rf Payload
```
