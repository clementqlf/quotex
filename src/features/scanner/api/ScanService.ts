import { Platform } from 'react-native';
import { PhotoFile } from 'react-native-vision-camera';
import { TextElement, TextBlock } from '@react-native-ml-kit/text-recognition';
import { recognizeText } from '@/src/features/scanner/model/mlKitParser';
import { extractIsbn } from '@/src/features/scanner/model/useIsbnScanner';
import { searchService } from '@/src/features/search/api/SearchService';
import { PlatformServices } from '@/src/shared/platform';
import { authService } from '@/src/entities/user/api/AuthService';
import { API_BASE_URL } from '@/src/shared/config/api';
import * as FileSystem from 'expo-file-system/legacy';
import { Quote } from '@/src/shared/api/types';

/**

 * Données du livre depuis les APIs externes (Inventaire, Google Books, etc.)
 */
export interface ExternalBookData {
    title?: string;
    authors?: string[];
    authorUris?: string[];
    description?: string;
    image?: string;
    cover?: string;
    uri?: string;
    inventaireUri?: string;
    googleId?: string;
    year?: number;
    pages?: number;
    genre?: string;
    label?: string;
}

/**
 * Résultat de recherche pour un livre via ISBN
 */
export interface IsbnSearchResult {
    books?: Array<{
        id?: number | string;
        title: string;
        author: string;
        cover?: string;
        inventaireUri?: string;
    }>;
    inventaireWorks?: Array<ExternalBookData>;
}

/**
 * Données du livre récupérées depuis un scan ISBN
 */
export interface IsbnBookData {
    title: string;
    author: string;
    cover?: string;
    bookId?: string;
    inventaireUri?: string;
    bookData?: ExternalBookData;
}

/**
 * Résultat du scan OCR
 */
export interface OcrResult {
    elements: TextElement[];
    blocks?: TextBlock[];
    text: string;
    normalizedUri?: string;
    normalizedSize?: { width: number; height: number } | null;
}

/**
 * Service de scan - Contient la logique métier pour le scanning de citations et livres
 * Séparé de l'UI pour respecter Clean Architecture
 */
export class ScanService {
    constructor(
        private platformServices: typeof PlatformServices = PlatformServices
    ) {}

    /**
     * Vérifie et traite un code ISBN détecté
     * Effectue la recherche du livre et l'import si nécessaire
     */
    async checkAndHandleIsbn(text: string): Promise<{ 
        success: boolean; 
        bookData: IsbnBookData | null; 
        error?: string 
    }> {
        const isbn = extractIsbn(text);
        if (!isbn) {
            return { success: false, bookData: null, error: 'No valid ISBN detected' };
        }

        console.log('[ScanService] Valid ISBN detected:', isbn);

        try {
            // Rechercher le livre via le service de recherche
            const data = await searchService.search(isbn);
            
            if (data.inventaireWorks && data.inventaireWorks.length > 0) {
                const item = data.inventaireWorks[0];
                const authorName = item.authors && item.authors.length > 0
                    ? item.authors.join(', ')
                    : 'Auteur inconnu';

                // Essayer d'importer le livre pour obtenir la couverture
                try {
                    const token = await authService.getToken();
                    
                    // Construire le payload d'import avec typage
                    const importPayload: Record<string, unknown> = {
                        title: item.label || item.title,
                        description: item.description || '',
                        cover: item.image || item.cover || '',
                        inventaireUri: item.uri || item.inventaireUri,
                        googleId: item.googleId,
                        isbn,
                        ...(item.year && { year: item.year }),
                        ...(item.pages && { pages: item.pages }),
                        ...(item.genre && { genre: item.genre }),
                        authors: item.authors || [],
                        authorUris: item.authorUris || [],
                    };
                    
                    const importRes = await fetch(`${API_BASE_URL}/books/import`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
                        },
                        body: JSON.stringify(importPayload),
                    });

                    if (importRes.ok) {
                        const imported: Record<string, unknown> = await importRes.json();
                        this.platformServices.haptics.notificationAsync("success");
                        
                        const bookData: IsbnBookData = {
                            title: (imported.title as string) || item.title || item.label || 'Livre inconnu',
                            author: authorName,
                            cover: (imported.cover as string) || item.image || item.cover || undefined,
                            bookId: imported.id ? String(imported.id) : undefined,
                            inventaireUri: (imported.inventaireUri as string) || item.inventaireUri || item.uri,
                        };
                        
                        return { success: true, bookData, error: undefined };
                    }
                } catch (importErr) {
                    console.error('[ScanService] Import failed, falling back to search cover:', importErr);
                }

                // Fallback: utiliser les données de recherche
                const externalBookData: ExternalBookData = {
                    title: item.title || item.label,
                    authors: item.authors,
                    authorUris: item.authorUris,
                    description: item.description,
                    image: item.image,
                    cover: item.cover,
                    uri: item.uri,
                    inventaireUri: item.inventaireUri,
                    googleId: item.googleId,
                    year: item.year,
                    pages: item.pages,
                    genre: item.genre,
                    label: item.label,
                };
                
                const bookData: IsbnBookData = {
                    title: item.title || item.label || 'Livre inconnu',
                    author: authorName,
                    cover: item.image || item.cover || undefined,
                    inventaireUri: item.inventaireUri || item.uri,
                    bookData: externalBookData,
                };
                
                return { success: true, bookData, error: undefined };
            } else if (data.books && data.books.length > 0) {
                const book = data.books[0];
                const authorName = typeof book.author === 'string'
                    ? book.author
                    : (book.author as any)?.name || 'Auteur inconnu';
                
                this.platformServices.haptics.notificationAsync("success");
                
                const bookData: IsbnBookData = {
                    title: book.title,
                    author: authorName,
                    cover: book.cover || undefined,
                    bookId: book.id?.toString() ?? undefined,
                    inventaireUri: book.inventaireUri,
                };
                
                return { success: true, bookData, error: undefined };
            } else {
                console.log('[ScanService] No book found for ISBN:', isbn);
                return { success: false, bookData: null, error: 'No book found for ISBN' };
            }
        } catch (error) {
            console.error('Error searching ISBN:', error);
            return { 
                success: false, 
                bookData: null, 
                error: error instanceof Error ? error.message : String(error) 
            };
        }
    }

    /**
     * Capture une photo et effectue la reconnaissance de texte
     */
    async capturePhotoAndRecognize(photoFile: PhotoFile): Promise<{
        success: boolean;
        photo: PhotoFile | null;
        ocrResult: OcrResult | null;
        error?: string;
    }> {
        try {
            console.log('[ScanService] Processing photo:', photoFile.path);
            
            const ocrResult = await recognizeText(photoFile.path);
            const elements = ocrResult.elements;

            if (!elements || elements.length === 0) {
                return {
                    success: false,
                    photo: null,
                    ocrResult: null,
                    error: 'No text recognized in the photo'
                };
            }

            // Normaliser le chemin de l'image
            const normalizedPath = ocrResult.normalizedUri?.replace('file://', '');
            

            const pickedPhoto: PhotoFile = {
                ...photoFile,
                path: normalizedPath || photoFile.path,
                width: ocrResult.normalizedSize?.width || photoFile.width,
                height: ocrResult.normalizedSize?.height || photoFile.height,
                metadata: { Orientation: 1 } as any,
            };

            return {
                success: true,
                photo: pickedPhoto,
                ocrResult: {
                    ...ocrResult,
                    text: elements.map(e => e.text).join(' ')
                },
                error: undefined
            };
        } catch (error) {
            console.error('Failed to process photo:', error);
            return {
                success: false,
                photo: null,
                ocrResult: null,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }

    /**
     * Sélectionne une image depuis la galerie et effectue la reconnaissance de texte
     */
    async pickImageFromGalleryAndRecognize(imageUri: string): Promise<{
        success: boolean;
        photo: PhotoFile | null;
        ocrResult: OcrResult | null;
        isIsbn: boolean;
        bookData: IsbnBookData | null;
        error?: string;
    }> {
        try {
            const cleanPath = imageUri.startsWith('file://') ? imageUri : `file://${imageUri}`;
            console.log('[ScanService] Processing gallery image:', cleanPath);

            const ocrResult = await recognizeText(cleanPath);
            const elements = ocrResult.elements;
            
            if (!elements || elements.length === 0) {
                return {
                    success: false,
                    photo: null,
                    ocrResult: null,
                    isIsbn: false,
                    bookData: null,
                    error: 'No text recognized in the selection'
                };
            }

            const fullText = elements.map(e => e.text).join(' ');
            console.log('[ScanService] Recognized text:', fullText);

            // Vérifier si c'est un ISBN
            const isbnCheck = await this.checkAndHandleIsbn(fullText);
            
            if (isbnCheck.success && isbnCheck.bookData) {
                return {
                    success: true,
                    photo: null,
                    ocrResult: null,
                    isIsbn: true,
                    bookData: isbnCheck.bookData,
                    error: undefined
                };
            }

            const pickedPhoto = {
                path: cleanPath,
                width: ocrResult.normalizedSize?.width || 0,
                height: ocrResult.normalizedSize?.height || 0,
                isRawPhoto: false,
                metadata: { Orientation: 1 },
            } as any as PhotoFile;

            return {
                success: true,
                photo: pickedPhoto,
                ocrResult: {
                    ...ocrResult,
                    text: fullText
                },
                isIsbn: false,
                bookData: null,
                error: undefined
            };
        } catch (error) {
            console.error('Error processing gallery image:', error);
            return {
                success: false,
                photo: null,
                ocrResult: null,
                isIsbn: false,
                bookData: null,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }

    /**
     * Nettoie une photo après annulation du scan
     */
    async cleanupPhoto(photo: PhotoFile | null): Promise<void> {
        if (photo?.path) {
            try {
                const path = photo.path.startsWith('file://') ? photo.path : `file://${photo.path}`;
                await FileSystem.deleteAsync(path, { idempotent: true });
            } catch (e) {
                console.log("Error deleting photo:", e);
            }
        }
    }

    /**
     * Sélectionne une citation aléatoire d'autres utilisateurs
     */
    async getRandomQuoteFromOtherUsers(
        allQuotes: Quote[],
        currentUserId: string | undefined
    ): Promise<{ success: boolean; quote: Quote | null; error?: string }> {
        try {
            // Importer les bases de données statiques
            const { localQuotesDB, globalQuotesDB } = await import('@/src/shared/api/staticData');
            
            // 1. Essayer de récupérer les citations ajoutées par d'autres utilisateurs
            let candidates: Quote[] = allQuotes.filter(
                (q: Quote) => q.user && q.user.id !== "1" && q.user.id !== currentUserId
            );

            // 2. Si rien trouvé, fallback sur les citations globales statiques
            if (candidates.length === 0) {
                candidates = (globalQuotesDB as unknown as Quote[]).filter(
                    (q: Quote) => q.user && q.user.id !== "1" && q.user.id !== currentUserId
                );
            }

            // 3. Fallback absolu sur n'importe quelles citations
            if (candidates.length === 0) {
                candidates = allQuotes.length > 0 
                    ? allQuotes 
                    : [...(localQuotesDB as unknown as Quote[]), ...(globalQuotesDB as unknown as Quote[])];
            }

            if (candidates.length === 0) {
                return { 
                    success: false, 
                    quote: null, 
                    error: 'No quotes from other users available' 
                };
            }

            const randomIndex = Math.floor(Math.random() * candidates.length);
            const selected: Quote = candidates[randomIndex];

            return { success: true, quote: selected, error: undefined };
        } catch (error) {
            return {
                success: false,
                quote: null,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }
}

// Instance singleton pour compatibilité
export const scanService = new ScanService();
