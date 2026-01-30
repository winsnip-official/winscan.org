'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { ChainData } from '@/types/chain';
import { Globe, TrendingUp, Network } from 'lucide-react';

export default function Home() {
  const router = useRouter();
  const [chains, setChains] = useState<ChainData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Check if homepage is disabled (default: enabled)
  const disableHomepage = process.env.NEXT_PUBLIC_DISABLE_HOMEPAGE === '1';
  const defaultChain = process.env.NEXT_PUBLIC_DEFAULT_CHAIN || 'paxi-mainnet';

  useEffect(() => {
    // If homepage disabled, redirect to default chain
    if (disableHomepage) {
      router.replace(`/${defaultChain}`);
      return;
    }

    // Load chains for homepage
    fetch('/api/chains')
      .then(res => res.json())
      .then(data => {
        setChains(data);
        setLoading(false);
      })
      .catch(error => {
        console.error('Error loading chains:', error);
        setLoading(false);
      });
  }, [disableHomepage, defaultChain, router]);

  const filteredChains = chains.filter(chain => 
    chain.chain_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    chain.chain_id?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const mainnets = filteredChains.filter(c => !c.chain_name.includes('test'));
  const testnets = filteredChains.filter(c => c.chain_name.includes('test'));

  // Show loading while checking config or loading chains
  if (disableHomepage || loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-t-2 border-blue-500 border-solid rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">
            {disableHomepage ? 'Redirecting...' : 'Loading chains...'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Header */}
      <header className="border-b border-gray-800 bg-[#0f0f0f]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Image src="/logo.svg" alt="WinScan" width={40} height={40} />
              <div>
                <h1 className="text-xl font-bold text-white">WinScan Explorer</h1>
                <p className="text-xs text-gray-400">Multi-chain blockchain explorer</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className="px-3 py-1 bg-blue-500/10 text-blue-400 text-sm rounded-lg border border-blue-500/20">
                {chains.length} Networks
              </span>
              <select className="bg-[#1a1a1a] border border-gray-700 rounded-lg px-3 py-2 text-white text-sm">
                <option>🇺🇸 English</option>
              </select>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative py-20 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-blue-500/5 to-transparent"></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <h2 className="text-5xl md:text-6xl font-bold text-white mb-6">
            Blockchain Explorer for
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">
              Cosmos Ecosystem
            </span>
          </h2>
          <p className="text-xl text-gray-400 mb-8 max-w-3xl mx-auto">
            Explore and analyze blockchain data across multiple{' '}
            <span className="text-blue-400 font-semibold">Cosmos networks</span>
          </p>
          
          {/* Features */}
          <div className="flex items-center justify-center gap-8 text-sm text-gray-400 mb-8">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span>Real-time Data</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <span>Multi-Chain Support</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
              <span>Advanced Analytics</span>
            </div>
          </div>

          {/* Search */}
          <div className="relative max-w-2xl mx-auto">
            <input
              type="text"
              placeholder="Search chains..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#1a1a1a] border border-gray-700 rounded-lg px-6 py-4 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-lg"
            />
          </div>
        </div>
      </section>

      {/* Stats */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
          <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-500/10 rounded-lg">
                <Globe className="w-6 h-6 text-blue-500" />
              </div>
              <div>
                <p className="text-gray-400 text-sm">Total Networks</p>
                <p className="text-2xl font-bold text-white">{chains.length}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-green-500/10 rounded-lg">
                <TrendingUp className="w-6 h-6 text-green-500" />
              </div>
              <div>
                <p className="text-gray-400 text-sm">Mainnets</p>
                <p className="text-2xl font-bold text-white">{mainnets.length}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-purple-500/10 rounded-lg">
                <Network className="w-6 h-6 text-purple-500" />
              </div>
              <div>
                <p className="text-gray-400 text-sm">Testnets</p>
                <p className="text-2xl font-bold text-white">{testnets.length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Mainnet Chains */}
        {mainnets.length > 0 && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-white mb-4">Mainnet Networks</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {mainnets.map((chain) => (
                <button
                  key={chain.chain_name}
                  onClick={() => router.push(`/${chain.chain_name.toLowerCase().replace(/\s+/g, '-')}`)}
                  className="bg-[#1a1a1a] border border-gray-800 hover:border-blue-500 rounded-lg p-6 text-left transition-all hover:scale-105"
                >
                  <div className="flex items-center gap-4 mb-3">
                    <Image
                      src={chain.logo}
                      alt={chain.chain_name}
                      width={48}
                      height={48}
                      className="rounded-full"
                    />
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-bold text-white truncate">{chain.chain_name}</h3>
                      <p className="text-sm text-gray-400 truncate">{chain.chain_id}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-1 bg-green-500/10 text-green-400 text-xs rounded">
                      Mainnet
                    </span>
                    {chain.assets?.[0]?.symbol && (
                      <span className="text-gray-400 text-sm">{chain.assets[0].symbol}</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Testnet Chains */}
        {testnets.length > 0 && (
          <div>
            <h2 className="text-2xl font-bold text-white mb-4">Testnet Networks</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {testnets.map((chain) => (
                <button
                  key={chain.chain_name}
                  onClick={() => router.push(`/${chain.chain_name.toLowerCase().replace(/\s+/g, '-')}`)}
                  className="bg-[#1a1a1a] border border-gray-800 hover:border-purple-500 rounded-lg p-6 text-left transition-all hover:scale-105"
                >
                  <div className="flex items-center gap-4 mb-3">
                    <Image
                      src={chain.logo}
                      alt={chain.chain_name}
                      width={48}
                      height={48}
                      className="rounded-full"
                    />
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-bold text-white truncate">{chain.chain_name}</h3>
                      <p className="text-sm text-gray-400 truncate">{chain.chain_id}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-1 bg-purple-500/10 text-purple-400 text-xs rounded">
                      Testnet
                    </span>
                    {chain.assets?.[0]?.symbol && (
                      <span className="text-gray-400 text-sm">{chain.assets[0].symbol}</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="border-t border-gray-800 bg-[#0f0f0f] mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 text-center text-gray-400 text-sm">
          © 2025 WinScan. Multi-chain blockchain explorer.
        </div>
      </footer>
    </div>
  );
}
