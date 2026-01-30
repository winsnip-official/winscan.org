'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Header from '@/components/Header';
import Sidebar from '@/components/Sidebar';
import { Box, Clock, Hash, Zap, User, FileText } from 'lucide-react';
import { ChainData } from '@/types/chain';

interface Transaction {
  hash: string;
  from: string;
  to: string | null;
  value: string;
  gasPrice: string;
  gasUsed: string;
}

interface BlockDetail {
  number: number;
  hash: string;
  timestamp: number;
  transactions: Transaction[];
  miner: string;
  gasUsed: string;
  gasLimit: string;
  parentHash: string;
  nonce: string;
  difficulty: string;
  size: number;
}

export default function EVMBlockDetailPage() {
  const params = useParams();
  const [chains, setChains] = useState<ChainData[]>([]);
  const [selectedChain, setSelectedChain] = useState<ChainData | null>(null);
  const [block, setBlock] = useState<BlockDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    if (!selectedChain || !params.blockNumber) return;

    const fetchBlockDetail = async () => {
      try {
        setLoading(true);
        setError(null);

        const chainName = selectedChain.chain_name.toLowerCase().replace(/\s+/g, '-');
        
        // Try backend API first
        try {
          const response = await fetch(
            `https://ssl.winsnip.xyz/api/evm/block/${params.blockNumber}?chain=${chainName}`,
            { signal: AbortSignal.timeout(5000) }
          );
          
          if (response.ok) {
            const data = await response.json();
            
            setBlock({
              number: data.number,
              hash: data.hash,
              timestamp: data.timestamp,
              transactions: data.transactions,
              miner: data.miner,
              gasUsed: data.gasUsed,
              gasLimit: data.gasLimit,
              parentHash: data.parentHash,
              nonce: data.nonce || '0x0',
              difficulty: data.difficulty || '0',
              size: data.size || 0
            });
            return;
          }
        } catch (backendError) {
          console.log('Backend fetch failed, using local API fallback');
        }

        // Fallback to local Next.js API
        const localResponse = await fetch(
          `/api/evm/block?chain=${chainName}&blockNumber=${params.blockNumber}`
        );
        
        if (!localResponse.ok) {
          throw new Error('Block not found');
        }
        
        const data = await localResponse.json();
        
        setBlock({
          number: data.number,
          hash: data.hash,
          timestamp: data.timestamp,
          transactions: data.transactions,
          miner: data.miner,
          gasUsed: data.gasUsed,
          gasLimit: data.gasLimit,
          parentHash: data.parentHash,
          nonce: '0x0',
          difficulty: '0',
          size: 0
        });
      } catch (err) {
        console.error('Error fetching block:', err);
        setError(err instanceof Error ? err.message : 'Failed to load block');
      } finally {
        setLoading(false);
      }
    };

    fetchBlockDetail();
  }, [selectedChain, params.blockNumber]);

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
                EVM Block #{params.blockNumber}
              </h1>
              <p className="text-gray-400">
                Block details for {selectedChain?.chain_name || ''}
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
            ) : block ? (
              <>
                {/* Block Info */}
                <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-6 mb-6">
                  <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    <Box className="w-5 h-5 text-blue-500" />
                    Block Information
                  </h2>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-gray-400 text-sm mb-1">Block Number</p>
                      <p className="text-white font-mono">{block.number.toLocaleString()}</p>
                    </div>
                    
                    <div>
                      <p className="text-gray-400 text-sm mb-1">Timestamp</p>
                      <p className="text-white">{new Date(block.timestamp * 1000).toLocaleString()}</p>
                    </div>
                    
                    <div className="md:col-span-2">
                      <p className="text-gray-400 text-sm mb-1">Block Hash</p>
                      <p className="text-white font-mono break-all">{block.hash}</p>
                    </div>
                    
                    <div className="md:col-span-2">
                      <p className="text-gray-400 text-sm mb-1">Parent Hash</p>
                      <p className="text-white font-mono break-all">{block.parentHash}</p>
                    </div>
                    
                    <div>
                      <p className="text-gray-400 text-sm mb-1">Miner</p>
                      <p className="text-white font-mono break-all">{block.miner}</p>
                    </div>
                    
                    <div>
                      <p className="text-gray-400 text-sm mb-1">Transactions</p>
                      <p className="text-white">{block.transactions.length}</p>
                    </div>
                    
                    <div>
                      <p className="text-gray-400 text-sm mb-1">Gas Used</p>
                      <p className="text-white">{parseInt(block.gasUsed).toLocaleString()}</p>
                    </div>
                    
                    <div>
                      <p className="text-gray-400 text-sm mb-1">Gas Limit</p>
                      <p className="text-white">{parseInt(block.gasLimit).toLocaleString()}</p>
                    </div>
                    
                    <div>
                      <p className="text-gray-400 text-sm mb-1">Size</p>
                      <p className="text-white">{block.size.toLocaleString()} bytes</p>
                    </div>
                    
                    <div>
                      <p className="text-gray-400 text-sm mb-1">Difficulty</p>
                      <p className="text-white">{block.difficulty}</p>
                    </div>
                  </div>
                </div>

                {/* Transactions */}
                <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg overflow-hidden">
                  <div className="p-6 border-b border-gray-800">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                      <FileText className="w-5 h-5 text-blue-500" />
                      Transactions ({block.transactions.length})
                    </h2>
                  </div>
                  
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-800">
                      <thead className="bg-[#0f0f0f]">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                            Tx Hash
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
                        {block.transactions.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="px-6 py-8 text-center text-gray-400">
                              No transactions in this block
                            </td>
                          </tr>
                        ) : (
                          block.transactions.map((tx) => (
                            <tr key={tx.hash} className="hover:bg-gray-800/50 transition-colors">
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-400 font-mono">
                                <a href={`/${params.chain}/evm/transactions/${tx.hash}`} className="hover:text-blue-300">
                                  {truncateHash(tx.hash)}
                                </a>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400 font-mono">
                                <a href={`/${params.chain}/evm/address/${tx.from}`} className="hover:text-gray-300">
                                  {truncateHash(tx.from)}
                                </a>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400 font-mono">
                                {tx.to ? (
                                  <a href={`/${params.chain}/evm/address/${tx.to}`} className="hover:text-gray-300">
                                    {truncateHash(tx.to)}
                                  </a>
                                ) : (
                                  'Contract Creation'
                                )}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                                {formatValue(tx.value)}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </main>
      </div>
    </div>
  );
}
