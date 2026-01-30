'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Header from '@/components/Header';
import Sidebar from '@/components/Sidebar';
import { FileText, Clock, Hash, Zap, User, ArrowRight, CheckCircle, XCircle } from 'lucide-react';
import { ChainData } from '@/types/chain';

interface TransactionDetail {
  hash: string;
  blockNumber: number;
  blockHash: string;
  timestamp: number;
  from: string;
  to: string | null;
  value: string;
  gasPrice: string;
  gasUsed: string;
  gasLimit: string;
  nonce: number;
  transactionIndex: number;
  status: number;
  input: string;
}

export default function EVMTransactionDetailPage() {
  const params = useParams();
  const [chains, setChains] = useState<ChainData[]>([]);
  const [selectedChain, setSelectedChain] = useState<ChainData | null>(null);
  const [transaction, setTransaction] = useState<TransactionDetail | null>(null);
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
    if (!selectedChain || !params.hash) return;

    const fetchTransactionDetail = async () => {
      try {
        setLoading(true);
        setError(null);

        const chainName = selectedChain.chain_name.toLowerCase().replace(/\s+/g, '-');
        
        // Try backend API first
        try {
          const response = await fetch(
            `https://ssl.winsnip.xyz/api/evm/transaction/${params.hash}?chain=${chainName}`,
            { signal: AbortSignal.timeout(5000) }
          );
          
          if (response.ok) {
            const data = await response.json();
            
            setTransaction({
              hash: data.hash,
              blockNumber: data.blockNumber,
              blockHash: data.blockHash,
              timestamp: data.timestamp,
              from: data.from,
              to: data.to,
              value: data.value,
              gasPrice: data.gasPrice,
              gasUsed: data.gasUsed,
              gasLimit: data.gasLimit,
              nonce: data.nonce,
              transactionIndex: data.transactionIndex,
              status: data.status,
              input: data.input
            });
            return;
          }
        } catch (backendError) {
          console.log('Backend fetch failed, using local API fallback');
        }

        // Fallback to local Next.js API
        const localResponse = await fetch(
          `/api/evm/transaction?chain=${chainName}&hash=${params.hash}`
        );
        
        if (!localResponse.ok) {
          throw new Error('Transaction not found');
        }
        
        const data = await localResponse.json();
        
        setTransaction({
          hash: data.hash,
          blockNumber: data.blockNumber,
          blockHash: data.blockHash,
          timestamp: data.timestamp,
          from: data.from,
          to: data.to,
          value: data.value,
          gasPrice: data.gasPrice,
          gasUsed: data.gasUsed,
          gasLimit: data.gasLimit,
          nonce: data.nonce,
          transactionIndex: data.transactionIndex,
          status: data.status,
          input: data.input
        });
      } catch (err) {
        console.error('Error fetching transaction:', err);
        setError(err instanceof Error ? err.message : 'Failed to load transaction');
      } finally {
        setLoading(false);
      }
    };

    fetchTransactionDetail();
  }, [selectedChain, params.hash]);

  const formatValue = (value: string) => {
    const bigIntValue = BigInt(value);
    const ethValue = Number(bigIntValue) / 1e18;
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
                EVM Transaction Details
              </h1>
              <p className="text-gray-400">
                Transaction details for {selectedChain?.chain_name || ''}
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
            ) : transaction ? (
              <div className="space-y-6">
                {/* Status Badge */}
                <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-6">
                  <div className="flex items-center gap-3">
                    {transaction.status === 1 ? (
                      <>
                        <CheckCircle className="w-6 h-6 text-green-500" />
                        <span className="text-green-500 font-semibold">Success</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="w-6 h-6 text-red-500" />
                        <span className="text-red-500 font-semibold">Failed</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Transaction Info */}
                <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-6">
                  <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-blue-500" />
                    Transaction Information
                  </h2>
                  
                  <div className="space-y-4">
                    <div>
                      <p className="text-gray-400 text-sm mb-1">Transaction Hash</p>
                      <p className="text-white font-mono break-all">{transaction.hash}</p>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-gray-400 text-sm mb-1">Block</p>
                        <a 
                          href={`/${params.chain}/evm/blocks/${transaction.blockNumber}`}
                          className="text-blue-400 hover:text-blue-300 font-mono"
                        >
                          {transaction.blockNumber.toLocaleString()}
                        </a>
                      </div>
                      
                      <div>
                        <p className="text-gray-400 text-sm mb-1">Timestamp</p>
                        <p className="text-white">{new Date(transaction.timestamp * 1000).toLocaleString()}</p>
                      </div>
                    </div>
                    
                    <div>
                      <p className="text-gray-400 text-sm mb-1">Block Hash</p>
                      <p className="text-white font-mono break-all">{transaction.blockHash}</p>
                    </div>
                  </div>
                </div>

                {/* From & To */}
                <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-6">
                  <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    <ArrowRight className="w-5 h-5 text-blue-500" />
                    Transfer
                  </h2>
                  
                  <div className="space-y-4">
                    <div>
                      <p className="text-gray-400 text-sm mb-1">From</p>
                      <a 
                        href={`/${params.chain}/evm/address/${transaction.from}`}
                        className="text-blue-400 hover:text-blue-300 font-mono break-all"
                      >
                        {transaction.from}
                      </a>
                    </div>
                    
                    <div className="flex items-center justify-center">
                      <ArrowRight className="w-6 h-6 text-gray-500" />
                    </div>
                    
                    <div>
                      <p className="text-gray-400 text-sm mb-1">To</p>
                      {transaction.to ? (
                        <a 
                          href={`/${params.chain}/evm/address/${transaction.to}`}
                          className="text-blue-400 hover:text-blue-300 font-mono break-all"
                        >
                          {transaction.to}
                        </a>
                      ) : (
                        <p className="text-gray-400">Contract Creation</p>
                      )}
                    </div>
                    
                    <div>
                      <p className="text-gray-400 text-sm mb-1">Value</p>
                      <p className="text-white text-lg font-semibold">
                        {formatValue(transaction.value)} {selectedChain?.assets?.[0]?.symbol || 'TOKEN'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Gas Details */}
                <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-6">
                  <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    <Zap className="w-5 h-5 text-blue-500" />
                    Gas Details
                  </h2>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-gray-400 text-sm mb-1">Gas Used</p>
                      <p className="text-white">{parseInt(transaction.gasUsed).toLocaleString()}</p>
                    </div>
                    
                    <div>
                      <p className="text-gray-400 text-sm mb-1">Gas Limit</p>
                      <p className="text-white">{parseInt(transaction.gasLimit).toLocaleString()}</p>
                    </div>
                    
                    <div>
                      <p className="text-gray-400 text-sm mb-1">Gas Price</p>
                      <p className="text-white">{(parseInt(transaction.gasPrice) / 1e9).toFixed(2)} Gwei</p>
                    </div>
                    
                    <div>
                      <p className="text-gray-400 text-sm mb-1">Transaction Fee</p>
                      <p className="text-white">
                        {((parseInt(transaction.gasUsed) * parseInt(transaction.gasPrice)) / 1e18).toFixed(6)} {selectedChain?.assets?.[0]?.symbol || 'TOKEN'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Additional Details */}
                <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-6">
                  <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    <Hash className="w-5 h-5 text-blue-500" />
                    Additional Details
                  </h2>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-gray-400 text-sm mb-1">Nonce</p>
                      <p className="text-white">{transaction.nonce}</p>
                    </div>
                    
                    <div>
                      <p className="text-gray-400 text-sm mb-1">Position in Block</p>
                      <p className="text-white">{transaction.transactionIndex}</p>
                    </div>
                  </div>
                  
                  {transaction.input && transaction.input !== '0x' && (
                    <div className="mt-4">
                      <p className="text-gray-400 text-sm mb-1">Input Data</p>
                      <div className="bg-[#0f0f0f] border border-gray-700 rounded p-3 overflow-x-auto">
                        <p className="text-white font-mono text-xs break-all">{transaction.input}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </main>
      </div>
    </div>
  );
}
