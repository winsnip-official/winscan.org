'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Search, MapPin, Globe, Server, Loader2 } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { ChainData } from '@/types/chain';

export default function IPLookupPage() {
  const params = useParams();
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [chains, setChains] = useState<ChainData[]>([]);
  const [selectedChain, setSelectedChain] = useState<ChainData | null>(null);

  useEffect(() => {
    const cachedChains = sessionStorage.getItem('chains');
    
    if (cachedChains) {
      const data = JSON.parse(cachedChains);
      setChains(data);
      const chainName = params?.chain as string;
      const chain = chainName 
        ? data.find((c: ChainData) => c.chain_name.toLowerCase().replace(/\s+/g, '-') === chainName.toLowerCase())
        : data.find((c: ChainData) => c.chain_name === 'lumera-mainnet') || data[0];
      setSelectedChain(chain);
    } else {
      fetch('/api/chains')
        .then(res => res.json())
        .then(data => {
          sessionStorage.setItem('chains', JSON.stringify(data));
          setChains(data);
          const chainName = params?.chain as string;
          const chain = chainName 
            ? data.find((c: ChainData) => c.chain_name.toLowerCase().replace(/\s+/g, '-') === chainName.toLowerCase())
            : data.find((c: ChainData) => c.chain_name === 'lumera-mainnet') || data[0];
          setSelectedChain(chain);
        });
    }
  }, [params]);

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!query.trim()) {
      setError('Please enter an IP address or domain');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch(`/api/tools/ip-lookup?query=${encodeURIComponent(query.trim())}`);
      const data = await response.json();

      if (!response.ok || !data.success) {
        setError(data.error || 'Lookup failed');
        return;
      }

      setResult(data);
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-[#0a0a0a]">
      <Sidebar selectedChain={selectedChain} />
      <div className="flex-1 flex flex-col">
        <Header chains={chains} selectedChain={selectedChain} onSelectChain={setSelectedChain} />
        <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-auto">
          <div className="max-w-6xl mx-auto mt-12">
            {/* Header */}
            <div className="mb-10">
              <h1 className="text-2xl md:text-3xl font-bold text-white mb-3 flex items-center">
                <Globe className="w-6 h-6 md:w-8 md:h-8 mr-2 md:mr-3" />
                IP & Domain Lookup
              </h1>
              <p className="text-gray-400 text-base">
                Check IP address or domain location, provider, and network information
              </p>
            </div>

            {/* Search Form */}
            <form onSubmit={handleLookup} className="mb-6">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Enter IP address or domain (e.g., 8.8.8.8 or google.com)"
                    className="w-full px-4 py-3 pl-12 bg-[#1a1a1a] border border-gray-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white placeholder-gray-600"
                  />
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-600" />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-800 disabled:cursor-not-allowed rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Looking up...
                    </>
                  ) : (
                    <>
                      <Search className="w-5 h-5" />
                      Lookup
                    </>
                  )}
                </button>
              </div>
            </form>

            {/* Error Message */}
            {error && (
              <div className="mb-6 p-4 bg-red-900/20 border border-red-800 rounded-lg">
                <p className="text-red-400">{error}</p>
              </div>
            )}

            {/* Results */}
            {result && (
              <div className="space-y-4">
                {/* Query Info */}
                <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-6">
                  <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-white">
                    <Search className="w-5 h-5 text-blue-400" />
                    Query Information
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-gray-500 text-sm mb-1">Original Query</p>
                      <p className="text-white font-mono text-sm">{result.query}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-sm mb-1">IP Address</p>
                      <p className="text-white font-mono text-sm">{result.ip}</p>
                    </div>
                    {result.hostname && (
                      <div className="md:col-span-2">
                        <p className="text-gray-500 text-sm mb-1">Resolved From Domain</p>
                        <p className="text-white font-mono text-sm">{result.hostname}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Location Info */}
                <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-6">
                  <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-white">
                    <MapPin className="w-5 h-5 text-green-400" />
                    Location Information
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-gray-500 text-sm mb-1">City</p>
                      <p className="text-white text-lg">{result.location.city}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-sm mb-1">Country</p>
                      <p className="text-white text-lg flex items-center gap-2">
                        <span className="text-2xl">{getFlagEmoji(result.location.countryCode)}</span>
                        {result.location.country}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-sm mb-1">Country Code</p>
                      <p className="text-white font-mono">{result.location.countryCode}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-sm mb-1">Coordinates</p>
                      <p className="text-white font-mono text-sm">{result.location.coordinates}</p>
                    </div>
                  </div>

                  {/* Map Link */}
                  <div className="mt-4 pt-4 border-t border-gray-800">
                    <a
                      href={`https://www.google.com/maps?q=${result.location.latitude},${result.location.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 transition-colors text-sm"
                    >
                      <Globe className="w-4 h-4" />
                      View on Google Maps
                    </a>
                  </div>
                </div>

                {/* Provider Info */}
                <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-6">
                  <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-white">
                    <Server className="w-5 h-5 text-purple-400" />
                    Network Provider
                  </h2>
                  <div>
                    <p className="text-gray-500 text-sm mb-1">Hosting Provider / ISP</p>
                    <p className="text-white text-2xl font-semibold">{result.location.provider}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Examples */}
            {!result && !loading && (
              <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-6">
                <h3 className="text-lg font-semibold mb-3 text-white">Examples</h3>
                <div className="space-y-2">
                  <button
                    onClick={() => setQuery('8.8.8.8')}
                    className="block w-full text-left px-4 py-3 bg-[#0f0f0f] hover:bg-gray-800 border border-gray-800 rounded transition-colors"
                  >
                    <span className="text-gray-500">IP:</span> <span className="text-white font-mono">8.8.8.8</span>
                  </button>
                  <button
                    onClick={() => setQuery('rpc.cosmos.network')}
                    className="block w-full text-left px-4 py-3 bg-[#0f0f0f] hover:bg-gray-800 border border-gray-800 rounded transition-colors"
                  >
                    <span className="text-gray-500">Domain:</span> <span className="text-white font-mono">rpc.cosmos.network</span>
                  </button>
                  <button
                    onClick={() => setQuery('https://api.winscan.org')}
                    className="block w-full text-left px-4 py-3 bg-[#0f0f0f] hover:bg-gray-800 border border-gray-800 rounded transition-colors"
                  >
                    <span className="text-gray-500">URL:</span> <span className="text-white font-mono">https://api.winscan.org</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

function getFlagEmoji(countryCode: string): string {
  if (!countryCode || countryCode === 'XX') return '🌍';
  
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map(char => 127397 + char.charCodeAt(0));
  
  return String.fromCodePoint(...codePoints);
}
