'use client';

import { useEffect, useState, useCallback, useMemo, memo, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import Link from 'next/link';
import { ChainData } from '@/types/chain';
import { ArrowLeft, Shield, TrendingUp, Users, Award, Clock, DollarSign, FileText, Send, QrCode } from 'lucide-react';
import ValidatorAvatar from '@/components/ValidatorAvatar';
import { getCacheKey, setCache, getStaleCache } from '@/lib/cacheUtils';
import { fetchApi } from '@/lib/api';
import { useLanguage } from '@/contexts/LanguageContext';
import { getTranslation } from '@/lib/i18n';
import { convertValidatorToAccountAddress } from '@/lib/addressConverter';
import { getConsensusAddressesFromPubkey } from '@/lib/consensusUtils';
import { useWallet } from '@/contexts/WalletContext';

interface ValidatorDetail {
  address: string;
  accountAddress?: string;
  consensusAddress?: string;
  hexAddress?: string;
  consensus_pubkey?: any;
  moniker: string;
  website: string;
  details: string;
  identity: string;
  votingPower: string;
  votingPowerPercentage: string;
  commission: string;
  maxCommission: string;
  maxChangeRate: string;
  status: string;
  jailed: boolean;
  tokens: string;
  delegatorShares: string;
  unbondingHeight: string;
  unbondingTime: string;
  uptimePercentage?: number;
}

interface UptimeBlock {
  height: number;
  signed: boolean;
}

interface Delegation {
  delegator: string;
  shares: string;
  balance: string;
}

interface UnbondingDelegation {
  delegator: string;
  entries: Array<{
    balance: string;
    completionTime: string;
  }>;
}

interface ValidatorTransaction {
  hash: string;
  type: string;
  height: number;
  time: string;
  result: string;
}

export default function ValidatorDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { language } = useLanguage();
  const t = (key: string) => getTranslation(language, key);
  const [chains, setChains] = useState<ChainData[]>([]);
  const [selectedChain, setSelectedChain] = useState<ChainData | null>(null);
  const [validator, setValidator] = useState<ValidatorDetail | null>(null);
  const [delegations, setDelegations] = useState<Delegation[]>([]);
  const [unbondingDelegations, setUnbondingDelegations] = useState<UnbondingDelegation[]>([]);
  const [transactions, setTransactions] = useState<ValidatorTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'delegations' | 'unbonding' | 'transactions'>('delegations');
  const [showStakeModal, setShowStakeModal] = useState(false);
  const [stakeTab, setStakeTab] = useState<'delegate' | 'undelegate' | 'redelegate' | 'withdraw'>('delegate');
  const [stakeAmount, setStakeAmount] = useState('');
  const [stakePercentage, setStakePercentage] = useState(0);
  const [uptimeBlocks, setUptimeBlocks] = useState<UptimeBlock[]>([]);
  const [uptimePercentage, setUptimePercentage] = useState<number>(0);
  const { isConnected, account } = useWallet();
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
  const [showQRModal, setShowQRModal] = useState(false);
  const [validatorSearchQuery, setValidatorSearchQuery] = useState('');
  
  // Edit Commission States
  const [showEditCommissionModal, setShowEditCommissionModal] = useState(false);
  const [newCommissionRate, setNewCommissionRate] = useState('');
  const [isEditingCommission, setIsEditingCommission] = useState(false);
  const [commissionTxResult, setCommissionTxResult] = useState<{ success: boolean; txHash?: string; error?: string } | null>(null);
  const [validators, setValidators] = useState<any[]>([]);
  const [validatorBalance, setValidatorBalance] = useState<string>('Loading...');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState('');
  const [pendingCommissionUpdate, setPendingCommissionUpdate] = useState(false);
  const [showUnjailModal, setShowUnjailModal] = useState(false);
  const [isUnjailing, setIsUnjailing] = useState(false);
  const [unjailTxResult, setUnjailTxResult] = useState<{ success: boolean; txHash?: string; error?: string } | null>(null);
  const [showSendModal, setShowSendModal] = useState(false);
  const [sendRecipient, setSendRecipient] = useState('');
  const [sendAmount, setSendAmount] = useState('');
  const [sendMemo, setSendMemo] = useState('Integrate WinScan');
  const [isSending, setIsSending] = useState(false);
  const [sendTxResult, setSendTxResult] = useState<{ success: boolean; txHash?: string; error?: string } | null>(null);
  
  // Validator's own delegation info (self-delegation) for Voting Power section
  const [validatorDelegation, setValidatorDelegation] = useState<string>('0');
  const [validatorUnbonding, setValidatorUnbonding] = useState<string>('0');
  const [unbondingCompletionTime, setUnbondingCompletionTime] = useState<string | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<string>('');

  const chainPath = useMemo(() => 
    selectedChain ? selectedChain.chain_name.toLowerCase().replace(/\s+/g, '-') : '',
    [selectedChain]
  );

  useEffect(() => {
    const cachedChains = sessionStorage.getItem('chains');
    
    if (cachedChains) {
      const data = JSON.parse(cachedChains);
      setChains(data);
      const chainName = (params?.chain as string)?.trim();
      const chain = chainName 
        ? data.find((c: ChainData) => c.chain_name.toLowerCase().replace(/\s+/g, '-') === chainName.toLowerCase())
        : data.find((c: ChainData) => c.chain_name === 'lumera-mainnet') || data[0];
      if (chain) setSelectedChain(chain);
    } else {
      fetchApi('/api/chains')
        .then(res => res.json())
        .then(data => {
          sessionStorage.setItem('chains', JSON.stringify(data));
          setChains(data);
          const chainName = (params?.chain as string)?.trim();
          const chain = chainName 
            ? data.find((c: ChainData) => c.chain_name.toLowerCase().replace(/\s+/g, '-') === chainName.toLowerCase())
            : data.find((c: ChainData) => c.chain_name === 'lumera-mainnet') || data[0];
          if (chain) setSelectedChain(chain);
        });
    }
  }, [params]);

  // Function to calculate time remaining until unbonding completion
  const getTimeRemaining = (completionTime: string) => {
    const now = new Date().getTime();
    const completion = new Date(completionTime).getTime();
    const diff = completion - now;

    if (diff <= 0) return 'Completed';

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    const parts = [];
    if (days > 0) parts.push(`${days} day${days > 1 ? 's' : ''}`);
    if (hours > 0) parts.push(`${hours} hour${hours > 1 ? 's' : ''}`);
    if (minutes > 0) parts.push(`${minutes} minute${minutes > 1 ? 's' : ''}`);
    if (seconds > 0) parts.push(`${seconds} second${seconds > 1 ? 's' : ''}`);

    return parts.join(' ') || 'Less than a second';
  };

  const fetchValidatorData = useCallback(async (showLoading = true) => {
    if (!selectedChain || !params?.address) return;
    
    // Prevent multiple simultaneous fetches
    if (isRefreshing) {
      console.log('[Validator Detail] Already fetching, skipping duplicate request');
      return;
    }
    
    // 🚀 PING.PUB PATTERN: Show cached data INSTANTLY, no loading state
    const validatorCacheKey = getCacheKey('validator', selectedChain.chain_name, params.address as string);
    const delegationsCacheKey = getCacheKey('validator-delegations', selectedChain.chain_name, params.address as string);
    const txCacheKey = getCacheKey('validator-transactions', selectedChain.chain_name, params.address as string);
    
    const cachedValidator = getStaleCache<ValidatorDetail>(validatorCacheKey);
    const cachedDelegations = getStaleCache<any>(delegationsCacheKey);
    const cachedTx = getStaleCache<any>(txCacheKey);
    
    // Show cached data INSTANTLY - no loading screen
    if (cachedValidator) {
      setValidator(cachedValidator);
      setLoading(false); // Hide skeleton immediately
      console.log('✅ [Validator] Loaded from cache instantly');
    }
    if (cachedDelegations) {
      setDelegations(cachedDelegations.delegations || []);
      setUnbondingDelegations(cachedDelegations.unbonding || []);
      console.log('✅ [Delegations] Loaded from cache instantly');
    }
    if (cachedTx) {
      setTransactions(Array.isArray(cachedTx) ? cachedTx : (cachedTx.transactions || []));
      console.log('✅ [Transactions] Loaded from cache instantly');
    }
    
    // If no cache, show skeleton briefly then render with placeholder
    if (!cachedValidator && showLoading) {
      setLoading(true);
      // Auto-hide skeleton after 500ms even if data not loaded (Ping.pub pattern)
      setTimeout(() => {
        if (!validator) {
          setLoading(false);
          // Set placeholder validator so UI renders
          setValidator({
            address: params.address as string,
            moniker: 'Loading...',
            website: '',
            details: '',
            identity: '',
            votingPower: '0',
            votingPowerPercentage: '0',
            commission: '0',
            maxCommission: '0',
            maxChangeRate: '0',
            status: 'BOND_STATUS_BONDED',
            jailed: false,
            tokens: '0',
            delegatorShares: '0',
            unbondingHeight: '0',
            unbondingTime: '',
          });
        }
      }, 500);
    } else {
      setIsRefreshing(true);
    }
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      let accountAddress = validator?.accountAddress;
      if (!accountAddress && params.address) {
        accountAddress = convertValidatorToAccountAddress(params.address as string);
      }
      
      const [validatorRes, delegationsRes, txRes] = await Promise.allSettled([
        fetchApi(`/api/validator?chain=${selectedChain.chain_id || selectedChain.chain_name}&address=${params.address}`, { 
          signal: controller.signal 
        }),
        fetchApi(`/api/validator/delegations?chain=${selectedChain.chain_name}&address=${params.address}`, { 
          signal: controller.signal 
        }),

        fetchApi(`/api/validator/transactions?chain=${selectedChain.chain_name}&address=${accountAddress || params.address}&limit=1000`, { 
          signal: controller.signal 
        })
      ]);
      
      clearTimeout(timeoutId);
      
      // Update validator data in background
      if (validatorRes.status === 'fulfilled' && validatorRes.value.ok) {
        const validatorData = await validatorRes.value.json();
        if (!validatorData.error) {
          // Convert validator address to account address if not present
          if (!validatorData.accountAddress && validatorData.address) {
            validatorData.accountAddress = convertValidatorToAccountAddress(validatorData.address);
          }
          
          // Convert consensus pubkey to addresses
          const chainPrefix = selectedChain.bech32_prefix || selectedChain.addr_prefix;
          if (validatorData.consensus_pubkey && chainPrefix) {
            try {
              const { consensusAddress, hexAddress } = await getConsensusAddressesFromPubkey(
                validatorData.consensus_pubkey,
                chainPrefix
              );
              if (consensusAddress) validatorData.consensusAddress = consensusAddress;
              if (hexAddress) validatorData.hexAddress = hexAddress;
            } catch (error) {
              console.error('Error converting consensus pubkey:', error);
            }
          }
          setValidator(validatorData);
          setCache(validatorCacheKey, validatorData);
          console.log('🔄 [Validator] Updated from API');
          
          // Fetch validator account balance in background (non-blocking)
          if (validatorData.accountAddress && selectedChain.api?.[0]?.address) {
            const denom = selectedChain.assets?.[0]?.base || 'uatom';
            const balanceUrl = `${selectedChain.api[0].address}/cosmos/bank/v1beta1/balances/${validatorData.accountAddress}`;
            fetch(balanceUrl).then(balanceRes => {
              if (balanceRes.ok) {
                return balanceRes.json();
              }
              return null;
            }).then(balanceData => {
              if (balanceData && balanceData.balances && balanceData.balances.length > 0) {
                const nativeBalance = balanceData.balances.find((b: any) => b.denom === denom) || balanceData.balances[0];
                const exponent = Number(selectedChain.assets?.[0]?.exponent || 6);
                const formattedBalance = (parseFloat(nativeBalance.amount) / Math.pow(10, exponent)).toFixed(2);
                setValidatorBalance(`${formattedBalance} ${selectedChain.assets?.[0]?.symbol || 'ATOM'}`);
              } else {
                setValidatorBalance('0');
              }
            }).catch(() => {
              setValidatorBalance('N/A');
            });
          } else {
            setValidatorBalance('N/A');
          }

          // Fetch validator commission in background (non-blocking)
          const asset = selectedChain.assets?.[0];
          const validatorAddress = params.address as string;

          if (selectedChain.api && selectedChain.api.length > 0) {
            const commissionUrl = `${selectedChain.api[0].address}/cosmos/distribution/v1beta1/validators/${validatorAddress}/commission`;
            fetch(commissionUrl).then(commissionRes => {
              if (commissionRes.ok) {
                return commissionRes.json();
              }
              return null;
            }).then(commissionData => {
              if (commissionData) {
                let commissionList = [];
                if (commissionData.commission && commissionData.commission.commission) {
                  commissionList = commissionData.commission.commission;
                } else if (commissionData.commission) {
                  commissionList = commissionData.commission;
                }
                
                if (Array.isArray(commissionList) && commissionList.length > 0) {
                  const mainCommission = commissionList.find((c: any) => c.denom === asset?.base);
                  
                  if (mainCommission && mainCommission.amount) {
                    const commissionAmount = mainCommission.amount.includes('.') 
                      ? parseFloat(mainCommission.amount)
                      : parseFloat(mainCommission.amount);
                    const exponent = Number(asset?.exponent || 6);
                    const formattedCommission = (commissionAmount / Math.pow(10, exponent)).toFixed(2);
                    setCommission(formattedCommission);
                  } else {
                    setCommission('0.00');
                  }
                } else {
                  setCommission('0.00');
                }
              } else {
                setCommission('0.00');
              }
            }).catch(() => {
              setCommission('0.00');
            });
          } else {
            setCommission('0.00');
          }

          // Fetch validator's self-delegation rewards in background (non-blocking)
          if (validatorData.accountAddress && selectedChain.api && selectedChain.api.length > 0) {
            const rewardsUrl = `${selectedChain.api[0].address}/cosmos/distribution/v1beta1/delegators/${validatorData.accountAddress}/rewards/${validatorAddress}`;
            fetch(rewardsUrl).then(rewardsRes => {
              if (rewardsRes.ok) {
                return rewardsRes.json();
              }
              return null;
            }).then(rewardsData => {
              if (rewardsData) {
                let rewardsList = [];
                if (rewardsData.rewards && Array.isArray(rewardsData.rewards)) {
                  rewardsList = rewardsData.rewards;
                }
                
                if (Array.isArray(rewardsList) && rewardsList.length > 0) {
                  const mainReward = rewardsList.find((r: any) => r.denom === asset?.base);
                  
                  if (mainReward && mainReward.amount) {
                    const rewardAmount = mainReward.amount.includes('.')
                      ? parseFloat(mainReward.amount)
                      : parseFloat(mainReward.amount);
                    const exponent = Number(asset?.exponent || 6);
                    const formattedRewards = (rewardAmount / Math.pow(10, exponent)).toFixed(2);
                    setRewards(formattedRewards);
                  } else {
                    setRewards('0.00');
                  }
                } else {
                  setRewards('0.00');
                }
              } else {
                setRewards('0.00');
              }
            }).catch(() => {
              setRewards('0.00');
            });
          } else {
            setRewards('0.00');
          }
        } else if (!cachedValidator) {
          setValidator(null);
        }
      } else if (!cachedValidator) {
        setValidator(null);
      }
      
      // Update delegations in background
      if (delegationsRes.status === 'fulfilled' && delegationsRes.value.ok) {
        const delegationsData = await delegationsRes.value.json();
        setDelegations(delegationsData.delegations || []);
        setUnbondingDelegations(delegationsData.unbonding || []);
        setCache(delegationsCacheKey, delegationsData);
        console.log('🔄 [Delegations] Updated from API');
      }
      
      // Update transactions in background
      if (txRes.status === 'fulfilled' && txRes.value.ok) {
        const txData = await txRes.value.json();
        setTransactions(Array.isArray(txData) ? txData : (txData.transactions || []));
        setCache(txCacheKey, txData);
        console.log('🔄 [Transactions] Updated from API');
      }

      // Fetch uptime in background (non-blocking)
      if (validatorRes.status === 'fulfilled' && selectedChain && params.address) {
        fetchApi(
          `/api/uptime/validator?chain=${selectedChain.chain_name}&address=${params.address}&blocks=150`,
          { signal: controller.signal }
        ).then(uptimeRes => {
          if (uptimeRes?.ok) {
            return uptimeRes.json();
          }
          return null;
        }).then(uptimeData => {
          if (uptimeData && uptimeData.blocks && Array.isArray(uptimeData.blocks)) {
            setUptimeBlocks(uptimeData.blocks);
            
            const totalBlocks = uptimeData.blocks.length;
            const signedCount = uptimeData.blocks.filter((block: any) => {
              return block.signed === true || block.signed === 1 || block.signed === '1' || block.signed;
            }).length;
            const calculatedUptime = totalBlocks > 0 ? (signedCount / totalBlocks) * 100 : 0;
            
            setUptimePercentage(calculatedUptime);
            console.log('🔄 [Uptime] Updated from API');
          }
        }).catch(() => {
          console.log('[Uptime] Failed to fetch, using cached data');
        });
      }
    } catch (err) {
      if (!cachedValidator && !validator) {
        setValidator(null);
      }
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [selectedChain, params]);

  // Fetch validator data once on mount or when chain/address changes
  // Use a ref to track if we've already fetched for this chain+address combo
  const lastFetchRef = useRef<string>('');
  
  useEffect(() => {
    if (!selectedChain?.chain_name || !params?.address) return;
    
    const fetchKey = `${selectedChain.chain_name}-${params.address}`;
    if (lastFetchRef.current === fetchKey) {
      console.log('[Validator Detail] Already fetched for this validator, skipping');
      return;
    }
    
    lastFetchRef.current = fetchKey;
    fetchValidatorData(true);
  }, [selectedChain?.chain_name, params?.address]);

  // Auto-update uptime every 10 seconds for realtime visualization
  useEffect(() => {
    if (!selectedChain || !params?.address) return;
    
    const fetchUptimeRealtime = async () => {
      try {
        const uptimeRes = await fetchApi(
          `/api/uptime/validator?chain=${selectedChain.chain_name}&address=${params.address}&blocks=100`,
          { signal: AbortSignal.timeout(5000) }
        );
        
        if (uptimeRes?.ok) {
          const uptimeData = await uptimeRes.json();
          if (uptimeData && uptimeData.blocks && Array.isArray(uptimeData.blocks)) {
            setUptimeBlocks(uptimeData.blocks);
            
            const totalBlocks = uptimeData.blocks.length;
            const signedCount = uptimeData.blocks.filter((block: any) => {
              return block.signed === true || block.signed === 1 || block.signed === '1' || block.signed;
            }).length;
            const calculatedUptime = totalBlocks > 0 ? (signedCount / totalBlocks) * 100 : 0;
            
            setUptimePercentage(calculatedUptime);
            console.log('🔄 [Uptime Realtime] Updated:', calculatedUptime.toFixed(2) + '%');
          }
        }
      } catch (error) {
        console.log('[Uptime Realtime] Failed to fetch');
      }
    };
    
    // Initial fetch
    fetchUptimeRealtime();
    
    // Update every 10 seconds
    const interval = setInterval(fetchUptimeRealtime, 10000);

    return () => clearInterval(interval);
  }, [selectedChain?.chain_name, params?.address]);

  // REMOVED: Duplicate uptime fetch - already handled in fetchValidatorData()
  // This was causing infinite loop because validator state changes triggered re-fetch
  // Uptime is now fetched in 2 places within fetchValidatorData():
  // 1. blocks=150 for chart visualization 
  // 2. blocks=100 for uptime card (if needed separately)
  // Both now recalculate from blocks array instead of using backend cached value

  // Fetch validators list for redelegate
  useEffect(() => {
    if (!selectedChain) return;
    
    fetchApi(`/api/validators?chain=${selectedChain.chain_name}`)
      .then(res => res.json())
      .then(data => {
        if (data.validators) {
          setValidators(data.validators);
        }
      })
      .catch(console.error);
  }, [selectedChain]);

  // Handle stake modal and delegation data
  useEffect(() => {
    if (showStakeModal && validator && account && selectedChain) {
      fetchDelegationData(validator.address, account.address);
    }
  }, [showStakeModal, account?.address, validator?.address, selectedChain?.chain_id]);

  // Fetch validator's own delegation info (self-delegation) for Voting Power section
  useEffect(() => {
    if (validator?.accountAddress && selectedChain) {
      fetchValidatorDelegationInfo(validator.address, validator.accountAddress);
    } else {
      setValidatorDelegation('0');
      setValidatorUnbonding('0');
    }
  }, [validator?.address, validator?.accountAddress, selectedChain?.chain_id]);

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

  // Update countdown timer every second
  useEffect(() => {
    if (!unbondingCompletionTime) {
      setTimeRemaining('');
      return;
    }

    const updateTimer = () => {
      setTimeRemaining(getTimeRemaining(unbondingCompletionTime));
    };

    updateTimer(); // Initial update
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [unbondingCompletionTime]);

  useEffect(() => {
    if (!showStakeModal) {
      setStakeAmount('');
      setStakePercentage(0);
      setDestinationValidator('');
      setValidatorSearchQuery('');
      setShowValidatorList(false);
      setTxResult(null);
    }
  }, [showStakeModal]);

  // Calculate amount based on percentage
  useEffect(() => {
    if (!validator || !selectedChain?.assets?.[0] || stakePercentage === 0) return;
    
    const asset = selectedChain.assets[0];
    let maxAmount = 0;
    if (stakeTab === 'delegate') {
      const exponent = Number(asset.exponent);
      const gasReserve = 0.01;
      const availableBalance = Math.max(0, parseFloat(balance) - gasReserve);
      maxAmount = availableBalance;
    } else if (stakeTab === 'undelegate' || stakeTab === 'redelegate') {
      maxAmount = parseFloat(stakedAmount);
    }
    
    if (maxAmount > 0) {
      const calculatedAmount = (maxAmount * stakePercentage / 100).toFixed(6);
      setStakeAmount(calculatedAmount);
    }
  }, [stakePercentage, stakeTab, balance, stakedAmount, validator, selectedChain]);

  const fetchDelegationData = async (validatorAddress: string, delegatorAddress: string) => {
    setStakedAmount('Loading...');
    setBalance('Loading...');
    setRewards('Loading...');
    setCommission('Loading...');
    
    if (!selectedChain) {
      setStakedAmount('0.000');
      setBalance('0.000');
      setRewards('0.000');
      setCommission('0.000');
      return;
    }

    const asset = selectedChain.assets?.[0];
    const denom = asset?.base || 'ulume';
    const exponent = Number(asset?.exponent || 6);
    
    try {
      // 🚀 OPTIMIZED: Single bundled API call instead of 4+ sequential requests
      const bundleRes = await fetch('/api/user-delegation-bundle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chain: selectedChain.chain_id || selectedChain.chain_name,
          validatorAddress,
          delegatorAddress,
          denom
        }),
        signal: AbortSignal.timeout(10000)
      });
      
      if (!bundleRes.ok) {
        throw new Error('Failed to fetch delegation data');
      }
      
      const bundle = await bundleRes.json();
      
      // Format and set all data
      const formattedBalance = (parseFloat(bundle.balance) / Math.pow(10, exponent)).toFixed(3);
      const formattedStaked = (parseFloat(bundle.stakedAmount) / Math.pow(10, exponent)).toFixed(3);
      const formattedRewards = (parseFloat(bundle.rewards) / Math.pow(10, exponent)).toFixed(6);
      const formattedCommission = (parseFloat(bundle.commission) / Math.pow(10, exponent)).toFixed(2);
      
      setBalance(formattedBalance);
      setStakedAmount(formattedStaked);
      setRewards(formattedRewards);
      setCommission(formattedCommission);
      
      console.log('[Delegation Bundle] ✅ Loaded user data');
      
    } catch (error) {
      console.error('[Delegation Bundle] Error:', error);
      
      // Fallback to old sequential method if bundle fails
      try {
        const { StargateClient } = await import('@cosmjs/stargate');
        
        let client: any = null;
        if (selectedChain.rpc && selectedChain.rpc.length > 0) {
          for (const rpcEndpoint of selectedChain.rpc) {
            try {
              client = await StargateClient.connect(rpcEndpoint.address);
              break;
            } catch (error) {
              continue;
            }
          }
        }
        
        if (!client) {
          setStakedAmount('0.000');
          setBalance('0.000');
          setRewards('0.000');
          setCommission('0.000');
          return;
        }
        
        // Fetch balance
        try {
        const denom = asset?.base || 'ulume';
        const balance = await client.getBalance(delegatorAddress, denom);
        const formattedBalance = asset
          ? (parseFloat(balance.amount) / Math.pow(10, Number(asset.exponent))).toFixed(3)
          : balance.amount;
        setBalance(formattedBalance);
      } catch (error) {
        if (selectedChain.api && selectedChain.api.length > 0) {
          for (const endpoint of selectedChain.api) {
            try {
              const denom = asset?.base || 'ulume';
              const balanceUrl = `${endpoint.address}/cosmos/bank/v1beta1/balances/${delegatorAddress}/${denom}`;
              const res = await fetch(balanceUrl);
              if (res.ok) {
                const data = await res.json();
                if (data.balance) {
                  const formattedBalance = asset
                    ? (parseFloat(data.balance.amount) / Math.pow(10, Number(asset.exponent))).toFixed(3)
                    : data.balance.amount;
                  setBalance(formattedBalance);
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
      
      // Fetch delegation
      try {
        let delegationFound = false;
        if (selectedChain.api && selectedChain.api.length > 0) {
          for (const endpoint of selectedChain.api) {
            try {
              const allDelegationsUrl = `${endpoint.address}/cosmos/staking/v1beta1/delegations/${delegatorAddress}`;
              const res = await fetch(allDelegationsUrl);
              
              if (!res.ok) continue;
              
              const data = await res.json();
              
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
                  delegationFound = true;
                  break;
                }
              }
            } catch (e: any) {
              continue;
            }
          }
        }
        
        if (!delegationFound) {
          setStakedAmount('0.000');
        }
      } catch (error) {
        setStakedAmount('0.000');
      }
      
      // Fetch rewards
      try {
        if (selectedChain.api && selectedChain.api.length > 0) {
          for (const endpoint of selectedChain.api) {
            try {
              const rewardsUrl = `${endpoint.address}/cosmos/distribution/v1beta1/delegators/${delegatorAddress}/rewards/${validatorAddress}`;
              const res = await fetch(rewardsUrl);
              if (res.ok) {
                const data = await res.json();
                const rewardsList = data.rewards || [];
                const mainReward = rewardsList.find((r: any) => r.denom === asset?.base) || { amount: '0' };
                const formattedRewards = asset
                  ? (parseFloat(mainReward.amount) / Math.pow(10, Number(asset.exponent))).toFixed(6)
                  : mainReward.amount;
                setRewards(formattedRewards);
                break;
              }
            } catch (error) {
              continue;
            }
          }
        }
      } catch (error) {
        setRewards('0.000');
      }

      // Fetch commission
      try {
        if (selectedChain.api && selectedChain.api.length > 0) {
          for (const endpoint of selectedChain.api) {
            try {
              const commissionUrl = `${endpoint.address}/cosmos/distribution/v1beta1/validators/${validatorAddress}/commission`;
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
                  } else {
                    setCommission('0.000');
                  }
                  break;
                }
              }
            } catch (error) {
              continue;
            }
          }
        }
      } catch (error) {
        setCommission('0.000');
      }
      
      try {
        if (client) {
          client.disconnect();
        }
      } catch (e) {
      }
        
      } catch (error) {
        setStakedAmount('0.000');
        setBalance('0.000');
        setRewards('0.000');
        setCommission('0.000');
      }
    }
  };

  const fetchValidatorDelegationInfo = async (validatorAddress: string, delegatorAddress: string) => {
    if (!selectedChain) return;

    const asset = selectedChain.assets?.[0];
    if (!asset) return;

    // Fetch delegation
    try {
      if (selectedChain.api && selectedChain.api.length > 0) {
        for (const endpoint of selectedChain.api) {
          try {
            const delegationUrl = `${endpoint.address}/cosmos/staking/v1beta1/delegations/${delegatorAddress}`;
            const res = await fetch(delegationUrl);
            if (res.ok) {
              const data = await res.json();
              const delegations = data.delegation_responses || [];
              const myDelegation = delegations.find((d: any) => d.delegation?.validator_address === validatorAddress);
              
              if (myDelegation && myDelegation.balance) {
                const amount = parseFloat(myDelegation.balance.amount || '0');
                const formatted = (amount / Math.pow(10, Number(asset.exponent))).toFixed(2);
                setValidatorDelegation(formatted);
              } else {
                setValidatorDelegation('0');
              }
              break;
            }
          } catch (error) {
            continue;
          }
        }
      }
    } catch (error) {
      setValidatorDelegation('0');
    }

    // Fetch unbonding delegations
    try {
      if (selectedChain.api && selectedChain.api.length > 0) {
        for (const endpoint of selectedChain.api) {
          try {
            // Try specific endpoint first with timeout
            let unbondingUrl = `${endpoint.address}/cosmos/staking/v1beta1/delegators/${delegatorAddress}/unbonding_delegations/${validatorAddress}`;
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            
            let res = await fetch(unbondingUrl, { signal: controller.signal }).finally(() => clearTimeout(timeoutId));
            
            // If not implemented (code 12), try getting all unbonding delegations and filter
            if (!res.ok || res.status === 501) {
              unbondingUrl = `${endpoint.address}/cosmos/staking/v1beta1/delegators/${delegatorAddress}/unbonding_delegations`;
              const controller2 = new AbortController();
              const timeoutId2 = setTimeout(() => controller2.abort(), 5000);
              res = await fetch(unbondingUrl, { signal: controller2.signal }).finally(() => clearTimeout(timeoutId2));
            }
            
            if (res.ok) {
              const data = await res.json();
              console.log('Unbonding API Response:', data);
              
              // Handle different response structures
              let unbondingDelegations = [];
              if (Array.isArray(data.unbonding_responses)) {
                unbondingDelegations = data.unbonding_responses;
              } else if (data.result && Array.isArray(data.result)) {
                unbondingDelegations = data.result;
              }
              
              // Filter for this validator
              const validatorUnbonding = unbondingDelegations.find(
                (u: any) => u.validator_address === validatorAddress
              );
              
              let totalUnbonding = 0;
              let earliestCompletionTime: string | null = null;
              
              if (validatorUnbonding && Array.isArray(validatorUnbonding.entries)) {
                validatorUnbonding.entries.forEach((entry: any) => {
                  totalUnbonding += parseFloat(entry.balance || '0');
                  
                  // Track earliest completion time
                  if (entry.completion_time) {
                    if (!earliestCompletionTime || new Date(entry.completion_time) < new Date(earliestCompletionTime)) {
                      earliestCompletionTime = entry.completion_time;
                    }
                  }
                });
              }
              
              console.log('Total Unbonding:', totalUnbonding);
              console.log('Earliest Completion Time:', earliestCompletionTime);
              
              const formatted = (totalUnbonding / Math.pow(10, Number(asset.exponent))).toFixed(2);
              console.log('Total Unbonding Formatted:', formatted);
              setValidatorUnbonding(formatted);
              setUnbondingCompletionTime(earliestCompletionTime);
              break;
            }
          } catch (error) {
            console.error('Error fetching unbonding:', error);
            continue;
          }
        }
      }
    } catch (error) {
      console.error('Unbonding fetch error:', error);
      setValidatorUnbonding('0');
      setUnbondingCompletionTime(null);
    }
  };

  const handleConfirmStake = async () => {
    if (!account || !validator || !selectedChain) {
      alert('Missing required information');
      return;
    }

    const asset = selectedChain.assets?.[0];
    if (!asset) {
      alert('Asset information not available');
      return;
    }
    
    setIsProcessing(true);
    try {
      const exponent = Number(asset.exponent);
      let params: any = {
        delegatorAddress: account.address,
        validatorAddress: validator.address,
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
        const hasCommission = parseFloat(commission) > 0;
        
        if (!hasRewards && !hasCommission) {
          alert('No rewards or commission available to withdraw');
          setIsProcessing(false);
          return;
        }
        
        const { executeWithdrawAll } = await import('@/lib/keplr');
        const withdrawParams = {
          delegatorAddress: account.address,
          validatorAddress: validator.address,
          hasRewards,
          hasCommission,
        };
        
        const result = await executeWithdrawAll(selectedChain, withdrawParams, gasLimit, memo);
        
        if (result.success) {
          setTxResult({ success: true, txHash: result.txHash || '' });
        } else {
          setTxResult({ success: false, error: result.error || 'Unknown error' });
        }
        
        setTimeout(() => {
          if (account && selectedChain && validator) {
            fetchDelegationData(validator.address, account.address);
          }
        }, 2000);
        setIsProcessing(false);
        return;
      }
      
      const { executeStaking } = await import('@/lib/keplr');
      const result = await executeStaking(selectedChain, stakeTab, params, gasLimit, memo);
      
      if (result.success) {
        setTxResult({ success: true, txHash: result.txHash || '' });
        setTimeout(() => {
          if (account && selectedChain && validator) {
            fetchDelegationData(validator.address, account.address);
          }
        }, 2000);
        setStakeAmount('');
        setStakePercentage(0);
      } else {
        setTxResult({ success: false, error: result.error || 'Unknown error' });
      }
    } catch (error: any) {
      setTxResult({ success: false, error: error.message || 'Unknown error' });
    } finally {
      setIsProcessing(false);
    }
  };

  if (loading && !validator) {
    // 🚀 PING.PUB PATTERN: Show skeleton UI immediately, no loading screen
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex">
        <Sidebar selectedChain={selectedChain} />
        <div className="flex-1 flex flex-col">
          <Header chains={chains} selectedChain={selectedChain} onSelectChain={setSelectedChain} />
          <main className="flex-1 mt-32 md:mt-16 p-3 md:p-6">
            {/* Skeleton Loader - Instant UI like Ping.pub */}
            <div className="animate-pulse">
              {/* Header Skeleton */}
              <div className="mb-6">
                <div className="h-4 bg-gray-800 rounded w-1/3 mb-2"></div>
                <div className="h-8 bg-gray-800 rounded w-1/2 mb-2"></div>
                <div className="h-4 bg-gray-800 rounded w-2/3"></div>
              </div>

              {/* Overview Card Skeleton */}
              <div className="bg-[#1a1a1a] rounded-lg p-6 mb-6">
                <div className="flex items-start gap-4 mb-6">
                  <div className="w-20 h-20 bg-gray-800 rounded-full"></div>
                  <div className="flex-1">
                    <div className="h-8 bg-gray-800 rounded w-1/3 mb-2"></div>
                    <div className="h-4 bg-gray-800 rounded w-1/2"></div>
                  </div>
                </div>
                
                {/* Stats Grid Skeleton */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="bg-[#111111] rounded-lg p-4">
                      <div className="h-4 bg-gray-800 rounded w-1/2 mb-2"></div>
                      <div className="h-6 bg-gray-800 rounded w-3/4"></div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tabs Skeleton */}
              <div className="bg-[#1a1a1a] rounded-lg">
                <div className="flex border-b border-gray-800">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex-1 px-6 py-4">
                      <div className="h-6 bg-gray-800 rounded w-3/4 mx-auto"></div>
                    </div>
                  ))}
                </div>
                <div className="p-6">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="h-12 bg-gray-800 rounded mb-2"></div>
                  ))}
                </div>
              </div>
            </div>
            
            {/* Loading indicator - subtle like Ping.pub */}
            <div className="fixed bottom-4 right-4 flex items-center gap-2 bg-blue-500/10 backdrop-blur-sm px-3 py-2 rounded-full border border-blue-500/20">
              <div className="animate-spin rounded-full h-3 w-3 border-2 border-blue-500/20 border-t-blue-500"></div>
              <span className="text-blue-400 text-xs">Loading...</span>
            </div>
          </main>
        </div>
      </div>
    );
  }

  if (!validator) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex">
        <Sidebar selectedChain={selectedChain} />
        <div className="flex-1 flex flex-col">
          <Header chains={chains} selectedChain={selectedChain} onSelectChain={setSelectedChain} />
          <main className="flex-1 mt-32 md:mt-16 p-3 md:p-6 flex items-center justify-center">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-white mb-2">{t('validatorDetail.notFound')}</h2>
              <button 
                onClick={() => router.back()} 
                className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                {t('validatorDetail.goBack')}
              </button>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex">
      <Sidebar selectedChain={selectedChain} />
      
      <div className="flex-1 flex flex-col">
        <Header chains={chains} selectedChain={selectedChain} onSelectChain={setSelectedChain} />

        <main className="flex-1 mt-32 md:mt-16 p-3 md:p-6 overflow-auto scroll-smooth">
          {/* Header Section */}
          <div className="mb-4 md:mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-fade-in">
            <div className="min-w-0 flex-1">
              <div className="flex items-center text-xs md:text-sm text-gray-400 mb-2 overflow-x-auto scrollbar-none">
                <Link href={`/${chainPath}`} className="hover:text-blue-500 transition-all duration-200 whitespace-nowrap">{t('validatorDetail.overview')}</Link>
                <span className="mx-1 md:mx-2">/</span>
                <Link href={`/${chainPath}/validators`} className="hover:text-blue-500 transition-all duration-200 whitespace-nowrap">{t('validatorDetail.validators')}</Link>
                <span className="mx-1 md:mx-2">/</span>
                <span className="text-white truncate">{validator.moniker}</span>
              </div>
              <h1 className="text-xl md:text-3xl font-bold text-white mb-2">{t('validatorDetail.title')}</h1>
              <p className="text-gray-400 text-sm md:text-base truncate">
                {t('validatorDetail.subtitle')} {validator.moniker}
              </p>
            </div>
            
            {/* Live indicator */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <div className={`w-2 h-2 rounded-full ${isRefreshing ? 'bg-blue-500 animate-pulse' : 'bg-green-500'}`}></div>
              <span className="text-xs text-gray-400">
                {isRefreshing ? t('validatorDetail.updating') : t('validatorDetail.live')}
              </span>
            </div>
          </div>

          {/* Overview Card */}
          <div className="bg-[#1a1a1a] rounded-lg p-4 md:p-6 mb-4 md:mb-6 hover:bg-[#1a1a1a]/80 transition-all duration-200">
            <h2 className="text-lg md:text-xl font-bold text-white mb-4 md:mb-6">{t('validatorDetail.overview')}</h2>
            
            <div className="space-y-4 md:space-y-6">
              {/* Validator Bio */}
              <div className="flex items-start gap-3 md:gap-4">
                <div className="relative group">
                  <ValidatorAvatar
                    identity={validator.identity}
                    moniker={validator.moniker}
                    size="xl"
                  />
                  {/* Status indicator on avatar with pulse animation */}
                  <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-[#1a1a1a] ${
                    validator.status === 'BOND_STATUS_BONDED' 
                      ? 'bg-green-500 animate-pulse' 
                      : validator.status === 'BOND_STATUS_UNBONDING'
                      ? 'bg-yellow-500'
                      : 'bg-gray-500'
                  }`}>
                    {validator.status === 'BOND_STATUS_BONDED' && (
                      <span className="absolute inset-0 rounded-full bg-green-500 animate-ping opacity-75"></span>
                    )}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <h3 className="text-2xl font-bold text-white truncate">{validator.moniker}</h3>
                    <button 
                      onClick={(e) => {
                        e.preventDefault();
                        if (isConnected) {
                          setShowStakeModal(true);
                        } else {
                          alert('Please connect your Keplr wallet first');
                        }
                      }}
                      disabled={!isConnected}
                      className={`group relative px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-200 whitespace-nowrap ${
                        isConnected 
                          ? 'bg-white hover:bg-gray-100 text-black shadow-md hover:shadow-lg hover:scale-105 active:scale-95 cursor-pointer' 
                          : 'bg-gray-800 text-gray-500 cursor-not-allowed opacity-50'
                      }`}
                    >
                      <span className="relative flex items-center gap-1.5">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Manage Stake
                      </span>
                    </button>
                  </div>
                  
                  {/* Status Badges & Performance Score */}
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <span className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all duration-200 ${
                      validator.status === 'BOND_STATUS_BONDED' 
                        ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30' 
                        : validator.status === 'BOND_STATUS_UNBONDING'
                        ? 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30'
                        : 'bg-gray-500/20 text-gray-400 hover:bg-gray-500/30'
                    }`}>
                      {validator.status?.replace('BOND_STATUS_', '') || 'UNKNOWN'}
                    </span>
                    {validator.jailed && (
                      <span className="px-2.5 py-1 rounded-md text-xs font-medium bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-all duration-200 animate-pulse">
                        JAILED
                      </span>
                    )}
                    
                    {/* Performance Score Badge */}
                    {(() => {
                      // Calculate performance score
                      const uptime = uptimePercentage || 0;
                      const commission = parseFloat(validator.commission) || 0;
                      const votingPower = parseFloat(validator.votingPowerPercentage) || 0;
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
                      else if (commission < 3) commissionScore = 15; // Too low might be suspicious
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
                      
                      // Determine badge
                      let badge = '';
                      let color = '';
                      let bgColor = '';
                      let textColor = '';
                      
                      if (score >= 85) {
                        badge = '🏆 Elite';
                        color = 'from-yellow-500 to-orange-500';
                        bgColor = 'bg-yellow-500/20';
                        textColor = 'text-yellow-400';
                      } else if (score >= 70) {
                        badge = '🥇 Excellent';
                        color = 'from-green-500 to-emerald-500';
                        bgColor = 'bg-green-500/20';
                        textColor = 'text-green-400';
                      } else if (score >= 50) {
                        badge = '🥈 Good';
                        color = 'from-blue-500 to-cyan-500';
                        bgColor = 'bg-blue-500/20';
                        textColor = 'text-blue-400';
                      } else {
                        badge = '🥉 Fair';
                        color = 'from-gray-500 to-gray-600';
                        bgColor = 'bg-gray-500/20';
                        textColor = 'text-gray-400';
                      }
                      
                      return (
                        <div className="group relative">
                          <span className={`px-2.5 py-1 rounded-md text-xs font-medium ${bgColor} ${textColor} hover:scale-105 transition-all duration-200 cursor-help border border-transparent hover:border-current`}>
                            {badge} {score}/100
                          </span>
                          
                          {/* Tooltip */}
                          <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block z-50 animate-fade-in">
                            <div className="bg-[#0a0a0a] border border-gray-700 rounded-lg p-3 shadow-xl min-w-[280px]">
                              <p className="text-white font-semibold text-sm mb-2">Performance Breakdown</p>
                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-gray-400">Uptime ({uptime.toFixed(1)}%)</span>
                                  <span className={uptimeScore >= 30 ? 'text-green-400' : uptimeScore >= 20 ? 'text-yellow-400' : 'text-red-400'}>
                                    {uptimeScore}/40
                                  </span>
                                </div>
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-gray-400">Commission ({commission}%)</span>
                                  <span className={commissionScore >= 25 ? 'text-green-400' : commissionScore >= 15 ? 'text-yellow-400' : 'text-orange-400'}>
                                    {commissionScore}/30
                                  </span>
                                </div>
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-gray-400">Decentralization</span>
                                  <span className={vpScore >= 25 ? 'text-green-400' : vpScore >= 15 ? 'text-yellow-400' : 'text-orange-400'}>
                                    {vpScore}/30
                                  </span>
                                </div>
                                {isJailed && (
                                  <div className="flex items-center justify-between text-xs pt-1 border-t border-gray-700">
                                    <span className="text-red-400">Jailed Penalty</span>
                                    <span className="text-red-400">-50</span>
                                  </div>
                                )}
                              </div>
                              <div className="mt-2 pt-2 border-t border-gray-700">
                                <div className="flex items-center justify-between text-xs font-semibold">
                                  <span className="text-white">Total Score</span>
                                  <span className={textColor}>{score}/100</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {validator.website && (
                    <a 
                      href={validator.website} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-500 hover:text-blue-400 text-sm flex items-center gap-1 mb-2 transition-all duration-200 hover:gap-2"
                    >
                      🔗 {validator.website}
                    </a>
                  )}
                  {validator.details && (
                    <p className="text-gray-400 text-sm mt-2 line-clamp-3">{validator.details}</p>
                  )}
                </div>
              </div>

              {/* 2 Column Layout: Addresses & Uptime */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
                {/* Left Column: Addresses */}
                <div className="bg-[#111111] rounded-lg p-3 md:p-5 border border-gray-800 space-y-3">
                  {/* Account Address */}
                <div className="flex flex-col sm:flex-row items-start gap-2 sm:gap-3">
                  <div className="w-full sm:w-24 flex-shrink-0">
                    <p className="text-gray-400 text-xs md:text-sm font-medium">Account</p>
                  </div>
                  <div className="flex-1 min-w-0 w-full">
                    <div className="flex items-center gap-2 bg-[#0a0a0a] rounded px-2 md:px-3 py-1.5 md:py-2 hover:bg-[#0f0f0f] transition-all duration-200">
                      <Link
                        href={`/${chainPath}/accounts/${validator?.accountAddress || (validator?.address ? convertValidatorToAccountAddress(validator.address) : '')}`}
                        className="text-blue-400 hover:text-blue-300 font-mono text-xs md:text-sm break-all flex-1 transition-colors"
                      >
                        {validator?.accountAddress || (validator?.address ? convertValidatorToAccountAddress(validator.address) : 'Not Available')}
                      </Link>
                      <button 
                        onClick={() => setShowQRModal(true)}
                        className="text-gray-400 hover:text-blue-400 transition-all duration-200 flex-shrink-0 hover:scale-110 active:scale-95"
                        title="Show QR Code"
                      >
                        <QrCode className="w-3 h-3 md:w-4 md:h-4" />
                      </button>
                      <button 
                        onClick={() => {
                          const addr = validator?.accountAddress || (validator?.address ? convertValidatorToAccountAddress(validator.address) : '');
                          if (addr) navigator.clipboard.writeText(addr);
                        }}
                        className="text-gray-400 hover:text-blue-400 transition-all duration-200 flex-shrink-0 hover:scale-110 active:scale-95"
                        title="Copy address"
                      >
                        <svg className="w-3 h-3 md:w-4 md:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
                
                {/* Account Balance */}
                <div className="flex flex-col sm:flex-row items-start gap-2 sm:gap-3">
                  <div className="w-full sm:w-24 flex-shrink-0">
                    <p className="text-gray-400 text-xs md:text-sm font-medium">Balance</p>
                  </div>
                  <div className="flex-1 min-w-0 w-full">
                    <div className="flex items-center gap-2 bg-[#0a0a0a] rounded px-2 md:px-3 py-1.5 md:py-2">
                      <p className="text-green-400 font-semibold text-xs md:text-sm flex-1">
                        {validatorBalance}
                      </p>
                      {validatorBalance !== 'Loading...' && validatorBalance !== 'N/A' && validator?.accountAddress && isConnected && account?.address === validator.accountAddress && (
                        <button
                          onClick={() => setShowSendModal(true)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white text-xs font-semibold rounded-lg transition-all shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40"
                        >
                          <Send className="w-3 h-3" />
                          Send
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Operator Address */}
                <div className="flex flex-col sm:flex-row items-start gap-2 sm:gap-3">
                  <div className="w-full sm:w-24 flex-shrink-0">
                    <p className="text-gray-400 text-xs md:text-sm font-medium">Operator</p>
                  </div>
                  <div className="flex-1 min-w-0 w-full">
                    <div className="flex items-center gap-2 bg-[#0a0a0a] rounded px-2 md:px-3 py-1.5 md:py-2 hover:bg-[#0f0f0f] transition-all duration-200">
                      <p className="text-blue-400 font-mono text-xs md:text-sm break-all flex-1">{validator.address}</p>
                      <button 
                        onClick={() => navigator.clipboard.writeText(validator.address)}
                        className="text-gray-400 hover:text-blue-400 transition-all duration-200 flex-shrink-0 hover:scale-110 active:scale-95"
                        title="Copy address"
                      >
                        <svg className="w-3 h-3 md:w-4 md:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Consensus Address */}
                <div className="flex flex-col sm:flex-row items-start gap-2 sm:gap-3">
                  <div className="w-full sm:w-24 flex-shrink-0">
                    <p className="text-gray-400 text-xs md:text-sm font-medium">Consensus</p>
                  </div>
                  <div className="flex-1 min-w-0 w-full">
                    <div className="flex items-center gap-2 bg-[#0a0a0a] rounded px-2 md:px-3 py-1.5 md:py-2 hover:bg-[#0f0f0f] transition-all duration-200">
                      <p className="text-blue-400 font-mono text-xs md:text-sm break-all flex-1">
                        {validator.consensusAddress || 'N/A'}
                      </p>
                      {validator.consensusAddress && (
                        <button 
                          onClick={() => navigator.clipboard.writeText(validator.consensusAddress || '')}
                          className="text-gray-400 hover:text-blue-400 transition-all duration-200 flex-shrink-0 hover:scale-110 active:scale-95"
                          title="Copy address"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* HEX Address */}
                <div className="flex items-start gap-3">
                  <div className="w-24 flex-shrink-0">
                    <p className="text-gray-400 text-sm font-medium">HEX</p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 bg-[#0a0a0a] rounded px-3 py-2 hover:bg-[#0f0f0f] transition-all duration-200">
                      <p className="text-blue-400 font-mono text-sm break-all flex-1 uppercase">
                        {validator.hexAddress || 'N/A'}
                      </p>
                      {validator.hexAddress && (
                        <button 
                          onClick={() => navigator.clipboard.writeText(validator.hexAddress || '')}
                          className="text-gray-400 hover:text-blue-400 transition-all duration-200 flex-shrink-0 hover:scale-110 active:scale-95"
                          title="Copy address"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Consensus Public Key */}
                <div className="flex items-start gap-3">
                  <div className="w-24 flex-shrink-0">
                    <p className="text-gray-400 text-sm font-medium">PubKey</p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 bg-[#0a0a0a] rounded px-3 py-2 hover:bg-[#0f0f0f] transition-all duration-200">
                      <p className="text-blue-400 font-mono text-xs break-all flex-1">
                        {validator.consensus_pubkey ? JSON.stringify(validator.consensus_pubkey) : 'N/A'}
                      </p>
                      {validator.consensus_pubkey && (
                        <button 
                          onClick={() => navigator.clipboard.writeText(JSON.stringify(validator.consensus_pubkey))}
                          className="text-gray-400 hover:text-blue-400 transition-all duration-200 flex-shrink-0 hover:scale-110 active:scale-95"
                          title="Copy pubkey"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Validator Uptime */}
              <div className="bg-[#111111] rounded-lg p-5 border border-gray-800 hover:border-emerald-500/50 transition-all duration-200">
                <h3 className="text-lg font-semibold text-white mb-3">Validator uptime</h3>
                
                <div className="text-4xl font-bold text-emerald-400 mb-4">
                  {uptimePercentage > 0 ? `${uptimePercentage.toFixed(2)}%` : '99.98%'}
                </div>

                {/* Uptime blocks grid - 10 rows x 10 columns = 100 blocks */}
                <div className="grid grid-cols-[repeat(50,minmax(0,1fr))] gap-[2px] mb-3">
                  {(uptimeBlocks.length > 0 ? uptimeBlocks : Array.from({ length: 100 }, (_, i) => ({ 
                    height: i, 
                    signed: Math.random() > 0.001 
                  }))).map((block, index) => (
                    <div
                      key={index}
                      className={`aspect-square rounded-sm transition-all duration-200 hover:scale-125 hover:z-10 cursor-help ${
                        block.signed 
                          ? 'bg-emerald-500 hover:bg-emerald-400 hover:shadow-lg hover:shadow-emerald-500/50' 
                          : 'bg-red-500 hover:bg-red-400 hover:shadow-lg hover:shadow-red-500/50'
                      }`}
                      title={`Block ${block.height}: ${block.signed ? 'Signed ✓' : 'Missed ✗'}`}
                    />
                  ))}
                </div>
                
                {/* Legend */}
                <div className="flex items-center justify-between text-xs text-gray-400 pt-3 border-t border-gray-800">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 bg-emerald-500 rounded-sm"></div>
                      <span>Signed</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 bg-red-500 rounded-sm"></div>
                      <span>Missed</span>
                    </div>
                  </div>
                  <span className="text-gray-500">Last 100 blocks</span>
                </div>
              </div>
            </div>
          </div>
          </div>

          {/* Voting Power Card - Full Width */}
          <div className="mb-6">
            <div className="bg-[#1a1a1a] rounded-lg p-6 hover:bg-[#1a1a1a]/80 transition-all duration-200 group">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-5 h-5 text-blue-500 group-hover:scale-110 transition-transform duration-200" />
                <h2 className="text-xl font-bold text-white">Voting Power</h2>
              </div>
              
              <div className="mb-6">
                <p className="text-5xl font-bold text-blue-500 mb-2 transition-all duration-300">
                  {isNaN(parseFloat(validator.votingPowerPercentage)) 
                    ? '0.00' 
                    : parseFloat(validator.votingPowerPercentage).toFixed(2)
                  }%
                </p>
                <p className="text-gray-400 text-sm">
                  {(() => {
                    const exponent = Number(selectedChain?.assets?.[0]?.exponent || 6);
                    const divisor = Math.pow(10, exponent);
                    return `${(parseInt(validator.votingPower || '0') / divisor).toLocaleString(undefined, { maximumFractionDigits: 0 })} / ${(parseInt(validator.tokens || '0') / divisor).toLocaleString(undefined, { maximumFractionDigits: 0 })} ${selectedChain?.assets[0].symbol}`;
                  })()}
                </p>
              </div>
              
              {/* Progress bar */}
              <div className="bg-gray-800 rounded-full h-3 mb-6 overflow-hidden relative">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer"></div>
                <div 
                  className="bg-blue-500 h-3 rounded-full transition-all duration-500"
                  style={{ 
                    width: `${isNaN(parseFloat(validator.votingPowerPercentage)) ? 0 : Math.min(parseFloat(validator.votingPowerPercentage), 100)}%` 
                  }}
                >
                </div>
              </div>

              {/* 3 column info */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="bg-[#111111] rounded-lg p-3 hover:bg-[#111111]/70 hover:scale-105 transition-all duration-200">
                  <p className="text-gray-400 text-xs font-medium mb-1">Block</p>
                  <p className="text-white font-bold text-lg">0</p>
                </div>
                <div className="bg-[#111111] rounded-lg p-3 hover:bg-[#111111]/70 hover:scale-105 transition-all duration-200">
                  <p className="text-gray-400 text-xs font-medium mb-1">Power</p>
                  <p className="text-white font-bold text-lg">
                    {(() => {
                      const exponent = Number(selectedChain?.assets?.[0]?.exponent || 6);
                      return (parseInt(validator.votingPower || '0') / Math.pow(10, exponent)).toLocaleString(undefined, { maximumFractionDigits: 0 });
                    })()}
                  </p>
                </div>
                <div className="bg-[#111111] rounded-lg p-3 hover:bg-[#111111]/70 hover:scale-105 transition-all duration-200">
                  <p className="text-gray-400 text-xs font-medium mb-1">Percentage</p>
                  <p className="text-blue-500 font-bold text-lg">
                    {isNaN(parseFloat(validator.votingPowerPercentage)) 
                      ? '0.00' 
                      : parseFloat(validator.votingPowerPercentage).toFixed(2)
                    }%
                  </p>
                </div>
              </div>

              {/* Validator's Self-Delegation Info */}
              <div className="mt-4 pt-4 border-t border-gray-800">
                <h3 className="text-sm font-semibold text-gray-400 mb-3">Validator's Delegation</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-[#111111] rounded-lg p-3 hover:bg-[#111111]/70 transition-all duration-200">
                    <p className="text-gray-400 text-xs font-medium mb-1">Delegated</p>
                    <p className="text-green-500 font-bold text-base">
                      {validatorDelegation} {selectedChain?.assets[0].symbol}
                    </p>
                  </div>
                  <div className="bg-[#111111] rounded-lg p-3 hover:bg-[#111111]/70 transition-all duration-200">
                    <p className="text-gray-400 text-xs font-medium mb-1">Unbonding</p>
                    <p className="text-orange-500 font-bold text-base">
                      {validatorUnbonding} {selectedChain?.assets[0].symbol}
                    </p>
                    {timeRemaining && parseFloat(validatorUnbonding) > 0 && (
                      <p className="text-gray-500 text-xs mt-1">
                        {timeRemaining}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Rewards & Commission Section - Simplified */}
          <div className="mb-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Commissions & Rewards Card */}
              <div className="bg-[#1a1a1a] rounded-lg p-6 hover:bg-[#1a1a1a]/80 transition-all duration-200 flex flex-col">
                <div className="flex items-center gap-2 mb-6">
                  <Award className="w-5 h-5 text-blue-500" />
                  <h2 className="text-xl font-bold text-white">Commissions & Rewards</h2>
                </div>
                
                <div className="space-y-6 flex-1">
                  {/* Commissions */}
                  <div>
                    <p className="text-gray-400 text-sm mb-2">Commissions</p>
                    <p className="text-3xl font-bold text-white">
                      {commission} {selectedChain?.assets[0].symbol}
                    </p>
                  </div>

                  {/* Outstanding Rewards */}
                  <div>
                    <p className="text-gray-400 text-sm mb-2">Outstanding Rewards</p>
                    <p className="text-3xl font-bold text-white">
                      {rewards} {selectedChain?.assets[0].symbol}
                    </p>
                  </div>
                </div>

                {/* Claim Button - Show always but disable if not validator's wallet */}
                <button
                  onClick={async () => {
                    if (!isConnected) {
                      alert('Please connect your wallet first');
                      return;
                    }
                    
                    if (!selectedChain || !validator?.address || !account?.address) return;
                    
                    // Check if connected wallet is the validator
                    if (account.address !== validator.accountAddress) {
                      alert('You must be the validator to claim rewards and commission');
                      return;
                    }
                    
                    const hasRewards = parseFloat(rewards) > 0;
                    const hasCommission = parseFloat(commission) > 0;
                    
                    if (!hasRewards && !hasCommission) {
                      alert('No rewards or commission to claim');
                      return;
                    }
                    
                    setIsProcessing(true);
                    setTxResult(null);
                    
                    try {
                      const { executeWithdrawAll } = await import('@/lib/keplr');
                      const result = await executeWithdrawAll(
                        selectedChain,
                        {
                          delegatorAddress: account.address,
                          validatorAddress: validator.address,
                          hasRewards: hasRewards,
                          hasCommission: hasCommission,
                        },
                        '400000',
                        'Integrate WinScan'
                      );
                      
                      setTxResult(result);
                      
                      if (result.success) {
                        // Refresh data after successful claim
                        setTimeout(() => {
                          fetchValidatorData(false);
                        }, 3000);
                      }
                    } catch (error: any) {
                      setTxResult({ success: false, error: error.message });
                    } finally {
                      setIsProcessing(false);
                    }
                  }}
                  disabled={isProcessing || !isConnected || (isConnected && account?.address && validator?.accountAddress && account.address !== validator.accountAddress) || (parseFloat(rewards) === 0 && parseFloat(commission) === 0)}
                  className={`w-full px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-200 flex items-center justify-center gap-1.5 ${
                    isProcessing || !isConnected || (isConnected && account?.address && validator?.accountAddress && account.address !== validator.accountAddress) || (parseFloat(rewards) === 0 && parseFloat(commission) === 0)
                      ? 'bg-gray-800 text-gray-500 cursor-not-allowed opacity-50'
                      : 'bg-white hover:bg-gray-100 text-black shadow-md hover:shadow-lg hover:scale-105 active:scale-95 cursor-pointer'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {isProcessing ? 'Processing...' : 'Claim Rewards & Commission'}
                </button>
              </div>

              {/* Commission Rate Card */}
              <div className="bg-[#1a1a1a] rounded-lg p-6 hover:bg-[#1a1a1a]/80 transition-all duration-200 flex flex-col">
                <div className="flex items-center gap-2 mb-6">
                  <DollarSign className="w-5 h-5 text-green-500" />
                  <h2 className="text-xl font-bold text-white">Commission Rate</h2>
                </div>
                
                <div className="space-y-6 flex-1">
                  {/* Current Rate */}
                  <div>
                    <p className="text-gray-400 text-sm mb-2">Current Rate</p>
                    <p className="text-3xl font-bold text-white">
                      {isNaN(parseFloat(validator?.commission || '0')) 
                        ? '0.00' 
                        : (parseFloat(validator.commission) * 100).toFixed(2)
                      }%
                    </p>
                  </div>

                  {/* Max Rate */}
                  <div>
                    <p className="text-gray-400 text-sm mb-2">Max Rate</p>
                    <p className="text-2xl font-bold text-white">
                      {isNaN(parseFloat(validator?.maxCommission || '0')) 
                        ? '0.00' 
                        : (parseFloat(validator.maxCommission) * 100).toFixed(2)
                      }%
                    </p>
                  </div>

                  {/* Max Change */}
                  <div>
                    <p className="text-gray-400 text-sm mb-2">Max Daily Change</p>
                    <p className="text-2xl font-bold text-white">
                      {isNaN(parseFloat(validator?.maxChangeRate || '0')) 
                        ? '0.00' 
                        : (parseFloat(validator.maxChangeRate) * 100).toFixed(2)
                      }%
                    </p>
                  </div>
                </div>
                
                {/* Action Buttons - Only show if connected wallet is the validator */}
                {isConnected && account?.address && validator?.accountAddress && 
                 account.address === validator.accountAddress && (
                  <div className="space-y-3">
                    {/* Edit Commission Button - Only if not jailed */}
                    {!validator.jailed && (
                      <button
                        onClick={() => {
                          setNewCommissionRate(validator.commission || '0');
                          setShowEditCommissionModal(true);
                        }}
                        className="w-full px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-200 bg-white hover:bg-gray-100 text-black shadow-md hover:shadow-lg hover:scale-105 active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Edit Commission Rate
                      </button>
                    )}
                    
                    {/* Unjail Button - Only if jailed */}
                    {validator.jailed && (
                      <button
                        onClick={() => setShowUnjailModal(true)}
                        className="w-full px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-200 bg-red-500 hover:bg-red-600 text-white shadow-md hover:shadow-lg hover:scale-105 active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                        </svg>
                        Unjail Validator
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Tabs Section */}
          <div className="bg-[#1a1a1a] rounded-lg overflow-hidden hover:bg-[#1a1a1a]/80 transition-all duration-200">
            {/* Tab Headers */}
            <div className="flex border-b border-gray-800">
              <button
                onClick={() => setActiveTab('delegations')}
                className={`flex-1 px-6 py-4 text-sm font-semibold transition-all duration-200 ${
                  activeTab === 'delegations'
                    ? 'text-white bg-blue-500 scale-105'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <Users className={`w-4 h-4 ${activeTab === 'delegations' ? 'animate-pulse' : ''}`} />
                  <span>Delegations</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs transition-all duration-200 ${
                    activeTab === 'delegations' 
                      ? 'bg-white/20 text-white' 
                      : 'bg-gray-800 text-gray-400'
                  }`}>
                    {delegations.length}
                  </span>
                </div>
              </button>
              <button
                onClick={() => setActiveTab('unbonding')}
                className={`flex-1 px-6 py-4 text-sm font-semibold transition-all duration-200 ${
                  activeTab === 'unbonding'
                    ? 'text-white bg-blue-500 scale-105'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <Clock className={`w-4 h-4 ${activeTab === 'unbonding' ? 'animate-pulse' : ''}`} />
                  <span>Unbonding</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs transition-all duration-200 ${
                    activeTab === 'unbonding' 
                      ? 'bg-white/20 text-white' 
                      : 'bg-gray-800 text-gray-400'
                  }`}>
                    {unbondingDelegations.length}
                  </span>
                </div>
              </button>
              <button
                onClick={() => setActiveTab('transactions')}
                className={`flex-1 px-6 py-4 text-sm font-semibold transition-all duration-200 ${
                  activeTab === 'transactions'
                    ? 'text-white bg-blue-500 scale-105'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <FileText className={`w-4 h-4 ${activeTab === 'transactions' ? 'animate-pulse' : ''}`} />
                  <span>Transactions</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs transition-all duration-200 ${
                    activeTab === 'transactions' 
                      ? 'bg-white/20 text-white' 
                      : 'bg-gray-800 text-gray-400'
                  }`}>
                    {transactions.length}
                  </span>
                </div>
              </button>
            </div>

            {/* Tab Content */}
            <div className="p-6">
              {activeTab === 'delegations' && (
                <div>
                  {delegations.length === 0 ? (
                    <div className="text-center py-12">
                      <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-400">No delegations found</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-[#111111] border-b border-gray-800">
                          <tr>
                            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-400">#</th>
                            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-400">Delegator</th>
                            <th className="px-4 py-3 text-right text-sm font-semibold text-gray-400">Amount</th>
                            <th className="px-4 py-3 text-right text-sm font-semibold text-gray-400">Shares</th>
                          </tr>
                        </thead>
                        <tbody>
                          {delegations.map((delegation, idx) => (
                            <tr key={idx} className="border-b border-gray-800 hover:bg-[#111111] transition-colors">
                              <td className="px-4 py-3 text-gray-400 text-sm">{idx + 1}</td>
                              <td className="px-4 py-3">
                                <Link
                                  href={`/${chainPath}/accounts/${delegation.delegator}`}
                                  className="text-blue-500 hover:text-blue-400 transition-colors font-mono text-sm"
                                >
                                  {delegation.delegator.slice(0, 15)}...{delegation.delegator.slice(-6)}
                                </Link>
                              </td>
                              <td className="px-4 py-3 text-right text-white font-medium">
                                {(() => {
                                  const exponent = Number(selectedChain?.assets?.[0]?.exponent || 6);
                                  return (parseFloat(delegation.balance) / Math.pow(10, exponent)).toLocaleString(undefined, { 
                                    minimumFractionDigits: 0,
                                    maximumFractionDigits: 4 
                                  });
                                })()} {selectedChain?.assets[0].symbol}
                              </td>
                              <td className="px-4 py-3 text-right text-gray-400">
                                {(() => {
                                  const exponent = Number(selectedChain?.assets?.[0]?.exponent || 6);
                                  return (parseFloat(delegation.shares) / Math.pow(10, exponent)).toLocaleString(undefined, { 
                                    minimumFractionDigits: 0,
                                    maximumFractionDigits: 2 
                                  });
                                })()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'unbonding' && (
                <div>
                  {unbondingDelegations.length === 0 ? (
                    <div className="text-center py-12">
                      <Clock className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-400">No unbonding delegations found</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-[#111111] border-b border-gray-800">
                          <tr>
                            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-400">#</th>
                            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-400">Delegator</th>
                            <th className="px-4 py-3 text-right text-sm font-semibold text-gray-400">Amount</th>
                            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-400">Completion Time</th>
                            <th className="px-4 py-3 text-center text-sm font-semibold text-gray-400">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {unbondingDelegations.flatMap((unbonding, idx) => 
                            unbonding.entries.map((entry, entryIdx) => (
                              <tr key={`${idx}-${entryIdx}`} className="border-b border-gray-800 hover:bg-[#111111] transition-colors">
                                <td className="px-4 py-3 text-gray-400 text-sm">{idx + 1}.{entryIdx + 1}</td>
                                <td className="px-4 py-3">
                                  <Link
                                    href={`/${chainPath}/accounts/${unbonding.delegator}`}
                                    className="text-blue-500 hover:text-blue-400 transition-colors font-mono text-sm"
                                  >
                                    {unbonding.delegator.slice(0, 15)}...{unbonding.delegator.slice(-6)}
                                  </Link>
                                </td>
                                <td className="px-4 py-3 text-right text-white font-medium">
                                  {(() => {
                                    const exponent = Number(selectedChain?.assets?.[0]?.exponent || 6);
                                    return (parseFloat(entry.balance) / Math.pow(10, exponent)).toLocaleString(undefined, { 
                                      minimumFractionDigits: 0,
                                      maximumFractionDigits: 4 
                                    });
                                  })()} {selectedChain?.assets[0].symbol}
                                </td>
                                <td className="px-4 py-3 text-gray-400 text-sm">
                                  {new Date(entry.completionTime).toLocaleString()}
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <span className="px-3 py-1 bg-orange-500/20 text-orange-500 rounded-full text-xs">
                                    Unbonding
                                  </span>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'transactions' && (
                <div>
                  {transactions.length === 0 ? (
                    <div className="text-center py-12">
                      <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-400">No transactions found</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-[#111111] border-b border-gray-800">
                          <tr>
                            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-400">Tx Hash</th>
                            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-400">Type</th>
                            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-400">Height</th>
                            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-400">Time</th>
                            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-400">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {transactions.map((tx, idx) => (
                            <tr key={idx} className="border-b border-gray-800 hover:bg-[#111111] transition-colors">
                              <td className="px-4 py-3">
                                <Link
                                  href={`/${chainPath}/transactions/${tx.hash}`}
                                  className="text-blue-500 hover:text-blue-400 transition-colors font-mono text-sm"
                                >
                                  {tx.hash.slice(0, 8)}...{tx.hash.slice(-6)}
                                </Link>
                              </td>
                              <td className="px-4 py-3">
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400">
                                  {tx.type}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <Link
                                  href={`/${chainPath}/blocks/${tx.height}`}
                                  className="text-blue-500 hover:text-blue-400 transition-colors"
                                >
                                  {tx.height.toLocaleString()}
                                </Link>
                              </td>
                              <td className="px-4 py-3 text-gray-400 text-sm">
                                {new Date(tx.time).toLocaleString()}
                              </td>
                              <td className="px-4 py-3">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                  tx.result === 'Success' 
                                    ? 'bg-green-500/10 text-green-500' 
                                    : 'bg-red-500/10 text-red-500'
                                }`}>
                                  {tx.result}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* Stake Management Modal */}
      {showStakeModal && validator && selectedChain && (
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
                <h2 className="text-xl font-bold text-white">Manage Stake with {validator.moniker}</h2>
                <button
                  onClick={() => {
                    if (account && selectedChain && validator) {
                      fetchDelegationData(validator.address, account.address);
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
                    {stakedAmount} {stakedAmount !== 'Loading...' && selectedChain.assets?.[0]?.symbol}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">Balance:</span>
                  <span className={`font-medium ${balance === 'Loading...' ? 'text-yellow-400 animate-pulse' : 'text-white'}`}>
                    {balance} {balance !== 'Loading...' && selectedChain.assets?.[0]?.symbol}
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
                    Available: {stakeTab === 'delegate' ? balance : stakeTab === 'undelegate' || stakeTab === 'redelegate' ? stakedAmount : balance} {selectedChain.assets?.[0]?.symbol}
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
                        ? validators.find((v: any) => v.address === destinationValidator)?.moniker || 'Select validator'
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
                          .filter((v: any) => v.address !== validator?.address)
                          .filter((v: any) => validatorSearchQuery === '' || 
                            v.moniker?.toLowerCase().includes(validatorSearchQuery.toLowerCase()) ||
                            v.address?.toLowerCase().includes(validatorSearchQuery.toLowerCase())
                          )
                          .map((val: any) => (
                            <button
                              key={val.address}
                              onClick={() => {
                                setDestinationValidator(val.address);
                                setShowValidatorList(false);
                              }}
                              className="w-full px-4 py-2.5 text-left hover:bg-[#111111] transition-colors flex items-center justify-between border-b border-gray-800 last:border-0"
                            >
                              <div className="flex-1 min-w-0">
                                <div className="text-white text-sm font-medium truncate">
                                  {val.moniker}
                                </div>
                              </div>
                              {destinationValidator === val.address && (
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

            {/* Withdraw Information */}
            {stakeTab === 'withdraw' && (
              <div className="mb-6 space-y-3">
                {parseFloat(rewards) > 0 && (
                  <div className="flex items-center gap-2 p-3 bg-[#111111] rounded-lg border border-gray-800">
                    <span className="text-2xl">💰</span>
                    <div className="flex-1">
                      <div className="text-xs text-gray-400">Available Rewards</div>
                      <div className="text-white font-medium">{rewards} {selectedChain.assets?.[0]?.symbol}</div>
                    </div>
                  </div>
                )}
                {parseFloat(commission) > 0 && (
                  <div className="flex items-center gap-2 p-3 bg-[#111111] rounded-lg border border-green-900/30">
                    <span className="text-2xl">💵</span>
                    <div className="flex-1">
                      <div className="text-xs text-gray-400">Validator Commission</div>
                      <div className="text-green-400 font-medium">{commission} {selectedChain.assets?.[0]?.symbol}</div>
                    </div>
                  </div>
                )}
                {(parseFloat(rewards) > 0 || parseFloat(commission) > 0) && (
                  <div className="flex items-center justify-between p-3 bg-blue-900/20 rounded-lg border border-blue-800/50">
                    <span className="text-sm text-blue-300 font-medium">Total Withdrawal:</span>
                    <span className="text-lg text-white font-bold">
                      {(parseFloat(rewards) + parseFloat(commission)).toFixed(6)} {selectedChain.assets?.[0]?.symbol}
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
                  <div className="relative">
                    <div className="absolute inset-0 bg-green-500/20 rounded-full blur-2xl animate-pulse"></div>
                    <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-green-500/50">
                      <svg className="w-10 h-10 text-white animate-bounce-slow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <h3 className="text-2xl font-bold text-white">Transaction Successful!</h3>
                    <p className="text-gray-400">Your transaction has been broadcast to the network</p>
                  </div>
                  
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
                  
                  <div className="flex gap-3 w-full pt-2">
                    <button
                      onClick={() => {
                        const chainPath = selectedChain?.chain_name.toLowerCase().replace(/\s+/g, '-') || '';
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
                  <div className="relative">
                    <div className="absolute inset-0 bg-red-500/20 rounded-full blur-2xl animate-pulse"></div>
                    <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center shadow-lg shadow-red-500/50">
                      <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <h3 className="text-2xl font-bold text-white">Transaction Failed</h3>
                    <p className="text-gray-400">An error occurred while processing your transaction</p>
                  </div>
                  
                  <div className="w-full bg-[#0a0a0a] border border-red-900/50 rounded-xl p-4 space-y-2">
                    <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">Error Details</p>
                    <p className="text-sm text-red-400 break-words">
                      {txResult.error || 'Unknown error occurred'}
                    </p>
                  </div>
                  
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
      
      {/* Edit Commission Modal */}
      {showEditCommissionModal && validator && selectedChain && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl max-w-md w-full border border-gray-800 shadow-2xl">
            <div className="p-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold text-white">Edit Commission</h3>
                <button
                  onClick={() => {
                    setShowEditCommissionModal(false);
                    setCommissionTxResult(null);
                  }}
                  className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {!commissionTxResult ? (
                <>
                  {/* Validator Info */}
                  <div className="bg-gray-800/50 rounded-xl p-4 mb-6">
                    <div className="flex items-center gap-3 mb-3">
                      <ValidatorAvatar identity={validator.identity} size="lg" />
                      <div>
                        <h4 className="font-semibold text-white">{validator.moniker}</h4>
                        <p className="text-sm text-gray-400">Current: {(parseFloat(validator.commission || '0') * 100).toFixed(2)}%</p>
                      </div>
                    </div>
                    
                    {validator.maxChangeRate && (
                      <div className="flex items-center gap-2 text-xs text-yellow-400 bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <span>Max change per day: {(parseFloat(validator.maxChangeRate) * 100).toFixed(2)}%</span>
                      </div>
                    )}
                    
                    {validator.maxCommission && (
                      <div className="flex items-center gap-2 text-xs text-gray-400 mt-2">
                        <span>Max commission rate: {(parseFloat(validator.maxCommission) * 100).toFixed(2)}%</span>
                      </div>
                    )}
                  </div>

                  {/* New Commission Rate Input */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      New Commission Rate (%)
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={newCommissionRate ? (parseFloat(newCommissionRate) * 100).toFixed(2) : ''}
                      onChange={(e) => {
                        const value = e.target.value;
                        // Allow typing decimal numbers
                        if (value === '' || /^\d*\.?\d*$/.test(value)) {
                          const percentValue = parseFloat(value) || 0;
                          const decimalValue = (percentValue / 100).toString();
                          setNewCommissionRate(decimalValue);
                        }
                      }}
                      className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500"
                      placeholder="e.g., 5.00 for 5%"
                    />
                    <p className="text-xs text-gray-500 mt-2">
                      Enter the new commission rate as a percentage (e.g., 5 for 5%)
                    </p>
                  </div>

                  {/* Validation Warning */}
                  {validator.maxChangeRate && (
                    (() => {
                      const currentRate = parseFloat(validator.commission || '0');
                      const newRate = parseFloat(newCommissionRate);
                      const maxChange = parseFloat(validator.maxChangeRate);
                      const change = newRate - currentRate;
                      
                      // Only validate if increasing commission (Cosmos allows unlimited decreases)
                      if (change > 0 && change > maxChange) {
                        return (
                          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400">
                            <p className="font-medium mb-1">⚠️ Increase exceeds maximum allowed</p>
                            <p>
                              You're trying to increase by {(change * 100).toFixed(2)}%, but max allowed is {(maxChange * 100).toFixed(2)}% per day.
                            </p>
                            <p className="mt-1 text-xs text-gray-400">
                              Note: Commission decreases have no limit
                            </p>
                          </div>
                        );
                      }
                      
                      return null;
                    })()
                  )}

                  {/* Action Buttons */}
                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setShowEditCommissionModal(false);
                        setCommissionTxResult(null);
                      }}
                      className="flex-1 px-4 py-3 bg-gray-800 hover:bg-gray-700 text-white font-medium rounded-lg transition-all"
                      disabled={isEditingCommission}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={async () => {
                        if (!selectedChain || !validator) return;
                        
                        const currentRate = parseFloat(validator.commission || '0');
                        const newRate = parseFloat(newCommissionRate);
                        
                        // Validate max change rate (only for increases, decreases are unlimited)
                        if (validator.maxChangeRate) {
                          const maxChange = parseFloat(validator.maxChangeRate);
                          const change = newRate - currentRate;
                          
                          // Only block if increasing above max change
                          if (change > 0 && change > maxChange) {
                            setConfirmMessage(`Commission increase of ${(change * 100).toFixed(2)}% exceeds maximum allowed ${(maxChange * 100).toFixed(2)}% per day. Decreases have no limit.`);
                            setShowConfirmModal(true);
                            return;
                          }
                        }
                        
                        // Validate max rate
                        if (validator.maxCommission) {
                          const maxRate = parseFloat(validator.maxCommission);
                          if (newRate > maxRate) {
                            setConfirmMessage(`New commission rate ${(newRate * 100).toFixed(2)}% exceeds maximum allowed ${(maxRate * 100).toFixed(2)}%`);
                            setShowConfirmModal(true);
                            return;
                          }
                        }
                        
                        // Show confirmation
                        setConfirmMessage(`Change commission from ${(currentRate * 100).toFixed(2)}% to ${(newRate * 100).toFixed(2)}%?`);
                        setPendingCommissionUpdate(true);
                        setShowConfirmModal(true);
                      }}
                      className="flex-1 px-4 py-3 bg-purple-500 hover:bg-purple-600 text-white font-semibold rounded-lg transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={isEditingCommission}
                    >
                      {isEditingCommission ? 'Processing...' : 'Update Commission'}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {/* Success/Error Result */}
                  {commissionTxResult.success ? (
                    <>
                      {/* Success Icon with glow effect */}
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
                        <p className="text-gray-400">Your commission has been updated successfully</p>
                      </div>
                      
                      {/* Transaction Hash */}
                      <div className="w-full bg-[#0a0a0a] border border-gray-800 rounded-xl p-4 space-y-2">
                        <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">Transaction Hash</p>
                        <div className="flex items-center gap-2">
                          <code className="text-xs text-green-400 font-mono break-all flex-1">
                            {commissionTxResult.txHash}
                          </code>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(commissionTxResult.txHash || '');
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
                            const chainPath = selectedChain?.chain_name.toLowerCase().replace(/\s+/g, '-') || '';
                            window.open(`/${chainPath}/transactions/${commissionTxResult.txHash}`, '_blank');
                          }}
                          className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-medium rounded-lg transition-all hover:scale-105 active:scale-95 shadow-lg shadow-blue-500/30"
                        >
                          View in Explorer
                        </button>
                        <button
                          onClick={() => {
                            setCommissionTxResult(null);
                            setShowEditCommissionModal(false);
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
                        <p className="text-gray-400">An error occurred while updating commission</p>
                      </div>
                      
                      {/* Error Details */}
                      <div className="w-full bg-[#0a0a0a] border border-red-900/50 rounded-xl p-4 space-y-2">
                        <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">Error Details</p>
                        <p className="text-sm text-red-400 break-words">
                          {commissionTxResult.error || 'Unknown error occurred'}
                        </p>
                      </div>
                      
                      {/* Close Button */}
                      <button
                        onClick={() => setCommissionTxResult(null)}
                        className="w-full px-4 py-3 bg-gray-800 hover:bg-gray-700 text-white font-medium rounded-lg transition-all hover:scale-105 active:scale-95"
                      >
                        Close
                      </button>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-gray-900 rounded-2xl max-w-md w-full border border-gray-800 shadow-2xl p-6">
            <div className="text-center space-y-4">
              <div className={`w-16 h-16 ${pendingCommissionUpdate ? 'bg-blue-500/20' : 'bg-red-500/20'} rounded-full flex items-center justify-center mx-auto`}>
                <svg className={`w-8 h-8 ${pendingCommissionUpdate ? 'text-blue-400' : 'text-red-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {pendingCommissionUpdate ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  )}
                </svg>
              </div>
              <div>
                <h4 className="text-lg font-bold text-white mb-2">
                  {pendingCommissionUpdate ? 'Confirm Update' : 'Validation Error'}
                </h4>
                <p className="text-gray-400 text-sm">{confirmMessage}</p>
              </div>
              <div className="flex gap-3 mt-6">
                {pendingCommissionUpdate ? (
                  <>
                    <button
                      onClick={() => {
                        setShowConfirmModal(false);
                        setPendingCommissionUpdate(false);
                      }}
                      className="flex-1 px-4 py-3 bg-gray-800 hover:bg-gray-700 text-white font-medium rounded-lg transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={async () => {
                        setShowConfirmModal(false);
                        setIsEditingCommission(true);
                        
                        try {
                          const { executeEditValidatorCommission } = await import('../../../../lib/keplr');
                          const result = await executeEditValidatorCommission(selectedChain!, {
                            validatorAddress: validator!.address,
                            commissionRate: newCommissionRate
                          });
                          
                          setCommissionTxResult(result);
                          setPendingCommissionUpdate(false);
                          
                          if (result.success) {
                            setTimeout(() => {
                              window.location.reload();
                            }, 3000);
                          }
                        } catch (error) {
                          console.error('Edit commission error:', error);
                          setCommissionTxResult({
                            success: false,
                            error: error instanceof Error ? error.message : 'Unknown error'
                          });
                          setPendingCommissionUpdate(false);
                        } finally {
                          setIsEditingCommission(false);
                        }
                      }}
                      className="flex-1 px-4 py-3 bg-purple-500 hover:bg-purple-600 text-white font-semibold rounded-lg transition-all shadow-md"
                    >
                      Confirm
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => {
                      setShowConfirmModal(false);
                      setPendingCommissionUpdate(false);
                    }}
                    className="w-full px-4 py-3 bg-purple-500 hover:bg-purple-600 text-white font-semibold rounded-lg transition-all shadow-md"
                  >
                    OK
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Unjail Modal */}
      {showUnjailModal && validator && selectedChain && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl max-w-md w-full border border-gray-800 shadow-2xl">
            {!unjailTxResult ? (
              <>
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-800">
                  <h3 className="text-xl font-bold text-white">Unjail Validator</h3>
                  <button
                    onClick={() => {
                      setShowUnjailModal(false);
                      setUnjailTxResult(null);
                    }}
                    className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
                  >
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Content */}
                <div className="p-6">
                  {/* Validator Info */}
                  <div className="bg-gray-800/50 rounded-xl p-4 mb-6">
                    <div className="flex items-center gap-3">
                      <ValidatorAvatar identity={validator.identity} size="lg" />
                      <div>
                        <h4 className="font-semibold text-white">{validator.moniker}</h4>
                        <p className="text-sm text-red-400">Currently Jailed</p>
                      </div>
                    </div>
                  </div>

                  {/* Warning */}
                  <div className="flex items-start gap-3 text-sm text-yellow-400 bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 mb-6">
                    <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <div>
                      <p className="font-medium mb-1">Important Notice</p>
                      <p className="text-xs text-yellow-300">
                        Unjailing your validator will restore it to active status. Make sure your validator node is running properly before unjailing.
                      </p>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setShowUnjailModal(false);
                        setUnjailTxResult(null);
                      }}
                      className="flex-1 px-4 py-3 bg-gray-800 hover:bg-gray-700 text-white font-medium rounded-lg transition-all"
                      disabled={isUnjailing}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={async () => {
                        if (!selectedChain || !validator) return;
                        
                        setIsUnjailing(true);
                        
                        try {
                          const { executeUnjail } = await import('../../../../lib/keplr');
                          const result = await executeUnjail(selectedChain, {
                            validatorAddress: validator.address
                          });
                          
                          setUnjailTxResult(result);
                          
                          if (result.success) {
                            setTimeout(() => {
                              window.location.reload();
                            }, 3000);
                          }
                        } catch (error) {
                          console.error('Unjail error:', error);
                          setUnjailTxResult({
                            success: false,
                            error: error instanceof Error ? error.message : 'Unknown error'
                          });
                        } finally {
                          setIsUnjailing(false);
                        }
                      }}
                      className="flex-1 px-4 py-3 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-lg transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={isUnjailing}
                    >
                      {isUnjailing ? 'Processing...' : 'Unjail Now'}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* Success/Error Result */}
                {unjailTxResult.success ? (
                  <div className="p-6 text-center space-y-4">
                    <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto">
                      <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div>
                      <h4 className="text-xl font-bold text-white mb-2">Validator Unjailed!</h4>
                      <p className="text-gray-400">Your validator has been successfully unjailed</p>
                    </div>
                    {unjailTxResult.txHash && (
                      <div className="bg-gray-800/50 rounded-lg p-3">
                        <p className="text-xs text-gray-500 mb-1">Transaction Hash</p>
                        <p className="text-sm text-green-400 break-all font-mono">{unjailTxResult.txHash}</p>
                      </div>
                    )}
                    <button
                      onClick={() => {
                        setShowUnjailModal(false);
                        setUnjailTxResult(null);
                      }}
                      className="w-full px-4 py-3 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-lg transition-all"
                    >
                      Close
                    </button>
                  </div>
                ) : (
                  <div className="p-6 text-center space-y-4">
                    <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto">
                      <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </div>
                    <div>
                      <h4 className="text-xl font-bold text-white mb-2">Unjail Failed</h4>
                      <p className="text-red-400 text-sm">{unjailTxResult.error || 'Unknown error occurred'}</p>
                    </div>
                    <button
                      onClick={() => {
                        setShowUnjailModal(false);
                        setUnjailTxResult(null);
                      }}
                      className="w-full px-4 py-3 bg-gray-800 hover:bg-gray-700 text-white font-semibold rounded-lg transition-all"
                    >
                      Close
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Send Modal */}
      {showSendModal && selectedChain && validator?.accountAddress && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-[#1a1a1a] to-[#0a0a0a] border border-gray-800 rounded-2xl max-w-md w-full shadow-2xl animate-scale-in">
            {!sendTxResult ? (
              <>
                <div className="p-6 border-b border-gray-800 flex items-center justify-between sticky top-0 bg-gradient-to-br from-[#1a1a1a] to-[#0a0a0a] z-10">
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <Send className="w-5 h-5" />
                    Send Tokens
                  </h2>
                  <button
                    onClick={() => setShowSendModal(false)}
                    className="text-gray-400 hover:text-white transition-colors p-2 hover:bg-gray-800 rounded-lg"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                
                <div className="p-6 space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">Recipient Address</label>
                    <input
                      type="text"
                      value={sendRecipient}
                      onChange={(e) => setSendRecipient(e.target.value)}
                      placeholder={`${selectedChain.bech32_prefix || selectedChain.addr_prefix}1...`}
                      className="w-full bg-[#111111] border border-gray-800 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">Amount</label>
                    <div className="relative">
                      <input
                        type="number"
                        value={sendAmount}
                        onChange={(e) => setSendAmount(e.target.value)}
                        placeholder="0.00"
                        step="0.000001"
                        className="w-full bg-[#111111] border border-gray-800 rounded-lg px-4 py-2.5 pr-20 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">
                        {selectedChain.assets[0]?.symbol}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-1.5">
                      <p className="text-xs text-gray-500">
                        Available: <span className="text-green-400">{validatorBalance}</span>
                      </p>
                    </div>
                    
                    {/* Percentage Buttons */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
                      {[25, 50, 75, 100].map((percentage) => (
                        <button
                          key={percentage}
                          type="button"
                          onClick={() => {
                            const numericBalance = parseFloat(validatorBalance.split(' ')[0] || '0');
                            let amount = numericBalance * (percentage / 100);
                            
                            // For 100%, subtract estimated fee (0.01 tokens)
                            if (percentage === 100) {
                              amount = Math.max(0, amount - 0.01);
                            }
                            
                            setSendAmount(amount.toFixed(6));
                          }}
                          className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-white text-xs font-semibold rounded-lg transition-all hover:scale-105 active:scale-95"
                        >
                          {percentage === 100 ? 'MAX' : `${percentage}%`}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  <details className="bg-[#111111] rounded-lg border border-gray-800">
                    <summary className="px-4 py-3 cursor-pointer text-sm font-medium text-gray-400 hover:text-white transition-colors">
                      Advanced Options
                    </summary>
                    <div className="px-4 pb-3 pt-1 space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-2">Memo (Optional)</label>
                        <input
                          type="text"
                          value={sendMemo}
                          onChange={(e) => setSendMemo(e.target.value)}
                          placeholder="Integrate WinScan"
                          className="w-full bg-[#111111] border border-gray-800 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
                        />
                      </div>
                    </div>
                  </details>
                  
                  <button
                    onClick={async () => {
                        if (!sendRecipient || !sendAmount) return;
                        
                        setIsSending(true);
                        try {
                          const { executeSend } = await import('../../../../lib/keplr');
                          const amountInBaseUnit = (parseFloat(sendAmount) * Math.pow(10, Number(selectedChain.assets[0]?.exponent || 6))).toString();
                          
                          const result = await executeSend(
                            selectedChain,
                            {
                              fromAddress: validator.accountAddress || '',
                              toAddress: sendRecipient,
                              amount: amountInBaseUnit,
                              denom: selectedChain.assets[0]?.base || 'uatom'
                            },
                            '200000',
                            sendMemo
                          );
                          
                          setSendTxResult(result);
                          
                          if (result.success) {
                            setTimeout(() => {
                              setShowSendModal(false);
                              setSendTxResult(null);
                              window.location.reload();
                            }, 3000);
                          }
                        } catch (error) {
                          console.error('Send error:', error);
                          setSendTxResult({
                            success: false,
                            error: error instanceof Error ? error.message : 'Unknown error'
                          });
                        } finally {
                          setIsSending(false);
                        }
                      }}
                    disabled={isSending || !sendRecipient || !sendAmount}
                    className={`w-full font-medium py-3 rounded-lg transition-all hover:scale-[1.02] active:scale-[0.98] ${
                      isSending || !sendRecipient || !sendAmount
                        ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                        : 'bg-white hover:bg-gray-200 text-black'
                    }`}
                  >
                    {isSending ? 'Processing...' : 'Confirm Send'}
                  </button>
                </div>
              </>
            ) : (
              <div className="p-8 text-center space-y-6 animate-fade-in">
                {sendTxResult.success ? (
                  <>
                    <div className="relative">
                      <div className="absolute inset-0 bg-green-500/20 rounded-full blur-2xl animate-pulse"></div>
                      <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center mx-auto shadow-lg shadow-green-500/50">
                        <svg className="w-10 h-10 text-white animate-bounce-slow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <h3 className="text-2xl font-bold text-white">Transaction Successful!</h3>
                      <p className="text-gray-400">Your transaction has been broadcast to the network</p>
                    </div>
                    
                    {sendTxResult.txHash && (
                      <div className="w-full bg-[#0a0a0a] border border-gray-800 rounded-xl p-4 space-y-2">
                        <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">Transaction Hash</p>
                        <div className="flex items-center gap-2">
                          <code className="text-xs text-green-400 font-mono break-all flex-1">
                            {sendTxResult.txHash}
                          </code>
                          <button
                            onClick={() => navigator.clipboard.writeText(sendTxResult.txHash || '')}
                            className="p-2 hover:bg-gray-800 rounded-lg transition-colors flex-shrink-0"
                            title="Copy to clipboard"
                          >
                            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    )}
                    
                    <div className="flex gap-3 w-full pt-2">
                      <button
                        onClick={() => {
                          const chainPath = selectedChain?.chain_name.toLowerCase().replace(/\s+/g, '-') || '';
                          window.open(`/${chainPath}/transactions/${sendTxResult.txHash}`, '_blank');
                        }}
                        className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-medium rounded-lg transition-all hover:scale-105 active:scale-95 shadow-lg shadow-blue-500/30"
                      >
                        View in Explorer
                      </button>
                      <button
                        onClick={() => {
                          setSendTxResult(null);
                          setShowSendModal(false);
                        }}
                        className="flex-1 px-4 py-3 bg-gray-800 hover:bg-gray-700 text-white font-medium rounded-lg transition-all hover:scale-105 active:scale-95"
                      >
                        Close
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="relative">
                      <div className="absolute inset-0 bg-red-500/20 rounded-full blur-2xl animate-pulse"></div>
                      <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center mx-auto shadow-lg shadow-red-500/50">
                        <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <h3 className="text-2xl font-bold text-white">Transaction Failed</h3>
                      <p className="text-gray-400">An error occurred while processing your transaction</p>
                    </div>
                    
                    <div className="w-full bg-[#0a0a0a] border border-red-800/30 rounded-xl p-4">
                      <p className="text-sm text-red-400">{sendTxResult.error || 'Unknown error occurred'}</p>
                    </div>
                    
                    <div className="flex gap-3 w-full pt-2">
                      <button
                        onClick={() => setSendTxResult(null)}
                        className="flex-1 px-4 py-3 bg-gray-800 hover:bg-gray-700 text-white font-medium rounded-lg transition-all hover:scale-105 active:scale-95"
                      >
                        Try Again
                      </button>
                      <button
                        onClick={() => {
                          setSendTxResult(null);
                          setShowSendModal(false);
                        }}
                        className="flex-1 px-4 py-3 bg-red-900/30 hover:bg-red-900/50 text-red-400 font-medium rounded-lg transition-all hover:scale-105 active:scale-95"
                      >
                        Close
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* QR Code Modal */}
      {showQRModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in" onClick={() => setShowQRModal(false)}>
          <div className="bg-gradient-to-br from-[#1a1a1a] to-[#0a0a0a] rounded-2xl p-8 max-w-md w-full shadow-2xl border border-gray-800 animate-scale-up" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">Wallet QR Code</h2>
              <button
                onClick={() => setShowQRModal(false)}
                className="text-gray-400 hover:text-white transition-colors p-2 hover:bg-gray-800 rounded-lg"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="bg-white p-4 rounded-xl mb-6 flex items-center justify-center">
              <img 
                src={`https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(validator?.accountAddress || (validator?.address ? convertValidatorToAccountAddress(validator.address) : ''))}`}
                alt="QR Code"
                className="w-64 h-64"
              />
            </div>
            
            <div className="bg-[#0a0a0a] rounded-lg p-4 mb-4 border border-gray-800">
              <p className="text-xs text-gray-400 mb-2">Wallet Address</p>
              <div className="flex items-center gap-2">
                <code className="text-sm text-blue-400 font-mono break-all flex-1">
                  {validator?.accountAddress || (validator?.address ? convertValidatorToAccountAddress(validator.address) : '')}
                </code>
                <button
                  onClick={() => {
                    const addr = validator?.accountAddress || (validator?.address ? convertValidatorToAccountAddress(validator.address) : '');
                    if (addr) navigator.clipboard.writeText(addr);
                  }}
                  className="text-gray-400 hover:text-blue-400 transition-colors p-2 hover:bg-gray-800 rounded-lg flex-shrink-0"
                  title="Copy address"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </button>
              </div>
            </div>
            
            <p className="text-xs text-gray-500 text-center">
              Scan this QR code to get the wallet address
            </p>
            
            <button
              onClick={() => setShowQRModal(false)}
              className="w-full mt-6 px-4 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium rounded-lg transition-all hover:scale-105 active:scale-95 shadow-lg shadow-blue-500/30"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

