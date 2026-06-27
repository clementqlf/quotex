const fs = require('fs');
const path = require('path');

const colorsPath = path.join(__dirname, '../src/shared/theme/colors.ts');
const docsDir = path.join(__dirname, '../docs');

function syncTheme() {
  if (!fs.existsSync(colorsPath)) {
    console.error(`Theme file not found at: ${colorsPath}`);
    process.exit(1);
  }

  const colorsContent = fs.readFileSync(colorsPath, 'utf8');

  // Extract color values using simple regular expressions
  const primaryMatch = colorsContent.match(/primary:\s*['"]([^'"]+)['"]/);
  const backgroundMatch = colorsContent.match(/background:\s*['"]([^'"]+)['"]/);
  const surfaceMatch = colorsContent.match(/surface:\s*['"]([^'"]+)['"]/);
  const textMatch = colorsContent.match(/text:\s*['"]([^'"]+)['"]/);
  const textSecondaryMatch = colorsContent.match(/textSecondary:\s*['"]([^'"]+)['"]/);
  const borderMatch = colorsContent.match(/surfaceHighlight:\s*['"]([^'"]+)['"]/);

  if (!primaryMatch || !backgroundMatch || !surfaceMatch || !textMatch || !textSecondaryMatch || !borderMatch) {
    console.error('Failed to extract some theme colors from colors.ts');
    process.exit(1);
  }

  const colors = {
    bg: backgroundMatch[1],
    surface: surfaceMatch[1],
    text: textMatch[1],
    textSecondary: textSecondaryMatch[1],
    accent: primaryMatch[1],
    border: borderMatch[1],
  };

  console.log('Extracted theme colors:', colors);

  // HTML files to update
  const filesToUpdate = [
    path.join(docsDir, 'index.html'),
    path.join(docsDir, 'cgu/index.html'),
    path.join(docsDir, 'confidentialite/index.html'),
  ];

  const rootStyleReplacement = `:root {
      --bg-color: ${colors.bg};
      --surface-color: ${colors.surface};
      --text-primary: ${colors.text};
      --text-secondary: ${colors.textSecondary};
      --accent-color: ${colors.accent};
      --border-color: ${colors.border};
    }`;

  filesToUpdate.forEach(filePath => {
    if (!fs.existsSync(filePath)) {
      console.warn(`File not found, skipping: ${filePath}`);
      return;
    }

    let fileContent = fs.readFileSync(filePath, 'utf8');
    const originalContent = fileContent;

    // Replace the :root block
    fileContent = fileContent.replace(/:root\s*\{[^}]*\}/g, rootStyleReplacement);

    if (fileContent !== originalContent) {
      fs.writeFileSync(filePath, fileContent, 'utf8');
      console.log(`Successfully synced theme colors in: ${path.relative(path.join(__dirname, '..'), filePath)}`);
    } else {
      console.log(`No changes needed for: ${path.relative(path.join(__dirname, '..'), filePath)}`);
    }
  });
}

syncTheme();
