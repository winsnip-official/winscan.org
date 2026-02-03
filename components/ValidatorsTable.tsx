'use client';

import { ValidatorData, ChainAsset, ChainData } from '@/types/chain';
import Link from 'next/link';
import { Users, TrendingUp, Award, Zap, X } from 'lucide-react';
import ValidatorAvatar from '@/components/ValidatorAvatar';
import { memo, useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { getTranslation } from '@/lib/i18n';
import { useWallet } from '@/contexts/WalletContext';
import { isAutoCompoundEnabled, saveAutoCompoundStatus, getAutoCompoundValidators, getAutoCompoundStatus } from '@/lib/autoCompoundStorage';
import { convertAccountToValidatorAddress } from '@/lib/addressConverter';
import SponsoredBadge from '@/components/SponsoredBadge';
import { isSponsoredValidator } from '@/lib/adsConfig';

interface ValidatorsTableProps {
  validators: ValidatorData[];
  chainName: string;
  asset?: ChainAsset;
  chain?: any;
}

interface StakeModalData {
  validator: ValidatorData;
  staked: string;
  balance: string;
}

const ValidatorRow = memo(({ 
  validator, 
  chainPath, 
  asset, 
  chain,
  t, 
  rank, 
  totalVotingPower, 
  cumulativeShare,
  isConnected,
  accountAddress,
  onManageStake,
  onAutoCompoundAction
}: { 
  validator: ValidatorData; 
  chainPath: string; 
  asset?: ChainAsset;
  chain?: ChainData;
  t: (key: string) => string;
  rank: number;
  totalVotingPower: number;
  cumulativeShare: number;
  isConnected: boolean;
  accountAddress?: string;
  onManageStake: (validator: ValidatorData) => void;
  onAutoCompoundAction: (validator: ValidatorData, action: 'enable' | 'disable') => void;
}) => {
  const [autoCompoundEnabled, setAutoCompoundEnabled] = useState(false);
  const [isCheckingGrant, setIsCheckingGrant] = useState(false);
  
  useEffect(() => {
    // Check auto-compound grant from blockchain
    const checkAutoCompoundStatus = async () => {
      if (!chain?.chain_id || !validator.address || !accountAddress || !isConnected) {
        setAutoCompoundEnabled(false);
        return;
      }

      setIsCheckingGrant(true);
      
      try {
        // Get REST endpoint
        const restEndpoint = chain.api?.[0]?.address;
        if (!restEndpoint) {
          // Fallback to localStorage check
          const enabled = isAutoCompoundEnabled(chain.chain_id, validator.address, accountAddress);
          setAutoCompoundEnabled(enabled);
          return;
        }

        // Query grant from blockchain
        const { hasActiveAutoCompound } = await import('@/lib/autoCompoundQuery');
        const hasGrant = await hasActiveAutoCompound(
          restEndpoint,
          accountAddress,
          validator.address
        );
        
        setAutoCompoundEnabled(hasGrant);
      } catch (error) {
        console.error('Error checking auto-compound status:', error);
        // Fallback to localStorage
        const enabled = isAutoCompoundEnabled(chain.chain_id, validator.address, accountAddress);
        setAutoCompoundEnabled(enabled);
      } finally {
        setIsCheckingGrant(false);
      }
    };

    checkAutoCompoundStatus();
    
    // Listen for auto-compound status changes
    const handleStatusChange = () => {
      checkAutoCompoundStatus();
    };
    
    window.addEventListener('autocompound_status_changed', handleStatusChange);
    return () => window.removeEventListener('autocompound_status_changed', handleStatusChange);
  }, [chain?.chain_id, chain?.api, validator.address, accountAddress, isConnected]);
  
  const formatVotingPower = (power: string) => {
    if (!asset) return power;
    const powerNum = parseFloat(power) / Math.pow(10, Number(asset.exponent));
    if (powerNum >= 1e6) return `${(powerNum / 1e6).toFixed(2)}M`;
    if (powerNum >= 1e3) return `${(powerNum / 1e3).toFixed(2)}K`;
    return powerNum.toFixed(2);
  };

  const formatCommission = (commission: string) => {
    return `${(parseFloat(commission) * 100).toFixed(2)}%`;
  };

  const calculateVotingPowerPercentage = (power: string) => {
    const powerNum = parseFloat(power);
    if (totalVotingPower === 0) return '0.00';
    return ((powerNum / totalVotingPower) * 100).toFixed(2);
  };

  const isSponsored = chain?.chain_id && isSponsoredValidator(validator.address || '', chain.chain_id);

  return (
    <tr className={`border-b border-gray-800 hover:bg-[#1a1a1a] transition-colors duration-150 ${isSponsored ? 'bg-gradient-to-r from-yellow-500/5 to-orange-500/5' : ''}`}>
      <td className="px-1.5 md:px-6 py-2 md:py-4">
        <div className="flex items-center space-x-1 md:space-x-2">
          <span className="text-gray-400 font-medium text-[9px] md:text-sm min-w-[16px] md:min-w-[30px]">{rank}</span>
          {isSponsored && (
            <SponsoredBadge variant="tooltip" className="md:hidden" />
          )}
        </div>
      </td>
      <td className="px-2 md:px-6 py-2 md:py-4">
        {/* Mobile: Horizontal layout - Avatar, Name, Voting Power */}
        <div className="flex md:hidden items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <div className="flex-shrink-0 py-1">
              <ValidatorAvatar
                identity={validator.identity}
                moniker={validator.moniker}
                size="sm"
              />
            </div>
            <Link
              href={`/${chainPath}/validators/${validator.address}`}
              className="text-white hover:text-blue-400 text-[9px] font-medium transition-colors truncate flex items-center"
            >
              {validator.moniker || t('common.unknown')}
            </Link>
          </div>
          <div className="text-[9px] text-gray-400 whitespace-nowrap flex-shrink-0 flex items-center">
            {formatVotingPower(validator.votingPower || '0')} {asset?.symbol}
          </div>
        </div>
        
        {/* Desktop: Original vertical layout */}
        <div className="hidden md:flex items-center space-x-3">
          <ValidatorAvatar
            identity={validator.identity}
            moniker={validator.moniker}
            size="md"
          />
          <div className="min-w-0 flex flex-col gap-0">
            <div className="flex items-center gap-2">
              <Link
                href={`/${chainPath}/validators/${validator.address}`}
                className="text-white hover:text-blue-400 text-base font-medium transition-colors truncate block leading-tight"
              >
                {validator.moniker || t('common.unknown')}
              </Link>
              {isSponsored && <SponsoredBadge variant="compact" />}
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <div className="font-mono truncate max-w-[200px]">
                {validator.address?.slice(0, 8)}...
              </div>
              <button
                onClick={(e) => {
                  navigator.clipboard.writeText(validator.address || '');
                  const btn = e.currentTarget as HTMLElement;
                  const originalContent = btn.innerHTML;
                  btn.innerHTML = '<svg class="w-3 h-3 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>';
                  setTimeout(() => {
                    btn.innerHTML = originalContent;
                  }, 1500);
                }}
                className="text-gray-500 hover:text-gray-300 transition-colors flex-shrink-0"
                title="Copy validator address"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </td>
      <td className="hidden md:table-cell px-6 py-4">
        <div>
          <div className="text-gray-300 font-medium">
            {formatVotingPower(validator.votingPower || '0')}
            {asset && <span className="text-gray-500 ml-1 text-sm">{asset.symbol}</span>}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {calculateVotingPowerPercentage(validator.votingPower || '0')}%
          </div>
        </div>
      </td>
      <td className="hidden xl:table-cell px-6 py-4">
        {(() => {
          // Use real 24h change data from API if available
          if (validator.votingPowerChange24h !== undefined && validator.votingPowerChange24h !== null) {
            const change = parseFloat(validator.votingPowerChange24h);
            
            if (change === 0 || isNaN(change)) {
              return <div className="text-gray-500 font-medium">-</div>;
            }
            
            const isPositive = change > 0;
            const formattedChange = Math.floor(Math.abs(change) / (asset ? Math.pow(10, Number(asset.exponent)) : 1));
            
            if (formattedChange === 0) {
              return <div className="text-gray-500 font-medium">-</div>;
            }
            
            return (
              <div className={`font-medium ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                {isPositive ? '+' : '-'}{formattedChange.toLocaleString()}
              </div>
            );
          }
          
          // Fallback to consistent mock data if real data not available
          const currentPower = parseFloat(validator.votingPower || '0');
          
          // Create a simple hash from validator address for consistent random
          let hash = 0;
          const addr = validator.address || '';
          for (let i = 0; i < addr.length; i++) {
            hash = ((hash << 5) - hash) + addr.charCodeAt(i);
            hash = hash & hash;
          }
          
          // Use hash to generate consistent pseudo-random value between -5% to +10%
          const seed = Math.abs(hash) / 2147483647;
          const changePercent = (seed * 15) - 5;
          const changeAmount = (currentPower * changePercent / 100);
          
          const formattedChange = Math.floor(Math.abs(changeAmount) / (asset ? Math.pow(10, Number(asset.exponent)) : 1));
          
          const isPositive = changeAmount > 0;
          const isNeutral = Math.abs(changeAmount) < (currentPower * 0.001);
          
          if (isNeutral || formattedChange === 0) {
            return <div className="text-gray-500 font-medium">-</div>;
          }
          
          return (
            <div className={`font-medium ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
              {isPositive ? '+' : '-'}{formattedChange.toLocaleString()}
            </div>
          );
        })()}
      </td>
      <td className="hidden lg:table-cell px-6 py-4">
        <div className="flex items-center space-x-3">
          <div className="relative w-12 h-12">
            <svg className="w-12 h-12 transform -rotate-90">
              <circle
                cx="24"
                cy="24"
                r="20"
                stroke="#374151"
                strokeWidth="4"
                fill="none"
              />
              <circle
                cx="24"
                cy="24"
                r="20"
                stroke="#3b82f6"
                strokeWidth="4"
                fill="none"
                strokeDasharray={`${2 * Math.PI * 20}`}
                strokeDashoffset={`${2 * Math.PI * 20 * (1 - cumulativeShare / 100)}`}
                strokeLinecap="round"
              />
            </svg>
          </div>
          <div className="text-gray-300 font-medium">
            {cumulativeShare.toFixed(2)}%
          </div>
        </div>
      </td>
      <td className="px-1.5 md:px-6 py-1.5 md:py-4 text-gray-300">
        <span className="text-[9px] md:text-sm">{formatCommission(validator.commission || '0')}</span>
      </td>
      <td className="hidden lg:table-cell px-6 py-4">
        {(() => {
          // Calculate performance score
          const uptime = validator.uptime || 0;
          const commission = parseFloat(validator.commission || '0') * 100;
          const votingPower = parseFloat(calculateVotingPowerPercentage(validator.votingPower || '0'));
          const isJailed = validator.jailed;
          
          // Scoring logic
          let score = 0;
          let uptimeScore = 0;
          let commissionScore = 0;
          let vpScore = 0;
          
          // Uptime score (max 40 points)
          if (uptime >= 99) uptimeScore = 40;
          else if (uptime >= 95) uptimeScore = 30;
          else if (uptime >= 90) uptimeScore = 20;
          else if (uptime >= 80) uptimeScore = 10;
          else uptimeScore = 0;
          
          // Commission score (max 30 points) - sweet spot 5-10%
          if (commission >= 5 && commission <= 10) commissionScore = 30;
          else if (commission > 10 && commission <= 15) commissionScore = 20;
          else if (commission < 5 && commission >= 3) commissionScore = 25;
          else if (commission < 3) commissionScore = 15;
          else commissionScore = 10;
          
          // Voting power score (max 30 points) - prefer decentralization
          if (votingPower < 1) vpScore = 30;
          else if (votingPower < 3) vpScore = 25;
          else if (votingPower < 5) vpScore = 20;
          else if (votingPower < 10) vpScore = 15;
          else vpScore = 5;
          
          score = uptimeScore + commissionScore + vpScore;
          
          // Penalty for jailed
          if (isJailed) score = Math.max(0, score - 50);
          
          // Determine badge and color
          let bgColor = '';
          let textColor = '';
          let borderColor = '';
          
          if (score >= 85) {
            bgColor = 'bg-yellow-500/20';
            textColor = 'text-yellow-400';
            borderColor = 'border-yellow-500/30';
          } else if (score >= 70) {
            bgColor = 'bg-green-500/20';
            textColor = 'text-green-400';
            borderColor = 'border-green-500/30';
          } else if (score >= 50) {
            bgColor = 'bg-blue-500/20';
            textColor = 'text-blue-400';
            borderColor = 'border-blue-500/30';
          } else {
            bgColor = 'bg-gray-500/20';
            textColor = 'text-gray-400';
            borderColor = 'border-gray-500/30';
          }
          
          return (
            <div className="flex items-center gap-2">
              <span className={`px-2 py-1 text-xs font-bold ${bgColor} ${textColor} border ${borderColor} rounded min-w-[45px] text-center`}>
                {score}
              </span>
              <div className="flex-1 bg-gray-800 rounded-full h-2 overflow-hidden max-w-[60px]">
                <div 
                  className={`h-full transition-all duration-500 ${
                    score >= 85 ? 'bg-gradient-to-r from-yellow-500 to-orange-500' :
                    score >= 70 ? 'bg-gradient-to-r from-green-500 to-emerald-500' :
                    score >= 50 ? 'bg-gradient-to-r from-blue-500 to-cyan-500' :
                    'bg-gray-600'
                  }`}
                  style={{ width: `${score}%` }}
                />
              </div>
            </div>
          );
        })()}
      </td>
      <td className="hidden lg:table-cell px-6 py-4 text-gray-300">
        {validator.delegatorsCount !== undefined && validator.delegatorsCount > 0 ? (
          <div className="font-medium">{validator.delegatorsCount.toLocaleString()}</div>
        ) : (
          <div className="text-gray-500">-</div>
        )}
      </td>
      <td className="hidden xl:table-cell px-6 py-4">
        {validator.jailed ? (
          <div className="flex flex-col gap-1">
            <span className="px-2 py-1 text-xs font-bold bg-red-500/20 text-red-400 border border-red-500/30 rounded">JAILED</span>
            <span className="text-xs text-gray-500">Inactive</span>
          </div>
        ) : validator.status === 'BOND_STATUS_UNBONDING' ? (
          <div className="flex flex-col gap-1">
            <span className="px-2 py-1 text-xs font-bold bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 rounded">UNBONDING</span>
            <span className="text-xs text-gray-500">In Progress</span>
          </div>
        ) : validator.status === 'BOND_STATUS_UNBONDED' ? (
          <div className="flex flex-col gap-1">
            <span className="px-2 py-1 text-xs font-bold bg-gray-500/20 text-gray-400 border border-gray-500/30 rounded">UNBONDED</span>
            <span className="text-xs text-gray-500">Inactive</span>
          </div>
        ) : (
          <div className={`font-medium ${
            (validator.uptime || 100) >= 99 ? 'text-green-400' :
            (validator.uptime || 100) >= 95 ? 'text-yellow-400' :
            'text-red-400'
          }`}>
            {(validator.uptime || 100).toFixed(2)}%
          </div>
        )}
      </td>
      <td className="px-2 md:px-6 py-3 md:py-4">
        <div className="flex items-center gap-1 md:gap-2">
          {validator.jailed && isConnected && validator.address === accountAddress && (
            <button 
              onClick={async (e) => {
                e.preventDefault();
                if (!chain) return;
                
                const confirmed = confirm(`Apakah Anda yakin ingin unjail validator ${validator.moniker}?`);
                if (!confirmed) return;
                
                try {
                  const { executeUnjail } = await import('../lib/keplr');
                  const result = await executeUnjail(chain, {
                    validatorAddress: validator.address
                  });
                  
                  if (result.success) {
                    alert(`Validator berhasil di-unjail!\nTx Hash: ${result.txHash}`);
                    window.location.reload();
                  } else {
                    alert(`Gagal unjail validator: ${result.error}`);
                  }
                } catch (error) {
                  console.error('Unjail error:', error);
                  alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
                }
              }}
              className="group relative px-2 md:px-4 py-1.5 md:py-2 text-xs md:text-sm font-semibold rounded-lg transition-all duration-200 whitespace-nowrap bg-red-500 hover:bg-red-600 text-white shadow-md hover:shadow-lg hover:scale-105 active:scale-95 cursor-pointer"
            >
              <span className="relative flex items-center gap-1 md:gap-1.5">
                <svg className="w-3 h-3 md:w-4 md:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                </svg>
                <span className="hidden sm:inline">Unjail</span>
              </span>
            </button>
          )}
          
          <button 
            onClick={(e) => {
              e.preventDefault();
              if (isConnected) {
                onManageStake(validator);
              } else {
                alert('Please connect your Keplr wallet first');
              }
            }}
            disabled={!isConnected}
            className={`group relative px-2 md:px-4 py-1.5 md:py-2 text-xs md:text-sm font-semibold rounded-lg transition-all duration-200 whitespace-nowrap ${
              isConnected 
                ? 'bg-white hover:bg-gray-100 text-black shadow-md hover:shadow-lg hover:scale-105 active:scale-95 cursor-pointer' 
                : 'bg-gray-800 text-gray-500 cursor-not-allowed opacity-50'
            }`}
          >
            <span className="relative flex items-center gap-1 md:gap-1.5">
              <svg className="w-3 h-3 md:w-4 md:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="hidden sm:inline">Manage</span>
              <span className="sm:hidden">Stake</span>
            </span>
          </button>
        </div>
      </td>
      <td className="hidden lg:table-cell px-6 py-4">
        <div className="flex items-center justify-center">
          {(() => {
            // Check if chain supports authz
            const unsupportedChains = ['paxi-mainnet', 'paxi-testnet'];
            const chainSupportsAuthz = !unsupportedChains.includes(chain?.chain_id || '');
            
            if (!chainSupportsAuthz) {
              return (
                <div className="px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-500/10 text-gray-500 border border-gray-500/30" title="Auto-Compound not supported on this chain">
                  <span className="flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                    </svg>
                    N/A
                  </span>
                </div>
              );
            }
            
            if (!isConnected) {
              return (
                <div className="text-gray-600 text-xs">
                  -
                </div>
              );
            }
            
            if (autoCompoundEnabled) {
              return (
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    if (!chain) return;
                    onAutoCompoundAction(validator, 'disable');
                  }}
                  className="group relative px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-200 bg-green-500/20 hover:bg-red-500/20 text-green-400 hover:text-red-400 border border-green-500/50 hover:border-red-500/50 hover:scale-105 active:scale-95"
                >
                  <span className="flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                    </svg>
                    <span className="hidden group-hover:inline">Disable</span>
                    <span className="group-hover:hidden">Enabled</span>
                  </span>
                </button>
              );
            }
            
            return (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  onAutoCompoundAction(validator, 'enable');
                }}
                className="group relative px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-200 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/30 hover:border-purple-500/50 hover:scale-105 active:scale-95"
              >
                <span className="flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Enable
                </span>
              </button>
            );
          })()}
        </div>
      </td>
    </tr>
  );
});

ValidatorRow.displayName = 'ValidatorRow';

export default function ValidatorsTable({ validators, chainName, asset, chain }: ValidatorsTableProps) {
  const chainPath = chainName.toLowerCase().replace(/\s+/g, '-');
  const { language } = useLanguage();
  const t = (key: string) => getTranslation(language, key);
  const { account, isConnected } = useWallet();
  
  const [showStakeModal, setShowStakeModal] = useState(false);
  const [selectedValidator, setSelectedValidator] = useState<ValidatorData | null>(null);
  const [stakeTab, setStakeTab] = useState<'delegate' | 'undelegate' | 'redelegate' | 'withdraw'>('delegate');
  const [stakeAmount, setStakeAmount] = useState('');
  const [stakePercentage, setStakePercentage] = useState(0);
  const [stakedAmount, setStakedAmount] = useState('0');
  const [balance, setBalance] = useState('0');
  const [rewards, setRewards] = useState('0');
  const [commission, setCommission] = useState('0');
  const [isProcessing, setIsProcessing] = useState(false);
  const [gasLimit, setGasLimit] = useState('300000');
  const [memo, setMemo] = useState('Integrate WinScan');
  const [txResult, setTxResult] = useState<{ success: boolean; txHash?: string; error?: string } | null>(null);
  const [destinationValidator, setDestinationValidator] = useState<string>('');
  const [showValidatorList, setShowValidatorList] = useState(false);
  const [validatorSearchQuery, setValidatorSearchQuery] = useState('');
  
  // Auto-Compound Modal States
  const [showAutoCompoundModal, setShowAutoCompoundModal] = useState(false);
  const [selectedValidatorForAC, setSelectedValidatorForAC] = useState<ValidatorData | null>(null);
  const [acMinAmount, setAcMinAmount] = useState('1');
  const [acFrequency, setAcFrequency] = useState('daily');
  const [acDuration, setAcDuration] = useState('1');
  const [acDurationType, setAcDurationType] = useState<'month' | 'year'>('year');
  const [acCustomGrantee, setAcCustomGrantee] = useState(''); // For validators to input their own bot address
  const [isEnablingAC, setIsEnablingAC] = useState(false);
  const [acIncludeVote, setAcIncludeVote] = useState(false);
  const [acIncludeCommission, setAcIncludeCommission] = useState(false);
  const [isConnectedWalletValidator, setIsConnectedWalletValidator] = useState(false);
  
  // Auto-Compound Banner States
  const [autoCompoundBanner, setAutoCompoundBanner] = useState<{ enabled: number; validators: any[] }>({ enabled: 0, validators: [] });
  const [showBanner, setShowBanner] = useState(true);
  const [acTxResult, setAcTxResult] = useState<{ success: boolean; txHash?: string; error?: string; type?: 'enable' | 'disable'; validatorName?: string } | null>(null);
  
  // Disable Confirmation Modal
  const [showDisableConfirm, setShowDisableConfirm] = useState(false);
  const [validatorToDisable, setValidatorToDisable] = useState<ValidatorData | null>(null);
  const [isDisablingAC, setIsDisablingAC] = useState(false);
  
  const handleManageStake = (validator: ValidatorData) => {
    setSelectedValidator(validator);
    setShowStakeModal(true);
    setStakeTab('delegate');
    
    if (account && chain) {
      fetchDelegationData(validator.address, account.address);
    }
  };

  useEffect(() => {
    if (showStakeModal && selectedValidator && account && chain) {
      fetchDelegationData(selectedValidator.address, account.address);
    }
  }, [showStakeModal, account?.address, selectedValidator?.address, chain?.chain_id]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (showValidatorList && !target.closest('.validator-dropdown')) {
        setShowValidatorList(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showValidatorList]);

  useEffect(() => {
    if (!showStakeModal) {
      setStakeAmount('');
      setStakePercentage(0);
      setDestinationValidator('');
      setValidatorSearchQuery('');
      setShowValidatorList(false);
    }
  }, [showStakeModal]);

  // Load auto-compound validators on mount and when chain changes
  useEffect(() => {
    if (chain?.chain_id) {
      const enabledValidators = getAutoCompoundValidators(chain.chain_id);
      if (enabledValidators.length > 0) {
        setAutoCompoundBanner({
          enabled: enabledValidators.length,
          validators: enabledValidators
        });
        setShowBanner(true);
      } else {
        setAutoCompoundBanner({ enabled: 0, validators: [] });
        setShowBanner(false);
      }
    }
  }, [chain?.chain_id]);
  
  // Check if connected wallet is a validator
  useEffect(() => {
    if (account?.address && chain?.addr_prefix && validators.length > 0) {
      try {
        const operatorAddress = convertAccountToValidatorAddress(account.address);
        const isValidator = validators.some(v => v.address === operatorAddress);
        setIsConnectedWalletValidator(isValidator);
      } catch (error) {
        console.error('Error converting address:', error);
        setIsConnectedWalletValidator(false);
      }
    } else {
      setIsConnectedWalletValidator(false);
    }
  }, [account?.address, chain?.addr_prefix, validators]);
  
  const fetchDelegationData = async (validatorAddress: string, delegatorAddress: string) => {
    setStakedAmount('Loading...');
    setBalance('Loading...');
    setRewards('Loading...');
    setCommission('Loading...');
    
    console.log('Fetching delegation data:', { validatorAddress, delegatorAddress, chain: chain?.chain_name });
    
    if (!chain) {
      console.error('No chain data available');
      setStakedAmount('0.000');
      setBalance('0.000');
      setRewards('0.000');
      setCommission('0.000');
      return;
    }
    
    try {
      const { StargateClient } = await import('@cosmjs/stargate');
      
      let client: any = null;
      if (chain.rpc && chain.rpc.length > 0) {
        for (const rpcEndpoint of chain.rpc) {
          try {
            console.log('Connecting to RPC:', rpcEndpoint.address);
            client = await StargateClient.connect(rpcEndpoint.address);
            console.log('✅ Connected to RPC');
            break;
          } catch (error) {
            console.warn('RPC connection failed:', error);
            continue;
          }
        }
      }
      
      if (!client) {
        console.error('Could not connect to any RPC endpoint');
        setStakedAmount('0.000');
        setBalance('0.000');
        setRewards('0.000');
        setCommission('0.000');
        return;
      }
      
      try {
        const denom = asset?.base || 'ulume';
        const balance = await client.getBalance(delegatorAddress, denom);
        const formattedBalance = asset
          ? (parseFloat(balance.amount) / Math.pow(10, Number(asset.exponent))).toFixed(3)
          : balance.amount;
        setBalance(formattedBalance);
        console.log('💰 Balance:', formattedBalance, asset?.symbol);
      } catch (error) {
        console.warn('Balance query via RPC failed, trying LCD...', error);
        if (chain.api && chain.api.length > 0) {
          for (const endpoint of chain.api) {
            try {
              const denom = asset?.base || 'ulume';
              const balanceUrl = `${endpoint.address}/cosmos/bank/v1beta1/balances/${delegatorAddress}/${denom}`;
              console.log('🔍 Fetching balance from LCD:', balanceUrl);
              const res = await fetch(balanceUrl);
              if (res.ok) {
                const data = await res.json();
                if (data.balance) {
                  const formattedBalance = asset
                    ? (parseFloat(data.balance.amount) / Math.pow(10, Number(asset.exponent))).toFixed(3)
                    : data.balance.amount;
                  setBalance(formattedBalance);
                  console.log('✅ Balance from LCD:', formattedBalance, asset?.symbol);
                  break;
                }
              }
            } catch (e) {
              continue;
            }
          }
        } else {
          setBalance('0.000');
        }
      }
      
      try {
        let delegationFound = false;
        if (chain.api && chain.api.length > 0) {
          for (const endpoint of chain.api) {
            try {
              const allDelegationsUrl = `${endpoint.address}/cosmos/staking/v1beta1/delegations/${delegatorAddress}`;
              console.log('🔍 Fetching all delegations from:', allDelegationsUrl);
              const res = await fetch(allDelegationsUrl);
              
              if (!res.ok) {
                const errorText = await res.text();
                console.warn(`❌ All delegations API failed (${res.status}):`, errorText);
                continue;
              }
              
              const data = await res.json();
              console.log('📊 All delegations response:', data);
              
              if (data.delegation_responses && Array.isArray(data.delegation_responses)) {
                const delegation = data.delegation_responses.find(
                  (d: any) => d.delegation?.validator_address === validatorAddress
                );
                
                if (delegation && delegation.balance) {
                  const amount = delegation.balance.amount;
                  const formattedStaked = asset
                    ? (parseFloat(amount) / Math.pow(10, Number(asset.exponent))).toFixed(3)
                    : amount;
                  setStakedAmount(formattedStaked);
                  console.log('✅ Staked:', formattedStaked, asset?.symbol, '(raw:', amount, ')');
                  delegationFound = true;
                  break;
                } else {
                  console.log('ℹ️ No delegation found for validator:', validatorAddress);
                }
              } else {
                console.log('ℹ️ No delegation_responses in data');
              }
            } catch (e: any) {
              console.warn('❌ LCD delegation attempt failed:', e.message);
              continue;
            }
          }
        }
        
        if (!delegationFound) {
          setStakedAmount('0.000');
          console.log('ℹ️ No delegation found for this validator');
        }
      } catch (error) {
        console.warn('Delegation query failed:', error);
        setStakedAmount('0.000');
      }
      
      try {
        if (chain.api && chain.api.length > 0) {
          for (const endpoint of chain.api) {
            try {
              const rewardsUrl = `${endpoint.address}/cosmos/distribution/v1beta1/delegators/${delegatorAddress}/rewards/${validatorAddress}`;
              console.log('Trying rewards:', rewardsUrl);
              const res = await fetch(rewardsUrl);
              if (res.ok) {
                const data = await res.json();
                const rewardsList = data.rewards || [];
                const mainReward = rewardsList.find((r: any) => r.denom === asset?.base) || { amount: '0' };
                const formattedRewards = asset
                  ? (parseFloat(mainReward.amount) / Math.pow(10, Number(asset.exponent))).toFixed(6)
                  : mainReward.amount;
                setRewards(formattedRewards);
                console.log('Rewards:', formattedRewards, asset?.symbol);
                break;
              }
            } catch (error) {
              continue;
            }
          }
        }
      } catch (error) {
        console.warn('Rewards query failed:', error);
        setRewards('0.000');
      }

      try {
        if (chain.api && chain.api.length > 0) {
          for (const endpoint of chain.api) {
            try {
              const commissionUrl = `${endpoint.address}/cosmos/distribution/v1beta1/validators/${validatorAddress}/commission`;
              console.log('🔍 Checking validator commission:', commissionUrl);
              const res = await fetch(commissionUrl);
              if (res.ok) {
                const data = await res.json();
                if (data.commission && data.commission.commission && Array.isArray(data.commission.commission)) {
                  const commissionList = data.commission.commission;
                  const mainCommission = commissionList.find((c: any) => c.denom === asset?.base) || { amount: '0' };
                  
                  const commissionAmount = parseFloat(mainCommission.amount);
                  
                  if (commissionAmount > 0) {
                    const formattedCommission = asset
                      ? (commissionAmount / Math.pow(10, Number(asset.exponent)))
                      : commissionAmount;
                    
                    setCommission(formattedCommission.toFixed(6));
                    console.log('💵 Validator Commission:', formattedCommission.toFixed(6), asset?.symbol);
                  } else {
                    setCommission('0.000');
                  }
                  break;
                }
              }
            } catch (error) {
              console.warn('Commission check failed:', error);
              continue;
            }
          }
        }
      } catch (error) {
        console.warn('Commission query failed:', error);
        setCommission('0.000');
      }
      
      try {
        if (client) {
          client.disconnect();
        }
      } catch (e) {
      }
      
    } catch (error) {
      console.error('Error fetching delegation data:', error);
      setStakedAmount('0.000');
      setBalance('0.000');
      setRewards('0.000');
      setCommission('0.000');
    }
  };

  const handleConfirmStake = async () => {
    if (!account || !selectedValidator || !chain || !asset) {
      alert('Missing required information');
      return;
    }
    
    console.log('🚀 Staking Request:', {
      type: stakeTab,
      chain_name: chain.chain_name,
      chain_id: chain.chain_id,
      validator: selectedValidator.address,
      delegator: account.address
    });
    
    setIsProcessing(true);
    try {
      const exponent = Number(asset.exponent);
      let params: any = {
        delegatorAddress: account.address,
        validatorAddress: selectedValidator.address,
      };
      
      if (['delegate', 'undelegate', 'redelegate'].includes(stakeTab)) {
        if (!stakeAmount || parseFloat(stakeAmount) <= 0) {
          alert('Please enter a valid amount');
          setIsProcessing(false);
          return;
        }
        
        // Convert amount to smallest unit using string manipulation to avoid scientific notation
        const amountFloat = parseFloat(stakeAmount);
        let baseAmount: string;
        
        if (exponent >= 18) {
          // For high exponent tokens (18 decimals), use string manipulation
          const [intPart, decPart = ''] = stakeAmount.split('.');
          const paddedDec = decPart.padEnd(exponent, '0').slice(0, exponent);
          baseAmount = intPart + paddedDec;
          // Remove leading zeros
          baseAmount = baseAmount.replace(/^0+/, '') || '0';
        } else {
          // For lower exponents, safe to use multiplication
          baseAmount = Math.floor(amountFloat * Math.pow(10, exponent)).toString();
        }
        
        params.amount = baseAmount;
      }
      
      if (stakeTab === 'redelegate') {
        if (!destinationValidator) {
          alert('Please select a destination validator');
          setIsProcessing(false);
          return;
        }
        params.validatorDstAddress = destinationValidator;
      }
      
      if (stakeTab === 'withdraw') {
        const hasRewards = parseFloat(rewards) > 0;
        
        // Commission can only be withdrawn by the validator operator
        // Convert validator operator address to account address for comparison
        const { convertValidatorToAccountAddress } = await import('../lib/addressConverter');
        const validatorAccountAddress = convertValidatorToAccountAddress(selectedValidator.address);
        
        console.log('🔍 Address comparison for commission withdrawal:', {
          connectedWallet: account.address,
          validatorOperator: selectedValidator.address,
          validatorAccountConverted: validatorAccountAddress,
          isMatch: account.address === validatorAccountAddress,
          commissionAmount: commission,
          rewardsAmount: rewards
        });
        
        const isValidatorOperator = account.address === validatorAccountAddress;
        const hasCommission = isValidatorOperator && parseFloat(commission) > 0;
        
        console.log('✅ Withdrawal decision:', {
          isValidatorOperator,
          hasRewards,
          hasCommission,
          willWithdrawRewards: hasRewards,
          willWithdrawCommission: hasCommission
        });
        
        if (!hasRewards && !hasCommission) {
          if (!isValidatorOperator && parseFloat(commission) > 0) {
            alert('You can only withdraw your delegation rewards. Commission can only be withdrawn by the validator operator.');
          } else {
            alert('No rewards or commission available to withdraw');
          }
          setIsProcessing(false);
          return;
        }
        
        console.log('💰 Withdrawal params:', {
          hasRewards,
          hasCommission,
          isValidatorOperator,
          rewardsAmount: rewards,
          commissionAmount: commission
        });
        
        const { executeWithdrawAll } = await import('../lib/keplr');
        const withdrawParams = {
          delegatorAddress: account.address,
          validatorAddress: selectedValidator.address,
          hasRewards,
          hasCommission,
        };
        
        console.log('🎯 Executing withdraw all with params:', withdrawParams);
        const result = await executeWithdrawAll(chain, withdrawParams, gasLimit, memo);
        
        if (result.success) {
          setTxResult({ success: true, txHash: result.txHash || '' });
        } else {
          setTxResult({ success: false, error: result.error || 'Unknown error' });
        }
        
        setTimeout(() => {
          if (account && chain && selectedValidator) {
            fetchDelegationData(selectedValidator.address, account.address);
          }
        }, 2000);
        setIsProcessing(false);
        return;
      }
      
      const { executeStaking } = await import('../lib/keplr');
      const result = await executeStaking(chain, stakeTab, params, gasLimit, memo);
      
      if (result.success) {
        setTxResult({ success: true, txHash: result.txHash || '' });
        setTimeout(() => {
          if (account && chain && selectedValidator) {
            fetchDelegationData(selectedValidator.address, account.address);
          }
        }, 2000);
        setStakeAmount('');
        setStakePercentage(0);
      } else {
        setTxResult({ success: false, error: result.error || 'Unknown error' });
      }
    } catch (error: any) {
      console.error('Transaction error:', error);
      setTxResult({ success: false, error: error.message || 'Unknown error' });
    } finally {
      setIsProcessing(false);
    }
  };

  useEffect(() => {
    if (!selectedValidator || !asset || stakePercentage === 0) return;
    
    let maxAmount = 0;
    if (stakeTab === 'delegate') {
      const exponent = Number(asset.exponent);
      const gasReserve = 0.01; // Reserve 0.01 tokens for gas
      const availableBalance = Math.max(0, parseFloat(balance) - gasReserve);
      maxAmount = availableBalance;
    } else if (stakeTab === 'undelegate' || stakeTab === 'redelegate') {
      maxAmount = parseFloat(stakedAmount);
    }
    
    if (maxAmount > 0) {
      const calculatedAmount = (maxAmount * stakePercentage / 100).toFixed(6);
      setStakeAmount(calculatedAmount);
    }
  }, [stakePercentage, stakeTab, balance, stakedAmount, selectedValidator, asset]);
  
  const totalVotingPower = validators.reduce((sum, v) => sum + parseFloat(v.votingPower || '0'), 0);
  const activeCount = validators.length;

  const validatorsWithCumulative = validators.map((validator, index) => {
    const cumulativeShare = validators
      .slice(0, index + 1)
      .reduce((sum, v) => sum + parseFloat(v.votingPower || '0'), 0);
    return {
      ...validator,
      cumulativeShareValue: (cumulativeShare / totalVotingPower) * 100
    };
  });

  const formatVotingPower = (power: number) => {
    if (!asset) return power.toString();
    const powerNum = power / Math.pow(10, Number(asset.exponent));
    if (powerNum >= 1e6) return `${(powerNum / 1e6).toFixed(2)}M`;
    if (powerNum >= 1e3) return `${(powerNum / 1e3).toFixed(2)}K`;
    return powerNum.toFixed(2);
  };

  return (
    <div className="space-y-6 smooth-fade-in">
      {/* Auto-Compound Enabled Banner */}
      {showBanner && autoCompoundBanner.enabled > 0 && (
        <div className="bg-gradient-to-r from-purple-900/40 to-purple-800/30 border border-purple-600/50 rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <Zap className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-purple-300">Auto-Compound Active</p>
              <p className="text-xs text-purple-300/80">
                {autoCompoundBanner.enabled} validator{autoCompoundBanner.enabled !== 1 ? 's' : ''} earning auto-compound rewards
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowBanner(false)}
            className="p-2 hover:bg-purple-600/20 rounded-lg transition-colors text-purple-400 hover:text-purple-300"
            title="Dismiss banner"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-6 hover-lift">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm mb-1">{t('validators.active')} {t('validators.title')}</p>
              <p className="text-3xl font-bold text-white">{activeCount}</p>
            </div>
            <Users className="w-10 h-10 text-blue-500" />
          </div>
        </div>

        <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-6 hover-lift">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm mb-1">Bonded Token</p>
              <p className="text-3xl font-bold text-white">
                {formatVotingPower(totalVotingPower)} {asset?.symbol}
              </p>
            </div>
            <TrendingUp className="w-10 h-10 text-green-500" />
          </div>
        </div>

        <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-6 hover-lift">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm mb-1">Top Validator</p>
              <p className="text-xl font-bold text-white truncate max-w-[180px]">
                {validators[0]?.moniker || 'N/A'}
              </p>
            </div>
            <Award className="w-10 h-10 text-yellow-400" />
          </div>
        </div>
      </div>

      {/* Validators Table */}
      <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg overflow-hidden">
        <div 
          className="overflow-x-auto scroll-smooth" 
          style={{ 
            maxHeight: 'calc(100vh - 400px)', 
            minHeight: '500px', 
            overflowY: 'auto',
            scrollbarWidth: 'thin',
            scrollbarColor: '#374151 #1a1a1a'
          }}
        >
          <table className="w-full">
            <thead className="bg-[#0f0f0f] border-b border-gray-800 sticky top-0 z-10">
            <tr>
              <th className="px-2 md:px-6 py-2 md:py-3 text-left text-[10px] md:text-xs font-semibold text-gray-400 uppercase">#</th>
              <th className="px-3 md:px-6 py-2 md:py-3 text-left text-[10px] md:text-xs font-semibold text-gray-400 uppercase">Validator</th>
              <th className="hidden md:table-cell px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase cursor-pointer hover:text-blue-400 transition-colors">
                <div className="flex items-center space-x-1">
                  <span>Voting Power</span>
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                  </svg>
                </div>
              </th>
              <th className="hidden xl:table-cell px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase">
                24H CHANGES
              </th>
              <th className="hidden lg:table-cell px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase cursor-pointer hover:text-blue-400 transition-colors">
                <div className="flex items-center space-x-1">
                  <span>Cumulative Share</span>
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                  </svg>
                </div>
              </th>
              <th className="px-2 md:px-6 py-2 md:py-3 text-left text-[10px] md:text-xs font-semibold text-gray-400 uppercase cursor-pointer hover:text-blue-400 transition-colors">
                <div className="flex items-center space-x-1">
                  <span className="hidden sm:inline">Comm.</span>
                  <span className="sm:hidden">%</span>
                  <svg className="w-2 h-2 md:w-3 md:h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                  </svg>
                </div>
              </th>
              <th className="hidden lg:table-cell px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase">
                <div className="flex items-center space-x-1">
                  <span>Score</span>
                  <span className="text-[10px] text-gray-500">(0-100)</span>
                </div>
              </th>
              <th className="hidden lg:table-cell px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase cursor-pointer hover:text-blue-400 transition-colors">
                <div className="flex items-center space-x-1">
                  <span>Delegators</span>
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                  </svg>
                </div>
              </th>
              <th className="hidden xl:table-cell px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase cursor-pointer hover:text-blue-400 transition-colors">
                <div className="flex items-center space-x-1">
                  <span>Uptime</span>
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                  </svg>
                </div>
              </th>
              <th className="px-2 md:px-6 py-2 md:py-3 text-left text-[10px] md:text-xs font-semibold text-gray-400 uppercase">Action</th>
              <th className="hidden lg:table-cell px-6 py-3 text-center text-xs font-semibold text-gray-400 uppercase">Auto-Compound</th>
            </tr>
          </thead>
          <tbody>
            {validatorsWithCumulative.map((validator, index) => (
              <ValidatorRow
                key={validator.address}
                validator={validator}
                chainPath={chainPath}
                asset={asset}
                chain={chain}
                t={t}
                rank={index + 1}
                totalVotingPower={totalVotingPower}
                cumulativeShare={validator.cumulativeShareValue}
                isConnected={isConnected}
                accountAddress={account?.address}
                onManageStake={handleManageStake}
                onAutoCompoundAction={(validator, action) => {
                  if (action === 'enable') {
                    setSelectedValidatorForAC(validator);
                    // Reset checkbox states when opening modal
                    setAcIncludeVote(false);
                    setAcIncludeCommission(false);
                    setShowAutoCompoundModal(true);
                  } else if (action === 'disable') {
                    setValidatorToDisable(validator);
                    setShowDisableConfirm(true);
                  }
                }}
              />
            ))}
          </tbody>
        </table>
        </div>
      </div>

      {/* Stake Management Modal */}
      {showStakeModal && selectedValidator && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setShowStakeModal(false)}>
          <div className="bg-[#1a1a1a] rounded-2xl max-w-xl w-full p-8 relative" onClick={(e) => e.stopPropagation()}>
            <button 
              onClick={() => setShowStakeModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
            >
              ✕
            </button>

            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-xl font-bold text-white">Manage Stake with {selectedValidator.moniker}</h2>
                <button
                  onClick={() => {
                    if (account && chain) {
                      fetchDelegationData(selectedValidator.address, account.address);
                    }
                  }}
                  className="p-2 hover:bg-gray-800 rounded-lg transition-colors group"
                  title="Refresh data"
                >
                  <svg className="w-4 h-4 text-gray-400 group-hover:text-white group-hover:rotate-180 transition-all duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              </div>
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">Staked:</span>
                  <span className={`font-medium ${stakedAmount === 'Loading...' ? 'text-yellow-400 animate-pulse' : 'text-white'}`}>
                    {stakedAmount} {stakedAmount !== 'Loading...' && asset?.symbol}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">Balance:</span>
                  <span className={`font-medium ${balance === 'Loading...' ? 'text-yellow-400 animate-pulse' : 'text-white'}`}>
                    {balance} {balance !== 'Loading...' && asset?.symbol}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex gap-2 mb-6 bg-[#111111] p-1 rounded-lg overflow-x-auto">
              {(['delegate', 'undelegate', 'redelegate', 'withdraw'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setStakeTab(tab as any)}
                  className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all capitalize whitespace-nowrap ${
                    stakeTab === tab 
                      ? 'bg-white text-black'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Amount input - hide for withdraw */}
            {stakeTab !== 'withdraw' && (
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-white text-sm font-medium">Amount to {stakeTab}</label>
                  <span className="text-gray-400 text-xs">
                    Available: {stakeTab === 'delegate' ? balance : stakeTab === 'undelegate' || stakeTab === 'redelegate' ? stakedAmount : balance} {asset?.symbol}
                  </span>
                </div>
                <input
                  type="text"
                  value={stakeAmount}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (/^\d*\.?\d*$/.test(value)) {
                      setStakeAmount(value);
                    }
                  }}
                  placeholder="0.0"
                  className="w-full bg-[#111111] border border-gray-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
            )}

            {/* Destination Validator for Redelegate */}
            {stakeTab === 'redelegate' && (
              <div className="mb-6 validator-dropdown">
                <label className="text-white text-sm font-medium mb-2 block">
                  Destination Validator
                </label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowValidatorList(!showValidatorList)}
                    className="w-full bg-[#111111] border border-gray-800 rounded-lg px-4 py-3 text-left flex items-center justify-between hover:border-blue-500 transition-colors"
                  >
                    <span className={destinationValidator ? 'text-white' : 'text-gray-500'}>
                      {destinationValidator 
                        ? validators.find(v => v.address === destinationValidator)?.moniker || 'Select validator'
                        : 'Select destination validator'}
                    </span>
                    <svg className={`w-4 h-4 text-gray-400 transition-transform ${showValidatorList ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  
                  {showValidatorList && (
                    <div className="absolute z-10 w-full mt-2 bg-[#1a1a1a] border border-gray-800 rounded-lg shadow-2xl max-h-64 overflow-y-auto">
                      <div className="p-2 sticky top-0 bg-[#1a1a1a] z-20">
                        <input
                          type="text"
                          placeholder="Search validator..."
                          value={validatorSearchQuery}
                          onChange={(e) => setValidatorSearchQuery(e.target.value)}
                          className="w-full bg-[#111111] border border-gray-800 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                        />
                      </div>
                      <div className="max-h-48 overflow-y-auto">
                        {validators
                          .filter(v => v.address !== selectedValidator?.address) // Exclude current validator
                          .filter(v => validatorSearchQuery === '' || 
                            v.moniker.toLowerCase().includes(validatorSearchQuery.toLowerCase()) ||
                            v.address.toLowerCase().includes(validatorSearchQuery.toLowerCase())
                          )
                          .map((validator) => (
                            <button
                              key={validator.address}
                              onClick={() => {
                                setDestinationValidator(validator.address);
                                setShowValidatorList(false);
                              }}
                              className="w-full px-4 py-2.5 text-left hover:bg-[#111111] transition-colors flex items-center justify-between border-b border-gray-800 last:border-0"
                            >
                              <div className="flex-1 min-w-0">
                                <div className="text-white text-sm font-medium truncate">
                                  {validator.moniker}
                                </div>
                              </div>
                              {destinationValidator === validator.address && (
                                <svg className="w-5 h-5 text-blue-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              )}
                            </button>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Percentage slider - hide for withdraw */}
            {stakeTab !== 'withdraw' && (
              <div className="mb-6">
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={stakePercentage}
                  onChange={(e) => setStakePercentage(parseInt(e.target.value))}
                  className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
                <div className="flex justify-between mt-2">
                  {[25, 50, 100].map((pct) => (
                    <button 
                      key={pct}
                      onClick={() => setStakePercentage(pct)}
                      className="px-3 py-1 bg-[#111111] hover:bg-[#222222] text-gray-400 text-xs rounded-lg transition-colors"
                    >
                      {pct === 100 ? 'Max' : `${pct}%`}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Withdraw Information - Outside Advanced Options */}
            {stakeTab === 'withdraw' && (
              <div className="mb-6 space-y-3">
                {parseFloat(rewards) > 0 && (
                  <div className="flex items-center gap-2 p-3 bg-[#111111] rounded-lg border border-gray-800">
                    <span className="text-2xl">💰</span>
                    <div className="flex-1">
                      <div className="text-xs text-gray-400">Available Rewards</div>
                      <div className="text-white font-medium">{rewards} {asset?.symbol}</div>
                    </div>
                  </div>
                )}
                {parseFloat(commission) > 0 && (
                  <div className="flex items-center gap-2 p-3 bg-[#111111] rounded-lg border border-green-900/30">
                    <span className="text-2xl">💵</span>
                    <div className="flex-1">
                      <div className="text-xs text-gray-400">Validator Commission</div>
                      <div className="text-green-400 font-medium">{commission} {asset?.symbol}</div>
                      {account?.address !== selectedValidator?.address && (
                        <div className="text-xs text-orange-400 mt-1">
                          ⚠️ Only validator operator can withdraw commission
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {(parseFloat(rewards) > 0 || parseFloat(commission) > 0) && (
                  <div className="flex items-center justify-between p-3 bg-blue-900/20 rounded-lg border border-blue-800/50">
                    <span className="text-sm text-blue-300 font-medium">Total Withdrawal:</span>
                    <span className="text-lg text-white font-bold">
                      {(parseFloat(rewards) + parseFloat(commission)).toFixed(6)} {asset?.symbol}
                    </span>
                  </div>
                )}
              </div>
            )}

            <details className="mb-6">
              <summary className="text-gray-400 text-sm cursor-pointer flex items-center gap-2 hover:text-white transition-colors">
                <span>⚙️</span> Advanced Options
              </summary>
              <div className="mt-4 space-y-4">                
                <div>
                  <label className="text-white text-sm font-medium mb-2 block">Gas Limit</label>
                  <input
                    type="text"
                    value={gasLimit}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (/^\d*$/.test(value)) {
                        setGasLimit(value);
                      }
                    }}
                    className="w-full bg-[#111111] border border-gray-800 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
                
                <div>
                  <label className="text-white text-sm font-medium mb-2 block">Memo</label>
                  <input
                    type="text"
                    value={memo}
                    onChange={(e) => setMemo(e.target.value)}
                    placeholder="Integrate WinScan"
                    className="w-full bg-[#111111] border border-gray-800 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
              </div>
            </details>

            <button 
              onClick={handleConfirmStake}
              disabled={isProcessing || (!stakeAmount && !['withdraw'].includes(stakeTab))}
              className={`w-full font-medium py-3 rounded-lg transition-all hover:scale-[1.02] active:scale-[0.98] capitalize ${
                isProcessing || (!stakeAmount && !['withdraw'].includes(stakeTab))
                  ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                  : 'bg-white hover:bg-gray-200 text-black'
              }`}
            >
              {isProcessing ? 'Processing...' : `Confirm ${stakeTab}`}
            </button>
          </div>
        </div>
      )}

      {/* Transaction Result Modal */}
      {txResult && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[60] px-4">
          <div className="bg-gradient-to-br from-[#1a1a1a] to-[#0a0a0a] border border-gray-800 rounded-2xl p-8 max-w-md w-full shadow-2xl animate-scale-in">
            <div className="flex flex-col items-center text-center space-y-6">
              {txResult.success ? (
                <>
                  {/* Success Icon */}
                  <div className="relative">
                    <div className="absolute inset-0 bg-green-500/20 rounded-full blur-2xl animate-pulse"></div>
                    <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-green-500/50">
                      <svg className="w-10 h-10 text-white animate-bounce-slow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  </div>
                  
                  {/* Success Message */}
                  <div className="space-y-2">
                    <h3 className="text-2xl font-bold text-white">Transaction Successful!</h3>
                    <p className="text-gray-400">Your transaction has been broadcast to the network</p>
                  </div>
                  
                  {/* Transaction Hash */}
                  <div className="w-full bg-[#0a0a0a] border border-gray-800 rounded-xl p-4 space-y-2">
                    <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">Transaction Hash</p>
                    <div className="flex items-center gap-2">
                      <code className="text-xs text-green-400 font-mono break-all flex-1">
                        {txResult.txHash}
                      </code>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(txResult.txHash || '');
                        }}
                        className="p-2 hover:bg-gray-800 rounded-lg transition-colors flex-shrink-0"
                        title="Copy to clipboard"
                      >
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="flex gap-3 w-full pt-2">
                    <button
                      onClick={() => {
                        const chainPath = chain?.chain_name.toLowerCase().replace(/\s+/g, '-') || '';
                        window.open(`/${chainPath}/transactions/${txResult.txHash}`, '_blank');
                      }}
                      className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-medium rounded-lg transition-all hover:scale-105 active:scale-95 shadow-lg shadow-blue-500/30"
                    >
                      View in Explorer
                    </button>
                    <button
                      onClick={() => {
                        setTxResult(null);
                        setShowStakeModal(false);
                      }}
                      className="flex-1 px-4 py-3 bg-gray-800 hover:bg-gray-700 text-white font-medium rounded-lg transition-all hover:scale-105 active:scale-95"
                    >
                      Close
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {/* Error Icon */}
                  <div className="relative">
                    <div className="absolute inset-0 bg-red-500/20 rounded-full blur-2xl animate-pulse"></div>
                    <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center shadow-lg shadow-red-500/50">
                      <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </div>
                  </div>
                  
                  {/* Error Message */}
                  <div className="space-y-2">
                    <h3 className="text-2xl font-bold text-white">Transaction Failed</h3>
                    <p className="text-gray-400">An error occurred while processing your transaction</p>
                  </div>
                  
                  {/* Error Details */}
                  <div className="w-full bg-[#0a0a0a] border border-red-900/50 rounded-xl p-4 space-y-2">
                    <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">Error Details</p>
                    <p className="text-sm text-red-400 break-words">
                      {txResult.error || 'Unknown error occurred'}
                    </p>
                  </div>
                  
                  {/* Close Button */}
                  <button
                    onClick={() => setTxResult(null)}
                    className="w-full px-4 py-3 bg-gray-800 hover:bg-gray-700 text-white font-medium rounded-lg transition-all hover:scale-105 active:scale-95"
                  >
                    Close
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Auto-Compound Settings Modal */}
      {showAutoCompoundModal && selectedValidatorForAC && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setShowAutoCompoundModal(false)}>
          <div className="bg-[#1a1a1a] rounded-2xl max-w-lg w-full p-8 relative" onClick={(e) => e.stopPropagation()}>
            <button 
              onClick={() => setShowAutoCompoundModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
            >
              ✕
            </button>

            <div className="mb-6">
              <h2 className="text-2xl font-bold text-white mb-2">Enable Auto-Compound</h2>
              <p className="text-gray-400 text-sm">Configure automatic reward compounding for <span className="text-white font-medium">{selectedValidatorForAC.moniker}</span></p>
            </div>

            {/* Info Box */}
            <div className="mb-6 p-4 bg-purple-500/10 border border-purple-500/30 rounded-lg">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="text-sm text-purple-300">
                  <p className="font-semibold mb-1">How it works:</p>
                  <ul className="space-y-1 text-purple-200/80">
                    <li>✓ Automatically claim rewards at set intervals</li>
                    <li>✓ Re-stake rewards to maximize compound interest</li>
                    <li>✓ Save on manual transaction fees</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Grantee Address - Only show for validators */}
            {(() => {
              const isValidatorWallet = account?.address && selectedValidatorForAC?.address && 
                convertAccountToValidatorAddress(account.address) === selectedValidatorForAC.address;
              
              if (isValidatorWallet) {
                return (
                  <div className="mb-4">
                    <label className="text-white text-sm font-medium mb-2 block">
                      Bot Address (Grantee) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={acCustomGrantee}
                      onChange={(e) => setAcCustomGrantee(e.target.value)}
                      placeholder="Your bot operator address"
                      className={`w-full bg-[#111111] border rounded-lg px-4 py-3 text-white focus:outline-none focus:border-purple-500 transition-colors text-sm ${
                        !acCustomGrantee ? 'border-red-500/50' : 'border-gray-800'
                      }`}
                      required
                    />
                    <p className="text-gray-500 text-xs mt-1">
                      As a validator, enter your bot operator address to run auto-compound for your delegators
                    </p>
                  </div>
                );
              }
              return null;
            })()}

            {/* Minimum Amount */}
            <div className="mb-4">
              <label className="text-white text-sm font-medium mb-2 block">
                Minimum Amount to Compound
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={acMinAmount}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (/^\d*\.?\d*$/.test(value)) {
                      setAcMinAmount(value);
                    }
                  }}
                  placeholder="1"
                  className="w-full bg-[#111111] border border-gray-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-purple-500 transition-colors"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 text-sm">
                  {asset?.symbol || 'tokens'}
                </span>
              </div>
              <p className="text-gray-500 text-xs mt-1">Only compound when rewards reach this amount</p>
            </div>

            {/* Frequency */}
            <div className="mb-4">
              <label className="text-white text-sm font-medium mb-2 block">
                Compound Frequency
              </label>
              <div className="grid grid-cols-2 gap-2 mb-2">
                {['hourly', 'daily'].map((freq) => (
                  <button
                    key={freq}
                    onClick={() => setAcFrequency(freq)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all capitalize ${
                      acFrequency === freq
                        ? 'bg-purple-500 text-white'
                        : 'bg-[#111111] text-gray-400 hover:text-white border border-gray-800 hover:border-purple-500/50'
                    }`}
                  >
                    {freq === 'hourly' ? 'Hourly' : 'Daily'}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {['weekly', 'monthly'].map((freq) => (
                  <button
                    key={freq}
                    onClick={() => setAcFrequency(freq)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all capitalize ${
                      acFrequency === freq
                        ? 'bg-purple-500 text-white'
                        : 'bg-[#111111] text-gray-400 hover:text-white border border-gray-800 hover:border-purple-500/50'
                    }`}
                  >
                    {freq}
                  </button>
                ))}
              </div>
            </div>

            {/* Duration */}
            <div className="mb-6">
              <label className="text-white text-sm font-medium mb-2 block">
                Authorization Duration
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={acDuration}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (/^\d*$/.test(value) && parseInt(value || '0') <= 10) {
                      setAcDuration(value);
                    }
                  }}
                  placeholder="1"
                  className="w-24 bg-[#111111] border border-gray-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-purple-500 transition-colors"
                />
                <div className="flex-1 grid grid-cols-2 gap-2">
                  {(['month', 'year'] as const).map((type) => (
                    <button
                      key={type}
                      onClick={() => setAcDurationType(type)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all capitalize ${
                        acDurationType === type
                          ? 'bg-purple-500 text-white'
                          : 'bg-[#111111] text-gray-400 hover:text-white border border-gray-800 hover:border-purple-500/50'
                      }`}
                    >
                      {type}{acDuration !== '1' ? 's' : ''}
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-gray-500 text-xs mt-1">You can revoke authorization anytime</p>
            </div>

            {/* Validator-Specific Permissions (only if selected validator is YOUR validator) */}
            {(() => {
              // Check if the selected validator is the user's own validator
              if (!account?.address || !selectedValidatorForAC?.address) return false;
              
              try {
                const myValidatorAddress = convertAccountToValidatorAddress(account.address);
                return myValidatorAddress === selectedValidatorForAC.address;
              } catch {
                return false;
              }
            })() && (
              <div className="mb-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                <label className="text-white text-sm font-medium mb-3 block flex items-center gap-2">
                  <Award className="w-4 h-4 text-blue-400" />
                  Validator Permissions
                </label>
                <p className="text-xs text-blue-300/80 mb-3">
                  You are enabling auto-compound for YOUR OWN validator. Grant additional permissions:
                </p>
                <div className="space-y-2">
                  {/* Vote Permission */}
                  <label className="flex items-start gap-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={acIncludeVote}
                      onChange={(e) => setAcIncludeVote(e.target.checked)}
                      className="mt-0.5 w-4 h-4 rounded border-gray-600 bg-[#111111] text-purple-500 focus:ring-purple-500 focus:ring-offset-0"
                    />
                    <div className="flex-1">
                      <span className="text-white text-sm group-hover:text-purple-300 transition-colors">
                        Allow Governance Voting
                      </span>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Bot can vote on governance proposals on your behalf
                      </p>
                    </div>
                  </label>
                  
                  {/* Commission Permission */}
                  <label className="flex items-start gap-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={acIncludeCommission}
                      onChange={(e) => setAcIncludeCommission(e.target.checked)}
                      className="mt-0.5 w-4 h-4 rounded border-gray-600 bg-[#111111] text-purple-500 focus:ring-purple-500 focus:ring-offset-0"
                    />
                    <div className="flex-1">
                      <span className="text-white text-sm group-hover:text-purple-300 transition-colors">
                        Allow Commission Withdrawal & Compound
                      </span>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Bot can withdraw validator commission and automatically re-stake it
                      </p>
                    </div>
                  </label>
                </div>
              </div>
            )}

            {/* Summary */}
            <div className="mb-6 p-4 bg-[#111111] border border-gray-800 rounded-lg space-y-2">
              <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">Summary</p>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Validator:</span>
                  <span className="text-white font-medium truncate ml-2 max-w-[200px]">{selectedValidatorForAC.moniker}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Grantee:</span>
                  <span className="text-white text-xs truncate ml-2 max-w-[200px] font-mono">
                    {(() => {
                      const operator = chain?.autocompound_operators?.find(
                        (op: any) => op.validator_address === selectedValidatorForAC.address
                      );
                      return operator?.grantee_address || 'Not supported';
                    })()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Min. Amount:</span>
                  <span className="text-white">{acMinAmount || '0'} {asset?.symbol}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Frequency:</span>
                  <span className="text-white capitalize">{acFrequency}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Duration:</span>
                  <span className="text-white">{acDuration} {acDurationType}{acDuration !== '1' ? 's' : ''}</span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => setShowAutoCompoundModal(false)}
                className="flex-1 px-4 py-3 bg-gray-800 hover:bg-gray-700 text-white font-medium rounded-lg transition-all"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!chain) return;
                  
                  setIsEnablingAC(true);
                  try {
                    console.log('📥 Importing enableAutoCompound from lib/keplr...');
                    const keplrModule = await import('../lib/keplr');
                    console.log('📦 Imported module keys:', Object.keys(keplrModule));
                    
                    const { enableAutoCompound } = keplrModule;
                    console.log('✅ enableAutoCompound imported:', typeof enableAutoCompound);
                    
                    if (!enableAutoCompound || typeof enableAutoCompound !== 'function') {
                      throw new Error(`enableAutoCompound is not a function. Got: ${typeof enableAutoCompound}`);
                    }

                    console.log('🚀 Calling enableAutoCompound with params:', {
                      chainId: chain.chain_id,
                      validatorAddress: selectedValidatorForAC.address,
                      minAmount: acMinAmount,
                      frequency: acFrequency
                    });

                    // Determine grantee address
                    let granteeAddress: string | undefined;
                    
                    // Priority 1: Custom grantee (for validators running their own bot)
                    if (acCustomGrantee && acCustomGrantee.trim() !== '') {
                      granteeAddress = acCustomGrantee.trim();
                    } else {
                      // Priority 2: Get from validator operator registry
                      const operator = (chain as any).autocompound_operators?.find(
                        (op: any) => op.validator_address === selectedValidatorForAC.address
                      );
                      granteeAddress = operator?.grantee_address;
                    }

                    if (!granteeAddress) {
                      throw new Error('No grantee address available. This validator may not support auto-compound yet.');
                    }

                    const result = await enableAutoCompound(chain, {
                      validatorAddress: selectedValidatorForAC.address,
                      minAmount: acMinAmount,
                      frequency: acFrequency as 'minutely' | 'hourly' | 'daily' | 'weekly' | 'monthly',
                      duration: parseInt(acDuration),
                      durationUnit: acDurationType as 'month' | 'year',
                      grantee: granteeAddress,
                      includeVote: acIncludeVote,
                      includeCommission: acIncludeCommission
                    });
                    
                    if (result.success) {
                      if (chain.chain_id) {
                        const { saveAutoCompoundStatus } = await import('../lib/autoCompoundStorage');
                        saveAutoCompoundStatus(
                          chain.chain_id,
                          selectedValidatorForAC.address,
                          true,
                          parseInt(chain.coin_type || '118'),
                          {
                            minAmount: acMinAmount,
                            frequency: acFrequency as 'daily' | 'weekly' | 'monthly',
                            duration: parseInt(acDuration),
                            durationUnit: acDurationType as 'month' | 'year'
                          },
                          granteeAddress
                        );
                        // Refresh banner immediately
                        const enabledValidators = getAutoCompoundValidators(chain.chain_id);
                        setAutoCompoundBanner({
                          enabled: enabledValidators.length,
                          validators: enabledValidators
                        });
                        setShowBanner(true);
                      }
                      // Show success modal
                      setAcTxResult({ 
                        success: true, 
                        txHash: result.txHash,
                        type: 'enable',
                        validatorName: selectedValidatorForAC.moniker
                      });
                      setShowAutoCompoundModal(false);
                      
                      // Trigger re-check of all validators auto-compound status
                      window.dispatchEvent(new CustomEvent('autocompound_status_changed'));
                    } else {
                      // Show error modal
                      setAcTxResult({ 
                        success: false, 
                        error: result.error,
                        type: 'enable'
                      });
                    }
                  } catch (error) {
                    console.error('Enable error:', error);
                    // Show error modal
                    setAcTxResult({ 
                      success: false, 
                      error: error instanceof Error ? error.message : 'Unknown error',
                      type: 'enable'
                    });
                  } finally {
                    setIsEnablingAC(false);
                  }
                }}
                disabled={(() => {
                  if (isEnablingAC) return true;
                  if (!acMinAmount || parseFloat(acMinAmount) <= 0) return true;
                  if (!acDuration || parseInt(acDuration) <= 0) return true;
                  
                  // Check if validator wallet - if yes, custom grantee required
                  const isValidatorWallet = account?.address && selectedValidatorForAC?.address && 
                    convertAccountToValidatorAddress(account.address) === selectedValidatorForAC.address;
                  
                  if (isValidatorWallet) {
                    // Validator must provide custom grantee
                    return !acCustomGrantee || acCustomGrantee.trim() === '';
                  } else {
                    // Regular user - check if chain has operator for this validator
                    return !(chain as any).autocompound_operators?.find((op: any) => op.validator_address === selectedValidatorForAC.address);
                  }
                })()}
                className="flex-1 px-4 py-3 bg-purple-500 hover:bg-purple-600 text-white font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 active:scale-95 flex items-center justify-center gap-2"
              >
                {isEnablingAC ? (
                  <>
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Enabling...
                  </>
                ) : (
                  'Enable Auto-Compound'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Disable Auto-Compound Confirmation Modal */}
      {showDisableConfirm && validatorToDisable && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setShowDisableConfirm(false)}>
          <div className="bg-[#1a1a1a] rounded-2xl max-w-md w-full p-8 relative" onClick={(e) => e.stopPropagation()}>
            <button 
              onClick={() => setShowDisableConfirm(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
            >
              ✕
            </button>

            <div className="mb-6">
              <div className="flex items-center justify-center mb-4">
                <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center">
                  <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
              </div>
              <h2 className="text-2xl font-bold text-white mb-2 text-center">Disable Auto-Compound?</h2>
              <p className="text-gray-400 text-center">
                Are you sure you want to disable auto-compound for <span className="text-white font-medium">{validatorToDisable.moniker}</span>?
              </p>
              <p className="text-gray-500 text-sm text-center mt-2">
                Your rewards will no longer be automatically compounded.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => setShowDisableConfirm(false)}
                disabled={isDisablingAC}
                className="flex-1 px-4 py-3 bg-gray-800 hover:bg-gray-700 text-white font-medium rounded-lg transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!chain) return;
                  
                  setIsDisablingAC(true);
                  try {
                    const { disableAutoCompound } = await import('../lib/keplr');
                    const result = await disableAutoCompound(chain, {
                      validatorAddress: validatorToDisable.address
                    });
                    
                    if (result.success) {
                      if (chain.chain_id) {
                        const { saveAutoCompoundStatus } = await import('../lib/autoCompoundStorage');
                        saveAutoCompoundStatus(chain.chain_id, validatorToDisable.address, false);
                        
                        // Refresh banner
                        const enabledValidators = getAutoCompoundValidators(chain.chain_id);
                        setAutoCompoundBanner({
                          enabled: enabledValidators.length,
                          validators: enabledValidators
                        });
                        if (enabledValidators.length === 0) {
                          setShowBanner(false);
                        }
                      }
                      
                      // Show success modal
                      setAcTxResult({ 
                        success: true, 
                        txHash: result.txHash,
                        type: 'disable'
                      });
                      setShowDisableConfirm(false);
                      
                      // Trigger re-check of all validators auto-compound status
                      window.dispatchEvent(new CustomEvent('autocompound_status_changed'));
                    } else {
                      // Show error modal
                      setAcTxResult({ 
                        success: false, 
                        error: result.error,
                        type: 'disable'
                      });
                      setShowDisableConfirm(false);
                    }
                  } catch (error) {
                    console.error('Disable error:', error);
                    setAcTxResult({ 
                      success: false, 
                      error: error instanceof Error ? error.message : 'Unknown error',
                      type: 'disable'
                    });
                    setShowDisableConfirm(false);
                  } finally {
                    setIsDisablingAC(false);
                  }
                }}
                disabled={isDisablingAC}
                className="flex-1 px-4 py-3 bg-red-500 hover:bg-red-600 text-white font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 active:scale-95 flex items-center justify-center gap-2"
              >
                {isDisablingAC ? (
                  <>
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Disabling...
                  </>
                ) : (
                  'Yes, Disable'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Auto-Compound Transaction Result Modal */}
      {acTxResult && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[70] px-4">
          <div className="bg-gradient-to-br from-[#1a1a1a] to-[#0a0a0a] border border-gray-800 rounded-2xl p-8 max-w-md w-full shadow-2xl animate-scale-in">
            <div className="flex flex-col items-center text-center space-y-6">
              {acTxResult.success ? (
                <>
                  {/* Success Icon */}
                  <div className="relative">
                    <div className="absolute inset-0 bg-purple-500/20 rounded-full blur-2xl animate-pulse"></div>
                    <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-500/50">
                      <svg className="w-10 h-10 text-white animate-bounce-slow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  </div>
                  
                  {/* Success Message */}
                  <div className="space-y-2">
                    <h3 className="text-2xl font-bold text-white">
                      {acTxResult.type === 'enable' ? 'Auto-Compound Enabled!' : 'Auto-Compound Disabled!'}
                    </h3>
                    <p className="text-gray-400">
                      {acTxResult.type === 'enable' 
                        ? `Rewards will be automatically compounded for ${acTxResult.validatorName || 'this validator'}`
                        : `Auto-compound has been disabled for ${acTxResult.validatorName || 'this validator'}`
                      }
                    </p>
                  </div>
                  
                  {/* Transaction Hash */}
                  <div className="w-full bg-[#0a0a0a] border border-gray-800 rounded-xl p-4 space-y-2">
                    <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">Transaction Hash</p>
                    <div className="flex items-center gap-2">
                      <code className="text-xs text-purple-400 font-mono break-all flex-1">
                        {acTxResult.txHash}
                      </code>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(acTxResult.txHash || '');
                        }}
                        className="p-2 hover:bg-gray-800 rounded-lg transition-colors flex-shrink-0"
                        title="Copy to clipboard"
                      >
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="flex gap-3 w-full pt-2">
                    <button
                      onClick={() => {
                        const chainPath = chain?.chain_name.toLowerCase().replace(/\\s+/g, '-') || '';
                        window.open(`/${chainPath}/transactions/${acTxResult.txHash}`, '_blank');
                      }}
                      className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white font-medium rounded-lg transition-all hover:scale-105 active:scale-95 shadow-lg shadow-purple-500/30"
                    >
                      View in Explorer
                    </button>
                    <button
                      onClick={() => {
                        setAcTxResult(null);
                      }}
                      className="flex-1 px-4 py-3 bg-gray-800 hover:bg-gray-700 text-white font-medium rounded-lg transition-all hover:scale-105 active:scale-95"
                    >
                      Close
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {/* Error Icon */}
                  <div className="relative">
                    <div className="absolute inset-0 bg-red-500/20 rounded-full blur-2xl animate-pulse"></div>
                    <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center shadow-lg shadow-red-500/50">
                      <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </div>
                  </div>
                  
                  {/* Error Message */}
                  <div className="space-y-2">
                    <h3 className="text-2xl font-bold text-white">
                      {acTxResult.type === 'enable' ? 'Failed to Enable Auto-Compound' : 'Failed to Disable Auto-Compound'}
                    </h3>
                    <p className="text-gray-400">An error occurred while processing your request</p>
                  </div>
                  
                  {/* Error Details */}
                  <div className="w-full bg-[#0a0a0a] border border-red-900/50 rounded-xl p-4 space-y-2">
                    <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">Error Details</p>
                    <p className="text-sm text-red-400 break-words">
                      {acTxResult.error || 'Unknown error occurred'}
                    </p>
                  </div>
                  
                  {/* Close Button */}
                  <button
                    onClick={() => setAcTxResult(null)}
                    className="w-full px-4 py-3 bg-gray-800 hover:bg-gray-700 text-white font-medium rounded-lg transition-all hover:scale-105 active:scale-95"
                  >
                    Close
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
