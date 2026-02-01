/**
 * SSL Backend Load Balancer
 * Automatically switches between ssl.winsnip.xyz and ssl2.winsnip.xyz
 * with health checking and automatic failover
 */

interface SSLEndpoint {
  url: string;
  failures: number;
  lastFailure: number;
  lastSuccess: number;
  avgLatency: number;
}

class SSLLoadBalancer {
  private endpoints: SSLEndpoint[] = [
    {
      url: 'https://ssl.winsnip.xyz',
      failures: 0,
      lastFailure: 0,
      lastSuccess: Date.now(),
      avgLatency: 0,
    },
    {
      url: 'https://ssl2.winsnip.xyz',
      failures: 0,
      lastFailure: 0,
      lastSuccess: Date.now(),
      avgLatency: 0,
    },
  ];

  private currentIndex: number = 0;
  private readonly MAX_FAILURES = 3;
  private readonly FAILURE_COOLDOWN = 60000; // 1 minute
  private readonly HEALTH_CHECK_INTERVAL = 30000; // 30 seconds

  constructor() {
    // Start periodic health check
    if (typeof window !== 'undefined') {
      this.startHealthCheck();
    }
  }

  /**
   * Get the best available endpoint
   */
  private getBestEndpoint(): SSLEndpoint {
    const now = Date.now();

    // Filter healthy endpoints (failures < MAX or cooldown expired)
    const healthy = this.endpoints.filter(ep => {
      if (ep.failures < this.MAX_FAILURES) return true;
      if (now - ep.lastFailure > this.FAILURE_COOLDOWN) {
        ep.failures = 0; // Reset after cooldown
        return true;
      }
      return false;
    });

    // If no healthy endpoints, reset all and use primary
    if (healthy.length === 0) {
      console.warn('[SSLLoadBalancer] All endpoints failed, resetting...');
      this.endpoints.forEach(ep => ep.failures = 0);
      return this.endpoints[0];
    }

    // Sort by: least failures, then lowest latency
    healthy.sort((a, b) => {
      if (a.failures !== b.failures) return a.failures - b.failures;
      return a.avgLatency - b.avgLatency;
    });

    // Round-robin between top 2 healthy endpoints
    const topEndpoints = healthy.slice(0, 2);
    const selected = topEndpoints[this.currentIndex % topEndpoints.length];
    this.currentIndex = (this.currentIndex + 1) % topEndpoints.length;

    return selected;
  }

  /**
   * Fetch with automatic failover
   */
  async fetch(path: string, options?: RequestInit): Promise<Response> {
    const maxAttempts = this.endpoints.length;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const endpoint = this.getBestEndpoint();
      const url = `${endpoint.url}${path}`;
      const startTime = Date.now();

      try {
        console.log(`[SSLLoadBalancer] Attempt ${attempt + 1}: ${endpoint.url}`);

        const response = await fetch(url, {
          ...options,
          signal: AbortSignal.timeout(15000), // 15s timeout
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            ...options?.headers,
          },
        });

        const latency = Date.now() - startTime;

        // Update latency (exponential moving average)
        endpoint.avgLatency = endpoint.avgLatency === 0
          ? latency
          : endpoint.avgLatency * 0.7 + latency * 0.3;

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        // Success!
        endpoint.lastSuccess = Date.now();
        if (endpoint.failures > 0) {
          console.log(`[SSLLoadBalancer] ${endpoint.url} recovered!`);
          endpoint.failures = 0;
        }

        console.log(`[SSLLoadBalancer] ✓ Success with ${endpoint.url} (${latency}ms)`);
        return response;

      } catch (error: any) {
        endpoint.failures++;
        endpoint.lastFailure = Date.now();
        lastError = error;

        console.error(
          `[SSLLoadBalancer] ${endpoint.url} failed (${endpoint.failures}/${this.MAX_FAILURES}):`,
          error.message
        );

        // Don't retry if this was the last endpoint
        if (attempt < maxAttempts - 1) {
          await new Promise(resolve => setTimeout(resolve, 200)); // Small delay before retry
        }
      }
    }

    // All endpoints failed
    throw new Error(`All SSL endpoints failed. Last error: ${lastError?.message}`);
  }

  /**
   * Fetch JSON with automatic failover
   */
  async fetchJSON<T = any>(path: string, options?: RequestInit): Promise<T> {
    const response = await this.fetch(path, options);
    return response.json();
  }

  /**
   * Health check for all endpoints
   */
  private async healthCheck(): Promise<void> {
    console.log('[SSLLoadBalancer] Running health check...');

    const checks = this.endpoints.map(async (endpoint) => {
      const startTime = Date.now();
      try {
        // Use /api/chains as health check since /api/health doesn't exist
        const response = await fetch(`${endpoint.url}/api/chains`, {
          signal: AbortSignal.timeout(5000),
        });

        if (response.ok) {
          const latency = Date.now() - startTime;
          endpoint.avgLatency = endpoint.avgLatency === 0
            ? latency
            : endpoint.avgLatency * 0.7 + latency * 0.3;

          endpoint.lastSuccess = Date.now();
          
          if (endpoint.failures > 0) {
            console.log(`[SSLLoadBalancer] ${endpoint.url} is back online!`);
            endpoint.failures = 0;
          }
        }
      } catch (error) {
        console.warn(`[SSLLoadBalancer] Health check failed for ${endpoint.url}`);
      }
    });

    await Promise.allSettled(checks);
  }

  /**
   * Start periodic health checks
   */
  private startHealthCheck(): void {
    // Initial check after 5 seconds
    setTimeout(() => this.healthCheck(), 5000);

    // Periodic checks
    setInterval(() => this.healthCheck(), this.HEALTH_CHECK_INTERVAL);
  }

  /**
   * Get status of all endpoints
   */
  getStatus() {
    return this.endpoints.map(ep => ({
      url: ep.url,
      healthy: ep.failures < this.MAX_FAILURES,
      failures: ep.failures,
      avgLatency: Math.round(ep.avgLatency),
      lastSuccess: new Date(ep.lastSuccess).toISOString(),
      lastFailure: ep.lastFailure ? new Date(ep.lastFailure).toISOString() : null,
    }));
  }
}

/**
 * Simple SSL failover - try SSL1, if error try SSL2
 * Only uses SSL backend if API_URL env var is set
 * Otherwise returns null to allow fallback to chain RPC
 */
export async function fetchWithFailover(
  path: string,
  options?: RequestInit
): Promise<Response> {
  // Get SSL endpoints from environment variables
  const ssl1 = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL_SSL1;
  const ssl2 = process.env.API_URL_FALLBACK || process.env.NEXT_PUBLIC_API_URL_SSL2;
  
  // If no SSL backend configured, throw error to trigger RPC fallback
  if (!ssl1 && !ssl2) {
    throw new Error('No SSL backend configured - use chain RPC instead');
  }

  const endpoints = [ssl1, ssl2].filter(Boolean) as string[];
  let lastError: Error | null = null;

  for (let i = 0; i < endpoints.length; i++) {
    const endpoint = endpoints[i];
    const url = `${endpoint}${path}`;

    try {
      console.log(`[Failover] Trying ${endpoint}...`);
      
      const response = await fetch(url, {
        ...options,
        signal: AbortSignal.timeout(30000), // 30s timeout
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      console.log(`[Failover] ✓ Success with ${endpoint}`);
      return response;

    } catch (error: any) {
      lastError = error;
      console.error(`[Failover] ${endpoint} failed:`, error.message);
      
      // If this is the last endpoint, throw error
      if (i === endpoints.length - 1) {
        throw new Error(`All SSL endpoints failed. Last error: ${lastError?.message}`);
      }
      
      // Small delay before trying next endpoint
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  throw new Error(`All SSL endpoints failed. Last error: ${lastError?.message}`);
}

/**
 * Fetch JSON with automatic SSL1 -> SSL2 failover
 */
export async function fetchJSONWithFailover<T = any>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetchWithFailover(path, options);
  return response.json();
}

// Singleton instance
const sslLoadBalancer = new SSLLoadBalancer();

/**
 * Get the best SSL backend URL
 */
export function getSSLBackendURL(): string {
  const endpoint = (sslLoadBalancer as any).getBestEndpoint();
  return endpoint.url;
}

/**
 * Fetch from SSL backend with automatic load balancing and failover
 */
export async function fetchFromSSLBackend(
  path: string,
  options?: RequestInit
): Promise<Response> {
  return sslLoadBalancer.fetch(path, options);
}

/**
 * Fetch JSON from SSL backend with automatic load balancing and failover
 */
export async function fetchJSONFromSSLBackend<T = any>(
  path: string,
  options?: RequestInit
): Promise<T> {
  return sslLoadBalancer.fetchJSON<T>(path, options);
}

/**
 * Get SSL load balancer status
 */
export function getSSLLoadBalancerStatus() {
  return sslLoadBalancer.getStatus();
}

// Expose to window for debugging
if (typeof window !== 'undefined') {
  (window as any).getSSLStatus = getSSLLoadBalancerStatus;
}

export default sslLoadBalancer;
