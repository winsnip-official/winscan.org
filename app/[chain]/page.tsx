'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { ChainData } from '@/types/chain';
import ValidatorAvatar from '@/components/ValidatorAvatar';
import { Activity, Box, Users, TrendingUp, Globe, Twitter, MessageCircle, Github, Send } from 'lucide-react';
import TokenomicsChart from '@/components/TokenomicsChart';
import TransactionHistoryChart from '@/components/TransactionHistoryChart';
import VotingPowerChart from '@/components/VotingPowerChart';
import StakingHistoryChart from '@/components/StakingHistoryChart';
import LatestBlocks from '@/components/LatestBlocks';
import LatestTransactions from '@/components/LatestTransactions';
import { getCacheKey, setCache as setCacheUtil, getStaleCache } from '@/lib/cacheUtils';
import { fetchApi } from '@/lib/api';
import { useLanguage } from '@/contexts/LanguageContext';
import { getTranslation } from '@/lib/i18n';
import { prefetchOnIdle } from '@/lib/prefetch';
import { fetchChainsWithCache } from '@/lib/chainsCache';
import { parallelFetch, cachedFetch } from '@/lib/optimizedFetch';
import { StatsSkeleton, TableSkeleton, ChartSkeleton } from '@/components/SkeletonLoader';

export default function ChainOverviewPage() {
  const params = useParams();
  const { language } = useLanguage();
  const t = (key: string) => getTranslation(language, key);
  const [chains, setChains] = useState<ChainData[]>([]);
  const [selectedChain, setSelectedChain] = useState<ChainData | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [blocks, setBlocks] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [validators, setValidators] = useState<any[]>([]);
  const [totalSupply, setTotalSupply] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [chainRegistry, setChainRegistry] = useState<any>(null);
  const [dataLoaded, setDataLoaded] = useState({
    network: false,
    blocks: false,
    validators: false,
    transactions: false
  });

  // Format large numbers with M/B/K suffix based on exponent
  const formatTokenAmount = (amount: number, includeSymbol: boolean = false) => {
    if (!selectedChain?.assets?.[0]) return amount.toLocaleString();
    
    const asset = selectedChain.assets[0];
    const exponent = parseInt(String(asset.exponent || 6));
    
    // Convert from base unit to display unit
    const displayAmount = amount / Math.pow(10, exponent);
    
    // Format with suffix
    let formatted: string;
    if (displayAmount >= 1e9) {
      formatted = `${(displayAmount / 1e9).toFixed(2)}B`;
    } else if (displayAmount >= 1e6) {
      formatted = `${(displayAmount / 1e6).toFixed(2)}M`;
    } else if (displayAmount >= 1e3) {
      formatted = `${(displayAmount / 1e3).toFixed(2)}K`;
    } else {
      formatted = displayAmount.toFixed(2);
    }
    
    return includeSymbol ? `${formatted} ${asset.symbol}` : formatted;
  };

  useEffect(() => {
    // Force clear cache for chain data
    const clearChainCache = () => {
      try {
        sessionStorage.removeItem('chains_data_v3');
        sessionStorage.removeItem('chains_version_v3');
      } catch (e) {}
    };
    
    clearChainCache();

    fetch('/api/chains', { cache: 'no-store' })
      .then(res => res.json())
      .then(data => {
        setChains(data);
        const chainName = (params?.chain as string)?.trim(); // Remove leading/trailing spaces
        const chain = chainName 
          ? data.find((c: ChainData) => 
              c.chain_name.toLowerCase().replace(/\s+/g, '-') === chainName.toLowerCase() ||
              c.chain_id?.toLowerCase().replace(/\s+/g, '-') === chainName.toLowerCase()
            )
          : data.find((c: ChainData) => c.chain_name === 'lumera-mainnet') || data[0];
        if (chain) setSelectedChain(chain);
      })
      .catch(err => console.error('Error loading chains:', err));
  }, [params]);

  // Fetch chain registry data for social links
  useEffect(() => {
    if (!selectedChain) return;
    
    const fetchChainRegistry = async () => {
      try {
        // First check if chain.json already has social links (prioritize local data)
        if (selectedChain.website || selectedChain.description || selectedChain.github || selectedChain.twitter || selectedChain.telegram) {
          console.log('Using local chain.json social links');
          setChainRegistry({
            website: selectedChain.website,
            description: selectedChain.description,
            twitter: selectedChain.twitter,
            telegram: selectedChain.telegram,
            codebase: selectedChain.github ? { git_repo: selectedChain.github } : undefined
          });
          return;
        }
        
        // Try fetching from Cosmos Chain Registry as fallback
        let registryData = null;
        const chainId = selectedChain.chain_id || selectedChain.chain_name;
        
        console.log('No local social links, fetching chain registry for:', chainId);
        
        try {
          const response = await fetch(`https://raw.githubusercontent.com/cosmos/chain-registry/master/${chainId}/chain.json`);
          if (response.ok) {
            registryData = await response.json();
            console.log('Registry data found:', registryData);
          }
        } catch (error) {
          console.log('Trying base chain ID...');
          // Try base chain ID
          const baseChainId = chainId.replace(/-\d+$/, '').replace(/-mainnet.*$/, '').replace(/-testnet.*$/, '');
          try {
            const response = await fetch(`https://raw.githubusercontent.com/cosmos/chain-registry/master/${baseChainId}/chain.json`);
            if (response.ok) {
              registryData = await response.json();
              console.log('Registry data found with base ID:', registryData);
            }
          } catch (retryError) {
            console.log('Chain registry not found for both', chainId, 'and', baseChainId);
          }
        }
        
        if (registryData) {
          setChainRegistry(registryData);
        }
      } catch (error) {
        console.error('Error fetching chain registry:', error);
      }
    };
    
    fetchChainRegistry();
  }, [selectedChain]);

  useEffect(() => {
    if (selectedChain) {
      const chainIdentifier = (selectedChain.chain_id || selectedChain.chain_name).trim();
      
      // Load all data in parallel using optimized fetch
      (async () => {
        setLoading(false); // Show skeleton immediately
        
        try {
          // Fetch all endpoints in parallel with aggressive caching
          const data = await parallelFetch<{
            network: any;
            blocks: any[];
            validators: any;
            supply: any;
            transactions: any[];
          }>({
            network: `/api/network?chain=${chainIdentifier}`,
            blocks: `/api/blocks?chain=${chainIdentifier}&limit=30`,
            validators: `/api/validators?chain=${chainIdentifier}`,
            supply: `/api/supply?chain=${chainIdentifier}`,
            transactions: `/api/transactions?chain=${chainIdentifier}&limit=20`,
          }, { staleTime: 5 * 60 * 1000 }); // 5 minute cache

          // Update state with fetched data
          if (data.network) {
            setStats({
              chainId: data.network.chainId || selectedChain.chain_name,
              latestBlock: data.network.latestBlockHeight || '0',
              blockTime: '~6s',
              peers: data.network.totalPeers || 0,
              inflation: '~7%',
              apr: '~12%'
            });
          }

          if (data.blocks && data.blocks.length > 0) {
            setBlocks(data.blocks);
          }

          if (data.validators) {
            const validatorsData = data.validators.validators || data.validators;
            setValidators(validatorsData);
            
            // Fetch mint data separately (may fail for some chains)
            try {
              const mintData = await cachedFetch<any>(
                `/api/mint?chain=${chainIdentifier}`,
                { staleTime: 10 * 60 * 1000 } // 10 minute cache
              );
              
              if (mintData && mintData.inflation) {
                const inflation = (parseFloat(mintData.inflation) * 100).toFixed(2) + '%';
                const bondedRatio = validatorsData.length > 0 ? 
                  validatorsData.reduce((sum: number, v: any) => sum + (parseFloat(v.votingPower) || 0), 0) / (totalSupply * 1000000) : 0.67;
                const apr = ((parseFloat(mintData.inflation) / Math.max(bondedRatio, 0.01)) * 100).toFixed(2) + '%';
                
                setStats((prev: any) => ({ ...prev, inflation, apr }));
              }
            } catch (err) {
              // Silent fail - keep default values
            }
          }

          if (data.supply && data.supply.totalSupply) {
            const exponent = Number(selectedChain?.assets?.[0]?.exponent || 6);
            const supply = parseFloat(data.supply.totalSupply) / Math.pow(10, exponent);
            setTotalSupply(supply);
          } else {
            setTotalSupply(1000000);
          }

          if (data.transactions && data.transactions.length > 0) {
            setTransactions(data.transactions);
          }

        } catch (err) {
          console.error('Error loading data:', err);
        }
      })();
    }
  }, [selectedChain]);

  useEffect(() => {
    if (!selectedChain) return;
    
    const chainIdentifier = (selectedChain.chain_id || selectedChain.chain_name).trim();
    
    const refreshData = async () => {
      setIsRefreshing(true);
      try {
        const [blocksData, txData] = await Promise.all([
          fetch(`/api/blocks?chain=${chainIdentifier}&limit=30`).then(r => r.json()).catch(() => []),
          fetch(`/api/transactions?chain=${chainIdentifier}&limit=10`).then(r => r.json()).catch(() => [])
        ]);
        setBlocks(Array.isArray(blocksData) ? blocksData : []);
        setTransactions(Array.isArray(txData) ? txData : []);
      } catch (err) {
        console.error('Refresh error:', err);
      } finally {
        setIsRefreshing(false);
      }
    };

    // Auto-refresh setiap 30 detik (tidak terlalu agresif)
    const interval = setInterval(refreshData, 30000);
    return () => clearInterval(interval);
  }, [selectedChain]);

  const chainPath = selectedChain?.chain_name.toLowerCase().replace(/\s+/g, '-') || '';
  const chainSymbol = selectedChain?.assets[0]?.symbol || 'TOKEN';

  return (
    <div className="flex min-h-screen bg-[#0a0a0a]">
      <Sidebar selectedChain={selectedChain} />
      
      <div className="flex-1 flex flex-col">
        <Header chains={chains} selectedChain={selectedChain} onSelectChain={setSelectedChain} />

        <main className="flex-1 mt-32 lg:mt-16 p-4 md:p-6 overflow-auto">
          
          {/* Premium Chain Header Banner */}
          <div className="mb-6">
            {chainRegistry && (chainRegistry.website || chainRegistry.description || chainRegistry.codebase?.git_repo || chainRegistry.twitter) ? (
              <div className="relative overflow-hidden bg-[#1a1a1a] border border-gray-800 rounded-xl shadow-lg">
                <div className="relative p-4 md:p-6">
                  {/* Top Section: Logo, Name & Social Links - Centered */}
                  <div className="flex flex-col items-center gap-4 mb-4">
                    {/* Logo and Name - Centered */}
                    <div className="flex flex-col items-center text-center gap-3">
                      {selectedChain && (
                        <div className="relative group">
                          <img 
                            src={selectedChain.logo} 
                            alt={selectedChain.chain_name} 
                            className="relative w-20 h-20 md:w-24 md:h-24 rounded-full border-2 border-gray-800 shadow-lg"
                          />
                        </div>
                      )}
                      <div>
                        <h1 className="text-2xl md:text-3xl font-bold text-white mb-1">
                          {selectedChain?.chain_name || t('common.loading')}
                        </h1>
                        <p className="text-gray-400 text-xs md:text-sm">{t('overview.networkOverview')}</p>
                      </div>
                    </div>
                    
                    {/* Social Links - Centered */}
                    <div className="flex flex-wrap items-center justify-center gap-2">
                      {chainRegistry.website && (
                        <a
                          href={chainRegistry.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group inline-flex items-center gap-2 px-4 h-9 bg-[#0f0f0f] hover:bg-gray-800 border border-gray-800 hover:border-gray-700 rounded-lg transition-all duration-200 text-xs font-medium"
                        >
                          <Globe className="w-3.5 h-3.5 text-gray-400 group-hover:text-white transition-colors flex-shrink-0" />
                          <span className="text-gray-300 group-hover:text-white transition-colors whitespace-nowrap">Website</span>
                        </a>
                      )}
                      
                      {chainRegistry.codebase?.git_repo && (
                        <a
                          href={chainRegistry.codebase.git_repo}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group inline-flex items-center gap-2 px-4 h-9 bg-[#0f0f0f] hover:bg-gray-800 border border-gray-800 hover:border-gray-700 rounded-lg transition-all duration-200 text-xs font-medium"
                        >
                          <Github className="w-3.5 h-3.5 text-gray-400 group-hover:text-white transition-colors flex-shrink-0" />
                          <span className="text-gray-300 group-hover:text-white transition-colors whitespace-nowrap">GitHub</span>
                        </a>
                      )}
                      
                      {chainRegistry.twitter && (
                        <a
                          href={chainRegistry.twitter}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group inline-flex items-center gap-2 px-4 h-9 bg-[#0f0f0f] hover:bg-gray-800 border border-gray-800 hover:border-gray-700 rounded-lg transition-all duration-200 text-xs font-medium"
                        >
                          <svg 
                            className="w-3.5 h-3.5 text-gray-400 group-hover:text-white transition-colors flex-shrink-0" 
                            fill="currentColor" 
                            viewBox="0 0 24 24"
                          >
                            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                          </svg>
                          <span className="text-gray-300 group-hover:text-white transition-colors whitespace-nowrap">X (Twitter)</span>
                        </a>
                      )}
                      
                      {chainRegistry.telegram && (
                        <a
                          href={chainRegistry.telegram}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group inline-flex items-center gap-2 px-4 h-9 bg-[#0f0f0f] hover:bg-gray-800 border border-gray-800 hover:border-gray-700 rounded-lg transition-all duration-200 text-xs font-medium"
                        >
                          <Send className="w-3.5 h-3.5 text-gray-400 group-hover:text-white transition-colors flex-shrink-0" />
                          <span className="text-gray-300 group-hover:text-white transition-colors whitespace-nowrap">Telegram</span>
                        </a>
                      )}
                      
                      {/* Live indicator - inline with social links */}
                      <div className="inline-flex items-center gap-2 px-3 h-9 bg-[#0a0a0a] border border-gray-800 rounded-full">
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isRefreshing ? 'bg-blue-500 animate-pulse' : 'bg-green-500'}`}></div>
                        <span className="text-xs text-gray-300 font-medium whitespace-nowrap">
                          {isRefreshing ? t('overview.updating') : t('overview.live')}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Description - Centered */}
                  {chainRegistry.description && (
                    <div className="p-3 bg-[#0f0f0f] rounded-lg border border-gray-800 text-center">
                      <p className="text-gray-300 text-xs md:text-sm leading-relaxed">{chainRegistry.description}</p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              // Fallback if no social links
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                <div className="flex items-center gap-4">
                  {selectedChain && (
                    <img 
                      src={selectedChain.logo} 
                      alt={selectedChain.chain_name} 
                      className="w-12 h-12 md:w-16 md:h-16 rounded-full"
                    />
                  )}
                  <div>
                    <h1 className="text-3xl font-bold text-white mb-1">
                      {selectedChain?.chain_name || t('common.loading')}
                    </h1>
                    <p className="text-gray-400">{t('overview.networkOverview')}</p>
                  </div>
                </div>
                
                {/* Live indicator */}
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${isRefreshing ? 'bg-blue-500 animate-pulse' : 'bg-green-500'}`}></div>
                  <span className="text-xs text-gray-400">
                    {isRefreshing ? t('overview.updating') : t('overview.live')}
                  </span>
                </div>
              </div>
            )}
          </div>

          {loading ? (
            <>
              {/* Stats Skeleton */}
              <StatsSkeleton />
              
              {/* Charts Skeleton */}
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 md:gap-6 mb-6 mt-6">
                <div className="lg:col-span-2">
                  <ChartSkeleton />
                </div>
                <ChartSkeleton />
                <ChartSkeleton />
                <ChartSkeleton />
              </div>
              
              {/* Tables Skeleton */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 md:gap-6">
                <div>
                  <div className="h-6 bg-gray-700 rounded w-32 mb-4"></div>
                  <TableSkeleton rows={10} />
                </div>
                <div>
                  <div className="h-6 bg-gray-700 rounded w-32 mb-4"></div>
                  <TableSkeleton rows={10} />
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Stats Grid - 5 columns */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4 mb-6">
                <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-4 md:p-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-400 text-xs md:text-sm">{t('overview.chainId')}</span>
                    <Activity className="w-4 h-4 md:w-5 md:h-5 text-blue-500" />
                  </div>
                  <p className="text-lg md:text-2xl font-bold text-white truncate">
                    {stats?.chainId || selectedChain?.chain_name || t('common.loading')}
                  </p>
                </div>

                <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-4 md:p-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-400 text-xs md:text-sm">{t('overview.latestBlock')}</span>
                    <Box className="w-4 h-4 md:w-5 md:h-5 text-blue-500" />
                  </div>
                  <p className="text-lg md:text-2xl font-bold text-white">
                    #{stats?.latestBlock && stats.latestBlock !== '0' 
                      ? parseInt(stats.latestBlock).toLocaleString() 
                      : blocks && blocks.length > 0 
                      ? parseInt(blocks[0].height).toLocaleString()
                      : t('common.loading')}
                  </p>
                </div>

                <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-4 md:p-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-400 text-xs md:text-sm">{t('overview.blockTime')}</span>
                    <TrendingUp className="w-4 h-4 md:w-5 md:h-5 text-blue-500" />
                  </div>
                  <p className="text-lg md:text-2xl font-bold text-white">{stats?.blockTime || '~6s'}</p>
                </div>

                <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-4 md:p-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-400 text-xs md:text-sm">APR</span>
                    <TrendingUp className="w-4 h-4 md:w-5 md:h-5 text-green-500" />
                  </div>
                  <p className="text-lg md:text-2xl font-bold text-green-400">
                    {stats?.apr || '~12%'}
                  </p>
                </div>

                <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-4 md:p-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-400 text-xs md:text-sm">Inflation</span>
                    <Activity className="w-4 h-4 md:w-5 md:h-5 text-orange-500" />
                  </div>
                  <p className="text-lg md:text-2xl font-bold text-orange-400">
                    {stats?.inflation || '~7%'}
                  </p>
                </div>
              </div>

              {/* Charts Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 md:gap-6 mb-6">
                {/* Transaction History - 2 columns */}
                <div className="lg:col-span-2 h-full">
                  <TransactionHistoryChart 
                    data={blocks && blocks.length > 0 
                      ? blocks.map((block: any) => ({
                          date: block.time ? new Date(block.time).toISOString() : new Date().toISOString(),
                          count: parseInt(block.txs || '0', 10)
                        }))
                      : undefined
                    }
                  />
                </div>
                
                {/* Bonded / Supply */}
                <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-6">
                  <h3 className="text-lg font-bold text-white mb-4">Bonded / Supply</h3>
                  
                  {/* Donut Chart */}
                  <div className="flex items-center justify-center mb-4">
                    <div className="relative w-40 h-40">
                      <svg viewBox="0 0 100 100" className="transform -rotate-90">
                        {(() => {
                          const exponent = Number(selectedChain?.assets?.[0]?.exponent || 6);
                          const divisor = Math.pow(10, exponent);
                          
                          // totalSupply sudah dalam display unit, votingPower dalam base unit
                          const bonded = validators && validators.length > 0 
                            ? validators.reduce((sum: number, v: any) => sum + (parseFloat(v.votingPower) || 0), 0) / divisor
                            : 0;
                          const supply = totalSupply > 0 ? totalSupply : 1000000;
                          const bondedPercentage = supply > 0 ? (bonded / supply) * 100 : 0;
                          const unbondedPercentage = 100 - bondedPercentage;
                          
                          const radius = 35;
                          const circumference = 2 * Math.PI * radius;
                          const bondedLength = (bondedPercentage / 100) * circumference;
                          const unbondedLength = (unbondedPercentage / 100) * circumference;
                          
                          return (
                            <>
                              {/* Background circle */}
                              <circle
                                cx="50"
                                cy="50"
                                r={radius}
                                fill="none"
                                stroke="#1a1a1a"
                                strokeWidth="12"
                              />
                              {/* Unbonded segment (gray) */}
                              <circle
                                cx="50"
                                cy="50"
                                r={radius}
                                fill="none"
                                stroke="#4b5563"
                                strokeWidth="12"
                                strokeDasharray={`${unbondedLength} ${circumference}`}
                                strokeDashoffset={-bondedLength}
                                strokeLinecap="round"
                              />
                              {/* Bonded segment (gradient blue-purple-pink) */}
                              <circle
                                cx="50"
                                cy="50"
                                r={radius}
                                fill="none"
                                stroke="url(#bondedGradient)"
                                strokeWidth="12"
                                strokeDasharray={`${bondedLength} ${circumference}`}
                                strokeLinecap="round"
                              />
                              <defs>
                                <linearGradient id="bondedGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                                  <stop offset="0%" stopColor="#3b82f6" />
                                  <stop offset="50%" stopColor="#8b5cf6" />
                                  <stop offset="100%" stopColor="#ec4899" />
                                </linearGradient>
                              </defs>
                            </>
                          );
                        })()}
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-center">
                          <p className="text-2xl font-bold text-white">
                            {(() => {
                              if (validators && validators.length > 0 && totalSupply > 0) {
                                const exponent = Number(selectedChain?.assets?.[0]?.exponent || 6);
                                const divisor = Math.pow(10, exponent);
                                const bonded = validators.reduce((sum: number, v: any) => sum + (parseFloat(v.votingPower) || 0), 0) / divisor;
                                return ((bonded / totalSupply) * 100).toFixed(1);
                              }
                              return "0";
                            })()}%
                          </p>
                          <p className="text-xs text-gray-400">Bonded</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Legend */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-2 bg-[#0f0f0f] rounded">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500"></div>
                        <span className="text-sm text-gray-400">Bonded</span>
                      </div>
                      <span className="text-sm font-bold text-white">
                        {validators && validators.length > 0
                          ? formatTokenAmount(validators.reduce((sum: number, v: any) => sum + (parseFloat(v.votingPower) || 0), 0), true)
                          : "0"
                        }
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-2 bg-[#0f0f0f] rounded">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-gray-600"></div>
                        <span className="text-sm text-gray-400">Unbonded</span>
                      </div>
                      <span className="text-sm font-bold text-white">
                        {(() => {
                          if (validators && validators.length > 0 && totalSupply > 0) {
                            const exponent = Number(selectedChain?.assets?.[0]?.exponent || 6);
                            const divisor = Math.pow(10, exponent);
                            // totalSupply sudah dalam display unit, votingPower dalam base unit
                            const totalBonded = validators.reduce((sum: number, v: any) => sum + (parseFloat(v.votingPower) || 0), 0) / divisor;
                            const unbonded = totalSupply - totalBonded;
                            // unbonded sudah dalam display unit, perlu convert ke base unit untuk formatTokenAmount
                            return formatTokenAmount(unbonded * divisor, true);
                          }
                          const exponent = Number(selectedChain?.assets?.[0]?.exponent || 6);
                          return formatTokenAmount(totalSupply * Math.pow(10, exponent), true);
                        })()}
                      </span>
                    </div>
                    <div className="pt-2 border-t border-gray-800">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-gray-400">Total Supply</span>
                        <span className="text-base font-bold text-white">
                          {(() => {
                            if (totalSupply > 0) {
                              const exponent = Number(selectedChain?.assets?.[0]?.exponent || 6);
                              return formatTokenAmount(totalSupply * Math.pow(10, exponent), true);
                            }
                            return "1M";
                          })()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Voting Power Distribution */}
                <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-6">
                  <h3 className="text-lg font-bold text-white mb-4">Voting Power</h3>
                  
                  {/* Smaller Donut Chart */}
                  <div className="flex items-center justify-center mb-4">
                    <div className="relative w-40 h-40">
                      <svg viewBox="0 0 100 100" className="transform -rotate-90">
                        {(() => {
                          const validatorData = validators && validators.length > 0 
                            ? (() => {
                                // Filter only active validators
                                const activeValidators = validators.filter((v: any) => v.status === 'active' || v.status === 'BOND_STATUS_BONDED');
                                
                                const totalVP = activeValidators.reduce((sum: number, val: any) => sum + (parseFloat(val.votingPower) || 0), 0);
                                const sorted = activeValidators
                                  .map((v: any) => {
                                    const vp = parseFloat(v.votingPower) || 0;
                                    return {
                                      name: v.moniker || v.address?.substring(0, 10) || 'Unknown',
                                      votingPower: vp / 1000000,
                                      percentage: totalVP > 0 ? (vp / totalVP) * 100 : 0,
                                      rawVotingPower: vp
                                    };
                                  })
                                  .sort((a, b) => b.rawVotingPower - a.rawVotingPower);
                                
                                const top10 = sorted.slice(0, 10);
                                const others = sorted.slice(10);
                                
                                if (others.length > 0) {
                                  const othersVP = others.reduce((sum, v) => sum + v.votingPower, 0);
                                  const othersPercentage = others.reduce((sum, v) => sum + v.percentage, 0);
                                  top10.push({
                                    name: 'Others',
                                    votingPower: othersVP,
                                    percentage: othersPercentage,
                                    rawVotingPower: othersVP * 1000000
                                  });
                                }
                                
                                return top10;
                              })()
                            : [];

                          // Bold gradient colors with strong contrast
                          const colors = [
                            '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7',
                            '#c026d3', '#d946ef', '#ec4899', '#f43f5e',
                            '#f97316', '#eab308', '#10b981', '#06b6d4'
                          ];

                          const radius = 35;
                          const circumference = 2 * Math.PI * radius;
                          let currentOffset = 0;

                          return (
                            <>
                              <circle
                                cx="50"
                                cy="50"
                                r={radius}
                                fill="none"
                                stroke="#0a0a0a"
                                strokeWidth="14"
                              />
                              {validatorData.map((validator, index) => {
                                const segmentLength = (validator.percentage / 100) * circumference;
                                const segment = (
                                  <circle
                                    key={index}
                                    cx="50"
                                    cy="50"
                                    r={radius}
                                    fill="none"
                                    stroke={colors[index % colors.length]}
                                    strokeWidth="14"
                                    strokeDasharray={`${segmentLength} ${circumference}`}
                                    strokeDashoffset={-currentOffset}
                                    strokeLinecap="butt"
                                    opacity="1"
                                  />
                                );
                                currentOffset += segmentLength;
                                return segment;
                              })}
                            </>
                          );
                        })()}
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-center">
                          <p className="text-xl font-bold text-white">
                            {validators ? validators.filter((v: any) => v.status === 'active' || v.status === 'BOND_STATUS_BONDED').length : 0}
                          </p>
                          <p className="text-xs text-gray-400">Active</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Top Validators List */}
                  <div className="space-y-1.5 max-h-[180px] overflow-y-auto">
                    {validators && validators.length > 0 
                      ? (() => {
                          // Filter only active validators
                          const activeValidators = validators.filter((v: any) => v.status === 'active' || v.status === 'BOND_STATUS_BONDED');
                          const totalVP = activeValidators.reduce((sum: number, val: any) => sum + (parseFloat(val.votingPower) || 0), 0);
                          const sorted = activeValidators
                            .map((v: any) => {
                              const vp = parseFloat(v.votingPower) || 0;
                              return {
                                name: v.moniker || v.address?.substring(0, 10) || 'Unknown',
                                percentage: totalVP > 0 ? (vp / totalVP) * 100 : 0,
                              };
                            })
                            .sort((a, b) => b.percentage - a.percentage)
                            .slice(0, 5);
                          
                          const colors = ['#3b82f6', '#8b5cf6', '#d946ef', '#ec4899', '#f97316'];
                          
                          return sorted.map((val, idx) => (
                            <div key={idx} className="flex items-center justify-between p-1.5 bg-[#0f0f0f] rounded text-xs">
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{backgroundColor: colors[idx]}}></div>
                                <span className="text-gray-400 truncate">{val.name}</span>
                              </div>
                              <span className="font-bold text-white ml-2 flex-shrink-0">{val.percentage.toFixed(1)}%</span>
                            </div>
                          ));
                        })()
                      : <p className="text-sm text-gray-400 text-center">No data</p>
                    }
                  </div>
                </div>
                
                {/* Block Production */}
                <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-6">
                  <h3 className="text-lg font-bold text-white mb-4">Block Production</h3>
                  
                  {/* Animated Block Proposer Avatar */}
                  <div className="flex flex-col items-center justify-center py-6">
                    {blocks && blocks.length > 0 ? (() => {
                      const latestBlock = blocks[0];
                      // Use validator data from block if available, otherwise find from validators array
                      const moniker = latestBlock.validator?.moniker || 
                                     validators.find((v: any) => 
                                       v.address === latestBlock.proposerAddress || 
                                       v.operatorAddress === latestBlock.proposerAddress
                                     )?.moniker || 
                                     latestBlock.proposerAddress?.substring(0, 12) || 
                                     'Unknown';
                      const identity = latestBlock.validator?.identity || 
                                      validators.find((v: any) => 
                                        v.address === latestBlock.proposerAddress || 
                                        v.operatorAddress === latestBlock.proposerAddress
                                      )?.identity;
                      
                      return (
                        <>
                          {/* Large Animated Avatar with pulse rings */}
                          <div className="relative mb-4" key={latestBlock.height}>
                            {/* Outer pulse ring */}
                            <div className="absolute inset-0 w-32 h-32 rounded-full bg-blue-500 animate-ping opacity-10" />
                            <div className="absolute inset-0 w-32 h-32 rounded-full bg-blue-500 animate-pulse opacity-20" style={{ animationDuration: '2s' }} />
                            
                            {/* Avatar - custom size 128px */}
                            <div className="relative animate-scale-in">
                              <ValidatorAvatar 
                                identity={identity}
                                moniker={moniker}
                                size="2xl"
                              />
                            </div>
                          </div>

                          {/* Validator Info */}
                          <h4 className="text-xl font-bold text-white mb-1 text-center animate-fade-in" key={`${latestBlock.height}-name`}>
                            {moniker}
                          </h4>
                          <p className="text-sm text-gray-400 mb-4">Latest Block Proposer</p>

                          {/* Block Info Badge */}
                          <div className="flex items-center gap-2 mb-4">
                            <div className="px-3 py-1.5 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                              <span className="text-xs text-gray-400">Block </span>
                              <span className="text-sm font-bold text-blue-400">
                                #{parseInt(latestBlock.height).toLocaleString()}
                              </span>
                            </div>
                            <div className="px-3 py-1.5 bg-green-500/10 border border-green-500/30 rounded-lg">
                              <span className="text-sm font-bold text-green-400">
                                {latestBlock.txs || 0} tx
                              </span>
                            </div>
                          </div>
                        </>
                      );
                    })() : (
                      <div className="text-center py-8">
                        <div className="w-32 h-32 rounded-full bg-gray-800 animate-pulse mx-auto mb-4"></div>
                        <p className="text-sm text-gray-400">Loading...</p>
                      </div>
                    )}
                  </div>

                  {/* Stats Summary */}
                  <div className="grid grid-cols-2 gap-2 pt-4 border-t border-gray-800">
                    <div className="text-center p-2 bg-[#0f0f0f] rounded">
                      <p className="text-xs text-gray-400">Blocks (24h)</p>
                      <p className="text-lg font-bold text-green-400">
                        {(() => {
                          if (stats?.blockTime) {
                            const blockTimeStr = stats.blockTime.replace('~', '').replace('s', '');
                            const blockTimeSeconds = parseFloat(blockTimeStr);
                            if (!isNaN(blockTimeSeconds) && blockTimeSeconds > 0) {
                              const blocksPerDay = Math.floor((24 * 60 * 60) / blockTimeSeconds);
                              return blocksPerDay.toLocaleString();
                            }
                          }
                          return '~14.4K';
                        })()}
                      </p>
                    </div>
                    <div className="text-center p-2 bg-[#0f0f0f] rounded">
                      <p className="text-xs text-gray-400">Block Time</p>
                      <p className="text-lg font-bold text-purple-400">
                        {stats?.blockTime || '~6s'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              {/* Latest Blocks & Transactions */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 md:gap-6">
                <LatestBlocks blocks={Array.isArray(blocks) ? blocks.slice(0, 10) : []} chainName={selectedChain?.chain_name || ''} />
                <LatestTransactions transactions={Array.isArray(transactions) ? transactions.slice(0, 10) : []} chainName={selectedChain?.chain_name || ''} asset={selectedChain?.assets[0]} />
              </div>
            </>
          )}
        </main>
        <Footer />
      </div>
    </div>
  );
}

