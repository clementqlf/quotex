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

                        const exempleIdx = fullTemplate.toLowerCase().indexOf('{{exemple');
                        if (exempleIdx !== -1) {
                            const balancedTemplate = findBalancedBraces(fullTemplate, exempleIdx);
                            if (balancedTemplate) {
                                example = cleanWikitext(balancedTemplate);
                            }
                        } else {
                            const rawMatch = fullTemplate.match(/([\s\S]*?)(?=(?:—|\(|$))/);
                            if (rawMatch) {
                                example = cleanWikitext(rawMatch[1]);
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

const findBalancedBraces = (str: string, startIdx: number): string | null => {
    let depth = 0;
    for (let i = startIdx; i < str.length; i++) {
        if (str.substring(i, i + 2) === '{{') {
            depth++;
            i++;
        } else if (str.substring(i, i + 2) === '}}') {
            depth--;
            i++;
            if (depth === 0) return str.substring(startIdx, i + 1);
        }
    }
    return null;
};

const splitByPipe = (str: string): string[] => {
    const results: string[] = [];
    let current = '';
    let depth = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str[i];
        if (char === '{' || char === '[') depth++;
        if (char === '}' || char === ']') depth--;
        if (char === '|' && depth === 0) {
            results.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    results.push(current);
    return results;
};

const cleanWikitext = (text: string): string => {
    if (!text) return '';
    let cleaned = text;

    // 1. Specific handling for {{exemple|...}}
    const exempleIdx = cleaned.toLowerCase().indexOf('{{exemple');
    if (exempleIdx !== -1) {
        const fullTemplate = findBalancedBraces(cleaned, exempleIdx);
        if (fullTemplate) {
            const content = fullTemplate.substring(fullTemplate.indexOf('|') + 1, fullTemplate.length - 2);
            const params = splitByPipe(content).map(p => p.trim());
            
            // The body is the first parameter that isn't a named metadata parameter (lang, source, etc.)
            const bodyParam = params.find(p => {
                if (p.startsWith('1=')) return true;
                // If it looks like "key=value" and isn't a long text (likely metadata)
                if (/^[a-z_]{1,15}\s*=/i.test(p)) return false;
                return p.length > 0;
            });
            
            if (bodyParam) {
                cleaned = bodyParam.startsWith('1=') ? bodyParam.substring(2) : bodyParam;
            }
        }
    }

    // 2. Remove specific persistent technical parameters from non-template text
    cleaned = cleaned.replace(/\|\s*(?:source|lang|langue|num|lieu|année|page|auteur|titre|site|url|le|consulté\s+le|éditeur|collection|passage|isbn|traduction|trad|volume|numéro|mois|jour)\s*=[^|}]*/gi, '');

    // 3. Handle common templates while preserving their core content
    // {{w|CONTENT|...}} or {{W|CONTENT|...}} (Wikipedia links)
    cleaned = cleaned.replace(/{{w\|([^|{}]+)[^}]*}}/gi, '$1');
    // {{lang|fr|CONTENT}}
    cleaned = cleaned.replace(/{{(?:lang|langue)\|[^|{}]+\|([^|{}]+)[^}]*}}/gi, '$1');

    // 3. Remove all other {{...}} templates completely. 
    for (let i = 0; i < 4; i++) {
        cleaned = cleaned.replace(/{{[^{}]*}}/g, '');
    }

    // 4. Remove [[link|text]] -> text
    cleaned = cleaned.replace(/\[\[(?:[^|\]]*\|)?([^\]]+)\]\]/g, '$1');

    // 5. Remove unwanted chars like ''italic'' or '''bold'''
    cleaned = cleaned.replace(/'''?/g, '');

    // 6. Remove HTML-like tags and refs
    cleaned = cleaned.replace(/<ref[^>]*>[\s\S]*?<\/ref>/g, '');
    cleaned = cleaned.replace(/<[^>]+>/g, '');

    // 7. Remove bracketed labels like [titre]
    cleaned = cleaned.replace(/\[[^\]]+\]/g, ' ');

    // 8. Remove any lingering wiki artifacts
    cleaned = cleaned.replace(/[{}|]/g, ' ');

    // 9. Remove lingering key=value patterns that might not have had a pipe
    const keys = ['source', 'titre', 'auteur', 'url', 'site', 'le', 'consulté\\s+le', 'éditeur', 'collection', 'passage', 'page', 'isbn', 'lieu', 'numéro', 'volume', 'année', 'mois', 'jour', 'traduction', 'trad', 'lang', 'langue', '\\d+'];
    const keysPattern = keys.join('|');
    const lingeringRegex = new RegExp(`(?:^|\\s)\\b(${keysPattern})\\s*=[^=]*(?=\\s+\\b(?:${keysPattern})\\s*=|$)`, 'gi');
    cleaned = cleaned.replace(lingeringRegex, ' ');

    // 10. Remove specific persistent technical words and parameters
    cleaned = cleaned.replace(/\b(lang|langue|exemple|sigle|fr)\b\s*=?\s*/gi, '');

    // 11. Final cleanup of spaces and lingering punctuation
    cleaned = cleaned.replace(/\s+/g, ' ');
    cleaned = cleaned.replace(/\s*=\s*$/, '');
    
    // Final check for the leading/trailing equals or dashes that sometimes remain
    cleaned = cleaned.replace(/^[—\s=]+|[—\s=]+$/g, '');

    return cleaned.trim();
};
