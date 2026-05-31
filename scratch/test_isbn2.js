const text1 = "978  2070368211";
const text2 = "978.2070368211";

function extractIsbnNew(text) {
    const cleanText = text.replace(/\n/g, ' ');
    const candidates = cleanText.match(/(?:[0-9xX][-\s]*){9,17}/g) || [];
    
    let found10 = null;
    
    for (const cand of candidates) {
        const cleaned = cand.replace(/[-\s]/g, '');
        if (cleaned.length === 13 && /^(97[89])\d{10}$/.test(cleaned)) {
            return cleaned;
        }
        if (cleaned.length === 10 && /^\d{9}[\dxX]$/i.test(cleaned)) {
            if (!found10) found10 = cleaned;
        }
    }
    
    const digitsOnly = cleanText.replace(/[^0-9xX]/g, '');
    const fallbackMatch = /(97[89]\d{10})/.exec(digitsOnly);
    if (fallbackMatch) {
        return fallbackMatch[1];
    }
    
    if (found10) {
        return found10;
    }
    
    const fallbackMatch10 = /(\b\d{9}[\dxX]\b)/i.exec(digitsOnly);
    if (fallbackMatch10) {
        return fallbackMatch10[1];
    }
    
    return null;
}

console.log("New 1:", extractIsbnNew(text1));
console.log("New 2:", extractIsbnNew(text2));
