'use client';
import { Search, Home } from 'lucide-react';
import ChainSelector from './ChainSelector';
import LanguageSwitcher from './LanguageSwitcher';
import LatestBlocksHeader from './LatestBlocksHeader';
import PriceTracker from './PriceTracker';
import dynamic from 'next/dynamic';
import { ChainData } from '@/types/chain';
import { useState, useCallback, useMemo, memo } from 'react';
import { useRouter } from 'next/navigation';
import { useDebounce } from 'use-debounce';
import { fetchJSONFromSSLBackend } from '@/lib/sslLoadBalancer';
const KeplrWallet = dynamic(() => import('./KeplrWallet'), {
  ssr: false,
  loading: () => (
    <div className="px-4 py-2 bg-[#1a1a1a] border border-gray-700 rounded-lg">
      <div className="w-24 h-8 bg-gray-800 animate-pulse rounded" />
    </div>
  ),
});
interface HeaderProps {
  chains: ChainData[];
  selectedChain: ChainData | null;
  onSelectChain: (chain: ChainData) => void;
}
function Header({ chains, selectedChain, onSelectChain }: HeaderProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery] = useDebounce(searchQuery, 300);
  const router = useRouter();
  const chainPath = useMemo(() => 
    selectedChain?.chain_name.toLowerCase().replace(/\s+/g, '-') || '',
    [selectedChain]
  );
  const handleSearch = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim() || !selectedChain) return;
    
    const query = searchQuery.trim();
    const chainName = selectedChain.chain_name.toLowerCase().replace(/\s+/g, '-');
    
    // Check if it's a block number
    if (/^\d+$/.test(query)) {
      // Try Cosmos block first
      try {
        const data = await fetchJSONFromSSLBackend(`/api/blocks/${query}?chain=${chainName}`);
        if (data.block) {
          router.push(`/${chainPath}/blocks/${query}`);
          setSearchQuery('');
          return;
        }
      } catch (err) {
        }
      
      // Fallback to EVM block if chain has EVM support
      if (selectedChain.evm_rpc && selectedChain.evm_rpc.length > 0) {
        router.push(`/${chainPath}/evm/blocks/${query}`);
        setSearchQuery('');
        return;
      }
      
      router.push(`/${chainPath}/blocks/${query}`);
    } 
    // Check if it's an EVM transaction hash (0x + 64 hex chars)
    else if (/^0x[a-fA-F0-9]{64}$/.test(query)) {
      if (selectedChain.evm_rpc && selectedChain.evm_rpc.length > 0) {
        router.push(`/${chainPath}/evm/transactions/${query}`);
        setSearchQuery('');
        return;
      }
      // If no EVM support, treat as Cosmos tx hash
      router.push(`/${chainPath}/transactions/${query.substring(2)}`); // Remove 0x prefix
    }
    // Check if it's a transaction hash (64 hex chars, no 0x)
    else if (/^[A-F0-9]{64}$/i.test(query)) {
      // Try Cosmos transaction first
      try {
        const data = await fetchJSONFromSSLBackend(`/api/transactions/${query}?chain=${chainName}`);
        if (data.transaction) {
          router.push(`/${chainPath}/transactions/${query}`);
          setSearchQuery('');
          return;
        }
      } catch (err) {
        }
      
      // Fallback to EVM transaction if chain has EVM support
      if (selectedChain.evm_rpc && selectedChain.evm_rpc.length > 0) {
        router.push(`/${chainPath}/evm/transactions/${query}`);
        setSearchQuery('');
        return;
      }
      
      router.push(`/${chainPath}/transactions/${query}`);
    } 
    // Check if it's a Cosmos address
    else if (selectedChain.bech32_prefix && query.startsWith(selectedChain.bech32_prefix)) {
      // Check if it's a PRC20 contract on Paxi chain (paxi1...)
      if (chainName === 'paxi-mainnet' && query.startsWith('paxi1') && query.length > 50) {
        // It's a PRC20 contract address
        router.push(`/${chainPath}/prc20/${query}`);
      } else {
        // Regular account
        router.push(`/${chainPath}/accounts/${query}`);
      }
    }
    else if (selectedChain.addr_prefix && query.startsWith(selectedChain.addr_prefix)) {
      router.push(`/${chainPath}/accounts/${query}`);
    }
    // Check if it's an EVM address (0x...)
    else if (/^0x[a-fA-F0-9]{40}$/.test(query)) {
      if (selectedChain.evm_rpc && selectedChain.evm_rpc.length > 0) {
        router.push(`/${chainPath}/evm/address/${query}`);
      } else {
        router.push(`/${chainPath}/accounts/${query}`);
      }
    }
    // Default search
    else {
      router.push(`/${chainPath}/transactions?q=${query}`);
    }
    
    setSearchQuery('');
  }, [searchQuery, selectedChain, chainPath, router]);
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  }, []);
  const handleHomeClick = useCallback(() => {
    router.push('/');
  }, [router]);
  return (
    <>
      <header className="fixed top-0 right-0 left-0 md:left-64 h-16 bg-[#0f0f0f] border-b border-gray-800 z-20 flex items-center px-3 sm:px-4 md:px-6">
        <div className="flex items-center justify-between w-full ml-12 sm:ml-14 md:ml-0 gap-2 sm:gap-4 min-w-0">
          {/* Left Side: Home, Chain Selector, Latest Blocks */}
          <div className="flex items-center gap-1 sm:gap-3 flex-shrink-0">
            {/* Home Button */}
            <button
              onClick={handleHomeClick}
              className="flex items-center gap-1 sm:gap-2 px-2.5 sm:px-4 py-2 bg-[#1a1a1a] hover:bg-gray-800 border border-gray-700 rounded-lg transition-colors duration-200 flex-shrink-0 h-[40px]"
              title="Back to Home"
            >
              <Home className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
              <span className="hidden sm:inline text-sm text-gray-300">Home</span>
            </button>
            
            {/* Chain Selector - Always visible */}
            <ChainSelector 
              chains={chains} 
              selectedChain={selectedChain} 
              onSelectChain={onSelectChain}
            />
            
            {/* Latest Blocks Header - Real-time */}
            <div className="hidden md:block flex-shrink-0">
              <LatestBlocksHeader selectedChain={selectedChain} />
            </div>
          </div>
          
          {/* Center: Search Bar - Desktop only */}
          <form onSubmit={handleSearch} className="flex-1 max-w-2xl hidden lg:block mx-6">
            <div className="relative">
              <div className="absolute left-3 top-0 bottom-0 flex items-center pointer-events-none">
                <Search className="w-5 h-5 text-gray-400" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={handleInputChange}
                placeholder="Search blocks, transactions, addresses..."
                className="w-full bg-[#1a1a1a] border border-gray-700 rounded-lg pl-10 pr-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-all duration-200"
                autoComplete="off"
              />
            </div>
          </form>
          
          {/* Right Actions */}
          <div className="flex items-center gap-1 sm:gap-3 flex-shrink-0">
            {/* Price Tracker */}
            <div className="hidden lg:block flex-shrink-0">
              <PriceTracker selectedChain={selectedChain} />
            </div>
            
            <div className="hidden md:block">
              <LanguageSwitcher />
            </div>
            <KeplrWallet selectedChain={selectedChain} />
          </div>
        </div>
      </header>
      
      {/* Mobile Search Bar - Below Header */}
      <div className="fixed top-16 right-0 left-0 md:left-64 lg:hidden bg-[#0f0f0f] border-b border-gray-800 z-10">
        <div className="px-3 py-2">
          {/* Search Bar */}
          <form onSubmit={handleSearch}>
            <div className="relative max-w-2xl mx-auto">
              <div className="absolute left-3 top-0 bottom-0 flex items-center pointer-events-none">
                <Search className="w-4 h-4 text-gray-400" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={handleInputChange}
                placeholder="Search hash, address, block..."
                className="w-full bg-[#1a1a1a] border border-gray-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-all duration-200"
                autoComplete="off"
              />
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
export default memo(Header);
