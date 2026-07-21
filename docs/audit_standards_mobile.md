# 📱 Grille d'Audit & Standards Universels d'Applications Mobiles

Ce document présente la grille d'évaluation impartiale des standards d'applications mobiles (iOS & Android). Il sert de référence pour vérifier qu'une application respecte les règles de l'art (Apple HIG, Google Material Design, normes de sécurité, résilience et conformité aux stores).

---

## 1. UI/UX & Ergonomie Mobile

### Cibles Tactiles & Dimensions (Touch Targets)
- [ ] **Boutons & Éléments cliquables** : Taille minimale de **44x44 pt (iOS)** ou **48x48 dp (Android)** pour éviter les erreurs d'appui.
- [ ] **Espacement** : Marge suffisante entre les éléments interactifs contigus.

### Adaptabilité & Safe Areas
- [ ] **Zones sécurisées (Safe Areas)** : Prise en compte de l'encoche (notch), de l'île dynamique (Dynamic Island), de la barre de statut et de la barre de navigation du système.
- [ ] **Orientation & Layouts** : Comportement propre lors des changements d'orientation (si autorisés) ou blocage explicite propre en mode portrait.

### Clavier Virtuel
- [ ] **Visibilité du champ actif** : Le clavier ne doit pas masquer le champ de saisie actif ou le bouton d'action principal (`KeyboardAvoidingView`).
- [ ] **Fermeture du clavier** : Fermeture au tap extérieur ou lors du défilement de la liste.
- [ ] **Types de clavier adaptés** : Utilisation des types appropriés (`email-address`, `numeric`, `phone-pad`, `decimal-pad`, etc.).

### Feedback Visuel & Interactif
- [ ] **États d'enfoncement (Pressed/Active)** : Retour visuel immédiat lors d'un tap sur un bouton.
- [ ] **Prévention du double-tap** : Désactivation temporaire des boutons d'action critique (ex: *Valider*, *Payer*, *Enregistrer*) pour éviter l'envoi de requêtes en double.
- [ ] **Retours haptiques** : Utilisation mesurée des vibrations haptiques pour confirmer les actions clés.

### Navigation Native
- [ ] **Geste de retour (iOS)** : Support du balayage vers la droite (Swipe back) pour revenir en arrière.
- [ ] **Bouton retour physique (Android)** : Gestion propre de la touche `Back` matérielle.

---

## 2. Réseau, Résilience & Gestion des États de la Vue

### Les 4 États Majeurs de chaque Écran
- [ ] **1. Loading (Chargement)** : Skeleton loaders ou spinners discrets au lieu d'un écran blanc ou gelé.
- [ ] **2. Success / Content (Succès)** : Affichage normal des données.
- [ ] **3. Empty / Zero State (Vide)** : Message explicatif clair et illustré avec un bouton d'action quand il n'y a pas de données (ex: *"Aucun livre ajouté"* + bouton *"Scanner un livre"*).
- [ ] **4. Error / Offline (Erreur)** : Message d'erreur compréhensible (sans jargon technique) avec un bouton *"Réessayer"*.

### Gestion des Réseaux Instables (3G/Low Connection)
- [ ] **Timeouts** : Annulation propre des requêtes prenant trop de temps avec notification à l'utilisateur.
- [ ] **Concurrency & Race Conditions** : Annulation des requêtes réseau obsolètes lorsqu'une nouvelle recherche/action est déclenchée rapidement.
- [ ] **Bannière d'état réseau** : Signalement discret en cas de perte de connexion réseau (ex: mode hors-ligne activé).

---

## 3. Cycle de Vie de l'Application & Persistance (Lifecycle)

### Passage Arrière-plan / Avant-plan (Background / Foreground)
- [ ] **Mise en pause / Reprise** : Suspension propre des timers, animations et géolocalisation lors du passage en arrière-plan.
- [ ] **Actualisation des sessions** : Rafraîchissement automatique et silencieux des jetons de session (tokens JWT) si l'utilisateur revient après une longue période d'inactivité.

### Restauration d'État (State Restoration)
- [ ] **Fermeture par le système (Memory Kill)** : Si l'OS ferme l'application en arrière-plan pour libérer de la mémoire RAM, la ré-ouverture doit s'effectuer sans crash ni perte de données critiques.

---

## 4. Performance & Gestion des Ressources

### Temps de Démarrage (Cold Start)
- [ ] **Affichage initial < 2-3 secondes** : Lancement rapide de l'écran d'accueil/splash screen sans blocage sur le thread JS.
- [ ] **Tree-shaking & Bundle JS** : Taille du bundle JS contenue, chargement différé des modules non essentiels.

### Fluidité d'Affichage (60 FPS)
- [ ] **Virtualisation des listes** : Utilisation obligatoire de composants de liste virtualisés (`FlashList`, `FlatList` optimisée) pour les défilements volumineux.
- [ ] **Fluidité du thread UI** : Pas de calculs lourds ou bloquants sur le thread principal/JS pendant les animations ou le scroll.

### Consommation Mémoire & Batterie
- [ ] **Nettoyage des Listeners & Timers** : Suppression systématique des event listeners, abonnements WebSocket et `setInterval` au démontage des composants (`useEffect` cleanup).
- [ ] **Optimisation des Images** : Utilisation de formats modernes (WebP, SVG), redimensionnement adapté à la densité d'écran et mise en cache disque/mémoire.

---

## 5. Sécurité & Données Privées

### Stockage Sécurisé
- [ ] **Coffre-fort Natif** : Stockage des jetons d'authentification, clés d'API et identifiants dans le `Keychain` (iOS) ou `Keystore` (Android) / `SecureStore`.
- [ ] **Interdiction du texte clair** : Aucune donnée sensible enregistrée dans `AsyncStorage` ou `LocalStorage` non chiffré.

### Permissions Just-In-Time
- [ ] **Demande contextuelle** : Les demandes de permissions (Appareil photo, Localisation, Notifications, Galerie) s'effectuent uniquement au moment du besoin réel.
- [ ] **Messages explicatifs (Usage Description)** : Justification explicite et claire dans les fichiers de configuration (ex: `Info.plist` / `AndroidManifest.xml`).

### Confidentialité & Logs
- [ ] **Nettoyage des Logs** : Aucun mot de passe, jeton ou donnée personnelle affiché dans les console logs en mode production.
- [ ] **Communications Chiffrées** : Obligation du protocole `HTTPS` pour tous les appels réseau distants.

---

## 6. Robustesse, Gestions d'Erreurs & Monitoring

### Error Boundaries (React)
- [ ] **Écrans de secours (Fallback UI)** : Présence d'au moins un `ErrorBoundary` global et de sous-boundaries par section pour éviter la fermeture brutale de l'application en cas d'erreur de rendu React.

### Tracking des Crashs en Production
- [ ] **Crash Reporting** : Intégration d'un outil de remontée des crashs (ex: Sentry, Bugsnag, Firebase Crashlytics) pour capturer les erreurs fatales en production.

---

## 7. Conformité aux Directives des Stores (Store Guidelines)

### Apple App Store & Google Play Store
- [ ] **Suppression de compte (Account Deletion)** : Bouton natif, accessible et fonctionnel permettant à l'utilisateur de demander ou d'effectuer la suppression de son compte et de ses données.
- [ ] **Contenus générés par les utilisateurs (UGC - User Generated Content)** :
  - Système de modération (masquage/blocage instantané).
  - Possibilité pour tout utilisateur de **signaler** un contenu abusif et de **bloquer** un auteur.
- [ ] **Achats In-App (IAP)** : Intégration conforme des SDKs Apple IAP / Google Play Billing pour tout achat de contenu ou service numérique dans l'application.
- [ ] **Politique de Confidentialité** : Lien valide vers la politique de confidentialité accessible depuis l'application et les fiches des stores.
