# Synchronisation Hors-Ligne - Quotex

Ce document décrit la fonctionnalité de synchronisation hors-ligne pour les citations dans l'application Quotex.

## Fonctionnalités

### 1. Ajout de citations hors-ligne
- Les citations peuvent être ajoutées sans connexion internet
- Elles sont automatiquement sauvegardées localement
- Une file d'attente gère les citations en attente de synchronisation

### 2. Synchronisation automatique
- Quand la connexion est rétablie, les citations sont automatiquement synchronisées
- Synchronisation périodique toutes les 5 minutes quand en ligne
- Synchronisation déclenchée manuellement possible

### 3. Gestion des erreurs
- Retry automatique des citations qui ont échoué
- Compteur de tentatives pour éviter les boucles infinies
- Notifications visuelles de l'état de synchronisation

## Architecture

### Composants

#### 1. `QuoteService.ts`
- Gère la file d'attente des citations en attente (`PENDING_QUOTES`)
- Méthodes clés :
  - `addQuote()` : Ajoute une citation localement si hors-ligne
  - `syncPendingQuotes()` : Synchronise les citations en attente avec le serveur
  - `getPendingQuotesCount()` : Retourne le nombre de citations en attente

#### 2. `useNetworkSync.ts`
- Hook React pour gérer la détection de connexion réseau
- Utilise `@react-native-community/netinfo` pour détecter les changements de connexion
- Gère la synchronisation automatique avec débounce
- Fournit l'état de synchronisation à l'UI

#### 3. `SyncStatusIndicator.tsx`
- Composant UI pour afficher l'état de synchronisation
- Affiche :
  - État de connexion (En ligne/Hors ligne)
  - Nombre de citations en attente
  - Dernière heure de synchronisation
  - Erreurs de synchronisation

#### 4. `DataProvider.tsx`
- Intègre le hook `useNetworkSync`
- Expose `syncStatus` dans le contexte global
- Fournit le hook `useSyncStatus()` pour accès facile

### Stockage

#### AsyncStorage Keys
- `PENDING_QUOTES` : File d'attente des citations à synchroniser
- `LAST_SYNC_TIME` : Heure de la dernière synchronisation réussie

### Format des données

#### Citation en attente (PendingQuote)
```typescript
{
    id: number;           // ID temporaire utilisé localement
    text: string;        // Texte de la citation
    book: string | null; // Titre du livre
    author: string | null; // Nom de l'auteur
    theme?: string;      // Thème optionnel
    createdAt: string;   // Timestamp ISO
    retryCount?: number; // Nombre de tentatives
}
```

#### Format envoyé au serveur (/sync-quotes)
```typescript
{
    offlineQuotes: [
        {
            id: string;      // ID temporaire en string
            text: string;
            author?: string;
            book?: string;
            theme?: string;
            createdAt: string;
            userId: string;   // ID de l'utilisateur
        }
    ]
}
```

## Utilisation

### Ajouter une citation

```typescript
import { useData } from '@/src/app/providers/DataProvider';

const { addQuote } = useData();

// Fonctionne en ligne ou hors-ligne
await addQuote("Ma belle citation", "Mon Livre", "Mon Auteur");
```

### Afficher l'état de synchronisation

```typescript
import { useSyncStatus } from '@/src/app/providers/DataProvider';

const syncStatus = useSyncStatus();

// Utilisation dans le JSX
<View>
    {syncStatus.isOffline && <Text>Mode hors-ligne</Text>}
    {syncStatus.pendingCount > 0 && (
        <Text>{syncStatus.pendingCount} citations en attente</Text>
    )}
    <Text>Dernière sync: {syncStatus.lastSyncTime?.toLocaleString()}</Text>
</View>
```

### Déclencher une synchronisation manuelle

```typescript
import { useSyncStatus } from '@/src/app/providers/DataProvider';

const syncStatus = useSyncStatus();

// Bouton pour synchroniser maintenant
<Button 
    title="Synchroniser maintenant"
    onPress={() => syncStatus.syncNow()}
/>
```

### Utiliser l'indicateur de statut

```typescript
import { SyncStatusIndicator } from '@/src/shared/ui/SyncStatusIndicator';

// Ajouter n'importe où dans votre UI
<SyncStatusIndicator />
```

## Fonctionnement interne

### Processus d'ajout de citation

1. **En ligne** :
   - Essaye d'envoyer la citation au serveur
   - Si succès : sauvegarde localement avec le vrai ID
   - Si échec : ajoute à la file d'attente

2. **Hors-ligne** :
   - Sauvegarde immédiatement dans la file d'attente
   - Retourne un ID temporaire
   - Met à jour le cache local avec la nouvelle citation

### Processus de synchronisation

1. **Déclenchement** :
   - Quand la connexion est rétablie (après 5 secondes de stabilité)
   - Toutes les 5 minutes quand en ligne
   - Manuellement via `syncNow()`

2. **Exécution** :
   - Récupère toutes les citations en attente
   - Envoie au endpoint `/sync-quotes`
   - Si succès : supprime de la file d'attente
   - Si échec : incrémente le compteur de retry

3. **Post-synchronisation** :
   - Rafraîchit la liste des citations
   - Met à jour le cache local
   - Met à jour `LAST_SYNC_TIME`

## Installation

### Dépendances

```bash
npm install @react-native-community/netinfo
```

### Configuration iOS

Pour iOS, aucune configuration supplémentaire n'est nécessaire.

### Configuration Android

Ajoutez les permissions dans `AndroidManifest.xml` :

```xml
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
<uses-permission android:name="android.permission.INTERNET" />
```

## Dépannage

### Les citations ne se synchronisent pas

1. Vérifiez que vous êtes connecté à internet
2. Vérifiez que vous êtes authentifié (un utilisateur doit être connecté)
3. Consultez les logs : `console.log` avec le tag `[QuoteService]` ou `[useNetworkSync]`

### Erreurs de synchronisation

Les erreurs sont stockées dans `syncStatus.lastSyncError` et peuvent être affichées dans l'UI.

### Tester la fonctionnalité

1. Passez en mode avion
2. Ajoutez des citations
3. Vérifiez que le compteur de citations en attente augmente
4. Rétablissez la connexion
5. Attendez 5 secondes ou appuyez sur "Synchroniser maintenant"
6. Vérifiez que les citations sont envoyées au serveur

## Fichiers modifiés

- `src/entities/quote/api/QuoteService.ts` - Logique principale de synchronisation
- `src/shared/api/StorageService.ts` - Ajout de LAST_SYNC_TIME
- `src/app/providers/DataProvider.tsx` - Intégration du sync status
- `src/shared/lib/hooks/useNetworkSync.ts` - Hook de gestion réseau (nouveau)
- `src/shared/ui/SyncStatusIndicator.tsx` - Composant UI (nouveau)
- `supabase/functions/sync-quotes/index.ts` - Endpoint serveur (existant)

## Notes

- Les citations synchronisées avec succès reçoivent un nouvel ID du serveur
- Les citations en attente gardent leur ID temporaire jusqu'à synchronisation
- Le cache local est toujours à jour, que ce soit en ligne ou hors-ligne
