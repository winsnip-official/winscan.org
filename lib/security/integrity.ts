/**
 * File Integrity Checker
 * Validates critical files haven't been tampered with
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

// Critical files that should not be modified without authorization
const CRITICAL_FILES = [
  'app/layout.tsx',
  'components/Header.tsx',
  'components/Sidebar.tsx',
  'components/Footer.tsx',
  'middleware.ts',
  'lib/api.ts',
  'lib/apiClient.ts',
];

// Generate hash for a file
export function generateFileHash(filePath: string): string {
  try {
    const fullPath = path.join(process.cwd(), filePath);
    const fileContent = fs.readFileSync(fullPath, 'utf-8');
    return crypto.createHash('sha256').update(fileContent).digest('hex');
  } catch (error) {
    console.error(`Error generating hash for ${filePath}:`, error);
    return '';
  }
}

// Generate integrity manifest
export function generateIntegrityManifest(): Record<string, string> {
  const manifest: Record<string, string> = {};
  
  for (const file of CRITICAL_FILES) {
    const hash = generateFileHash(file);
    if (hash) {
      manifest[file] = hash;
    }
  }
  
  return manifest;
}

// Verify file integrity
export function verifyFileIntegrity(
  filePath: string,
  expectedHash: string
): boolean {
  const currentHash = generateFileHash(filePath);
  return currentHash === expectedHash;
}

// Verify all critical files
export function verifyAllFiles(
  manifest: Record<string, string>
): { valid: boolean; tamperedFiles: string[] } {
  const tamperedFiles: string[] = [];
  
  for (const [file, expectedHash] of Object.entries(manifest)) {
    if (!verifyFileIntegrity(file, expectedHash)) {
      tamperedFiles.push(file);
    }
  }
  
  return {
    valid: tamperedFiles.length === 0,
    tamperedFiles,
  };
}
