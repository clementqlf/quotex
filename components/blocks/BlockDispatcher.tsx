import React from 'react';
import { View, Text } from 'react-native';
import { BlockKey } from '../../src/config/blocks';
import { Book, Author, Quote } from '../../types';
import ReviewBlock from '../ReviewBlock';
import { BookInfoBlock } from './BookInfoBlock';
import { AuthorBlock } from './AuthorBlock';
import { NotesBlock } from './NotesBlock';
import { SimilarBooksBlock } from './SimilarBooksBlock';
import { SimilarAuthorsBlock } from './SimilarAuthorsBlock';
import { DefinitionBlock } from './DefinitionBlock';
import { SavedQuotesBlock } from './SavedQuotesBlock';
import { BuyLinkBlock } from './BuyLinkBlock';
import { BlockWrapper } from './BlockWrapper';
import { useTheme } from '../../src/contexts/ThemeContext';

// Defined context interface to pass necessary data to blocks
export interface BlockContext {
    // Data
    book?: Book | null;
    author?: Author | null;
    quote?: Quote | null;
    savedQuotes?: Quote[];

    // Handlers
    onUpdateBlockData?: (blockKey: string, data: any) => void;
    onBookPress?: (bookTitle: string) => void;
    onAuthorPress?: (authorName: string) => void;
    onQuotePress?: (quote: Quote) => void;

    // Specific handlers
    onReviewAdded?: () => void;
    onEditDefinitionSelection?: (blockKey: string) => void; // For Quote
    onManageDictionary?: () => void; // For Book

    // State
    blockData?: Record<string, any>;
}

interface BlockDispatcherProps {
    blockId: string; // The full ID, e.g., 'notes#123' or just 'notes'
    context: BlockContext;
    onRemove?: () => void; // Callback to remove the block
}

export const BlockDispatcher: React.FC<BlockDispatcherProps> = ({ blockId, context, onRemove }) => {
    const baseKey = (blockId.includes('#') ? blockId.split('#')[0] : blockId) as BlockKey;

    // Fallback for missing context data where appropriate
    const {
        book, author, quote, savedQuotes, blockData,
        onUpdateBlockData, onBookPress, onAuthorPress, onQuotePress,
        onReviewAdded, onEditDefinitionSelection, onManageDictionary
    } = context;

    const { colors } = useTheme();

    switch (baseKey) {
        case 'reviews':
            if (!book?.id) return null;
            // ReviewBlock handles its own wrapper internally usually, let's verify
            // Existing Component has internal structure.
            // We might want to wrap it if it doesn't match our new style, but let's assume it does for now as it was used directly.
            return (
                <ReviewBlock
                    bookId={typeof book.id === 'string' ? parseInt(book.id) : book.id}
                    onReviewAdded={onReviewAdded}
                    onRemove={onRemove}
                />
            );

        case 'bookDescription':
            return <BookInfoBlock book={book || null} variant="description" onRemove={onRemove} />;

        case 'bookInfo':
            // Used in QuoteDetail, needs navigation handler
            return <BookInfoBlock book={book || null} variant="info" onBookPress={onBookPress} onRemove={onRemove} />;

        case 'buy':
            if (!book) return null;
            return <BuyLinkBlock book={book} onRemove={onRemove} />;

        case 'notes':
            return (
                <NotesBlock
                    blockKey="notes" // We might want to pass full blockId if we support multiple notes blocks?
                    // For now system supports unique note per 'notes' key effectively in storage unless key is unique
                    content={blockData?.[blockId] ?? quote?.blockData?.[blockId] ?? ''}
                    onUpdate={(text) => onUpdateBlockData && onUpdateBlockData(blockId, text)}
                    onRemove={onRemove}
                />
            );

        case 'author':
            return (
                <AuthorBlock
                    author={author || null}
                    book={book || undefined}
                    authorName={getAuthorNameFromQuote(quote)}
                    onAuthorPress={onAuthorPress}
                    onRemove={onRemove}
                />
            );

        case 'savedQuotes':
            if (!savedQuotes) return null;
            return <SavedQuotesBlock quotes={savedQuotes} onQuotePress={(q) => onQuotePress && onQuotePress(q)} onRemove={onRemove} />;

        case 'similarBooks':
            // Data might come from book or quote's fetched book
            const similarBooks = book?.similarBooks || [];
            return <SimilarBooksBlock books={similarBooks} onBookPress={(t) => onBookPress && onBookPress(t)} onRemove={onRemove} />;

        case 'similarAuthors':
            const similarAuthors = author?.similarAuthors || [];
            return <SimilarAuthorsBlock authors={similarAuthors} onAuthorPress={(n) => onAuthorPress && onAuthorPress(n)} onRemove={onRemove} />;

        case 'definition':
            // Quote Mode
            // We need to resolve definitions.
            // If manually edited, they are in blockData. If not, maybe in quote.definitions?
            const manualDefs = quote?.blockData?.[blockId];
            const serverDefs = quote?.definitions;
            const defsToShow = manualDefs || serverDefs || [];

            return (
                <DefinitionBlock
                    blockKey="definition"
                    definitions={defsToShow}
                    onEditSelection={onEditDefinitionSelection ? () => onEditDefinitionSelection(blockId) : undefined}
                    onRemove={onRemove}
                />
            );

        case 'dictionary':
            // Book Mode (Aggregated)
            // This logic was complex in BookDetail. aggregated definitions are calculated there.
            // We should pass them via context or prop if possible.
            // But context is generic.
            // Ideally BookDetail should calculate the aggregated list and pass it in a special property or we extend context.
            // Let's assume passed in 'blockData' under 'aggregatedDefinitions'? No, that's storage.
            // We can pass it in context.definitions?
            // Or better, we calculate it here? No, calculation relies on 'savedQuotes'.

            // Let's assume we pass a special 'computed' value in context if needed.
            // We can add `aggregatedDefinitions` to BlockContext.

            // But wait, the context interface is above. Let's add it.
            // Actually, let's cast context for now or add it to interface.

            const { aggregatedDefinitions, hiddenTerms, manualDefinitions } = (context as any); // extend context later

            // Filter logic
            // Ideally the parent component does the filtering logic (ViewModel pattern) and passes 'visibleDefinitions' to us.
            // Let's assume 'visibleDefinitions' is passed in context for simplicity?
            // Or we pass the raw data and do it here.

            // Given complexity, let's assume the parent passes `visibleDefinitions` specifically for this block.
            // But the key is dynamic.

            const visibleDefs = (context as any).visibleDefinitions || [];

            return (
                <DefinitionBlock
                    blockKey="dictionary"
                    definitions={visibleDefs}
                    isAggregated={true}
                    onManageDictionary={onManageDictionary}
                    onRemove={onRemove}
                />
            );

        default:
            return (
                <BlockWrapper blockKey={baseKey as BlockKey} onRemove={onRemove}>
                    <View><Text style={{ color: colors.warning }}>Unknown Block: {baseKey}</Text></View>
                </BlockWrapper>
            );
    }
};

// Helper
function getAuthorNameFromQuote(quote?: Quote | null): string | undefined {
    if (!quote) return undefined;
    if (typeof quote.author === 'string') return quote.author;
    return quote.author?.name;
}
