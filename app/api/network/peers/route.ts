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

    // Extract IPs and do GeoIP lookup
    const locationMap = new Map<string, ValidatorLocation>();
    let successfulLookups = 0;
    let failedLookups = 0;

    for (const peer of peers) {
      try {
        // Extract IP from remote_ip or listen_addr
        const remoteIP = peer.remote_ip || peer.node_info?.listen_addr;
        if (!remoteIP) {
          console.warn(`[Peers API] Peer has no IP:`, peer.node_info?.moniker || 'unknown');
          failedLookups++;
          continue;
        }

        const ip = extractIP(remoteIP);
        if (!ip) {
          console.warn(`[Peers API] Could not extract IP from: ${remoteIP}`);
          failedLookups++;
          continue;
        }

        console.log(`[Peers API] Looking up IP: ${ip} (from ${remoteIP})`);

        // Lookup location
        const location = await lookupIP(ip);
        if (!location) {
          console.warn(`[Peers API] GeoIP lookup failed for: ${ip}`);
          failedLookups++;
          continue;
        }

        console.log(`[Peers API] ✅ Found location for ${ip}: ${location.city}, ${location.country} (${location.provider || 'Unknown'})`);
        successfulLookups++;

        // Create location key including provider for better grouping
        const locationKey = `${location.city},${location.country},${location.provider || 'Unknown'}`;

        if (locationMap.has(locationKey)) {
          const existing = locationMap.get(locationKey)!;
          existing.count++;
          if (peer.node_info?.moniker) {
            existing.monikers?.push(peer.node_info.moniker);
          }
        } else {
          locationMap.set(locationKey, {
            city: location.city,
            country: location.country,
            coordinates: [location.longitude, location.latitude],
            count: 1,
            provider: location.provider || 'Unknown',
            monikers: peer.node_info?.moniker ? [peer.node_info.moniker] : []
          });
        }
      } catch (error: any) {
        console.error(`[Peers API] Error processing peer:`, error.message);
        failedLookups++;
      }
    }

    const locations = Array.from(locationMap.values());

    console.log(`[Peers API] ✅ Mapped ${locations.length} unique locations for ${chain} (${successfulLookups} successful, ${failedLookups} failed lookups)`);

    return NextResponse.json({
      success: true,
      total_peers: peers.length,
      total_locations: locations.length,
      locations,
      cached: false,
      stats: {
        successfulLookups,
        failedLookups
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
