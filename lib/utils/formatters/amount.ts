/**
 * Format amount utilities that respect chain exponent configuration
 * Supports both Cosmos (exponent 6) and EVM chains (exponent 18)
 */

import { ChainData } from '@/types/chain';

/**
 * Get exponent from chain configuration
 * @param chain - Chain data object
 * @returns Exponent as number (default: 6 for Cosmos chains)
 */
export function getChainExponent(chain: ChainData | null | undefined): number {
  if (!chain?.assets?.[0]?.exponent) return 6;
  
  const exp = chain.assets[0].exponent;
  return typeof exp === 'string' ? parseInt(exp) : exp;
}

/**
 * Format amount from base unit to display unit
 * @param amount - Amount in base unit (e.g., uatom, wei)
 * @param chain - Chain data object
 * @param decimals - Number of decimal places to show (default: 6)
 * @returns Formatted amount string
 */
export function formatAmount(
  amount: string | number | bigint,
  chain: ChainData | null | undefined,
  decimals: number = 6
): string {
  try {
    const exponent = getChainExponent(chain);
    const amountNum = typeof amount === 'bigint' 
      ? Number(amount) 
      : typeof amount === 'string' 
        ? parseFloat(amount) 
        : amount;
    
    if (isNaN(amountNum)) return '0';
    
    const divisor = Math.pow(10, exponent);
    const formatted = (amountNum / divisor).toFixed(decimals);
    
    // Remove trailing zeros
    return formatted.replace(/\.?0+$/, '');
  } catch (error) {
    console.error('Error formatting amount:', error);
    return '0';
  }
}

/**
 * Parse amount from display unit to base unit
 * @param amount - Amount in display unit (e.g., 1.5 ATOM)
 * @param chain - Chain data object
 * @returns Amount in base unit as string
 */
export function parseAmount(
  amount: string | number,
  chain: ChainData | null | undefined
): string {
  try {
    const exponent = getChainExponent(chain);
    const amountNum = typeof amount === 'string' ? parseFloat(amount) : amount;
    
    if (isNaN(amountNum)) return '0';
    
    // For high exponent (18), use BigInt to avoid precision loss
    if (exponent >= 18) {
      const [intPart, decPart = ''] = amount.toString().split('.');
      const paddedDec = decPart.padEnd(exponent, '0').slice(0, exponent);
      const baseAmount = intPart + paddedDec;
      return baseAmount.replace(/^0+/, '') || '0';
    }
    
    // For lower exponents, safe to use multiplication
    const multiplier = Math.pow(10, exponent);
    return Math.floor(amountNum * multiplier).toString();
  } catch (error) {
    console.error('Error parsing amount:', error);
    return '0';
  }
}

/**
 * Format amount with symbol
 * @param amount - Amount in base unit
 * @param chain - Chain data object
 * @param decimals - Number of decimal places to show
 * @returns Formatted amount with symbol (e.g., "1.5 ATOM")
 */
export function formatAmountWithSymbol(
  amount: string | number | bigint,
  chain: ChainData | null | undefined,
  decimals: number = 6
): string {
  const formatted = formatAmount(amount, chain, decimals);
  const symbol = chain?.assets?.[0]?.symbol || 'TOKEN';
  return `${formatted} ${symbol}`;
}

/**
 * Get divisor for chain (10^exponent)
 * @param chain - Chain data object
 * @returns Divisor as number
 */
export function getChainDivisor(chain: ChainData | null | undefined): number {
  const exponent = getChainExponent(chain);
  return Math.pow(10, exponent);
}
