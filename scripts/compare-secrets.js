const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Paths to env files
const devEnvPath = path.join(__dirname, '../.env.development');
const prodEnvPath = path.join(__dirname, '../.env.production');

// Helper to extract project ref from URL in env file
function getProjectRefFromEnv(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) {
      return fallback;
    }
    const content = fs.readFileSync(filePath, 'utf8');
    const match = content.match(/EXPO_PUBLIC_SUPABASE_URL\s*=\s*https:\/\/([a-z0-9]+)\.supabase\.co/);
    if (match && match[1]) {
      return match[1];
    }
  } catch (error) {
    console.warn(`Warning: Could not read/parse ${path.basename(filePath)}:`, error.message);
  }
  return fallback;
}

// Extract project refs with fallbacks
const devRef = getProjectRefFromEnv(devEnvPath, 'neurbzkkfxrjzjykthtn');
const prodRef = getProjectRefFromEnv(prodEnvPath, 'izrbxjtmwembixwqyaka');

console.log(`\n🔍 Comparing Supabase Secrets:`);
console.log(`   - Dev Project Ref:  ${devRef}`);
console.log(`   - Prod Project Ref: ${prodRef}\n`);

// Helper to run supabase secrets command
function getSecrets(projectRef) {
  try {
    const output = execSync(`npx supabase secrets list --project-ref ${projectRef} -o json`, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'] // ignore stderr warnings about updates
    });
    return JSON.parse(output.trim());
  } catch (error) {
    console.error(`❌ Error fetching secrets for project ref "${projectRef}":`, error.message);
    return null;
  }
}

console.log('⚡ Fetching secrets from Supabase...');
const devSecrets = getSecrets(devRef);
const prodSecrets = getSecrets(prodRef);

if (!devSecrets || !prodSecrets) {
  console.log('❌ Failed to fetch secrets from one or both environments. Please ensure you are logged in to Supabase CLI (run `npx supabase login`).');
  process.exit(1);
}

// Map secrets by name for easy lookup
const devMap = new Map(devSecrets.map(s => [s.name, s]));
const prodMap = new Map(prodSecrets.map(s => [s.name, s]));

// Collect all secret names
const allSecretNames = Array.from(new Set([...devMap.keys(), ...prodMap.keys()])).sort();

// Prepare table data
const tableData = allSecretNames.map(name => {
  const devSec = devMap.get(name);
  const prodSec = prodMap.get(name);

  let status = '✅ Identical';
  
  if (!devSec) {
    status = '➕ Only in Prod';
  } else if (!prodSec) {
    status = '❌ Missing in Prod';
  } else if (devSec.value !== prodSec.value) {
    status = '⚠️ Value mismatch (Digests differ)';
  }

  return {
    Secret: name,
    'Dev Status': devSec ? 'Set' : 'Not Set',
    'Prod Status': prodSec ? 'Set' : 'Not Set',
    Comparison: status
  };
});

console.log('\n📊 COMPARISON RESULTS:\n');
console.table(tableData);

const missingInProd = tableData.filter(d => d.Comparison === '❌ Missing in Prod');
const mismatch = tableData.filter(d => d.Comparison === '⚠️ Value mismatch (Digests differ)');

if (missingInProd.length > 0 || mismatch.length > 0) {
  console.log('\n⚠️ Actions Required:');
  
  if (missingInProd.length > 0) {
    console.log(`\n👉 The following secrets are missing in production:`);
    missingInProd.forEach(item => {
      console.log(`   - ${item.Secret} (Set in Dev, but not in Prod)`);
    });
    console.log(`\nTo set them, run:`);
    console.log(`supabase secrets set KEY=VALUE --project-ref ${prodRef}`);
  }

  if (mismatch.length > 0) {
    console.log(`\n👉 The following secrets have different values between Dev and Prod:`);
    mismatch.forEach(item => {
      console.log(`   - ${item.Secret}`);
    });
    console.log(`(This is normal for keys like DATABASE_URL or environment-specific API keys, but make sure it is intentional!)`);
  }
} else {
  console.log('\n🎉 All secrets are present in both development and production!');
}
console.log('');
