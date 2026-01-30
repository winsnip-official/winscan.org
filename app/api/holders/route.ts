import { createRoute } from '@/lib/routes';
import { fetchJSONFromSSLBackend } from '@/lib/sslLoadBalancer';
import { loadHoldersCache } from '../services/upaxiRealtimeService';

export const GET = createRoute({
  requiredParams: ['chain', 'denom'],
  optionalParams: ['limit', 'search'],
  cacheConfig: { ttl: 60000, staleWhileRevalidate: 120000 },
  handler: async ({ chain, denom, limit = '200', search }) => {
    // Check if denom is a PRC20 contract address
    const isPRC20 = denom.startsWith('paxi1') && denom.length > 40;
    
    if (isPRC20) {
      // For PRC20 tokens, use dedicated prc20-holders endpoint
      let path = `/api/prc20-holders?contract=${encodeURIComponent(denom)}&limit=${limit}`;
      
      if (search) {
        path += `&search=${encodeURIComponent(search)}`;
      }

      console.log('[Holders API] Fetching PRC20 from backend SSL:', path);
      return await fetchJSONFromSSLBackend(path);
    }

    // Special handling for UPAXI - use cache
    if (denom === 'upaxi' && chain === 'paxi-mainnet') {
      console.log('[Holders API] Using UPAXI holders cache');
      
      try {
        const cache = await loadHoldersCache();
        
        if (search) {
          // Search mode
          const holder = cache.holders.find(h => h.address === search);
          if (holder) {
            return {
              denom,
              totalSupply: cache.totalSupply,
              holders: [holder],
              count: 1,
              lastUpdate: cache.lastUpdate,
              from_cache: true
            };
          }
          return {
            denom,
            totalSupply: cache.totalSupply,
            holders: [],
            count: 0,
            message: 'Address not found'
          };
        }
        
        // List mode
        const limitNum = parseInt(limit);
        const topHolders = cache.holders.slice(0, limitNum);
        
        return {
          denom,
          totalSupply: cache.totalSupply,
          holders: topHolders,
          count: cache.holders.length,
          returnedCount: topHolders.length,
          lastUpdate: cache.lastUpdate,
          note: `Data from cache (${cache.holders.length} total holders). Last updated: ${new Date(cache.lastUpdate).toISOString()}`,
          from_cache: true
        };
      } catch (error: any) {
        console.error('[Holders API] Error loading cache:', error.message);
        // Fallback to regular method
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
