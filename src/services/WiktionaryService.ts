export interface Definition {
    term: string;
    genre: string;
    definition: string;
    example: string;
}

export const fetchDefinition = async (word: string): Promise<Definition | null> => {
    try {
        const url = `https://fr.wiktionary.org/w/api.php?action=query&titles=${encodeURIComponent(word)}&prop=revisions&rvslots=*&rvprop=content&format=json&origin=*`;
        const response = await fetch(url);
        const data = await response.json();

        const pages = data.query?.pages;
        if (!pages) return null;

        const pageId = Object.keys(pages)[0];
        if (pageId === '-1') return null; // Word not found

        const content = pages[pageId]?.revisions?.[0]?.slots?.main?.['*'];
        if (!content) return null;

        return parseWikitext(word, content);
    } catch (error) {
        console.warn(`Error fetching definition for ${word}:`, error);
        return null;
    }
};

const parseWikitext = (word: string, wikitext: string): Definition | null => {
    // 1. Extract the French section: starts with == {{langue|fr}} == and ends at the next language section or end of string
    const frSectionMatch = wikitext.match(/==\s*{{langue\|fr}}\s*==([\s\S]*?)(?=(==\s*{{langue\||$))/);
    if (!frSectionMatch) return null; // No French definition found

    const frContent = frSectionMatch[1];

    // 2. Extract Part of Speech (Type/Genre)
    // Looking for === {{S|...|fr}} === 
    // Common types: nom, verbe, adjectif, adverbe
    const typeMatch = frContent.match(/===\s*{{S\|([^}|]+)\|fr(?:\|num=\d+)?}}\s*===/);
    let genre = typeMatch ? typeMatch[1] : 'Définition';

    // Normalize simple types for display
    const genreMap: Record<string, string> = {
        'nom': 'Nom commun',
        'verbe': 'Verbe',
        'adj': 'Adjectif',
        'adjectif': 'Adjectif',
        'adv': 'Adverbe',
        'adverbe': 'Adverbe'
    };
    genre = genreMap[genre] || genre.charAt(0).toUpperCase() + genre.slice(1);

    // 3. Extract the first definition
    // Definitions start with '#'
    const definitionMatch = frContent.match(/^#\s*([^*].*?)$/m);
    let definition = definitionMatch ? definitionMatch[1] : '';

    // Clean the definition text (remove templates and links)
    definition = cleanWikitext(definition);

    // 4. Extract an example
    // Examples start with '#*' or use {{exemple|...}} template
    let example = '';

    // Try finding strict dictionary example lines (#*)
    const exampleMatch = frContent.match(/^#\*\s*(.*?)$/m);

    // Or look for {{exemple|...}}
    const templateExampleMatch = frContent.match(/{{exemple\|([^}|]+)/);

    if (exampleMatch) {
        example = exampleMatch[1];
    } else if (templateExampleMatch) {
        example = templateExampleMatch[1];
    }

    example = cleanWikitext(example);
    if (!example) example = ''; // Ensure not null

    if (!definition) return null;

    return {
        term: word,
        genre,
        definition,
        example
    };
};

const cleanWikitext = (text: string): string => {
    if (!text) return '';
    let cleaned = text;

    // Remove [[link|text]] -> text
    cleaned = cleaned.replace(/\[\[(?:[^|\]]*\|)?([^\]]+)\]\]/g, '$1');

    // Remove {{...}} templates roughly
    // This is tricky as templates can be nested or complex. 
    // For a simple cleaner:
    // Remove reference templates like {{source|...}} or {{R|...}} at the end often
    cleaned = cleaned.replace(/{{[^}]+}}/g, '');

    // Remove unwanted chars like ''italic'' or '''bold'''
    cleaned = cleaned.replace(/'''?/g, '');

    return cleaned.trim();
};
