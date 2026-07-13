import { compareAuthorNames, normalizeTitle } from './inventaire.ts';
import type { GoogleBookSearchResult } from './googlebooks.ts';

export interface GoogleBookCandidateScore {
  candidate: GoogleBookSearchResult;
  score: number;
}

export function scoreGoogleBookCandidate(candidate: GoogleBookSearchResult): number {
  return (candidate.cover ? 4 : 0) + (candidate.description ? 2 : 0) + (candidate.pages ? 1 : 0);
}

function tokenizeText(input: string): string[] {
  if (!input) return [];
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

export function scoreGoogleBookTitleSimilarity(expectedTitle: string, candidateTitle: string): number {
  const expectedTokens = tokenizeText(expectedTitle);
  const candidateTokens = tokenizeText(candidateTitle);
  if (!expectedTokens.length || !candidateTokens.length) return 0;

  const candidateSet = new Set(candidateTokens);
  const overlap = expectedTokens.filter((token) => candidateSet.has(token)).length;
  const expectedCoverage = overlap / expectedTokens.length;
  const candidateCoverage = overlap / candidateTokens.length;
  const exactNormalizedMatch = normalizeTitle(expectedTitle) === normalizeTitle(candidateTitle);

  return (exactNormalizedMatch ? 100 : 0) + (expectedCoverage * 10) + (candidateCoverage * 5);
}

export function selectBestGoogleBookMatch(
  candidates: GoogleBookSearchResult[],
  expectedTitle: string,
  expectedAuthor?: string,
): GoogleBookSearchResult | null {
  if (!Array.isArray(candidates) || candidates.length === 0) return null;
  if (!expectedTitle || !expectedTitle.trim()) return null;

  const normalizedInputTitle = normalizeTitle(expectedTitle.trim());
  if (!normalizedInputTitle) return null;

  const filtered = candidates.filter((candidate) => {
    const normalizedCandidateTitle = normalizeTitle(candidate.title || candidate.label || '');
    if (normalizedCandidateTitle !== normalizedInputTitle) return false;

    if (!expectedAuthor || !expectedAuthor.trim()) return true;

    return Array.isArray(candidate.authors)
      && candidate.authors.some((candidateAuthor) => compareAuthorNames(candidateAuthor, expectedAuthor));
  });

  if (filtered.length === 0) return null;

  return filtered
    .map((candidate): GoogleBookCandidateScore => ({
      candidate,
      score: scoreGoogleBookCandidate(candidate),
    }))
    .sort((a, b) => b.score - a.score)[0].candidate;
}

export function selectBestGoogleBookRichMetadataMatch(
  candidates: GoogleBookSearchResult[],
  expectedTitle: string,
  expectedAuthor?: string,
): GoogleBookSearchResult | null {
  if (!Array.isArray(candidates) || candidates.length === 0) return null;
  if (!expectedTitle || !expectedTitle.trim()) return null;

  const dataCandidates = candidates.filter((candidate) => !!candidate.cover || !!candidate.description);
  if (dataCandidates.length === 0) return null;

  return dataCandidates
    .map((candidate): GoogleBookCandidateScore => {
      const titleScore = scoreGoogleBookTitleSimilarity(expectedTitle, candidate.title || candidate.label || '');
      const authorScore = expectedAuthor && expectedAuthor.trim() && Array.isArray(candidate.authors)
        && candidate.authors.some((candidateAuthor) => compareAuthorNames(candidateAuthor, expectedAuthor))
        ? 20
        : 0;

      return {
        candidate,
        score: titleScore + authorScore + scoreGoogleBookCandidate(candidate),
      };
    })
    .sort((a, b) => b.score - a.score)[0].candidate;
}
