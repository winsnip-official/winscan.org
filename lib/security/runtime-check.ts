/**
 * Runtime integrity checker
 * Validates critical files at build time and runtime
 */

import { generateFileHash } from './integrity';
import { FILE_HASHES } from './hashes';

let integrityCheckResult: {
  valid: boolean;
  tamperedFiles: string[];
  error?: string;
} | null = null;

export function verifyRuntimeIntegrity(): {
  valid: boolean;
  tamperedFiles: string[];
  error?: string;
} {
  // Return cached result if already checked
  if (integrityCheckResult !== null) {
    return integrityCheckResult;
  }

  // Skip in development
  if (process.env.NODE_ENV === 'development') {
    integrityCheckResult = { valid: true, tamperedFiles: [] };
    return integrityCheckResult;
  }

  const tamperedFiles: string[] = [];

  try {
    for (const [file, expectedHash] of Object.entries(FILE_HASHES)) {
      const currentHash = generateFileHash(file);
      
      if (currentHash && currentHash !== expectedHash) {
        tamperedFiles.push(file);
        console.error(`[SECURITY] File tampered: ${file}`);
        console.error(`  Expected: ${expectedHash.substring(0, 16)}...`);
        console.error(`  Current:  ${currentHash.substring(0, 16)}...`);
      }
    }

    if (tamperedFiles.length > 0) {
      console.error('\n╔════════════════════════════════════════════════════════╗');
      console.error('║         🚨 SECURITY ALERT - UNAUTHORIZED ACCESS 🚨      ║');
      console.error('╚════════════════════════════════════════════════════════╝');
      console.error('\n[CRITICAL] Core files have been modified without authorization!');
      console.error(`[CRITICAL] ${tamperedFiles.length} file(s) tampered:`, tamperedFiles);
      console.error('\n[ACTION] This deployment is BLOCKED.');
      console.error('[ACTION] Website will not function until integrity is restored.');
      console.error('[CONTACT] Repository owner for assistance.\n');
    }

    integrityCheckResult = {
      valid: tamperedFiles.length === 0,
      tamperedFiles,
    };

    return integrityCheckResult;
  } catch (error: any) {
    integrityCheckResult = {
      valid: false,
      tamperedFiles: [],
      error: error.message,
    };
    return integrityCheckResult;
  }
}

// Export function to check if system is compromised
export function isSystemCompromised(): boolean {
  const result = verifyRuntimeIntegrity();
  return !result.valid;
}

// Run check at module load in production
if (process.env.NODE_ENV === 'production' && typeof window === 'undefined') {
  const result = verifyRuntimeIntegrity();
  
  if (!result.valid) {
    // In production, throw error to prevent deployment
    const errorMessage = 
      `\n╔════════════════════════════════════════════════════════╗\n` +
      `║    🚨 SECURITY: UNAUTHORIZED MODIFICATIONS DETECTED 🚨  ║\n` +
      `╚════════════════════════════════════════════════════════╝\n\n` +
      `[CRITICAL] ${result.tamperedFiles.length} core file(s) have been modified without authorization.\n` +
      `[BLOCKED] Deployment prevented for security reasons.\n` +
      `[FILES] ${result.tamperedFiles.join(', ')}\n\n` +
      `[ACTION] Contact repository owner to restore integrity.\n` +
      `[INFO] This is a security feature to prevent unauthorized modifications.\n`;
    
    throw new Error(errorMessage);
  }
}
