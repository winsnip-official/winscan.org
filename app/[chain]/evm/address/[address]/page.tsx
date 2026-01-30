'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Header from '@/components/Header';
import Sidebar from '@/components/Sidebar';
import { Wallet, Coins, FileText, Clock, TrendingUp, Package, Image as ImageIcon, Code } from 'lucide-react';
import { ChainData } from '@/types/chain';

interface Transaction {
  hash: string;
  blockNumber: number;
  timestamp: number;
  from: string;
  to: string | null;
  value: string;
  gasUsed: string;
  gasPrice: string;
}

interface AddressDetail {
  address: string;
  balance: string;
  balanceFormatted: string;
  transactionCount: number;
  isContract: boolean;
  transactions: Transaction[];
  tokenBalances: TokenBalance[];
  nftBalances: NFTBalance[];
  stats: {
    totalTransactions: number;
    sent: number;
    received: number;
    tokens: number;
    nfts: number;
  };
}

interface TokenBalance {
  tokenAddress: string;
  name: string;
  symbol: string;
  decimals: number;
  balance: string;
  balanceFormatted: string;
}

interface NFTBalance {
  contractAddress: string;
  tokenId: string;
  name?: string;
  symbol?: string;
}

export default function EVMAddressDetailPage() {
  const params = useParams();
  const [chains, setChains] = useState<ChainData[]>([]);
  const [selectedChain, setSelectedChain] = useState<ChainData | null>(null);
  const [addressData, setAddressData] = useState<AddressDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'transactions' | 'tokens' | 'nfts'>('transactions');

  useEffect(() => {
    const loadChains = async () => {
      try {
        const response = await fetch('/api/chains');
        const data = await response.json();
        setChains(data);
        
        const chainParam = params.chain as string;
        const chain = data.find((c: ChainData) => 
          c.chain_name.toLowerCase().replace(/\s+/g, '-') === chainParam
        );
        
        if (chain) {
          setSelectedChain(chain);
        }
      } catch (err) {
        console.error('Error loading chains:', err);
      }
    };

    loadChains();
  }, [params.chain]);

  useEffect(() => {
    if (!selectedChain || !params.address) return;

    const fetchAddressDetail = async () => {
      const chainName = selectedChain.chain_name.toLowerCase().replace(/\s+/g, '-');
      const address = params.address as string;
      const cacheKey = `evm_address_${chainName}_${address}`;

      // Read from cache first
      try {
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
          const { data, timestamp } = JSON.parse(cached);
          if (data && data.address) {
            setAddressData(data); // Use full cached data
            // Skip fetch if cache is fresh (< 15 seconds)
            if (Date.now() - timestamp < 15000) {
              setLoading(false);
              return;
            }
          }
        }
      } catch (e) {
        console.warn('Cache read error:', e);
      }

      // Only show loading if no cached data
      if (!addressData) {
        setLoading(true);
      }

      try {
        setError(null);
        let data: any = null;

        // Try backend first (without timeout constraint)
        try {
          const response = await fetch(
            `https://ssl.winsnip.xyz/api/evm/address/${address}?chain=${chainName}`
          );
          data = await response.json();
          
          // If backend returns error or no data, fallback to local scan
          if (data.error || !data.address) {
            console.log('[Address Detail] Backend returned error/no data, using local scan...');
            data = null;
          }
        } catch (fetchError) {
          console.log('[Address Detail] Backend fetch failed, using local scan...', fetchError);
          data = null;
        }
        
        // Fallback to local API if backend failed
        if (!data) {
          const localResponse = await fetch(
            `/api/evm/address?chain=${chainName}&address=${address}`
          );
          
          if (!localResponse.ok) {
            throw new Error('Failed to fetch address details');
          }
          
          data = await localResponse.json();
        }

        // Set address data
        const formattedData = {
          address: data.address,
          balance: data.balance,
          balanceFormatted: data.balanceFormatted || formatValue(data.balance),
          transactionCount: data.transactionCount,
          isContract: data.isContract || false,
          transactions: (data.transactions || []).map((tx: any) => ({
            hash: tx.hash,
            blockNumber: tx.blockNumber,
            timestamp: tx.timestamp,
            from: tx.from,
            to: tx.to,
            value: tx.value,
            gasUsed: tx.gasUsed || '0',
            gasPrice: tx.gasPrice || '0'
          })),
          tokenBalances: data.tokenBalances || [],
          nftBalances: data.nftBalances || [],
          stats: data.stats || {
            totalTransactions: data.transactionCount || 0,
            sent: 0,
            received: 0,
            tokens: (data.tokenBalances || []).length,
            nfts: (data.nftBalances || []).length
          }
        };

        setAddressData(formattedData);

        // Save to cache
        try {
          sessionStorage.setItem(cacheKey, JSON.stringify({
            data: formattedData,
            timestamp: Date.now()
          }));
        } catch (e) {
          console.warn('Cache write error:', e);
        }

      } catch (err) {
        console.error('Error fetching address:', err);
        // Keep showing cached data if available
        if (!addressData) {
          setError(err instanceof Error ? err.message : 'Failed to load address');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchAddressDetail();
  }, [selectedChain, params.address]);

  const formatValue = (value: string) => {
    const ethValue = parseFloat(value) / 1e18;
    return ethValue.toFixed(6);
  };

  const truncateHash = (hash: string) => {
    return `${hash.substring(0, 10)}...${hash.substring(hash.length - 8)}`;
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex">
      <Sidebar selectedChain={selectedChain} />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header 
          chains={chains}
          selectedChain={selectedChain}
          onSelectChain={setSelectedChain}
        />
        
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-[#0a0a0a]">
          <div className="container mx-auto px-3 md:px-6 py-6 md:py-8 pt-24 md:pt-8">
            <div className="mb-6">
              <h1 className="text-3xl font-bold text-white mb-2">
                EVM Address Details
              </h1>
              <p className="text-gray-400">
                Account information for {selectedChain?.chain_name || ''}
              </p>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
              </div>
            ) : error ? (
              <div className="bg-red-900/20 border border-red-800 rounded-lg p-6">
                <p className="text-red-200">{error}</p>
              </div>
            ) : addressData ? (
              <div className="space-y-6">
                {/* Address Info */}
                <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-6">
                  <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    <Wallet className="w-5 h-5 text-blue-500" />
                    Address Information
                  </h2>
                  
                  <div className="space-y-4">
                    <div>
                      <p className="text-gray-400 text-sm mb-1">Address</p>
                      <p className="text-white font-mono break-all">{addressData.address}</p>
                    </div>
                  </div>
                </div>

                {/* Balance & Stats */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-6">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-gray-400 text-sm">Balance</span>
                      <Coins className="w-5 h-5 text-blue-500" />
                    </div>
                    <p className="text-2xl font-bold text-white">
                      {addressData.balanceFormatted}
                    </p>
                    <p className="text-sm text-gray-400 mt-1">
                      {selectedChain?.assets?.[0]?.symbol || 'TOKEN'}
                    </p>
                  </div>

                  <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-6">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-gray-400 text-sm">Transactions</span>
                      <FileText className="w-5 h-5 text-blue-500" />
                    </div>
                    <p className="text-2xl font-bold text-white">
                      {addressData.stats.totalTransactions.toLocaleString()}
                    </p>
                    <p className="text-sm text-gray-400 mt-1">
                      {addressData.stats.sent} sent, {addressData.stats.received} received
                    </p>
                  </div>

                  <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-6">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-gray-400 text-sm">Tokens</span>
                      <Package className="w-5 h-5 text-blue-500" />
                    </div>
                    <p className="text-2xl font-bold text-white">
                      {addressData.stats.tokens}
                    </p>
                    <p className="text-sm text-gray-400 mt-1">
                      ERC20 tokens
                    </p>
                  </div>

                  <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-6">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-gray-400 text-sm">NFTs</span>
                      <ImageIcon className="w-5 h-5 text-blue-500" />
                    </div>
                    <p className="text-2xl font-bold text-white">
                      {addressData.stats.nfts}
                    </p>
                    <p className="text-sm text-gray-400 mt-1">
                      ERC721/1155
                    </p>
                  </div>
                </div>

                {/* Contract Badge */}
                {addressData.isContract && (
                  <div className="bg-purple-900/20 border border-purple-800 rounded-lg p-4">
                    <div className="flex items-center gap-2">
                      <Code className="w-5 h-5 text-purple-400" />
                      <span className="text-purple-200 font-medium">This is a Contract Address</span>
                    </div>
                  </div>
                )}

                {/* Tabs */}
                <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg overflow-hidden">
                  <div className="flex border-b border-gray-800">
                    <button
                      onClick={() => setActiveTab('transactions')}
                      className={`flex-1 px-6 py-4 text-sm font-medium transition-colors ${
                        activeTab === 'transactions'
                          ? 'bg-blue-500/10 text-blue-400 border-b-2 border-blue-500'
                          : 'text-gray-400 hover:text-gray-300'
                      }`}
                    >
                      <div className="flex items-center justify-center gap-2">
                        <FileText className="w-4 h-4" />
                        Transactions ({addressData.transactions.length})
                      </div>
                    </button>
                    <button
                      onClick={() => setActiveTab('tokens')}
                      className={`flex-1 px-6 py-4 text-sm font-medium transition-colors ${
                        activeTab === 'tokens'
                          ? 'bg-blue-500/10 text-blue-400 border-b-2 border-blue-500'
                          : 'text-gray-400 hover:text-gray-300'
                      }`}
                    >
                      <div className="flex items-center justify-center gap-2">
                        <Package className="w-4 h-4" />
                        Tokens ({addressData.tokenBalances.length})
                      </div>
                    </button>
                    <button
                      onClick={() => setActiveTab('nfts')}
                      className={`flex-1 px-6 py-4 text-sm font-medium transition-colors ${
                        activeTab === 'nfts'
                          ? 'bg-blue-500/10 text-blue-400 border-b-2 border-blue-500'
                          : 'text-gray-400 hover:text-gray-300'
                      }`}
                    >
                      <div className="flex items-center justify-center gap-2">
                        <ImageIcon className="w-4 h-4" />
                        NFTs ({addressData.nftBalances.length})
                      </div>
                    </button>
                  </div>

                  {/* Tab Content */}
                  <div className="p-6">
                    {activeTab === 'transactions' && (
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-800">
                          <thead className="bg-[#0f0f0f]">
                            <tr>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                                Tx Hash
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                                Block
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                                Type
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                                From
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                                To
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                                Value ({selectedChain?.assets?.[0]?.symbol || 'TOKEN'})
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-[#1a1a1a] divide-y divide-gray-800">
                            {addressData.transactions.length === 0 ? (
                              <tr>
                                <td colSpan={6} className="px-6 py-8 text-center text-gray-400">
                                  No transactions found in recent blocks
                                </td>
                              </tr>
                            ) : (
                              addressData.transactions.map((tx) => {
                                const isOutgoing = tx.from.toLowerCase() === addressData.address.toLowerCase();
                                const isIncoming = tx.to?.toLowerCase() === addressData.address.toLowerCase();
                                
                                return (
                                  <tr key={tx.hash} className="hover:bg-gray-800/50 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-400 font-mono">
                                      <a href={`/${params.chain}/evm/transactions/${tx.hash}`} className="hover:text-blue-300">
                                        {truncateHash(tx.hash)}
                                      </a>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-100">
                                      <a href={`/${params.chain}/evm/blocks/${tx.blockNumber}`} className="hover:text-gray-300">
                                        {tx.blockNumber}
                                      </a>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                                      {isOutgoing ? (
                                        <span className="px-2 py-1 bg-red-500/20 text-red-400 rounded text-xs font-medium">OUT</span>
                                      ) : isIncoming ? (
                                        <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs font-medium">IN</span>
                                      ) : (
                                        <span className="px-2 py-1 bg-gray-500/20 text-gray-400 rounded text-xs font-medium">-</span>
                                      )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400 font-mono">
                                      {truncateHash(tx.from)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400 font-mono">
                                      {tx.to ? truncateHash(tx.to) : (
                                        <span className="text-purple-400">Contract Creation</span>
                                      )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                                      {formatValue(tx.value)}
                                    </td>
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {activeTab === 'tokens' && (
                      <div className="overflow-x-auto">
                        {addressData.tokenBalances.length === 0 ? (
                          <div className="text-center py-12">
                            <Package className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                            <p className="text-gray-400">No tokens found in recent blocks</p>
                            <p className="text-gray-500 text-sm mt-2">This address may not hold any ERC20 tokens</p>
                          </div>
                        ) : (
                          <table className="min-w-full divide-y divide-gray-800">
                            <thead className="bg-[#0f0f0f]">
                              <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                                  Token
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                                  Symbol
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                                  Balance
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                                  Contract
                                </th>
                              </tr>
                            </thead>
                            <tbody className="bg-[#1a1a1a] divide-y divide-gray-800">
                              {addressData.tokenBalances.map((token, idx) => (
                                <tr key={idx} className="hover:bg-gray-800/50 transition-colors">
                                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">
                                    {token.name}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                                    {token.symbol}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                                    {token.balanceFormatted}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-400 font-mono">
                                    {truncateHash(token.tokenAddress)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    )}

                    {activeTab === 'nfts' && (
                      <div>
                        {addressData.nftBalances.length === 0 ? (
                          <div className="text-center py-12">
                            <ImageIcon className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                            <p className="text-gray-400">No NFTs found in recent blocks</p>
                            <p className="text-gray-500 text-sm mt-2">This address may not hold any ERC721/ERC1155 tokens</p>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {addressData.nftBalances.map((nft, idx) => (
                              <div key={idx} className="bg-[#0f0f0f] border border-gray-800 rounded-lg p-4">
                                <div className="aspect-square bg-gray-800 rounded-lg mb-3 flex items-center justify-center">
                                  <ImageIcon className="w-12 h-12 text-gray-600" />
                                </div>
                                <p className="text-white font-medium mb-1">
                                  {nft.name || `Token #${parseInt(nft.tokenId, 16)}`}
                                </p>
                                <p className="text-gray-400 text-sm font-mono">
                                  {truncateHash(nft.contractAddress)}
                                </p>
                                <p className="text-gray-500 text-xs mt-1">
                                  Token ID: {parseInt(nft.tokenId, 16)}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </main>
      </div>
    </div>
  );
}
