const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function replaceInFile(filePath, replacements) {
    if (!fs.existsSync(filePath)) {
        console.warn('File not found:', filePath);
        return;
    }
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;
    for (const [search, replace] of replacements) {
        content = content.replace(search, replace);
    }
    if (content !== original) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log('Fixed:', filePath);
    }
}

// 1. Fix global -> globalThis in tests and specific files
const filesWithGlobal = [
    '__tests__/SupabaseQuoteRepository.test.ts',
    'app/_layout.tsx',
    'src/entities/author/api/__tests__/WikidataService.test.ts',
    'src/entities/quote/api/__tests__/QuoteService.test.ts',
    'src/entities/quote/api/__tests__/SupabaseQuoteRepository.test.ts',
    'src/entities/user/ui/UserProfile.tsx',
    'src/features/scanner/api/__tests__/ScanService.test.ts'
];

for (const file of filesWithGlobal) {
    replaceInFile(path.join(__dirname, '..', file), [
        [/global\./g, 'globalThis.']
    ]);
}

// 2. Fix NodeJS.Timeout in useNetworkSync.ts
replaceInFile(path.join(__dirname, '../src/entities/quote/lib/useNetworkSync.ts'), [
    [/NodeJS\.Timeout/g, 'ReturnType<typeof setTimeout>']
]);

// 3. Fix StyleSheet.absoluteFillObject -> StyleSheet.absoluteFill
const filesWithAbsoluteFill = [
    'src/entities/quote/ui/AIChatModal.tsx',
    'src/entities/quote/ui/QuoteDetailModal.tsx',
    'src/entities/user/ui/UserProfile.tsx',
    'src/features/scanner/ui/BarcodeScannerModal.tsx',
    'src/features/scanner/ui/ScanFrameOverlay.tsx',
    'src/features/scanner/ui/ScanPreviewModal.tsx',
    'src/features/scanner/ui/ScanScreen.tsx',
    'src/features/scanner/ui/ScanWorkflow.tsx',
    'src/shared/ui/AnimatedSplashScreen.tsx'
];

for (const file of filesWithAbsoluteFill) {
    replaceInFile(path.join(__dirname, '..', file), [
        [/StyleSheet\.absoluteFillObject/g, 'StyleSheet.absoluteFill']
    ]);
}

console.log('All replacements done.');
