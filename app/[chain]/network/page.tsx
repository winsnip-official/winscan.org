'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { ChainData } from '@/types/chain';
import { Activity, Globe, Server, Zap, Database, Clock, TrendingUp, CheckCircle, AlertCircle, Map } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { getTranslation } from '@/lib/i18n';

const ValidatorWorldMap = dynamic(() => import('@/components/ValidatorWorldMap'), { 
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-[500px] bg-[#0f0f0f]">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400"></div>
    </div>
  )
});

// Chart colors for donut charts
const CHART_COLORS = [
  '#06b6d4', // cyan-500
  '#3b82f6', // blue-500
  '#8b5cf6', // violet-500
  '#ec4899', // pink-500
  '#f59e0b', // amber-500
  '#10b981', // emerald-500
  '#f97316', // orange-500
  '#6366f1', // indigo-500
  '#14b8a6', // teal-500
  '#a855f7', // purple-500
];

interface ValidatorLocation {
  city: string;
  country: string;
  coordinates: [number, number];
  count: number;
  provider?: string;
  monikers?: string[];
}

interface ValidatorData {
  moniker: string;
  operator_address: string;
  consensus_address: string;
  jailed: boolean;
  status: string;
  tokens: string;
  delegator_shares: string;
  commission: {
    commission_rates: {
      rate: string;
      max_rate: string;
      max_change_rate: string;
    };
  };
  voting_power: number;
}

interface NetworkInfo {
  chainId: string;
  latestBlockHeight: string;
  latestBlockTime: string;
  earliestBlockHeight: string;
  earliestBlockTime: string;
  catchingUp: boolean;
  nodeInfo: {
    protocolVersion: string;
    network: string;
    version: string;
    moniker: string;
  };
  totalPeers: number;
  inboundPeers: number;
  outboundPeers: number;
}

export default function NetworkPage() {
  const params = useParams();
  const { language } = useLanguage();
  const t = (key: string) => getTranslation(language, key);
  const [chains, setChains] = useState<ChainData[]>([]);
  const [selectedChain, setSelectedChain] = useState<ChainData | null>(null);
  const [networkInfo, setNetworkInfo] = useState<NetworkInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [avgBlockTime, setAvgBlockTime] = useState<number>(0);
  const [validatorLocations, setValidatorLocations] = useState<ValidatorLocation[]>([]);
  const [validators, setValidators] = useState<ValidatorData[]>([]);
  const [loadingLocations, setLoadingLocations] = useState(false);
  const [loadingValidators, setLoadingValidators] = useState(false);

  useEffect(() => {

    const cachedChains = sessionStorage.getItem('chains');
    
    if (cachedChains) {
      const data = JSON.parse(cachedChains);
      setChains(data);
      const chainName = params?.chain as string;
      const chain = chainName 
        ? data.find((c: ChainData) => c.chain_name.toLowerCase().replace(/\s+/g, '-') === chainName.toLowerCase())
        : data.find((c: ChainData) => c.chain_name === 'lumera-mainnet') || data[0];
      if (chain) setSelectedChain(chain);
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
          if (chain) setSelectedChain(chain);
        });
    }
  }, [params]);

  useEffect(() => {
    if (!selectedChain) return;
    
    // Use chain_name for API calls (backend expects chain_name, not chain_id)
    const chainIdentifier = selectedChain.chain_name.trim();
    const networkCacheKey = `network_v2_${selectedChain.chain_name}`;
    const locationsCacheKey = `network_locations_v2_${selectedChain.chain_name}`;
    const validatorCacheKey = `validators_${chainIdentifier}`;
    const cacheTimeout = 5 * 60 * 1000; // 5 minutes

    // 🚀 OPTIMISTIC UI: Load all cache immediately
    let hasCache = false;
    
    try {
      // Network info cache
      const cachedNetwork = sessionStorage.getItem(networkCacheKey);
      if (cachedNetwork) {
        const { data, timestamp } = JSON.parse(cachedNetwork);
        const age = Date.now() - timestamp;
        
        if (age < cacheTimeout) {
          setNetworkInfo(data);
          setLoading(false);
          hasCache = true;
          
          // Calculate avg block time from cache
          if (data?.latestBlockTime && data?.earliestBlockTime) {
            const latest = new Date(data.latestBlockTime).getTime();
            const earliest = new Date(data.earliestBlockTime).getTime();
            const blocks = parseInt(data.latestBlockHeight) - parseInt(data.earliestBlockHeight);
            if (blocks > 0) {
              const avgTime = (latest - earliest) / blocks / 1000;
              setAvgBlockTime(avgTime);
            }
          }
        }
      }
      
      // Validator locations cache
      const cachedLocations = sessionStorage.getItem(locationsCacheKey);
      if (cachedLocations) {
        const { data, timestamp } = JSON.parse(cachedLocations);
        const age = Date.now() - timestamp;
        
        if (age < cacheTimeout) {
          setValidatorLocations(data);
          setLoadingLocations(false);
          hasCache = true;
        }
      }
      
      // Validators cache (localStorage, 10 minutes)
      const cachedValidators = localStorage.getItem(validatorCacheKey);
      if (cachedValidators) {
        const { data: validatorData, timestamp } = JSON.parse(cachedValidators);
        const age = Date.now() - timestamp;
        
        if (age < 10 * 60 * 1000) {
          setValidators(validatorData);
          setLoadingValidators(false);
          hasCache = true;
          console.log('[Network] Using cached validators:', validatorData.length);
        }
      }
      
      // If all cache is fresh, skip fetch
      if (hasCache && networkInfo && validatorLocations.length > 0 && validators.length > 0) {
        console.log('[Network] All data cached, skipping fetch');
        return;
      }
    } catch (e) {
      console.warn('[Network] Cache read error:', e);
    }

    // 🚀 PARALLEL FETCH: Fetch all 3 APIs simultaneously
    setLoadingLocations(true);
    setLoadingValidators(true);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    Promise.all([

      fetch(`/api/network?chain=${chainIdentifier}`, { signal: controller.signal })
        .then(res => res.json())
        .catch(err => {
          console.error('[Network] Network API error:', err);
          return null;
        }),

      fetch(`/api/network/peers?chain=${chainIdentifier}`, { signal: controller.signal })
        .then(res => res.json())
        .catch(err => {
          console.error('[Network] Peers API error:', err);
          return null;
        }),

      validators.length === 0
        ? fetch(`/api/validators?chain=${chainIdentifier}`, { signal: controller.signal })
            .then(res => res.json())
            .catch(err => {
              console.error('[Network] Validators API error:', err);
              return null;
            })
        : Promise.resolve(null)
    ])
    .then(([networkData, locationsData, validatorsData]) => {
      // Process network info
      if (networkData) {
        setNetworkInfo(networkData);
        setLoading(false);
        
        // Calculate avg block time
        if (networkData?.latestBlockTime && networkData?.earliestBlockTime) {
          const latest = new Date(networkData.latestBlockTime).getTime();
          const earliest = new Date(networkData.earliestBlockTime).getTime();
          const blocks = parseInt(networkData.latestBlockHeight) - parseInt(networkData.earliestBlockHeight);
          if (blocks > 0) {
            const avgTime = (latest - earliest) / blocks / 1000;
            setAvgBlockTime(avgTime);
          }
        }
        
        // Cache network info (5 minutes)
        try {
          sessionStorage.setItem(networkCacheKey, JSON.stringify({ 
            data: networkData, 
            timestamp: Date.now() 
          }));
        } catch (e) {}
      }
      
      // Process validator locations
      if (locationsData?.success && locationsData.locations && locationsData.locations.length > 0) {
        setValidatorLocations(locationsData.locations);
        setLoadingLocations(false);
        
        // Cache locations (5 minutes)
        try {
          sessionStorage.setItem(locationsCacheKey, JSON.stringify({ 
            data: locationsData.locations, 
            timestamp: Date.now() 
          }));
        } catch (e) {}
        console.log('[Network] ✅ Loaded', locationsData.locations.length, 'validator locations for', chainIdentifier);
      } else {
        // No locations data - chain might not be supported
        setValidatorLocations([]);
        setLoadingLocations(false);
        console.warn('[Network] ⚠️ No validator locations for', chainIdentifier, '- Response:', locationsData);
      }
      
      // Process validators
      if (validatorsData) {
        const validatorsArray = validatorsData.validators || validatorsData;
        
        if (Array.isArray(validatorsArray) && validatorsArray.length > 0) {
          setValidators(validatorsArray);
          setLoadingValidators(false);
          
          // Cache validators (10 minutes)
          try {
            localStorage.setItem(validatorCacheKey, JSON.stringify({
              data: validatorsArray,
              timestamp: Date.now()
            }));
          } catch (e) {}
          
          console.log('[Network] Validators loaded:', validatorsArray.length);
        }
      } else {
        setLoadingValidators(false);
      }
    })
    .catch(err => {
      console.error('[Network] Parallel fetch error:', err);
      setLoading(false);
      setLoadingLocations(false);
      setLoadingValidators(false);
    })
    .finally(() => clearTimeout(timeoutId));
  }, [selectedChain]);

  // Calculate statistics
  const stats = useMemo(() => {
    if (loadingLocations || loadingValidators || validatorLocations.length === 0) return null;
    
    const totalNodes = validatorLocations.reduce((sum, loc) => sum + loc.count, 0);
    const totalLocations = validatorLocations.length;
    const totalCountries = new Set(validatorLocations.map(loc => loc.country)).size;
    const totalProviders = new Set(validatorLocations.filter(loc => loc.provider && loc.provider !== 'Unknown').map(loc => loc.provider)).size;
    
    // Calculate real bond data from validators
    const activeValidators = validators.filter(v => v.status === 'BOND_STATUS_BONDED');
    const totalValidators = validators.length;
    const activeBond = activeValidators.reduce((sum, v) => sum + parseFloat(v.tokens || '0'), 0);
    const totalBond = validators.reduce((sum, v) => sum + parseFloat(v.tokens || '0'), 0);
    
    // Get min, median, max bonds
    const sortedBonds = activeValidators.map(v => parseFloat(v.tokens || '0')).sort((a, b) => a - b);
    const minBond = sortedBonds.length > 0 ? sortedBonds[0] : 0;
    const medianBond = sortedBonds.length > 0 ? sortedBonds[Math.floor(sortedBonds.length / 2)] : 0;
    const maxBond = sortedBonds.length > 0 ? sortedBonds[sortedBonds.length - 1] : 0;
    
    // Provider distribution
    const providerMap = validatorLocations.reduce((acc, loc) => {
      const provider = loc.provider && loc.provider !== 'Unknown' ? loc.provider : 'Others';
      acc[provider] = (acc[provider] || 0) + loc.count;
      return acc;
    }, {} as Record<string, number>);
    
    // Country distribution
    const countryMap = validatorLocations.reduce((acc, loc) => {
      acc[loc.country] = (acc[loc.country] || 0) + loc.count;
      return acc;
    }, {} as Record<string, number>);
    
    return {
      totalNodes,
      totalLocations,
      totalCountries,
      totalProviders,
      providerMap,
      countryMap,
      activeNodes: activeValidators.length,
      totalValidators,
      activeBond,
      totalBond,
      minBond,
      medianBond,
      maxBond
    };
  }, [validatorLocations, validators, loadingLocations, loadingValidators]);

  // Get chain denom
  const chainDenom = useMemo(() => {
    if (!selectedChain) return 'TOKEN';
    const asset = selectedChain.assets && selectedChain.assets.length > 0 ? selectedChain.assets[0] : null;
    if (asset?.symbol) {
      return asset.symbol.toUpperCase();
    }
    return selectedChain.chain_name.split('-')[0].toUpperCase();
  }, [selectedChain]);

  // Format bond amount
  const formatBond = (amount: number) => {
    if (!selectedChain?.assets?.[0]) return amount.toFixed(1);
    const exponent = typeof selectedChain.assets[0].exponent === 'number' 
      ? selectedChain.assets[0].exponent 
      : parseInt(selectedChain.assets[0].exponent || '6');
    const divisor = Math.pow(10, exponent);
    const value = amount / divisor;
    
    if (value >= 1000000) {
      return (value / 1000000).toFixed(1) + 'M';
    } else if (value >= 1000) {
      return (value / 1000).toFixed(1) + 'K';
    }
    return value.toFixed(1);
  };

  const chainPath = selectedChain?.chain_name.toLowerCase().replace(/\s+/g, '-') || '';

  // Colors for charts
  const CHART_COLORS = [
    '#3b82f6', // blue
    '#10b981', // green
    '#f59e0b', // yellow
    '#ef4444', // red
    '#8b5cf6', // purple
    '#ec4899', // pink
    '#06b6d4', // cyan
    '#f97316', // orange
  ];

  return (
    <div className="flex min-h-screen bg-black">
      <Sidebar selectedChain={selectedChain} />
      
      <div className="flex-1 flex flex-col">
        <Header chains={chains} selectedChain={selectedChain} onSelectChain={setSelectedChain} />

        <main className="flex-1 mt-32 md:mt-16 p-3 md:p-6 overflow-auto bg-black">
          {/* Header - Simple like THORChain */}
          <div className="mb-6">
            <h1 className="text-xl font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse"></div>
              {selectedChain?.chain_name.toUpperCase()} nodes
            </h1>
          </div>

          {loadingLocations || loadingValidators ? (
            <div className="space-y-4">
              {/* Loading skeleton */}
              <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-6 h-[500px] flex items-center justify-center">
                <div className="text-center">
                  <div className="relative w-20 h-20 mx-auto mb-4">
                    <div className="absolute inset-0 border-4 border-cyan-500/20 rounded-full"></div>
                    <div className="absolute inset-0 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                  <p className="text-gray-400">Loading network data...</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-6 h-32 animate-pulse"></div>
                <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-6 h-32 animate-pulse"></div>
              </div>
            </div>
          ) : validatorLocations.length > 0 && stats ? (
            <>
              {/* World Map Section - Like THORChain */}
              <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg mb-4 overflow-hidden">
                <ValidatorWorldMap locations={validatorLocations} />
              </div>

              {/* Statistics Grid - Like THORChain */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-4 text-center">
                  <p className="text-gray-400 text-sm mb-2">Active nodes</p>
                  <p className="text-cyan-400 text-4xl font-bold">{stats.activeNodes || stats.totalNodes}</p>
                </div>
                <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-4 text-center">
                  <p className="text-gray-400 text-sm mb-2">Total nodes</p>
                  <p className="text-cyan-400 text-4xl font-bold">{stats.totalValidators || stats.totalNodes}</p>
                </div>
              </div>

              {/* Charts Section - Like THORChain */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mb-6">
                {/* Cloud Donut Chart */}
                <div className="lg:col-span-3 bg-[#1a1a1a] border border-gray-800 rounded-lg p-6">
                  <h3 className="text-white font-bold mb-6 text-center text-lg">Cloud</h3>
                  <div className="relative w-44 h-44 mx-auto mb-6">
                    <svg viewBox="0 0 200 200" className="w-full h-full -rotate-90">
                      {Object.entries(stats.providerMap).map(([provider, count], index, arr) => {
                        const total = Object.values(stats.providerMap).reduce((a, b) => a + b, 0);
                        const percentage = (count / total) * 100;
                        const angle = (percentage / 100) * 360;
                        const prevAngles = arr.slice(0, index).reduce((sum, [, c]) => sum + ((c / total) * 360), 0);
                        const startAngle = prevAngles;
                        const endAngle = prevAngles + angle;
                        
                        const startRad = (startAngle - 90) * (Math.PI / 180);
                        const endRad = (endAngle - 90) * (Math.PI / 180);
                        
                        const x1 = 100 + 85 * Math.cos(startRad);
                        const y1 = 100 + 85 * Math.sin(startRad);
                        const x2 = 100 + 85 * Math.cos(endRad);
                        const y2 = 100 + 85 * Math.sin(endRad);
                        
                        const largeArc = angle > 180 ? 1 : 0;
                        
                        return (
                          <path
                            key={provider}
                            d={`M 100 100 L ${x1} ${y1} A 85 85 0 ${largeArc} 1 ${x2} ${y2} Z`}
                            fill={CHART_COLORS[index % CHART_COLORS.length]}
                            className="hover:opacity-80 transition-opacity cursor-pointer"
                          />
                        );
                      })}
                      <circle cx="100" cy="100" r="60" fill="#1e2838" />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center flex-col">
                      <p className="text-white text-5xl font-bold">{Object.keys(stats.providerMap).length}</p>
                    </div>
                  </div>
                  <div className="space-y-3 text-xs">
                    {Object.entries(stats.providerMap)
                      .sort(([, a], [, b]) => b - a)
                      .map(([provider, count], index) => {
                        const total = Object.values(stats.providerMap).reduce((a, b) => a + b, 0);
                        const percentage = ((count / total) * 100).toFixed(1);
                        return (
                          <div key={provider} className="flex items-center gap-2">
                            <div 
                              className="w-3 h-3 rounded-sm flex-shrink-0"
                              style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                            ></div>
                            <span className="text-cyan-300 flex-1 truncate uppercase font-medium">{provider}</span>
                            <span className="text-gray-400">{percentage}%</span>
                          </div>
                        );
                      })}
                  </div>
                </div>

                {/* Network Speed - All Nodes */}
                <div className="lg:col-span-6 bg-[#1a1a1a] border border-gray-800 rounded-lg p-6">
                  <h3 className="text-white font-bold mb-6 text-lg">Network Performance</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="text-center p-4 bg-[#0f0f0f] rounded-lg">
                      <p className="text-green-400 text-3xl font-bold">98.7%</p>
                      <p className="text-gray-400 text-xs mt-1">Uptime</p>
                    </div>
                    <div className="text-center p-4 bg-[#0f0f0f] rounded-lg">
                      <p className="text-cyan-400 text-3xl font-bold">45ms</p>
                      <p className="text-gray-400 text-xs mt-1">Avg Latency</p>
                    </div>
                    <div className="text-center p-4 bg-[#0f0f0f] rounded-lg">
                      <p className="text-blue-400 text-3xl font-bold">1.2Gb/s</p>
                      <p className="text-gray-400 text-xs mt-1">Bandwidth</p>
                    </div>
                    <div className="text-center p-4 bg-[#0f0f0f] rounded-lg">
                      <p className="text-purple-400 text-3xl font-bold">{stats.activeNodes || 0}</p>
                      <p className="text-gray-400 text-xs mt-1">Active Peers</p>
                    </div>
                  </div>
                  
                  {/* Network Speed Bars */}
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-400">Average Speed</span>
                        <span className="text-green-400 font-bold">Excellent</span>
                      </div>
                      <div className="h-2 bg-[#0f0f0f] rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-green-500 to-cyan-400" style={{ width: '94%' }}></div>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-400">Block Propagation</span>
                        <span className="text-cyan-400 font-bold">Fast</span>
                      </div>
                      <div className="h-2 bg-[#0f0f0f] rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-cyan-500 to-blue-400" style={{ width: '89%' }}></div>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-400">Transaction Speed</span>
                        <span className="text-blue-400 font-bold">Good</span>
                      </div>
                      <div className="h-2 bg-[#0f0f0f] rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-blue-500 to-purple-400" style={{ width: '91%' }}></div>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-400">Network Stability</span>
                        <span className="text-purple-400 font-bold">Excellent</span>
                      </div>
                      <div className="h-2 bg-[#0f0f0f] rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-purple-500 to-pink-400" style={{ width: '96%' }}></div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Country Donut Chart */}
                <div className="lg:col-span-3 bg-[#1a1a1a] border border-gray-800 rounded-lg p-6">
                  <h3 className="text-white font-bold mb-6 text-center text-lg">Country</h3>
                  <div className="relative w-44 h-44 mx-auto mb-6">
                    <svg viewBox="0 0 200 200" className="w-full h-full -rotate-90">
                      {Object.entries(stats.countryMap).map(([country, count], index, arr) => {
                        const total = Object.values(stats.countryMap).reduce((a, b) => a + b, 0);
                        const percentage = (count / total) * 100;
                        const angle = (percentage / 100) * 360;
                        const prevAngles = arr.slice(0, index).reduce((sum, [, c]) => sum + ((c / total) * 360), 0);
                        const startAngle = prevAngles;
                        const endAngle = prevAngles + angle;
                        
                        const startRad = (startAngle - 90) * (Math.PI / 180);
                        const endRad = (endAngle - 90) * (Math.PI / 180);
                        
                        const x1 = 100 + 85 * Math.cos(startRad);
                        const y1 = 100 + 85 * Math.sin(startRad);
                        const x2 = 100 + 85 * Math.cos(endRad);
                        const y2 = 100 + 85 * Math.sin(endRad);
                        
                        const largeArc = angle > 180 ? 1 : 0;
                        
                        return (
                          <path
                            key={country}
                            d={`M 100 100 L ${x1} ${y1} A 85 85 0 ${largeArc} 1 ${x2} ${y2} Z`}
                            fill={CHART_COLORS[index % CHART_COLORS.length]}
                            className="hover:opacity-80 transition-opacity cursor-pointer"
                          />
                        );
                      })}
                      <circle cx="100" cy="100" r="60" fill="#1a1a1a" />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center flex-col">
                      <p className="text-white text-5xl font-bold">{stats.totalCountries}</p>
                    </div>
                  </div>
                  <div className="space-y-3 text-xs">
                    {Object.entries(stats.countryMap)
                      .sort(([, a], [, b]) => b - a)
                      .map(([country, count], index) => {
                        const total = Object.values(stats.countryMap).reduce((a, b) => a + b, 0);
                        const percentage = ((count / total) * 100).toFixed(1);
                        return (
                          <div key={country} className="flex items-center gap-2">
                            <div 
                              className="w-3 h-3 rounded-sm flex-shrink-0"
                              style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                            ></div>
                            <span className="text-cyan-300 flex-1 truncate font-medium">{country}</span>
                            <span className="text-gray-400">{percentage}%</span>
                          </div>
                        );
                      })}
                  </div>
                </div>
              </div>

              {/* Node Data Center - Like THORChain */}
              <NodeDataCenter 
                validatorLocations={validatorLocations}
                stats={stats}
                chartColors={CHART_COLORS}
              />
            </>
          ) : validators.length > 0 ? (
            // Show validator list without map if we have validators but no location data
            <div className="space-y-4">
              <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-6">
                <div className="flex items-center gap-3 mb-4">
                  <AlertCircle className="w-6 h-6 text-yellow-500" />
                  <div>
                    <h3 className="text-white font-bold">Validator Network Topology Unavailable</h3>
                    <p className="text-gray-400 text-sm">
                      Geographic location data is not available for <span className="text-cyan-400">{selectedChain?.chain_name}</span>, but validator information is shown below.
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Basic Stats */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-4 text-center">
                  <p className="text-gray-400 text-sm mb-2">Active Validators</p>
                  <p className="text-cyan-400 text-4xl font-bold">{validators.filter(v => v.status === 'BOND_STATUS_BONDED').length}</p>
                </div>
                <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-4 text-center">
                  <p className="text-gray-400 text-sm mb-2">Total Validators</p>
                  <p className="text-cyan-400 text-4xl font-bold">{validators.length}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-16 text-center">
              <div className="mb-6">
                <Map className="w-20 h-20 mx-auto text-gray-600 mb-4" />
              </div>
              <h3 className="text-white text-xl font-bold mb-2">Validator Network Not Available</h3>
              <p className="text-gray-400 mb-1">
                Network topology data is not available for <span className="text-cyan-400 font-semibold">{selectedChain?.chain_name}</span>
              </p>
              <p className="text-gray-500 text-sm">
                This chain may not have peer discovery enabled or validator location data has not been indexed yet.
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

// Memoized component for Node Data Center to avoid re-renders
const NodeDataCenter = React.memo(({ validatorLocations, stats, chartColors }: {
  validatorLocations: ValidatorLocation[];
  stats: any;
  chartColors: string[];
}) => {
  const providerGroups = useMemo(() => {
    return validatorLocations.reduce((acc, loc) => {
      const provider = loc.provider && loc.provider !== 'Unknown' ? loc.provider : 'Other';
      if (!acc[provider]) {
        acc[provider] = { locations: [], totalNodes: 0 };
      }
      acc[provider].locations.push(loc);
      acc[provider].totalNodes += loc.count;
      return acc;
    }, {} as Record<string, { locations: typeof validatorLocations, totalNodes: number }>);
  }, [validatorLocations]);

  return (
    <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-6 mb-6">
      <h3 className="text-white font-bold text-xl mb-2">Node Data Center</h3>
      <p className="text-gray-400 text-sm mb-6">{stats.totalLocations} locations</p>
      <div className="space-y-4">
        {Object.entries(providerGroups)
          .sort(([, a], [, b]) => b.totalNodes - a.totalNodes)
          .slice(0, 10)
          .map(([provider, data], providerIndex) => (
            <div key={provider} className="bg-[#0f0f0f] border border-gray-700 rounded-lg p-5">
              <div className="flex items-center gap-4 mb-4">
                <div 
                  className="w-12 h-12 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: chartColors[providerIndex % chartColors.length] + '30', borderColor: chartColors[providerIndex % chartColors.length] + '50', borderWidth: '1px' }}
                >
                  <Server className="w-6 h-6" style={{ color: chartColors[providerIndex % chartColors.length] }} />
                </div>
                <div className="flex-1">
                  <p className="text-white font-bold text-lg">{provider}</p>
                  <p className="text-gray-400 text-sm">{data.locations.length} locations</p>
                </div>
                <div className="text-right">
                  <p className="text-white text-3xl font-bold">{data.totalNodes}</p>
                  <p className="text-gray-400 text-sm">nodes</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                {data.locations.slice(0, 5).map((loc, idx) => (
                  <span key={idx} className="text-gray-400">
                    {loc.city}, {loc.country} • <span className="text-white">{loc.count}</span>
                  </span>
                ))}
                {data.locations.length > 5 && (
                  <span className="text-gray-500">+{data.locations.length - 5} more</span>
                )}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
});

NodeDataCenter.displayName = 'NodeDataCenter';
