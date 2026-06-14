// Quote Use Cases
export { QuoteUseCases } from './QuoteUseCases';

// Flow hooks
export { useAddQuoteFlow } from './useAddQuoteFlow';
export type { AddQuoteActions, SaveScannedQuoteResult } from './useAddQuoteFlow';

export { useRandomQuoteFlow } from './useRandomQuoteFlow';
export type { 
  UseRandomQuoteFlowProps, 
  RandomQuoteState, 
  RandomQuoteActions, 
  UseRandomQuoteFlowResult 
} from './useRandomQuoteFlow';

// Re-export types from the shared types
export type { CreateQuoteDto, Quote } from '@/src/shared/api/types';
