export interface Definition {
    term: string;
    genre: string;
    pronunciation?: string;
    etymology?: string;
    definition: string;
    example: string;
    exampleSource?: string;
    synonyms?: string[];
}

export const fetchDefinition = async (word: string): Promise<Definition[]> => {
    try {
        const url = `https://fr.wiktionary.org/w/api.php?action=query&titles=${encodeURIComponent(word)}&prop=revisions&rvslots=*&rvprop=content&format=json&origin=*`;
        const response = await fetch(url);
        const data = await response.json();

        const pages = data.query?.pages;
        if (!pages) return [];

        const pageId = Object.keys(pages)[0];
        if (pageId === '-1') return []; // Word not found

        const content = pages[pageId]?.revisions?.[0]?.slots?.main?.['*'];
        if (!content) return [];

        return parseWikitext(word, content);
    } catch (error) {
        console.warn(`Error fetching definition for ${word}:`, error);
        return [];
    }
};

const parseWikitext = (word: string, wikitext: string): Definition[] => {
    // 1. Extract the French section
    const frSectionMatch = wikitext.match(/==\s*{{langue\|fr}}\s*==([\s\S]*?)(?=(==\s*{{langue\||$))/);
    if (!frSectionMatch) return [];

    const frContent = frSectionMatch[1];

    // 2. Extract Pronunciation
    const pronMatch = frContent.match(/{{pron\|([^}|]*)(?:\|fr)?}}/i);
    const pronunciation = (pronMatch && pronMatch[1]) ? `[${pronMatch[1]}]` : undefined;

    // 3. Extract linguistic markers
    const linguisticMarkers: string[] = [];
    if (frContent.match(/{{m(?:\|fr)?}}/i)) linguisticMarkers.push('masculin');
    if (frContent.match(/{{f(?:\|fr)?}}/i)) linguisticMarkers.push('féminin');
    if (frContent.match(/{{invar(?:\|fr)?}}/i)) linguisticMarkers.push('invariable');

    // 4. Extract Etymology (support === or ====)
    const etymMatch = frContent.match(/={3,4}\s*{{S\|étymologie}}\s*={3,4}([\s\S]*?)(?==|$)/i);
    const etymology = etymMatch ? cleanWikitext(etymMatch[1].trim().split('\n')[0].startsWith(':') ? etymMatch[1].trim().substring(1) : etymMatch[1]) : undefined;

    // 5. Extract Part of Speech
    const typeMatch = frContent.match(/===\s*{{S\|([^}|]+)\|fr(?:\|num=\d+)?}}\s*===/i);
    let genre = typeMatch ? typeMatch[1] : 'Définition';
    const genreMap: Record<string, string> = {
        'nom': 'n.', 'verbe': 'v.', 'adj': 'adj.', 
        'adjectif': 'adj.', 'adv': 'adv.', 'adverbe': 'adv.', 'sigle': 'sigle'
    };
    genre = genreMap[genre.toLowerCase()] || genre;
    if (linguisticMarkers.length > 0) {
        genre = `${genre} ${linguisticMarkers.join(' ')}`;
    }

    // 6. Extract all definitions
    const lines = frContent.split('\n');
    const results: Definition[] = [];
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        if (line.startsWith('#') && !line.startsWith('#*') && !line.startsWith('#:') && !line.startsWith('##')) {
            let rawDef = line.substring(1).trim();
            
            // Extract contexts
            const contexts: string[] = [];
            const ctxRegex = /{{(?:lexique|contexte|abr|abréviation|label|info|source)\|([^|}]+)(?:\|fr)?}}/gi;
            let match;
            while ((match = ctxRegex.exec(rawDef)) !== null) {
                const label = match[1].toLowerCase() === 'abr' ? 'abréviation' : match[1];
                contexts.push(`(${label})`);
            }
            
            let definition = cleanWikitext(rawDef);
            if (contexts.length > 0) {
                definition = `${contexts.join(' ')} ${definition}`;
            }
            
            if (definition) {
                let example = '';
                let exampleSource = '';

                // Look ahead for examples
                for (let j = i + 1; j < Math.min(i + 15, lines.length); j++) {
                    const nextLine = lines[j].trim();
                    if (!nextLine) continue;

                    if (nextLine.startsWith('#') && !nextLine.startsWith('#*') && !nextLine.startsWith('#:')) break;

                    if (nextLine.startsWith('#*') || nextLine.startsWith('#:')) {
                        let fullTemplate = nextLine.substring(2).trim();
                        
                        // Handle multi-line templates
                        if (fullTemplate.includes('{{exemple') && !fullTemplate.includes('}}')) {
                            let k = j + 1;
                            while (k < lines.length && !lines[k].includes('}}')) {
                                fullTemplate += ' ' + lines[k].trim();
                                k++;
                            }
                            if (k < lines.length) fullTemplate += ' ' + lines[k].trim();
                        }

                        const templateMatch = fullTemplate.match(/{{exemple\s*\|[^|}]*\|([\s\S]*?)}}|(?:#[\*:]\s*)?([\s\S]*?)(?=(?:—|\(|$))/i);
                        if (templateMatch) {
                            const content = templateMatch[1] || templateMatch[2];
                            if (content) {
                                // Extract source if present in template or after dash
                                const sourceMatch = fullTemplate.match(/source\s*=\s*([^|}]+)/i) || fullTemplate.match(/[—(]([^—)]+)[)]?$/);
                                example = cleanWikitext(content);
                                if (sourceMatch) exampleSource = cleanWikitext(sourceMatch[1]);
                            }
                        }
                        if (example) break;
                    }
                }

                results.push({
                    term: word,
                    genre,
                    pronunciation,
                    etymology,
                    definition,
                    example,
                    exampleSource
                });
            }
        }
    }

    return results;
};

const cleanWikitext = (text: string): string => {
    if (!text) return '';
    let cleaned = text;

    // 1. First, try to extract the core content of {{exemple|CONTENT|...}}
    // We do this before general cleaning to save the content
    cleaned = cleaned.replace(/{{exemple\s*\|\s*([^|{}]+)[^}]*}}/gi, '$1');

    // 2. Remove all {{...}} templates completely. 
    // Most templates in definitions are technical markers (gender, language, etc.)
    // and don't belong in a clean display.
    // We use a loop for nesting.
    for (let i = 0; i < 4; i++) {
        cleaned = cleaned.replace(/{{[^{}]*}}/g, '');
    }

    // 3. Remove [[link|text]] -> text
    cleaned = cleaned.replace(/\[\[(?:[^|\]]*\|)?([^\]]+)\]\]/g, '$1');

    // 4. Remove unwanted chars like ''italic'' or '''bold'''
    cleaned = cleaned.replace(/'''?/g, '');

    // 5. Remove HTML-like tags and refs
    cleaned = cleaned.replace(/<ref[^>]*>[\s\S]*?<\/ref>/g, '');
    cleaned = cleaned.replace(/<[^>]+>/g, '');

    // 6. Remove any lingering wiki artifacts
    cleaned = cleaned.replace(/[{}|]/g, ' ');

    // 7. Remove specific persistent technical words and parameters
    cleaned = cleaned.replace(/\|\s*(?:source|lang|langue|num|lieu|année|page|auteur)\s*=[^|}]*/gi, '');
    cleaned = cleaned.replace(/\b(lang|langue|exemple|sigle|fr)\b\s*=?\s*/gi, '');

    // 8. Remove leading small words (usually language codes like 'fr fr ')
    // Match 1-3 lowercase letters at the start of the string followed by space
    while (cleaned.match(/^[a-z]{1,3}\s+/i)) {
        cleaned = cleaned.replace(/^[a-z]{1,3}\s+/i, '');
    }

    // 9. Final cleanup of spaces
    cleaned = cleaned.replace(/\s+/g, ' ');

    return cleaned.trim();
};
