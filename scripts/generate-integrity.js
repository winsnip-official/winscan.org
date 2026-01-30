/**
 * Generate integrity manifest for critical files
 * Run this after making authorized changes: node scripts/generate-integrity.js
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Critical files to protect
const CRITICAL_FILES = [
  'app/layout.tsx',
  'components/Header.tsx',
  'components/Sidebar.tsx',
  'components/Footer.tsx',
  'middleware.ts',
  'lib/api.ts',
  'lib/apiClient.ts',
];

function generateFileHash(filePath) {
  try {
    const fullPath = path.join(process.cwd(), filePath);
    const fileContent = fs.readFileSync(fullPath, 'utf-8');
    return crypto.createHash('sha256').update(fileContent).digest('hex');
  } catch (error) {
    console.error(`Error generating hash for ${filePath}:`, error);
    return null;
  }
}

function generateManifest() {
  const manifest = {
    generated: new Date().toISOString(),
    files: {},
  };

  console.log('🔐 Generating integrity manifest...\n');

  for (const file of CRITICAL_FILES) {
    const hash = generateFileHash(file);
    if (hash) {
      manifest.files[file] = hash;
      console.log(`✅ ${file}`);
      console.log(`   Hash: ${hash.substring(0, 16)}...`);
    } else {
      console.log(`❌ ${file} - Failed to generate hash`);
    }
  }

  // Save manifest (local only)
  const manifestPath = path.join(process.cwd(), '.integrity-manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  // Generate hashes.ts (will be committed to repo)
  const hashesContent = `/**
 * File integrity hashes - DO NOT MODIFY
 * Generated: ${manifest.generated}
 */

export const FILE_HASHES = ${JSON.stringify(manifest.files, null, 2)} as const;

export const GENERATED_AT = '${manifest.generated}';
`;

  const hashesPath = path.join(process.cwd(), 'lib/security/hashes.ts');
  fs.writeFileSync(hashesPath, hashesContent);

  console.log(`\n✅ Integrity manifest saved to .integrity-manifest.json`);
  console.log(`✅ Hashes embedded in lib/security/hashes.ts`);
  console.log(`📅 Generated: ${manifest.generated}`);
  console.log(`📁 Protected files: ${Object.keys(manifest.files).length}`);
  console.log(`\n⚠️  Remember to commit lib/security/hashes.ts!`);
}

// Run
generateManifest();
