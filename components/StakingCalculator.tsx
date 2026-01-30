'use client';
import { useState, useEffect, useMemo } from 'react';
import { Calculator, TrendingUp, Calendar, Percent } from 'lucide-react';
import { ChainData } from '@/types/chain';

interface StakingCalculatorProps {
  selectedChain: ChainData | null;
}

export default function StakingCalculator({ selectedChain }: StakingCalculatorProps) {
  const [amount, setAmount] = useState<string>('1000');
  const [apr, setApr] = useState<string>('15');
  const [loadingApr, setLoadingApr] = useState<boolean>(false);
  const [aprAutoDetected, setAprAutoDetected] = useState<boolean>(false);
  const [duration, setDuration] = useState<number>(365); // days
  const [compound, setCompound] = useState<boolean>(true);
  const [compoundFrequency, setCompoundFrequency] = useState<number>(1); // daily

  // Fetch APR from API when chain changes
  useEffect(() => {
    if (!selectedChain) return;

    const fetchApr = async () => {
      setLoadingApr(true);
      setAprAutoDetected(false);
      try {
        const chainPath = selectedChain.chain_name.toLowerCase().replace(/\s+/g, '-');
        
        // Fetch inflation
        const mintResponse = await fetch(`/api/mint?chain=${chainPath}`);
        
        console.log('[Staking Calculator] Fetching APR for:', chainPath);
        console.log('[Staking Calculator] Mint response status:', mintResponse.status);
        
        if (mintResponse.ok) {
          const mintData = await mintResponse.json();
          console.log('[Staking Calculator] Mint data:', mintData);
          
          if (mintData.inflation && mintData.inflation !== '0') {
            let inflationValue = parseFloat(mintData.inflation);
            
            // Convert to percentage if needed
            if (!isNaN(inflationValue)) {
              if (inflationValue < 1) {
                inflationValue = inflationValue * 100;
              }
              
              console.log('[Staking Calculator] Inflation:', inflationValue);
              
              // Now fetch staking pool to get bonded ratio for accurate APR
              try {
                const poolResponse = await fetch(`/api/network?chain=${chainPath}`);
                if (poolResponse.ok) {
                  const poolData = await poolResponse.json();
                  console.log('[Staking Calculator] Pool data:', poolData);
                  
                  if (poolData.bondedTokens && poolData.supply) {
                    const bondedTokens = parseFloat(poolData.bondedTokens);
                    const totalSupply = parseFloat(poolData.supply);
                    
                    if (bondedTokens > 0 && totalSupply > 0) {
                      const bondedRatio = bondedTokens / totalSupply;
                      const calculatedApr = inflationValue / bondedRatio;
                      
                      console.log('[Staking Calculator] Bonded Ratio:', bondedRatio);
                      console.log('[Staking Calculator] Calculated APR:', calculatedApr);
                      
                      setApr(calculatedApr.toFixed(2));
                      setAprAutoDetected(true);
                      return;
                    }
                  }
                }
              } catch (poolError) {
                console.log('[Staking Calculator] Could not fetch pool data, using inflation as APR');
              }
              
              // Fallback: use inflation as APR if bonded ratio not available
              setApr(inflationValue.toFixed(2));
              setAprAutoDetected(true);
            }
          } else {
            console.log('[Staking Calculator] No inflation data or inflation is 0, keeping default');
          }
        } else {
          console.log('[Staking Calculator] API request failed:', mintResponse.status);
        }
      } catch (error) {
        console.error('[Staking Calculator] Error fetching APR:', error);
        // Keep default value if fetch fails
      } finally {
        setLoadingApr(false);
      }
    };

    fetchApr();
  }, [selectedChain]);

  // Calculate rewards
  const calculations = useMemo(() => {
    const principal = parseFloat(amount) || 0;
    const rate = parseFloat(apr) / 100 || 0;
    const days = duration;

    if (principal <= 0 || rate <= 0 || days <= 0) {
      return {
        daily: 0,
        weekly: 0,
        monthly: 0,
        yearly: 0,
        total: 0,
        finalAmount: principal,
      };
    }

    if (compound) {
      // Compound interest formula: A = P(1 + r/n)^(nt)
      // n = compounding frequency per year
      const n = compoundFrequency === 1 ? 365 : compoundFrequency === 7 ? 52 : 12;
      const t = days / 365;
      const finalAmount = principal * Math.pow(1 + rate / n, n * t);
      const totalReward = finalAmount - principal;

      return {
        daily: (totalReward / days),
        weekly: (totalReward / days) * 7,
        monthly: (totalReward / days) * 30,
        yearly: totalReward * (365 / days),
        total: totalReward,
        finalAmount: finalAmount,
      };
    } else {
      // Simple interest: I = P * r * t
      const totalReward = principal * rate * (days / 365);

      return {
        daily: totalReward / days,
        weekly: (totalReward / days) * 7,
        monthly: (totalReward / days) * 30,
        yearly: totalReward * (365 / days),
        total: totalReward,
        finalAmount: principal + totalReward,
      };
    }
  }, [amount, apr, duration, compound, compoundFrequency]);

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 6,
    }).format(num);
  };

  const denom = selectedChain?.assets?.[0]?.symbol || 'TOKEN';

  return (
    <div className="space-y-6">
      {/* Calculator Card */}
      <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-4 md:p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-blue-500/10 rounded-lg">
            <Calculator className="w-6 h-6 text-blue-500" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Staking Calculator</h2>
            <p className="text-sm text-gray-400">Calculate your staking rewards</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Input Section */}
          <div className="space-y-4">
            {/* Amount Input */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Staking Amount
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full bg-[#0f0f0f] border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
                  placeholder="Enter amount"
                  min="0"
                  step="any"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                  {denom}
                </span>
              </div>
            </div>

            {/* APR Input */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-300">
                  Annual Percentage Rate (APR)
                </label>
                {loadingApr && (
                  <span className="text-xs text-blue-400">Loading...</span>
                )}
                {!loadingApr && aprAutoDetected && (
                  <span className="text-xs text-green-400 flex items-center gap-1">
                    <span>✓</span>
                    <span>Auto-detected</span>
                  </span>
                )}
              </div>
              <div className="relative">
                <input
                  type="number"
                  value={apr}
                  onChange={(e) => {
                    setApr(e.target.value);
                    setAprAutoDetected(false); // Mark as manually edited
                  }}
                  className="w-full bg-[#0f0f0f] border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
                  placeholder="Enter APR"
                  min="0"
                  max="100"
                  step="0.1"
                  disabled={loadingApr}
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                  %
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {aprAutoDetected 
                  ? 'APR is based on network inflation. Actual APR may vary based on bonded ratio and validator commission.'
                  : 'Enter estimated APR. Network inflation can be used as a baseline.'}
              </p>
            </div>

            {/* Duration Input */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Staking Duration
              </label>
              <div className="grid grid-cols-4 gap-2 mb-3">
                {[30, 90, 180, 365].map((days) => (
                  <button
                    key={days}
                    onClick={() => setDuration(days)}
                    className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                      duration === days
                        ? 'bg-blue-500 text-white'
                        : 'bg-[#0f0f0f] text-gray-400 hover:bg-gray-800'
                    }`}
                  >
                    {days}d
                  </button>
                ))}
              </div>
              <input
                type="number"
                value={duration}
                onChange={(e) => setDuration(parseInt(e.target.value) || 0)}
                className="w-full bg-[#0f0f0f] border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
                placeholder="Custom days"
                min="1"
              />
            </div>

            {/* Compound Toggle */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-300">
                  Auto-Compound Rewards
                </label>
                <button
                  onClick={() => setCompound(!compound)}
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    compound ? 'bg-blue-500' : 'bg-gray-700'
                  }`}
                >
                  <div
                    className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                      compound ? 'translate-x-6' : ''
                    }`}
                  />
                </button>
              </div>

              {compound && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Compound Frequency
                  </label>
                  <select
                    value={compoundFrequency}
                    onChange={(e) => setCompoundFrequency(parseInt(e.target.value))}
                    className="w-full bg-[#0f0f0f] border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
                  >
                    <option value={1}>Daily</option>
                    <option value={7}>Weekly</option>
                    <option value={30}>Monthly</option>
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Results Section */}
          <div className="space-y-4">
            {/* Estimated Rewards */}
            <div className="bg-[#0f0f0f] border border-gray-700 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-5 h-5 text-green-500" />
                <h3 className="text-lg font-semibold text-white">Estimated Rewards</h3>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 text-sm">Daily</span>
                  <span className="text-white font-medium">
                    {formatNumber(calculations.daily)} {denom}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 text-sm">Weekly</span>
                  <span className="text-white font-medium">
                    {formatNumber(calculations.weekly)} {denom}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 text-sm">Monthly</span>
                  <span className="text-white font-medium">
                    {formatNumber(calculations.monthly)} {denom}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 text-sm">Yearly</span>
                  <span className="text-white font-medium">
                    {formatNumber(calculations.yearly)} {denom}
                  </span>
                </div>
              </div>
            </div>

            {/* Total Summary */}
            <div className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-4">
                <Calendar className="w-5 h-5 text-blue-500" />
                <h3 className="text-lg font-semibold text-white">Total Summary</h3>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-300 text-sm">Initial Stake</span>
                  <span className="text-white font-medium">
                    {formatNumber(parseFloat(amount) || 0)} {denom}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-300 text-sm">Total Rewards</span>
                  <span className="text-green-400 font-medium">
                    +{formatNumber(calculations.total)} {denom}
                  </span>
                </div>
                <div className="h-px bg-gray-700" />
                <div className="flex justify-between items-center">
                  <span className="text-white font-semibold">Final Amount</span>
                  <span className="text-blue-400 font-bold text-lg">
                    {formatNumber(calculations.finalAmount)} {denom}
                  </span>
                </div>
              </div>
            </div>

            {/* Info Box */}
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <Percent className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-yellow-200 font-medium mb-1">Note</p>
                  <p className="text-xs text-yellow-200/80">
                    These calculations are estimates. Actual rewards may vary based on network conditions, 
                    validator commission, and other factors.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
