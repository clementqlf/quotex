const text1 = "978  2070368211";
const text2 = "9782070368211";
const text3 = "some text 978 2070368211 other text";

function extractIsbnCurrent(text) {
    const cleanText = text.replace(/\n/g, ' ');
    const candidates = cleanText.match(/(?:[0-9xX][-\s]?){9,17}/g) || [];
    
    for (const cand of candidates) {
        const cleaned = cand.replace(/[-\s]/g, '');
        if (cleaned.length === 13 && /^(97[89])\d{10}$/.test(cleaned)) {
            return cleaned;
        }
        if (cleaned.length === 10 && /^\d{9}[\dxX]$/i.test(cleaned)) {
            return cleaned;
        }
    }
    return null;
}

function extractIsbnNew(text) {
    const cleanText = text.replace(/\n/g, ' ');
    // use * instead of ? for spacing
    const candidates = cleanText.match(/(?:[0-9xX][-\s]*){9,17}/g) || [];
    
    let found10 = null;
    
    for (const cand of candidates) {
        const cleaned = cand.replace(/[-\s]/g, '');
        if (cleaned.length === 13 && /^(97[89])\d{10}$/.test(cleaned)) {
            return cleaned; // always return 13 immediately
        }
        if (cleaned.length === 10 && /^\d{9}[\dxX]$/i.test(cleaned)) {
            if (!found10) found10 = cleaned;
        }
    }
    
    return found10;
}

console.log("Current 1:", extractIsbnCurrent(text1));
console.log("New 1:", extractIsbnNew(text1));

console.log("Current 2:", extractIsbnCurrent(text2));
console.log("New 2:", extractIsbnNew(text2));

console.log("Current 3:", extractIsbnCurrent(text3));
console.log("New 3:", extractIsbnNew(text3));

