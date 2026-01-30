import { createRoute } from '@/lib/routes';
import { fetchJSONFromSSLBackend } from '@/lib/sslLoadBalancer';

export const GET = createRoute({
  requiredParams: ['chain', 'denom'],
  optionalParams: ['limit', 'search'],
  cacheConfig: { ttl: 60000, staleWhileRevalidate: 120000 },
  handler: async ({ chain, denom, limit = '200', search }) => {
    // Check if denom is a PRC20 contract address
    const isPRC20 = denom.startsWith('paxi1') && denom.length > 40;
    
    if (isPRC20) {
      let path = `/api/prc20-holders?contract=${encodeURIComponent(denom)}&limit=${limit}`;
      
      if (search) {
        path += `&search=${encodeURIComponent(search)}`;
      }

      console.log('[Holders API] Fetching PRC20 from backend SSL:', path);
      return await fetchJSONFromSSLBackend(path);
    }

    // Special handling for UPAXI - fetch directly from backend
    if (denom === 'upaxi' && chain === 'paxi-mainnet') {
      console.log('[Holders API] Fetching UPAXI holders directly from backend');
      
      try {
        // Fetch directly from backend SSL
        const path = `/api/holders?chain=paxi-mainnet&denom=upaxi&limit=${limit}${search ? `&search=${encodeURIComponent(search)}` : ''}`;
        const data = await fetchJSONFromSSLBackend(path);
        
        return {
          ...data,
          note: data.note || 'UPAXI holders data from backend cache'
        };
      } catch (error: any) {
        console.error('[Holders API] Error fetching UPAXI:', error.message);
        return {
          denom,
          totalSupply: '0',
          holders: [],
          count: 0,
          message: 'Failed to fetch UPAXI holders'
        };
      }
    }

    // For native/IBC tokens, use regular holders endpoint
    let path = `/api/holders?chain=${chain}&denom=${encodeURIComponent(denom)}&limit=${limit}`;
    
    if (search) {
      path += `&search=${encodeURIComponent(search)}`;
    }

    console.log('[Holders API] Fetching from backend with SSL load balancer');
    return await fetchJSONFromSSLBackend(path);
  }
});
