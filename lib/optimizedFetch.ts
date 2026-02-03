/**
 * Optimized Data Fetcher
 * Parallel fetching + aggressive caching + stale-while-revalidate
 */

import { enhancedCache } from './enhancedCache';
import { fetchApi } from './api';

interface FetchOptions {
  staleTime?: number; // How long data is considered fresh (default: 5 minutes)
  forceRefresh?: boolean; // Skip cache and fetch fresh data
}

/**
 * Fetch with aggressive caching
 * Returns cached data immediately, refreshes in background if stale
 */
export async function cachedFetch<T>(
  url: string,
  options: FetchOptions = {}
): Promise<T> {
  const { staleTime = 5 * 60 * 1000, forceRefresh = false } = options;
  const cacheKey = `fetch_${url}`;

  // Return cached data immediately if available (even if stale)
  if (!forceRefresh) {
    const cached = enhancedCache.get<T>(cacheKey, staleTime);
    if (cached) {
      // Check if stale and refresh in background
      if (enhancedCache.isStale(cacheKey, staleTime)) {
        // Background refresh (don't await)
        fetchAndCache<T>(url, cacheKey, staleTime).catch(() => {});
      }
      return cached;
    }
  }

  // No cache or force refresh - fetch and wait
  return fetchAndCache<T>(url, cacheKey, staleTime);
}

/**
 * Fetch and cache data
 */
async function fetchAndCache<T>(
  url: string,
  cacheKey: string,
  staleTime: number
): Promise<T> {
  const response = await fetchApi(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const data = await response.json();
  enhancedCache.set(cacheKey, data, staleTime);
  return data;
}

/**
 * Fetch multiple endpoints in parallel
 * Much faster than sequential fetching
 */
export async function parallelFetch<T extends Record<string, any>>(
  endpoints: Record<keyof T, string>,
  options: FetchOptions = {}
): Promise<T> {
  const keys = Object.keys(endpoints) as Array<keyof T>;
  
  const promises = keys.map(key =>
    cachedFetch(endpoints[key], options)
      .then(data => ({ key, data }))
      .catch(error => ({ key, data: null, error }))
  );

  const results = await Promise.all(promises);

  const output = {} as T;
  results.forEach(({ key, data }) => {
    output[key] = data as T[keyof T];
  });

  return output;
}

/**
 * Prefetch data for future use
 * Useful for hover prefetching
 */
export function prefetchData(url: string, options: FetchOptions = {}): void {
  cachedFetch(url, options).catch(() => {
    // Silent fail - prefetch is optional
  });
}
