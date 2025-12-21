/**
 * Service to manage persistent block layouts for Quotes and Books.
 * Currently uses in-memory storage, but can be easily swapped for AsyncStorage or a backend.
 */

import { StorageService, STORAGE_KEYS } from './StorageService';

/**
 * Service to manage persistent block layouts for Quotes and Books.
 */

// Default layouts
const DEFAULT_QUOTE_BLOCKS = [
    'definition#0',
    'notes#0',
    'bookInfo#0',
    'author#0',
    'similarBooks#0',
    'similarAuthors#0',
    'addBlock'
];

const DEFAULT_BOOK_BLOCKS = [
    'author#0',
    'savedQuotes#0',
    'similarBooks#0',
    'addBlock'
];

export const BlockService = {
    /**
     * Get the block layout for a specific entity.
     */
    async getLayout(parentId: string | number, parentType: 'quote' | 'book'): Promise<string[]> {
        // Simulate delay
        await new Promise<void>(resolve => setTimeout(resolve, 50));

        const key = `${parentType}:${parentId}`;
        const layouts = await StorageService.getItem<Record<string, string[]>>(STORAGE_KEYS.BLOCK_LAYOUTS) || {};

        if (layouts[key]) {
            return layouts[key];
        }

        // Return default if no custom layout exists
        return parentType === 'quote' ? [...DEFAULT_QUOTE_BLOCKS] : [...DEFAULT_BOOK_BLOCKS];
    },

    /**
     * Save a new block layout for a specific entity.
     */
    async saveLayout(parentId: string | number, parentType: 'quote' | 'book', layout: string[]): Promise<void> {
        // Simulate delay
        await new Promise<void>(resolve => setTimeout(resolve, 50));

        const key = `${parentType}:${parentId}`;
        const layouts = await StorageService.getItem<Record<string, string[]>>(STORAGE_KEYS.BLOCK_LAYOUTS) || {};

        layouts[key] = layout;
        await StorageService.setItem(STORAGE_KEYS.BLOCK_LAYOUTS, layouts);

        console.log(`[BlockService] Saved layout for ${key}:`, layout);
    }
};
