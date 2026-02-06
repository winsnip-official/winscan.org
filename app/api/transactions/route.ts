import { createRoute } from '@/lib/routes/factory';
import { fetchJSONWithSmartFailover } from '@/lib/sslLoadBalancer';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = createRoute({
  requiredParams: ['chain'],
  optionalParams: ['limit'],
  cacheConfig: {
    ttl: 10000, // 10 seconds
    staleWhileRevalidate: 30000 // 30 seconds
  },
  handler: async ({ chain, limit }) => {
    try {
      const path = `/api/transactions?chain=${chain}${limit ? `&limit=${limit}` : ''}`;
      
      // Use smart failover: Chain RPC -> SSL1 -> SSL2
      return await fetchJSONWithSmartFailover(path, chain, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(8000) // 8 second timeout for Vercel
      });
    } catch (error) {
      console.warn(`[Transactions API] All endpoints failed for chain ${chain}:`, error);
      // Return empty array instead of throwing error
      return { transactions: [] };
    }
  }
});
