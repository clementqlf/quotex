# Rapport d'Audit de Conformité App Store : Quotex

En tant qu'expert App Store Review (Guidelines 2026), voici l'audit de votre application Quotex. Les points soulevés ciblent les motifs de rejets les plus fréquents pour votre stack (Expo, Supabase, Vision Camera, IA).

## Analyse des risques (Guidelines Apple)

*   **Section 1 (Safety) - User Generated Content (UGC) & Modération**
    *   **Risque :** Si les citations ou commentaires sont partagés publiquement (réseaux sociaux internes), Apple exige un système complet de modération.
    *   **Action :** Implémentez un bouton "Signaler", une fonctionnalité de blocage d'utilisateur, et une validation des CGU (EULA) stricte interdisant les contenus haineux/abusifs dès l'inscription.
*   **Section 1 (Safety) - Accès Caméra (OCR)**
    *   **Risque :** Demande de permission sans explication claire et contextuelle.
    *   **Action :** Le `NSCameraUsageDescription` (dans `app.json` ou `Info.plist`) ne doit pas juste dire "Accès à la caméra". Il doit préciser : *"Quotex a besoin de la caméra pour scanner les pages de vos livres et extraire les citations via OCR, ainsi que pour scanner les codes-barres ISBN."*
*   **Section 2 (Performance) - Clés d'API & Supabase**
    *   **Risque :** Exposition des clés de service ou mauvaise gestion des environnements.
    *   **Action :** Assurez-vous que seule la clé Supabase `anon/public` est présente dans le client React Native. Les clés privées/service_role doivent rester strictement dans le backend (Edge Functions).
*   **Section 3 (Business) - Achats In-App & Affiliation**
    *   **Risque :** Rediriger l'utilisateur vers une plateforme d'achat externe (Amazon, etc.) sans utiliser l'In-App Purchase, ce qui peut violer la règle d'évitement des commissions d'Apple.
    *   **Action :** Les liens d'affiliation vers des biens *physiques* (livres papier) sont autorisés sans In-App Purchase. Cependant, si le lien mène à des biens *numériques* (e-books) consommables sur le téléphone, Apple peut exiger l'utilisation des In-App Purchases ou vous sanctionner.
*   **Section 5 (Legal) - Propriété Intellectuelle (Citations)**
    *   **Risque :** Droit d'auteur sur les extraits de livres.
    *   **Action :** Assurez-vous que l'application est présentée comme un outil de prise de notes personnelle (Fair Use). Si vous proposez une base de données publique de citations, un avertissement sur le droit de courte citation doit être présent dans vos CGU.

## Checklist de conformité (Privacy & Transparence)

L'utilisation de `react-native-vision-camera` et ML Kit implique des traitements de données potentiellement sensibles (images, textes).

*   **Privacy Labels (App Store Connect) :**
    *   [ ] Déclarer les **Données Utilisateur** (Email, Nom - liés à l'authentification Supabase).
    *   [ ] Déclarer le **Contenu Utilisateur** (Photos/Vidéos si l'image scannée est sauvegardée, sinon préciser "Non sauvegardé").
    *   [ ] Déclarer l'utilisation d'**Identifiants** (User ID pour l'affiliation/tracking).
*   **Permissions Camera (`react-native-vision-camera`) :**
    *   [ ] Vérifier que la caméra ne s'active *que* lorsque l'utilisateur initie le scan (pas au lancement de l'app).
    *   [ ] Fournir un état de repli (fallback UI) propre si l'utilisateur refuse l'accès à la caméra (ex: saisie manuelle de l'ISBN ou de la citation).
*   **Traitement ML Kit (OCR) :**
    *   [ ] Mentionner dans la Politique de Confidentialité si le traitement OCR se fait *On-Device* (en local via ML Kit) ou si l'image est envoyée sur un serveur (Edge Functions). L'*On-Device* est grandement préféré par les relecteurs.

## Audit de Sécurité & RLS (Supabase)

Les relecteurs Apple sont de plus en plus stricts sur la sécurisation des backends (BaaS). Voici les points RLS cruciaux pour éviter les fuites de données (`userbook`, `quotes`, `reviews`).

**1. Verrouillage par défaut (Default Deny)**
Assurez-vous que toutes vos tables ont le RLS activé par défaut.

```sql
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.userbook ENABLE ROW LEVEL SECURITY;
```

**2. Isolation stricte des données personnelles (Lectures/Écritures)**
Un utilisateur ne doit pouvoir lire, modifier et supprimer que ses propres citations (sauf s'il a explicitement rendu une citation publique).

```sql
-- Exemple : Seul le propriétaire peut lire ses citations privées
CREATE POLICY "Les utilisateurs peuvent lire leurs propres citations" 
ON public.quotes 
FOR SELECT 
USING (auth.uid() = user_id);

-- Exemple : Insertion autorisée uniquement pour l'utilisateur connecté
CREATE POLICY "Les utilisateurs peuvent créer leurs citations" 
ON public.quotes 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);
```

**3. Sécurisation des Edge Functions**
Si vous utilisez Supabase Edge Functions pour traiter l'OCR (Groq), ne passez *jamais* l'ID utilisateur depuis le client pour identifier qui fait l'action. Récupérez toujours l'ID via le JWT côté serveur :

```typescript
// DANS L'EDGE FUNCTION (Bonne pratique)
const authHeader = req.headers.get('Authorization')!
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authHeader } } })
const { data: { user } } = await supabase.auth.getUser()
// Utiliser user.id de manière sécurisée
```

## Simulation d'audit : Questions & Réponses pour les "Notes d'examen"

Anticipez ces questions dans la section *Notes for Reviewer* d'App Store Connect.

1.  **Relecteur :** *"Votre application utilise la caméra pour l'OCR. Les photos prises par l'utilisateur sont-elles envoyées sur vos serveurs ou partagées avec des tiers ?"*
    *   **Votre réponse idéale :** "Non. Tout le traitement de reconnaissance de texte (OCR) via ML Kit est effectué localement sur l'appareil (On-Device). Les images scannées ne sont jamais sauvegardées dans la pellicule, ni envoyées vers nos serveurs (Supabase)." *(À adapter selon votre vraie implémentation).*
2.  **Relecteur :** *"Vous proposez des liens externes pour acheter des livres. Pourquoi ne pas utiliser le système d'achat In-App d'Apple ?"*
    *   **Votre réponse idéale :** "Les liens présents dans l'application sont des liens d'affiliation redirigeant exclusivement vers des biens physiques imprimés (livres papier). Conformément à la section 3.1.5 (Physical Goods) des Guidelines, ces achats ont lieu en dehors de l'application via le navigateur par défaut de l'utilisateur."
3.  **Relecteur :** *"Où se trouve la fonctionnalité pour bloquer un utilisateur ou signaler un contenu abusif ?"*
    *   **Votre réponse idéale :** "L'application permet le partage social. Conformément aux règles UGC (User Generated Content), un bouton 'Signaler' est présent sur chaque citation publique (menu '...'). Un système de blocage d'utilisateur est disponible sur le profil public de chaque utilisateur. Une modération active est en place via nos équipes."
4.  **Relecteur :** *"Comment fonctionne votre système de synchronisation hors-ligne si l'utilisateur perd la connexion ?"*
    *   **Votre réponse idéale :** "L'application utilise un cache local robuste. Les citations créées hors-ligne sont sauvegardées sur le stockage local de l'appareil et un indicateur visuel informe l'utilisateur. La synchronisation avec notre base Supabase reprend automatiquement et silencieusement dès le retour de la connexion réseau."
5.  **Relecteur :** *"J'ai essayé de scanner un livre pour le tester mais je n'en ai pas sous la main. Comment puis-je vérifier cette fonctionnalité ?"*
    *   **Votre réponse idéale :** "Nous avons fourni dans la section 'Pièces jointes' (Attachments) de cet examen une vidéo de démonstration complète du processus de scan (ISBN et OCR). Nous avons également fourni dans ces notes un code-barres ISBN de test que vous pouvez scanner depuis votre écran d'ordinateur."

## Conseils IA (Groq) & Affiliation

**Intelligence Artificielle (Interprétation par Groq)**
*   **Transparence (Design) :** Apple (et la législation européenne) exige que le contenu généré par l'IA soit clairement identifiable.
*   **Mentions obligatoires :** Ajoutez une mention discrète sous l'interprétation de la citation : *"Interprétation générée par IA. Le contenu peut contenir des inexactitudes."* ou intégrez une icône d'étincelles (✨) universellement reconnue.

**Liens d'Affiliation (Business)**
*   **Transparence légale :** Pour éviter un rejet et respecter les lois sur la consommation, l'utilisateur doit savoir que vous gagnez de l'argent sur son achat.
*   **Mentions obligatoires :** Affichez un texte visible sur la page d'achat ou le bouton, par exemple : *"Quotex peut percevoir une commission sur les achats effectués via ces liens."* Apple est très sensible à la transparence commerciale (Section 5.1).

---

## Checklist de validation (Avant soumission)

- [ ] L'EULA (CGU) inclut une clause stricte sur la tolérance zéro pour les contenus abusifs (UGC).
- [ ] Le `NSCameraUsageDescription` explique *clairement* à quoi sert l'accès caméra (OCR/ISBN).
- [ ] Les règles RLS Supabase interdisent la lecture/écriture des données privées entre utilisateurs.
- [ ] Le flux de scan caméra possède une alternative manuelle si la permission est refusée.
- [ ] Les mentions légales liées à l'affiliation ("Liens commissionnés") sont visibles.
- [ ] Le label "Généré par IA" est présent sur les enrichissements de texte.
- [ ] Une vidéo de démo de l'OCR/Scanner est préparée pour App Store Connect.
- [ ] Des identifiants de test (compte avec des données pré-remplies) sont fournis au relecteur.
