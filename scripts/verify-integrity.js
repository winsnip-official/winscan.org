/**
 * Verify integrity of critical files
 * Run this to check if files have been tampered: node scripts/verify-integrity.js
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function generateFileHash(filePath) {
  try {
    const fullPath = path.join(process.cwd(), filePath);
    const fileContent = fs.readFileSync(fullPath, 'utf-8');
    return crypto.createHash('sha256').update(fileContent).digest('hex');
  } catch (error) {
    return null;
  }
}

function verifyIntegrity() {
  console.log('🔍 Verifying file integrity...\n');

  // Load manifest
  const manifestPath = path.join(process.cwd(), '.integrity-manifest.json');
  
  if (!fs.existsSync(manifestPath)) {
    console.error('❌ Integrity manifest not found!');
    console.error('   Run: node scripts/generate-integrity.js');
    process.exit(1);
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  console.log(`📅 Manifest generated: ${manifest.generated}\n`);

  let tamperedFiles = [];
  let validFiles = 0;

  for (const [file, expectedHash] of Object.entries(manifest.files)) {
    const currentHash = generateFileHash(file);
    
    if (!currentHash) {
      console.log(`⚠️  ${file} - File not found`);
      tamperedFiles.push(file);
    } else if (currentHash === expectedHash) {
      console.log(`✅ ${file} - OK`);
      validFiles++;
    } else {
      console.log(`❌ ${file} - TAMPERED!`);
      console.log(`   Expected: ${expectedHash.substring(0, 16)}...`);
      console.log(`   Current:  ${currentHash.substring(0, 16)}...`);
      tamperedFiles.push(file);
    }
  }

  console.log(`\n${'='.repeat(50)}`);
  
  if (tamperedFiles.length === 0) {
    console.log('✅ All files are intact!');
    console.log(`📁 Verified: ${validFiles} files`);
    process.exit(0);
  } else {
    console.log('❌ SECURITY ALERT: Files have been tampered!');
    console.log(`📁 Valid: ${validFiles} files`);
    console.log(`⚠️  Tampered: ${tamperedFiles.length} files`);
    console.log('\nTampered files:');
    tamperedFiles.forEach(file => console.log(`  - ${file}`));
    console.log('\n⚠️  If these changes are authorized, regenerate manifest:');
    console.log('   node scripts/generate-integrity.js');
    process.exit(1);
  }
}

// Run
verifyIntegrity();
