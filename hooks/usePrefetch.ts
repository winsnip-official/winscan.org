/**
 * Prefetch Hook for Next.js
 * Prefetches pages on hover for instant navigation
 */

import { useRouter } from 'next/navigation';
import { useCallback } from 'react';

export function usePrefetch() {
  const router = useRouter();

  const prefetch = useCallback((href: string) => {
    if (typeof window === 'undefined') return;
    
    try {
      // Next.js router.prefetch
      router.prefetch(href);
      
      // Also prefetch API data if needed
      const apiEndpoints = extractApiEndpoints(href);
      apiEndpoints.forEach(endpoint => {
        fetch(endpoint, { 
          method: 'HEAD',
          cache: 'force-cache'
        }).catch(() => {});
      });
    } catch (error) {
      // Silent fail - prefetch is optional
    }
  }, [router]);

  return { prefetch };
}

// Extract API endpoints from page URL
function extractApiEndpoints(href: string): string[] {
  const endpoints: string[] = [];
  
  // Extract chain from URL
  const chainMatch = href.match(/\/([^\/]+)\/(validators|blocks|transactions|network)/);
  if (chainMatch) {
    const [, chain, page] = chainMatch;
    
    switch (page) {
      case 'validators':
        endpoints.push(`/api/validators?chain=${chain}`);
        break;
      case 'blocks':
        endpoints.push(`/api/blocks?chain=${chain}&limit=20`);
        break;
      case 'transactions':
        endpoints.push(`/api/transactions?chain=${chain}&limit=20`);
        break;
      case 'network':
        endpoints.push(`/api/network?chain=${chain}`);
        break;
    }
  }
  
  return endpoints;
}
