// GeoIP utility using MaxMind GeoLite2-Country and GeoLite2-ASN databases
import maxmind, { AsnResponse } from 'maxmind';
import path from 'path';

// Define CountryResponse type since it's not exported by maxmind
interface CountryResponse {
  country?: {
    iso_code?: string;
    names?: {
      en?: string;
      [key: string]: string | undefined;
    };
  };
  registered_country?: {
    iso_code?: string;
    names?: {
      en?: string;
      [key: string]: string | undefined;
    };
  };
}

let countryLookup: any = null;
let asnLookup: any = null;

// Country capital coordinates for approximate location
const COUNTRY_CAPITALS: Record<string, { city: string; lat: number; lon: number }> = {
  'US': { city: 'Washington DC', lat: 38.9072, lon: -77.0369 },
  'DE': { city: 'Berlin', lat: 52.5200, lon: 13.4050 },
  'FR': { city: 'Paris', lat: 48.8566, lon: 2.3522 },
  'GB': { city: 'London', lat: 51.5074, lon: -0.1278 },
  'NL': { city: 'Amsterdam', lat: 52.3676, lon: 4.9041 },
  'SG': { city: 'Singapore', lat: 1.3521, lon: 103.8198 },
  'JP': { city: 'Tokyo', lat: 35.6762, lon: 139.6503 },
  'KR': { city: 'Seoul', lat: 37.5665, lon: 126.9780 },
  'CN': { city: 'Beijing', lat: 39.9042, lon: 116.4074 },
  'CA': { city: 'Ottawa', lat: 45.4215, lon: -75.6972 },
  'AU': { city: 'Canberra', lat: -35.2809, lon: 149.1300 },
  'BR': { city: 'Brasília', lat: -15.8267, lon: -47.9218 },
  'IN': { city: 'New Delhi', lat: 28.6139, lon: 77.2090 },
  'RU': { city: 'Moscow', lat: 55.7558, lon: 37.6173 },
  'FI': { city: 'Helsinki', lat: 60.1699, lon: 24.9384 },
  'PL': { city: 'Warsaw', lat: 52.2297, lon: 21.0122 },
  'IT': { city: 'Rome', lat: 41.9028, lon: 12.4964 },
  'ES': { city: 'Madrid', lat: 40.4168, lon: -3.7038 },
  'SE': { city: 'Stockholm', lat: 59.3293, lon: 18.0686 },
  'NO': { city: 'Oslo', lat: 59.9139, lon: 10.7522 },
  'DK': { city: 'Copenhagen', lat: 55.6761, lon: 12.5683 },
  'CH': { city: 'Bern', lat: 46.9480, lon: 7.4474 },
  'AT': { city: 'Vienna', lat: 48.2082, lon: 16.3738 },
  'BE': { city: 'Brussels', lat: 50.8503, lon: 4.3517 },
  'CZ': { city: 'Prague', lat: 50.0755, lon: 14.4378 },
  'IE': { city: 'Dublin', lat: 53.3498, lon: -6.2603 },
  'PT': { city: 'Lisbon', lat: 38.7223, lon: -9.1393 },
  'GR': { city: 'Athens', lat: 37.9838, lon: 23.7275 },
  'TR': { city: 'Ankara', lat: 39.9334, lon: 32.8597 },
  'IL': { city: 'Jerusalem', lat: 31.7683, lon: 35.2137 },
  'AE': { city: 'Abu Dhabi', lat: 24.4539, lon: 54.3773 },
  'SA': { city: 'Riyadh', lat: 24.7136, lon: 46.6753 },
  'ZA': { city: 'Pretoria', lat: -25.7479, lon: 28.2293 },
  'MX': { city: 'Mexico City', lat: 19.4326, lon: -99.1332 },
  'AR': { city: 'Buenos Aires', lat: -34.6037, lon: -58.3816 },
  'CL': { city: 'Santiago', lat: -33.4489, lon: -70.6693 },
  'TH': { city: 'Bangkok', lat: 13.7563, lon: 100.5018 },
  'VN': { city: 'Hanoi', lat: 21.0285, lon: 105.8542 },
  'ID': { city: 'Jakarta', lat: -6.2088, lon: 106.8456 },
  'MY': { city: 'Kuala Lumpur', lat: 3.1390, lon: 101.6869 },
  'PH': { city: 'Manila', lat: 14.5995, lon: 120.9842 },
  'NZ': { city: 'Wellington', lat: -41.2865, lon: 174.7762 },
  'UA': { city: 'Kyiv', lat: 50.4501, lon: 30.5234 },
  'RO': { city: 'Bucharest', lat: 44.4268, lon: 26.1025 },
  'BG': { city: 'Sofia', lat: 42.6977, lon: 23.3219 },
  'HU': { city: 'Budapest', lat: 47.4979, lon: 19.0402 },
  'HR': { city: 'Zagreb', lat: 45.8150, lon: 15.9819 },
};

// Initialize GeoIP Country reader
export async function initCountry(): Promise<any> {
  if (countryLookup) return countryLookup;

  try {
    const dbPath = path.join(process.cwd(), 'data', 'GeoLite2-Country.mmdb');
    countryLookup = await maxmind.open(dbPath);
    console.log('[GeoIP] ✅ GeoLite2-Country database loaded');
    return countryLookup;
  } catch (error: any) {
    console.error('[GeoIP] Failed to load Country database:', error.message);
    return null;
  }
}

// Initialize GeoIP ASN reader
export async function initASN(): Promise<any> {
  if (asnLookup) return asnLookup;

  try {
    const dbPath = path.join(process.cwd(), 'data', 'GeoLite2-ASN.mmdb');
    asnLookup = await maxmind.open(dbPath);
    console.log('[GeoIP] ✅ GeoLite2-ASN database loaded');
    return asnLookup;
  } catch (error: any) {
    console.error('[GeoIP] Failed to load ASN database:', error.message);
    return null;
  }
}

// Lookup IP using free API (ip-api.com) as fallback
async function lookupIPViaAPI(ip: string): Promise<{
  city: string;
  country: string;
  countryCode: string;
  latitude: number;
  longitude: number;
  provider?: string;
} | null> {
  try {
    // ip-api.com free tier: 45 requests per minute
    const response = await fetch(`http://ip-api.com/json/${ip}?fields=status,message,country,countryCode,city,lat,lon,isp,org,as,asname`, {
      signal: AbortSignal.timeout(5000)
    });

    if (!response.ok) {
      console.error('[GeoIP API] Request failed:', response.status);
      return null;
    }

    const data = await response.json();

    if (data.status !== 'success') {
      console.log('[GeoIP API] No data for IP:', ip, data.message);
      return null;
    }

    const city = data.city || 'Unknown';
    const country = data.country || 'Unknown';
    const countryCode = data.countryCode || 'XX';
    const latitude = data.lat || 0;
    const longitude = data.lon || 0;

    if (latitude === 0 && longitude === 0) {
      return null;
    }

    // Extract ASN and organization for provider detection
    const asMatch = data.as?.match(/^AS(\d+)/);
    const asn = asMatch ? asMatch[1] : undefined;
    const organization = data.org || data.isp || data.asname;
    const provider = detectProvider(ip, asn, organization);

    return {
      city,
      country,
      countryCode,
      latitude,
      longitude,
      provider
    };
  } catch (error: any) {
    console.error('[GeoIP API] Lookup error for', ip, ':', error.message);
    return null;
  }
}

// Batch lookup via API (for when database is not available)
export async function lookupIPBatchViaAPI(ips: string[]): Promise<Map<string, any>> {
  const results = new Map<string, any>();
  
  try {
    // ip-api.com supports batch requests (up to 100 IPs)
    // POST to http://ip-api.com/batch
    const batchSize = 100;
    const batches = [];
    
    for (let i = 0; i < ips.length; i += batchSize) {
      batches.push(ips.slice(i, i + batchSize));
    }
    
    for (const batch of batches) {
      try {
        const response = await fetch('http://ip-api.com/batch?fields=status,message,query,country,countryCode,city,lat,lon,isp,org,as,asname', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(batch),
          signal: AbortSignal.timeout(10000)
        });
        
        if (!response.ok) {
          console.error('[GeoIP API Batch] Request failed:', response.status);
          continue;
        }
        
        const data = await response.json();
        
        for (const item of data) {
          if (item.status === 'success') {
            const ip = item.query;
            const city = item.city || 'Unknown';
            const country = item.country || 'Unknown';
            const countryCode = item.countryCode || 'XX';
            const latitude = item.lat || 0;
            const longitude = item.lon || 0;
            
            if (latitude !== 0 || longitude !== 0) {
              const asMatch = item.as?.match(/^AS(\d+)/);
              const asn = asMatch ? asMatch[1] : undefined;
              const organization = item.org || item.isp || item.asname;
              const provider = detectProvider(ip, asn, organization);
              
              results.set(ip, {
                city,
                country,
                countryCode,
                latitude,
                longitude,
                provider
              });
            }
          }
        }
      } catch (batchError: any) {
        console.error('[GeoIP API Batch] Error:', batchError.message);
      }
    }
  } catch (error: any) {
    console.error('[GeoIP API Batch] Fatal error:', error.message);
  }
  
  return results;
}

// Lookup IP address and get location
export async function lookupIP(ip: string): Promise<{
  city: string;
  country: string;
  countryCode: string;
  latitude: number;
  longitude: number;
  provider?: string;
} | null> {
  // Try local database first
  try {
    const lookup = await initCountry();
    if (!lookup) {
      // Database not available, use API immediately
      return lookupIPViaAPI(ip);
    }

    const result = lookup.get(ip);
    if (result) {
      const country = result.country?.names?.en || 'Unknown';
      const countryCode = result.country?.iso_code || 'XX';
      
      // Use capital city coordinates as approximate location
      const capital = COUNTRY_CAPITALS[countryCode] || { city: country, lat: 0, lon: 0 };
      
      if (capital.lat !== 0 || capital.lon !== 0) {
        // Get ASN data for provider detection
        let provider = 'Unknown';
        try {
          const asnDb = await initASN();
          if (asnDb) {
            const asnResult = asnDb.get(ip);
            if (asnResult) {
              const asn = asnResult.autonomous_system_number?.toString();
              const organization = asnResult.autonomous_system_organization;
              provider = detectProvider(ip, asn, organization);
            } else {
              provider = detectProvider(ip);
            }
          } else {
            provider = detectProvider(ip);
          }
        } catch (asnError: any) {
          provider = detectProvider(ip);
        }

        return {
          city: capital.city,
          country,
          countryCode,
          latitude: capital.lat,
          longitude: capital.lon,
          provider
        };
      }
    }
  } catch (error: any) {
    console.warn('[GeoIP DB] Error, using API fallback:', error.message);
  }

  // Fallback to API if database lookup failed or returned no data
  return lookupIPViaAPI(ip);
}

// Extract IP from various formats
export function extractIP(address: string): string | null {
  // Remove protocol if present
  address = address.replace(/^(https?|tcp|wss?):\/\//, '');
  
  // Extract IP from address:port format
  const match = address.match(/^([^:]+)/);
  if (!match) return null;
  
  const ip = match[1];
  
  // Validate IP format (basic check)
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip)) {
    return ip;
  }
  
  // If it's a domain, we can't geolocate it directly
  return null;
}

// Detect hosting provider based on IP and ASN
export function detectProvider(ip: string, asn?: string, organization?: string): string {
  // Common hosting provider patterns
  const providers: Record<string, RegExp[]> = {
    'AWS': [/amazon/i, /aws/i, /ec2/i, /amazonaws/i],
    'Google Cloud': [/google/i, /gcp/i, /cloud/i, /googleusercontent/i],
    'Microsoft Azure': [/microsoft/i, /azure/i, /msft/i],
    'DigitalOcean': [/digitalocean/i, /do-/i],
    'Hetzner': [/hetzner/i, /hetzner-online/i, /^AS24940$/],
    'OVH': [/ovh/i, /ovhcloud/i, /^AS16276$/],
    'Linode': [/linode/i, /akamai/i, /^AS63949$/],
    'Vultr': [/vultr/i, /choopa/i, /^AS20473$/],
    'Contabo': [/contabo/i, /^AS51167$/],
    'Netcup': [/netcup/i, /^AS197540$/],
    'Scaleway': [/scaleway/i, /online\.net/i, /^AS12876$/],
    'Alibaba Cloud': [/alibaba/i, /aliyun/i, /^AS45102$/],
    'Tencent Cloud': [/tencent/i, /^AS45090$/],
    'IBM Cloud': [/ibm/i, /softlayer/i, /^AS36351$/],
    'Oracle Cloud': [/oracle/i, /oraclecloud/i, /^AS31898$/],
    'Cloudflare': [/cloudflare/i, /^AS13335$/],
    'Fastly': [/fastly/i, /^AS54113$/],
  };

  const searchText = `${organization || ''} ${asn || ''}`.toLowerCase();

  for (const [provider, patterns] of Object.entries(providers)) {
    for (const pattern of patterns) {
      if (pattern.test(searchText)) {
        return provider;
      }
    }
  }

  // IP range-based detection for common providers
  const ipParts = ip.split('.').map(Number);
  if (ipParts.length === 4) {
    const firstOctet = ipParts[0];
    const secondOctet = ipParts[1];
    
    // Hetzner ranges
    if ((firstOctet === 65 && secondOctet === 21) || 
        (firstOctet === 135 && secondOctet === 181) ||
        (firstOctet === 144 && secondOctet === 91) ||
        (firstOctet === 168 && secondOctet === 119)) {
      return 'Hetzner';
    }
    
    // OVH ranges
    if ((firstOctet === 51 && [15, 38, 68, 75, 77, 79, 83, 89, 91, 195, 210, 222, 254, 255].includes(secondOctet)) ||
        (firstOctet === 54 && [36, 37, 38, 39].includes(secondOctet)) ||
        (firstOctet === 137 && [74].includes(secondOctet)) ||
        (firstOctet === 141 && [94, 95].includes(secondOctet)) ||
        (firstOctet === 144 && [217].includes(secondOctet)) ||
        (firstOctet === 145 && [239].includes(secondOctet)) ||
        (firstOctet === 147 && [135].includes(secondOctet)) ||
        (firstOctet === 151 && [80].includes(secondOctet)) ||
        (firstOctet === 152 && [228].includes(secondOctet)) ||
        (firstOctet === 164 && [132].includes(secondOctet)) ||
        (firstOctet === 167 && [114].includes(secondOctet)) ||
        (firstOctet === 178 && [32, 33].includes(secondOctet)) ||
        (firstOctet === 188 && [165].includes(secondOctet)) ||
        (firstOctet === 192 && [95].includes(secondOctet)) ||
        (firstOctet === 193 && [70].includes(secondOctet))) {
      return 'OVH';
    }
    
    // DigitalOcean ranges
    if ((firstOctet === 104 && [131, 236].includes(secondOctet)) ||
        (firstOctet === 134 && [209].includes(secondOctet)) ||
        (firstOctet === 138 && [68, 197].includes(secondOctet)) ||
        (firstOctet === 139 && [59].includes(secondOctet)) ||
        (firstOctet === 142 && [93].includes(secondOctet)) ||
        (firstOctet === 143 && [110, 198, 244].includes(secondOctet)) ||
        (firstOctet === 157 && [230, 245].includes(secondOctet)) ||
        (firstOctet === 159 && [65, 89, 203, 223].includes(secondOctet)) ||
        (firstOctet === 161 && [35].includes(secondOctet)) ||
        (firstOctet === 164 && [90, 92].includes(secondOctet)) ||
        (firstOctet === 165 && [22, 227].includes(secondOctet)) ||
        (firstOctet === 167 && [71, 99, 172].includes(secondOctet)) ||
        (firstOctet === 178 && [62, 128].includes(secondOctet)) ||
        (firstOctet === 188 && [166].includes(secondOctet)) ||
        (firstOctet === 206 && [189].includes(secondOctet)) ||
        (firstOctet === 207 && [154].includes(secondOctet))) {
      return 'DigitalOcean';
    }
    
    // Contabo ranges
    if ((firstOctet === 173 && [249].includes(secondOctet)) ||
        (firstOctet === 207 && [180].includes(secondOctet)) ||
        (firstOctet === 213 && [136, 239].includes(secondOctet))) {
      return 'Contabo';
    }
  }

  return 'Others';
}
