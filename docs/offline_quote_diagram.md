# Ajout d'une citation (En ligne vs Hors-ligne)

L'architecture actuelle a un défaut de conception (un "double système de file d'attente") qui explique pourquoi les citations ne s'affichenent pas toujours ou sont instables hors-ligne. 

Voici le diagramme du comportement actuel :

```mermaid
sequenceDiagram
    participant UI as Interface (Scan/MyQuotes)
    participant UseCase as QuoteUseCases
    participant LocalDB as StorageService (Cache)
    participant OpQueue as OperationQueue
    participant Repo as SupabaseQuoteRepository
    participant SyncQueue as PENDING_QUOTES
    participant Server as Serveur Supabase

    rect rgb(230, 240, 255)
        Note over UI,Server: SCÉNARIO HORS-LIGNE (Mode Avion)
        
        UI->>UseCase: createQuoteWithMatching()
        UseCase->>LocalDB: Ajoute la quote (ID temporaire) au cache local
        UseCase->>OpQueue: Ajoute à l'OperationQueue
        UseCase-->>UI: Retourne la quote
        
        UI->>Repo: refreshQuotes() -> getQuotes()
        Repo->>Server: fetch(API)
        Server--xRepo: Network Error!
        Repo->>LocalDB: fallback -> lit le cache local
        Repo-->>UI: Retourne les quotes (avec la nouvelle)
    end

    rect rgb(255, 230, 230)
        Note over UI,Server: SCÉNARIO EN LIGNE (Ou retour connexion)
        
        UI->>Repo: refreshQuotes() -> getQuotes()
        Repo->>Server: fetch(API)
        Server-->>Repo: Retourne les quotes du serveur
        
        Note over Repo,LocalDB: PROBLÈME CRITIQUE CI-DESSOUS
        Repo->>LocalDB: Lit PENDING_QUOTES (Vide, car UseCase utilise OpQueue!)
        Repo->>LocalDB: Écrase le cache local (quotes serveur + PENDING_QUOTES)
        Note over Repo,LocalDB: LA QUOTE HORS-LIGNE EST EFFACÉE DU CACHE !
        
        Repo-->>UI: Retourne les quotes (la quote hors-ligne disparaît!)
    end
    
    rect rgb(255, 240, 200)
        Note over UseCase,Server: SYNC EN ARRIÈRE PLAN
        OpQueue->>UseCase: syncPendingQuotes()
        UseCase->>Repo: createQuote()
        Note over Repo,SyncQueue: Repo utilise son propre système de queue !
        Repo->>Server: API Sync Quotes
        Server-->>Repo: Succès
        Repo->>LocalDB: Met à jour le cache local
    end
```

### Pourquoi cela ne marche pas et est-ce une bonne pratique ?

**Non, ce n'est pas la bonne pratique actuelle.** 

Le problème fondamental est qu'il y a **deux systèmes de synchronisation hors-ligne qui se battent** :
1. `QuoteUseCases.ts` utilise `OperationQueue` (votre nouveau système unifié).
2. `SupabaseQuoteRepository.ts` utilise son propre système historique `STORAGE_KEYS.PENDING_QUOTES`.

Quand vous êtes en mode avion et que vous ajoutez une citation :
1. `QuoteUseCases` l'ajoute bien à `OperationQueue` et au cache local.
2. Si vous rafraîchissez l'écran ou qu'une autre action appelle `getQuotes()`, le repository `SupabaseQuoteRepository` essaie de lire les citations depuis le réseau. S'il réussit (par exemple si la connexion revient une seconde), il écrase le cache local en fusionnant le serveur et `PENDING_QUOTES`. Mais comme votre citation est dans `OperationQueue` (et pas `PENDING_QUOTES`), elle **disparaît visuellement du feed** jusqu'à ce que `OperationQueue` réussisse à la synchroniser en arrière-plan plus tard !

De plus, l'interface attend parfois un format précis, ou un conflit de clés `id` fait que l'optimistic update de React Query n'est pas conservé. 

### La solution (Bonne pratique de l'industrie)

La bonne pratique est d'avoir **une seule source de vérité (Single Source of Truth)**.
1. Nous devons supprimer l'ancien système `PENDING_QUOTES` de `SupabaseQuoteRepository` pour qu'il devienne purement un connecteur API.
2. Toute la logique hors-ligne (`OperationQueue`, fallback sur le cache local) doit être gérée soit dans React Query (`persistQueryClient`), soit centralisée dans le `UseCase`.
3. Assurer que `getQuotes` récupère les éléments de l'`OperationQueue` pour les afficher tant qu'ils ne sont pas synchronisés.
