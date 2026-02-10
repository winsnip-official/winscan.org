import { NextRequest, NextResponse } from 'next/server';
import { lookupIP, extractIP } from '@/lib/geoip';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface ValidatorLocation {
  city: string;
  country: string;
  coordinates: [number, number];
  count: number;
  provider?: string;
  monikers?: string[];
}

// In-memory cache for IP lookups (valid for 5 minutes)
const ipCache = new Map<string, { location: any; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function lookupIPWithCache(ip: string): Promise<any> {
  const now = Date.now();
  const cached = ipCache.get(ip);
  
  if (cached && (now - cached.timestamp) < CACHE_TTL) {
    return cached.location;
  }
  
  const location = await lookupIP(ip);
  if (location) {
    ipCache.set(ip, { location, timestamp: now });
  }
  
  return location;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const chain = searchParams.get('chain');

    if (!chain) {
      return NextResponse.json({ error: 'Chain parameter required' }, { status: 400 });
    }

    // Load chain config
    const fs = await import('fs');
    const path = await import('path');
    const chainsDir = path.join(process.cwd(), 'Chains');
    const files = fs.readdirSync(chainsDir);
    
    let chainConfig: any = null;
    for (const file of files) {
      if (file.endsWith('.json')) {
        const config = JSON.parse(fs.readFileSync(path.join(chainsDir, file), 'utf-8'));
        if (config.chain_name === chain || config.chain_id === chain) {
          chainConfig = config;
          break;
        }
      }
    }

    if (!chainConfig || !chainConfig.rpc || chainConfig.rpc.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Chain not found or no RPC endpoints',
        locations: []
      }, { status: 404 });
    }

    console.log(`[Peers API] Fetching peers for ${chain}`);

    // Fetch net_info from RPC
    const rpcUrl = chainConfig.rpc[0].address;
    const netInfoUrl = `${rpcUrl}/net_info`;
    
    console.log(`[Peers API] Fetching from: ${netInfoUrl}`);
    
    const response = await fetch(netInfoUrl, {
      next: { revalidate: 60 },
      signal: AbortSignal.timeout(10000)
    });

    if (!response.ok) {
      console.error(`[Peers API] RPC request failed: ${response.status} ${response.statusText}`);
      throw new Error(`RPC request failed: ${response.statusText}`);
    }

    const data = await response.json();
    const peers = data.result?.peers || [];

    console.log(`[Peers API] Found ${peers.length} peers for ${chain}`);

    if (peers.length === 0) {
      console.warn(`[Peers API] No peers found for ${chain}`);
      return NextResponse.json({
        success: true,
        total_peers: 0,
        total_locations: 0,
        locations: []
      });
    }

    // Extract all IPs first
    const peerIPs: Array<{ ip: string; moniker: string; remoteIP: string }> = [];
    for (const peer of peers) {
      const remoteIP = peer.remote_ip || peer.node_info?.listen_addr;
      if (!remoteIP) continue;
      
      const ip = extractIP(remoteIP);
      if (!ip) continue;
      
      peerIPs.push({
        ip,
        moniker: peer.node_info?.moniker || 'unknown',
        remoteIP
      });
    }

    console.log(`[Peers API] Extracted ${peerIPs.length} valid IPs, starting batch lookup...`);

    // Batch lookup with Promise.all for parallel processing
    const startTime = Date.now();
    const lookupPromises = peerIPs.map(async ({ ip, moniker, remoteIP }) => {
      try {
        const location = await lookupIPWithCache(ip);
        return { ip, moniker, remoteIP, location };
      } catch (error: any) {
        console.error(`[Peers API] Error looking up ${ip}:`, error.message);
        return { ip, moniker, remoteIP, location: null };
      }
    });

    const results = await Promise.all(lookupPromises);
    const lookupTime = Date.now() - startTime;
    console.log(`[Peers API] ✅ Completed ${results.length} lookups in ${lookupTime}ms`);

    // Process results and group by location
    const locationMap = new Map<string, ValidatorLocation>();
    let successfulLookups = 0;
    let failedLookups = 0;
    let cachedLookups = 0;

    for (const { ip, moniker, location } of results) {
      if (!location) {
        failedLookups++;
        continue;
      }

      successfulLookups++;

      // Create location key including provider for better grouping
      const locationKey = `${location.city},${location.country},${location.provider || 'Unknown'}`;

      if (locationMap.has(locationKey)) {
        const existing = locationMap.get(locationKey)!;
        existing.count++;
        if (moniker && moniker !== 'unknown') {
          existing.monikers?.push(moniker);
        }
      } else {
        locationMap.set(locationKey, {
          city: location.city,
          country: location.country,
          coordinates: [location.longitude, location.latitude],
          count: 1,
          provider: location.provider || 'Unknown',
          monikers: moniker && moniker !== 'unknown' ? [moniker] : []
        });
      }
    }

    const locations = Array.from(locationMap.values());

    console.log(`[Peers API] ✅ Mapped ${locations.length} unique locations for ${chain} (${successfulLookups} successful, ${failedLookups} failed, ${ipCache.size} cached)`);

    return NextResponse.json({
      success: true,
      total_peers: peers.length,
      total_locations: locations.length,
      locations,
      cached: false,
      stats: {
        successfulLookups,
        failedLookups,
        cachedLookups: ipCache.size,
        lookupTimeMs: lookupTime
      }
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120'
      }
    });

  } catch (error: any) {
    console.error('[Peers API] Error:', error.message);
    
    return NextResponse.json({
      success: false,
      error: error.message,
      total_peers: 0,
      total_locations: 0,
      locations: []
    }, { status: 500 });
  }
}
