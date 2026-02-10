import { NextRequest, NextResponse } from 'next/server';
import { lookupIP } from '@/lib/geoip';
import dns from 'dns';
import { promisify } from 'util';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const dnsResolve4 = promisify(dns.resolve4);

async function resolveHostname(hostname: string): Promise<string | null> {
  try {
    const addresses = await dnsResolve4(hostname);
    return addresses[0] || null;
  } catch (error) {
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('query');

    if (!query) {
      return NextResponse.json({ error: 'Query parameter required' }, { status: 400 });
    }

    let ip = query.trim();
    let hostname = null;
    let resolvedFromDomain = false;

    // Check if input is a domain name (not an IP)
    if (!/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip)) {
      hostname = ip;
      // Remove protocol if present
      hostname = hostname.replace(/^(https?|tcp|wss?):\/\//, '');
      // Remove port if present
      hostname = hostname.split(':')[0];
      // Remove path if present
      hostname = hostname.split('/')[0];

      console.log(`[IP Lookup] Resolving domain: ${hostname}`);
      const resolvedIP = await resolveHostname(hostname);
      
      if (!resolvedIP) {
        return NextResponse.json({
          success: false,
          error: 'Could not resolve domain to IP address',
          query: query
        }, { status: 404 });
      }

      ip = resolvedIP;
      resolvedFromDomain = true;
      console.log(`[IP Lookup] Resolved ${hostname} to ${ip}`);
    }

    // Validate IP format
    if (!/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid IP address format',
        query: query
      }, { status: 400 });
    }

    console.log(`[IP Lookup] Looking up IP: ${ip}`);

    // Lookup IP location
    const location = await lookupIP(ip);

    if (!location) {
      return NextResponse.json({
        success: false,
        error: 'Could not find location data for this IP',
        query: query,
        ip: ip,
        hostname: hostname
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      query: query,
      ip: ip,
      hostname: resolvedFromDomain ? hostname : null,
      location: {
        city: location.city,
        country: location.country,
        countryCode: location.countryCode,
        latitude: location.latitude,
        longitude: location.longitude,
        provider: location.provider || 'Unknown',
        coordinates: `${location.latitude}, ${location.longitude}`
      }
    });

  } catch (error: any) {
    console.error('[IP Lookup] Error:', error.message);
    
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
