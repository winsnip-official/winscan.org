'use client';

import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import PRC20PriceChart from '@/components/PRC20PriceChart';
import { ChainData } from '@/types/chain';
import { Settings, Info, Zap, AlertCircle, RefreshCw, Shield, CheckCircle, XCircle } from 'lucide-react';
import { calculateFee } from '@/lib/keplr';
import { getPoolPrice, calculateSwapOutput } from '@/lib/poolPriceCalculator';
import AddLiquiditySection from '@/components/AddLiquiditySection';
import RemoveLiquiditySection from '@/components/RemoveLiquiditySection';

interface Token {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  logo?: string;
  balance?: string;
}

export default function PRC20SwapPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const [chains, setChains] = useState<ChainData[]>([]);
  const [selectedChain, setSelectedChain] = useState<ChainData | null>(null);
  const [tokens, setTokens] = useState<Token[]>([]);
  const [fromToken, setFromToken] = useState<Token | null>(null);
  const [toToken, setToToken] = useState<Token | null>(null);
  const [initialTokenSet, setInitialTokenSet] = useState(false);
  const [fromAmount, setFromAmount] = useState('');
  const [toAmount, setToAmount] = useState('');
  const [slippage, setSlippage] = useState('0.5');
  const [loading, setLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string>('');
  const [txResult, setTxResult] = useState<{ success: boolean; txHash?: string; error?: string } | null>(null);
  const [marketPrices, setMarketPrices] = useState<Record<string, { price_paxi: number; price_usd: number; price_change_24h: number }>>({});
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [swapPercentage, setSwapPercentage] = useState(0);
  const [memo, setMemo] = useState('WinScan Swap');
  const [activeTab, setActiveTab] = useState<'swap' | 'liquidity' | 'burn' | 'transfer' | 'info'>('swap');
  const [liquidityMode, setLiquidityMode] = useState<'add' | 'remove'>('add');
  const [refreshing, setRefreshing] = useState(false);
  const [showFromTokenModal, setShowFromTokenModal] = useState(false);
  const [showToTokenModal, setShowToTokenModal] = useState(false);
  const [tokenSearchQuery, setTokenSearchQuery] = useState('');
  // Admin panel hidden
  // const [isAdmin, setIsAdmin] = useState(false);
  // const [showAdminPanel, setShowAdminPanel] = useState(false);
  // const [verifyContractAddress, setVerifyContractAddress] = useState('');
  // const [verifyAction, setVerifyAction] = useState<'add' | 'remove'>('add');
  // const [verifying, setVerifying] = useState(false);

  // Handle tab from URL query params
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'burn' || tab === 'transfer' || tab === 'info' || tab === 'liquidity') {
      setActiveTab(tab as any);
    }
  }, [searchParams]);

  useEffect(() => {
    const loadChains = async () => {
      try {
        const response = await fetch('/api/chains');
        const data = await response.json();
        setChains(data);

        const chain = data.find(
          (c: ChainData) =>
            c.chain_name.toLowerCase().replace(/\s+/g, '-') === params.chain
        );
        setSelectedChain(chain || null);
      } catch (error) {
        console.error('Error loading chains:', error);
      }
    };

    loadChains();
  }, [params.chain]);

  useEffect(() => {
    if (selectedChain) {
      loadTokens();
      checkWalletConnection();
      
      // Auto-refresh tokens every 2 minutes to catch new tokens
      const refreshInterval = setInterval(() => {
        console.log('🔄 Auto-refreshing token list...');
        loadTokens();
      }, 2 * 60 * 1000); // 2 minutes
      
      return () => clearInterval(refreshInterval);
    }
  }, [selectedChain]);

  const loadMarketPrices = async (tokensArray?: Token[]) => {
    const tokensToUse = tokensArray || tokens;
    console.log('💡 Loading market prices (NO CACHE) with', tokensToUse.length, 'tokens');

    // Fetch pools directly from LCD - NO CACHE!
    try {
      console.log('📡 Fetching FRESH pools from LCD (no cache)...');
      const poolsResponse = await fetch(
        'https://mainnet-lcd.paxinet.io/paxi/swap/all_pools',
        { signal: AbortSignal.timeout(10000) }
      );
      
      if (!poolsResponse.ok) {
        throw new Error('Failed to fetch pools');
      }

      const poolsData = await poolsResponse.json();
      const pools = poolsData.pools || poolsData.result?.pools || poolsData;
      
      if (!Array.isArray(pools) || pools.length === 0) {
        throw new Error('Invalid pools data structure');
      }

      console.log('🏊 Fresh pools loaded:', pools.length);

      // Calculate real-time prices from pool reserves
      // Use poolPriceCalculator module to get prices with correct decimals
      console.log('🔄 Using poolPriceCalculator module to calculate prices...');
      const calculatedPrices: Record<string, { price_paxi: number; price_usd: number; price_change_24h: number }> = {};
      
      // Process each pool using the module
      for (const pool of pools) {
        const prc20Address = pool.prc20 || pool.prc20_address || pool.token || pool.contract_address;
        
        if (!prc20Address) continue;

        try {
          // Use module to get price with correct decimals
          const poolPrice = await getPoolPrice(prc20Address);
          
          if (poolPrice) {
            calculatedPrices[prc20Address] = {
              price_paxi: poolPrice.price,
              price_usd: poolPrice.price,
              price_change_24h: 0
            };
            
            // Update token decimals in state if different
            const tokenInState = tokensToUse.find(t => t.address === prc20Address);
            if (tokenInState && tokenInState.decimals !== poolPrice.decimals) {
              console.log(`🔧 Updating ${tokenInState.symbol} decimals: ${tokenInState.decimals} → ${poolPrice.decimals}`);
              setTokens(prev => prev.map(t => 
                t.address === prc20Address ? { ...t, decimals: poolPrice.decimals } : t
              ));
            }
          }
        } catch (error) {
          console.error(`❌ Error calculating price for ${prc20Address}:`, error);
        }
      }

      setMarketPrices(calculatedPrices);
      console.log('✅ Prices calculated with correct decimals:', Object.keys(calculatedPrices).length, 'tokens');
      
    } catch (error) {
      console.error('❌ Error loading pool prices:', error);
    }
  };

  const checkWalletConnection = async () => {
    if (!selectedChain) return;
    
    try {
      if (typeof window !== 'undefined' && (window as any).keplr) {
        // Make sure chain is added to Keplr first
        await (window as any).keplr.enable(selectedChain.chain_id);
        const key = await (window as any).keplr.getKey(selectedChain.chain_id);
        setWalletAddress(key.bech32Address);
        console.log('✅ Connected wallet:', key.bech32Address);
        
        // Admin check disabled
        // if (selectedChain.chain_id === 'paxi-mainnet') {
        //   try {
        //     const verifyRes = await fetch(`https://ssl.winsnip.xyz/api/prc20/verify/list`);
        //     if (verifyRes.ok) {
        //       const data = await verifyRes.json();
        //       const admins = data.admins || [];
        //       if (admins.includes(key.bech32Address)) {
        //         setIsAdmin(true);
        //         console.log('👑 Admin wallet detected!');
        //       } else {
        //         setIsAdmin(false);
        //       }
        //     }
        //   } catch (e) {
        //     console.error('Failed to check admin status');
        //     setIsAdmin(false);
        //   }
        // } else {
        //   setIsAdmin(false);
        // }
        
        // Immediately load balances after connection
        if (tokens.length > 0) {
          console.log('🔄 Loading balances for connected wallet...');
          loadBalances(true);
        }
      }
    } catch (error) {
      console.log('⚠️ Wallet not connected:', error);
    }
  };

  const loadTokens = async () => {
    try {
      console.log('🔄 Loading tokens from SSL cache...');
      
      // Try SSL endpoints with cache (instant)
      const sslUrls = [
        'https://ssl.winsnip.xyz/api/prc20-tokens/cache',
        'https://ssl2.winsnip.xyz/api/prc20-tokens/cache',
        '/api/prc20/tokens'
      ];
      
      let data = null;
      for (const url of sslUrls) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000);
          
          const response = await fetch(url, { signal: controller.signal });
          clearTimeout(timeoutId);
          
          if (response.ok) {
            data = await response.json();
            console.log(`✅ Loaded from ${url}:`, data.tokens?.length, 'tokens');
            break;
          }
        } catch (e) {
          console.warn(`Failed to load from ${url}:`, e);
          continue;
        }
      }
      
      if (!data || !data.tokens) {
        throw new Error('Failed to load tokens from all endpoints');
      }
      
      console.log('📦 Total tokens loaded:', data.tokens?.length);
      
      // Add native PAXI token with logo
      const nativeToken: Token = {
        address: 'upaxi',
        name: 'PAXI',
        symbol: 'PAXI',
        decimals: 6,
        balance: '0',
        logo: '/paxi.png'
      };
      
      // Map PRC20 tokens from cache
      const prc20Tokens = (data.tokens || []).map((token: any) => ({
        address: token.contract_address || token.address,
        name: token.token_info?.name || token.name || 'Unknown',
        symbol: token.token_info?.symbol || token.symbol || 'UNK',
        decimals: parseInt(token.token_info?.decimals || token.decimals) || 6,
        logo: token.marketing_info?.logo?.url || token.logoUrl,
        balance: '0'
      }));
      
      console.log('✅ Mapped', prc20Tokens.length, 'PRC20 tokens');
      
      const allTokens = [nativeToken, ...prc20Tokens];
      console.log('🪙 All tokens:', allTokens.length, 'total');
      
      setTokens(allTokens);
      
      // Auto-select token from URL query param (if not already set)
      if (!initialTokenSet) {
        const fromParam = searchParams.get('from');
        
        if (fromParam) {
          console.log('🔍 Auto-selecting token from URL:', fromParam);
          const selectedToken = allTokens.find(t => t.address.toLowerCase() === fromParam.toLowerCase());
          
          if (selectedToken) {
            console.log('✅ Found token:', selectedToken.symbol);
            setFromToken(selectedToken);
            // If FROM is PRC20, TO = PAXI. If FROM is PAXI, leave TO empty for user to select
            if (selectedToken.address !== 'upaxi') {
              setToToken(nativeToken);
              console.log('✅ Auto-selected pair:', selectedToken.symbol, '→ PAXI');
            } else {
              console.log('✅ FROM = PAXI, waiting for user to select TO token');
            }
            setInitialTokenSet(true);
          } else {
            console.warn('⚠️ Token not found:', fromParam);
            // Default: PAXI as FROM
            setFromToken(nativeToken);
            setInitialTokenSet(true);
          }
        } else {
          // No query param: default PAXI as FROM
          setFromToken(nativeToken);
          setInitialTokenSet(true);
        }
      }
      
      // Load market prices (no cache)
      console.log('🔄 Tokens loaded, now loading market prices...');
      loadMarketPrices(allTokens);
      
      // Balances will be loaded by useEffect when tokens are selected
    } catch (error) {
      console.error('Error loading tokens:', error);
    }
  };

  const loadBalances = async (selectedTokensOnly: boolean = false) => {
    if (!selectedChain?.api?.[0]?.address || !walletAddress) {
      return;
    }
    
    setRefreshing(true);
    try {
      // Always fetch native PAXI balance
      const balanceUrl = `${selectedChain.api[0].address}/cosmos/bank/v1beta1/balances/${walletAddress}`;
      const nativeBalanceRes = await fetch(balanceUrl);
      
      if (!nativeBalanceRes.ok) {
        console.log('Could not fetch PAXI balance');
        return;
      }
      
      const nativeData = await nativeBalanceRes.json();
      const paxiBalance = nativeData.balances?.find((b: any) => b.denom === 'upaxi');
      const paxiAmount = paxiBalance?.amount || '0';
      
      // Update tokens dengan balance
      const updatedTokens = [...tokens];
      const paxiIdx = updatedTokens.findIndex(t => t.address === 'upaxi');
      if (paxiIdx !== -1) {
        updatedTokens[paxiIdx] = { ...updatedTokens[paxiIdx], balance: paxiAmount };
      }
      
      // Jika selectedTokensOnly, hanya fetch untuk fromToken dan toToken
      if (selectedTokensOnly && (fromToken || toToken)) {
        const tokensToFetch = [];
        if (fromToken && fromToken.address !== 'upaxi') tokensToFetch.push(fromToken);
        if (toToken && toToken.address !== 'upaxi') tokensToFetch.push(toToken);
        
        for (const token of tokensToFetch) {
          try {
            const balanceRes = await fetch(
              `/api/prc20-balance?contract=${token.address}&address=${walletAddress}`,
              { cache: 'no-store' }
            );
            
            if (!balanceRes.ok) {
              continue;
            }
            
            const balanceData = await balanceRes.json();
            const balance = balanceData.balance || '0';
            
            // Update token in array
            const idx = updatedTokens.findIndex(t => t.address === token.address);
            if (idx !== -1) {
              updatedTokens[idx] = { ...updatedTokens[idx], balance };
            }
          } catch (error) {
            // Silently continue on error
          }
        }
      }
      
      setTokens(updatedTokens);
      
      // Update selected tokens with new balance - ALWAYS update to force re-render
      if (fromToken) {
        const updated = updatedTokens.find(t => t.address === fromToken.address);
        if (updated) {
          setFromToken({ ...updated }); // Force new object to trigger re-render
        }
      }
      if (toToken) {
        const updated = updatedTokens.find(t => t.address === toToken.address);
        if (updated) {
          setToToken({ ...updated }); // Force new object to trigger re-render
        }
      }
    } catch (error) {
      // Silently handle errors - they're expected when wallet not connected
    } finally {
      setRefreshing(false);
    }
  };

  // Load balances when tokens selected
  useEffect(() => {
    if (walletAddress && tokens.length > 0 && (fromToken || toToken)) {
      const timer = setTimeout(() => {
        loadBalances(true);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [walletAddress, fromToken?.address, toToken?.address]);
  
  // Initial balance load after wallet connected and tokens loaded
  useEffect(() => {
    if (walletAddress && tokens.length > 0 && initialTokenSet) {
      const timer = setTimeout(() => {
        loadBalances(true);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [walletAddress, tokens.length, initialTokenSet]);

  // This function is now replaced by poolPriceCalculator module
  // Kept for backward compatibility
  const queryPoolPrice = getPoolPrice;

  // Auto-calculate toAmount when fromAmount changes with real-time pool query
  useEffect(() => {
    if (!fromAmount || !fromToken || !toToken) {
      setToAmount('');
      return;
    }

    const amount = parseFloat(fromAmount);
    if (isNaN(amount) || amount <= 0) {
      setToAmount('');
      return;
    }

    // Async function to calculate with real-time pool data
    const calculateAmount = async () => {
      let calculatedAmount: number;
      
      if (fromToken.address === 'upaxi' && toToken.address !== 'upaxi') {
        // PAXI → PRC20: amount / price_paxi
        // First try cached market prices
        let tokenPriceInPaxi = marketPrices[toToken.address]?.price_paxi || marketPrices[toToken.address]?.price_usd;
        
        // If no cached price, query pool directly
        if (!tokenPriceInPaxi || tokenPriceInPaxi === 0) {
          console.log('🔍 No cached price, querying pool for', toToken.symbol);
          const poolData = await queryPoolPrice(toToken.address);
          if (poolData) {
            tokenPriceInPaxi = poolData.price;
            // Update token decimals if different - THIS IS CRITICAL!
            if (poolData.decimals !== toToken.decimals) {
              console.warn(`🔧 FIXING ${toToken.symbol} decimals: ${toToken.decimals} → ${poolData.decimals}`);
              const updatedToToken = { ...toToken, decimals: poolData.decimals };
              setToToken(updatedToToken);
              
              // Also update in tokens array
              setTokens(prev => prev.map(t => 
                t.address === toToken.address ? updatedToToken : t
              ));
            }
            // Update market prices cache
            setMarketPrices(prev => ({
              ...prev,
              [toToken.address]: {
                price_paxi: tokenPriceInPaxi,
                price_usd: tokenPriceInPaxi,
                price_change_24h: 0
              }
            }));
          }
        }
        
        if (tokenPriceInPaxi && tokenPriceInPaxi > 0) {
          // Use module to calculate output
          calculatedAmount = calculateSwapOutput(amount, 'upaxi', toToken.address, tokenPriceInPaxi);
          console.log(`💱 Swap (PAXI → ${toToken.symbol}): ${amount} PAXI = ${calculatedAmount.toFixed(6)} ${toToken.symbol}`);
          console.log(`   Price: 1 ${toToken.symbol} = ${tokenPriceInPaxi.toFixed(10)} PAXI`);
        } else {
          console.warn('⚠️ No price data for', toToken.symbol);
          setToAmount('');
          return;
        }
      } else if (fromToken.address !== 'upaxi' && toToken.address === 'upaxi') {
        // PRC20 → PAXI: amount * price_paxi
        // First try cached market prices
        let tokenPriceInPaxi = marketPrices[fromToken.address]?.price_paxi || marketPrices[fromToken.address]?.price_usd;
        
        // If no cached price, query pool directly
        if (!tokenPriceInPaxi || tokenPriceInPaxi === 0) {
          console.log('🔍 No cached price, querying pool for', fromToken.symbol);
          const poolData = await queryPoolPrice(fromToken.address);
          if (poolData) {
            tokenPriceInPaxi = poolData.price;
            // Update token decimals if different - THIS IS CRITICAL!
            if (poolData.decimals !== fromToken.decimals) {
              console.warn(`🔧 FIXING ${fromToken.symbol} decimals: ${fromToken.decimals} → ${poolData.decimals}`);
              const updatedFromToken = { ...fromToken, decimals: poolData.decimals };
              setFromToken(updatedFromToken);
              
              // Also update in tokens array
              setTokens(prev => prev.map(t => 
                t.address === fromToken.address ? updatedFromToken : t
              ));
            }
            // Update market prices cache
            setMarketPrices(prev => ({
              ...prev,
              [fromToken.address]: {
                price_paxi: tokenPriceInPaxi,
                price_usd: tokenPriceInPaxi,
                price_change_24h: 0
              }
            }));
          }
        }
        
        if (tokenPriceInPaxi && tokenPriceInPaxi > 0) {
          // Use module to calculate output
          calculatedAmount = calculateSwapOutput(amount, fromToken.address, 'upaxi', tokenPriceInPaxi);
          console.log(`💱 Swap (${fromToken.symbol} → PAXI): ${amount} ${fromToken.symbol} = ${calculatedAmount.toFixed(6)} PAXI`);
          console.log(`   Price: 1 ${fromToken.symbol} = ${tokenPriceInPaxi.toFixed(10)} PAXI`);
        } else {
          console.warn('⚠️ No price data for', fromToken.symbol);
          setToAmount('');
          return;
        }
      } else {
        // Should not reach here, but fallback
        calculatedAmount = amount;
      }
      
      // Format output amount with reasonable precision
      // Use maximum of 6 decimals for display, but respect token's actual decimals
      const displayDecimals = Math.min(toToken.decimals, 6);
      const formattedAmount = calculatedAmount.toFixed(displayDecimals);
      console.log(`📊 Final output: ${formattedAmount} ${toToken.symbol} (display decimals: ${displayDecimals})`);
      
      setToAmount(formattedAmount);
    };
    
    // Execute calculation
    calculateAmount();
    
  }, [fromAmount, fromToken, toToken, marketPrices]);

  // Admin verify contract function - disabled
  /*
  const handleVerifyContract = async () => {
    if (!verifyContractAddress.trim()) {
      setTxResult({
        success: false,
        error: 'Please enter a contract address'
      });
      return;
    }

    if (!selectedChain) {
      setTxResult({
        success: false,
        error: 'Chain not selected'
      });
      return;
    }

    setVerifying(true);
    try {
      const endpoint = verifyAction === 'add' 
        ? '/api/prc20/verify'
        : '/api/prc20/unverify';

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chain: selectedChain.chain_name,
          contractAddress: verifyContractAddress.trim(),
          adminAddress: walletAddress
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setTxResult({
          success: true,
          txHash: `Contract ${verifyAction === 'add' ? 'added to' : 'removed from'} verified list: ${verifyContractAddress.trim()}`
        });
        setVerifyContractAddress('');
        
        // Force reload tokens with cache bypass
        setTimeout(async () => {
          // Clear any existing token cache
          const cacheBuster = Date.now();
          
          console.log('🔄 Refreshing tokens after verification change...');
          
          // Reload tokens with fresh data
          await loadTokens();
          
          // Force reload market prices
          if (tokens.length > 0) {
            await loadMarketPrices(tokens);
          }
          
          console.log('✅ Token list refreshed with new verification status');
        }, 1500);
      } else {
        throw new Error(data.error || 'Verification failed');
      }
    } catch (error: any) {
      console.error('❌ Verification error:', error);
      setTxResult({
        success: false,
        error: error.message || 'Verification failed'
      });
    } finally {
      setVerifying(false);
    }
  };
  */

  // Filter tokens based on search query
  const filteredTokens = tokens.filter(token => {
    if (!tokenSearchQuery.trim()) return true;
    
    const query = tokenSearchQuery.toLowerCase();
    return (
      token.name.toLowerCase().includes(query) ||
      token.symbol.toLowerCase().includes(query) ||
      token.address.toLowerCase().includes(query)
    );
  });

  // Filter for swap: only show PRC20 tokens (exclude PAXI) in from selector
  const filteredFromTokens = filteredTokens.filter(token => token.address !== 'upaxi');
  
  // Filter for swap: only show PAXI in to selector when from is PRC20
  const filteredToTokens = fromToken && fromToken.address !== 'upaxi' 
    ? filteredTokens.filter(token => token.address === 'upaxi')
    : filteredTokens.filter(token => token.address !== 'upaxi');

  const handleSwap = async () => {
    if (!fromToken || !toToken || !fromAmount) {
      setTxResult({ success: false, error: 'Please fill all fields' });
      return;
    }

    if (!walletAddress) {
      setTxResult({ success: false, error: 'Please connect your wallet first' });
      return;
    }

    if (!selectedChain) {
      setTxResult({ success: false, error: 'Chain not loaded' });
      return;
    }

    setLoading(true);
    try {
      // CRITICAL: Query ACTUAL decimals from token contract (NOT inference!)
      let actualFromDecimals = fromToken.decimals;
      let actualToDecimals = toToken.decimals;
      
      if (fromToken.address !== 'upaxi') {
        console.log(`🔍 Querying ACTUAL decimals for ${fromToken.symbol} from token contract...`);
        console.log(`   Contract address: ${fromToken.address}`);
        console.log(`   Cached decimals: ${fromToken.decimals}`);
        
        try {
          const tokenInfoQuery = Buffer.from(JSON.stringify({ token_info: {} })).toString('base64');
          const queryUrl = `https://mainnet-lcd.paxinet.io/cosmwasm/wasm/v1/contract/${fromToken.address}/smart/${tokenInfoQuery}`;
          console.log(`   Query URL: ${queryUrl}`);
          
          const response = await fetch(queryUrl, { signal: AbortSignal.timeout(5000) });
          console.log(`   Response status: ${response.status}`);
          
          if (response.ok) {
            const data = await response.json();
            console.log(`   Response data:`, data);
            const contractDecimals = parseInt(data.data?.decimals);
            
            if (!isNaN(contractDecimals)) {
              console.log(`✅ ${fromToken.symbol} ACTUAL decimals from contract: ${contractDecimals}`);
              actualFromDecimals = contractDecimals;
              
              if (contractDecimals !== fromToken.decimals) {
                console.warn(`⚠️ DECIMALS MISMATCH! Cached: ${fromToken.decimals}, Contract: ${contractDecimals} - USING CONTRACT VALUE!`);
              } else {
                console.log(`✅ Decimals match! Both are ${contractDecimals}`);
              }
            } else {
              console.error(`❌ Invalid decimals in response:`, data.data?.decimals);
            }
          } else {
            console.error(`❌ HTTP ${response.status}: ${response.statusText}`);
          }
        } catch (e: any) {
          console.error(`❌ Failed to query ${fromToken.symbol} decimals:`, e.message);
          console.log(`   Falling back to pool inference...`);
          
          // Fallback to pool inference only if contract query fails
          const poolData = await getPoolPrice(fromToken.address);
          if (poolData) {
            console.log(`   Pool inferred decimals: ${poolData.decimals}`);
            if (poolData.decimals !== fromToken.decimals) {
              console.warn(`🔧 Fallback: Using pool inferred decimals: ${poolData.decimals}`);
              actualFromDecimals = poolData.decimals;
            }
          } else {
            console.error(`   ❌ Pool data also unavailable! Using cached: ${fromToken.decimals}`);
          }
        }
        
        console.log(`📌 FINAL ${fromToken.symbol} decimals: ${actualFromDecimals}`);
      }
      
      if (toToken.address !== 'upaxi') {
        try {
          console.log(`🔍 Querying ACTUAL decimals for ${toToken.symbol} from token contract...`);
          const tokenInfoQuery = Buffer.from(JSON.stringify({ token_info: {} })).toString('base64');
          const response = await fetch(
            `https://mainnet-lcd.paxinet.io/cosmwasm/wasm/v1/contract/${toToken.address}/smart/${tokenInfoQuery}`
          );
          
          if (response.ok) {
            const data = await response.json();
            const contractDecimals = parseInt(data.data?.decimals);
            
            if (!isNaN(contractDecimals)) {
              console.log(`✅ ${toToken.symbol} ACTUAL decimals from contract: ${contractDecimals}`);
              actualToDecimals = contractDecimals;
              
              if (contractDecimals !== toToken.decimals) {
                console.warn(`⚠️ MISMATCH! Cached: ${toToken.decimals}, Contract: ${contractDecimals} - USING CONTRACT VALUE!`);
              }
            }
          }
        } catch (e) {
          console.error(`❌ Failed to query ${toToken.symbol} decimals:`, e);
          // Fallback to pool inference only if contract query fails
          const poolData = await getPoolPrice(toToken.address);
          if (poolData && poolData.decimals !== toToken.decimals) {
            console.warn(`🔧 Fallback: Using pool inferred decimals: ${poolData.decimals}`);
            actualToDecimals = poolData.decimals;
          }
        }
      }
      
      console.log('🚀 Starting swap transaction:', {
        from: fromToken.symbol,
        to: toToken.symbol,
        amount: fromAmount,
        fromDecimalsInitial: fromToken.decimals,
        toDecimalsInitial: toToken.decimals,
        fromDecimalsCorrected: actualFromDecimals,
        toDecimalsCorrected: actualToDecimals,
        rawBalance: fromToken.balance,
        fromAddress: fromToken.address,
        toAddress: toToken.address
      });
      
      console.log('⚠️ CRITICAL: Checking decimals match...');
      if (actualFromDecimals !== fromToken.decimals) {
        console.error(`❌ DECIMALS MISMATCH! ${fromToken.symbol}: Cached=${fromToken.decimals}, Actual=${actualFromDecimals}`);
      } else {
        console.log(`✅ ${fromToken.symbol} decimals match: ${actualFromDecimals}`);
      }
      
      if (actualToDecimals !== toToken.decimals) {
        console.error(`❌ DECIMALS MISMATCH! ${toToken.symbol}: Cached=${toToken.decimals}, Actual=${actualToDecimals}`);
      } else {
        console.log(`✅ ${toToken.symbol} decimals match: ${actualToDecimals}`);
      }
      
      // Balance is ALWAYS in base units (raw from contract) - no decimals applied
      let userBalanceBaseUnits = parseFloat(fromToken.balance || '0');
      
      const userBalanceHumanReadable = userBalanceBaseUnits / Math.pow(10, actualFromDecimals);
      
      console.log('💳 User balance (raw from contract):', {
        token: fromToken.symbol,
        rawBalance: userBalanceBaseUnits,
        decimals: actualFromDecimals,
        humanReadable: userBalanceHumanReadable.toFixed(8),
        humanReadableFull: userBalanceHumanReadable
      });
      
      // CRITICAL DEBUG: Show user what's happening
      const debugInfo = `
🔍 SWAP DEBUG INFO

Token: ${fromToken.symbol}
Your balance: ${userBalanceHumanReadable.toFixed(8)} ${fromToken.symbol}
You want to swap: ${fromAmount} ${fromToken.symbol}

[RAW VALUES]
Balance (raw): ${userBalanceBaseUnits}
Decimals: ${actualFromDecimals}
Request: ${fromAmount} × 10^${actualFromDecimals}

⚠️ Check if you have enough balance!
      `.trim();
      
      console.log(debugInfo);
      
      // Calculate requested amount in base units with ACTUAL decimals
      const requestedAmountBaseUnits = Math.floor(parseFloat(fromAmount) * Math.pow(10, actualFromDecimals));
      
      const balanceCheck = {
        token: fromToken.symbol,
        decimals: actualFromDecimals,
        userBalanceRaw: userBalanceBaseUnits,
        userBalanceHuman: (userBalanceBaseUnits / Math.pow(10, actualFromDecimals)).toFixed(8),
        requestedHuman: fromAmount,
        requestedRaw: requestedAmountBaseUnits,
        calculation: `${fromAmount} × 10^${actualFromDecimals} = ${requestedAmountBaseUnits}`,
        hasEnough: userBalanceBaseUnits >= requestedAmountBaseUnits,
        shortage: userBalanceBaseUnits < requestedAmountBaseUnits ? 
          (requestedAmountBaseUnits - userBalanceBaseUnits) : 0
      };
      
      console.log('💰 Balance check DETAILS:', balanceCheck);
      
      // Show alert and throw error if insufficient
      if (!balanceCheck.hasEnough) {
        const shortageHuman = (balanceCheck.shortage / Math.pow(10, actualFromDecimals)).toFixed(8);
        alert(`❌ INSUFFICIENT BALANCE!\n\nToken: ${fromToken.symbol}\nDecimals: ${actualFromDecimals}\n\nYou have: ${balanceCheck.userBalanceHuman} ${fromToken.symbol}\nYou want: ${fromAmount} ${fromToken.symbol}\nShortage: ${shortageHuman} ${fromToken.symbol}\n\n[RAW VALUES]\nBalance: ${balanceCheck.userBalanceRaw}\nRequested: ${balanceCheck.requestedRaw}\n\nPlease reduce your swap amount!`);
        throw new Error(`Insufficient balance. You need ${shortageHuman} more ${fromToken.symbol}`);
      }
      
      // Confirmation before proceeding
      console.log('✅ Balance check PASSED! Proceeding with swap...');
      
      // SAFETY: Never send more than available balance (防止overflow)
      const safeAmountInBaseUnit = Math.min(requestedAmountBaseUnits, userBalanceBaseUnits);
      const amountInBaseUnit = safeAmountInBaseUnit.toString();
      
      if (safeAmountInBaseUnit < requestedAmountBaseUnits) {
        console.warn('⚠️ Reducing swap amount to match available balance');
      }
      
      console.log('💰 Amount to send:', {
        input: fromAmount,
        decimals: actualFromDecimals,
        baseUnit: amountInBaseUnit
      });
      
      // CRITICAL: Check pool reserves to prevent overflow in pool contract
      let poolReserves: any = null;
      try {
        const fromAddr = fromToken.address === 'upaxi' ? toToken.address : fromToken.address;
        const poolData = await getPoolPrice(fromAddr);
        
        if (poolData) {
          poolReserves = poolData.reserves;
          
          const yourSwapBaseUnits = parseFloat(amountInBaseUnit);
          const yourSwapHuman = yourSwapBaseUnits / Math.pow(10, actualFromDecimals);
          
          console.log('🏊 Pool reserves check:', {
            token: fromToken.symbol,
            poolPaxiReserve: poolData.reserves.paxi.toFixed(6) + ' PAXI',
            poolTokenReserve: poolData.reserves.token.toFixed(6) + ' ' + fromToken.symbol,
            yourSwapBaseUnits: yourSwapBaseUnits,
            yourSwapHuman: yourSwapHuman.toFixed(6) + ' ' + fromToken.symbol,
            decimals: actualFromDecimals,
            poolHasEnough: poolData.reserves.token > yourSwapHuman
          });
          
          // Check if pool has enough reserves
          if (fromToken.address !== 'upaxi') {
            // Swapping PRC20 → PAXI, check if pool has enough tokens to accept
            if (yourSwapHuman > poolData.reserves.token) {
              throw new Error(`Pool doesn't have enough capacity. Pool token reserve: ${poolData.reserves.token.toFixed(6)} ${fromToken.symbol}, you're trying to swap: ${yourSwapHuman.toFixed(6)} ${fromToken.symbol}`);
            }
          } else {
            // Swapping PAXI → PRC20, check if pool has enough PAXI to accept
            const yourSwapPaxi = yourSwapBaseUnits / 1e6;
            if (yourSwapPaxi > poolData.reserves.paxi) {
              throw new Error(`Pool doesn't have enough PAXI capacity. Pool PAXI reserve: ${poolData.reserves.paxi.toFixed(6)} PAXI, you're trying to swap: ${yourSwapPaxi.toFixed(6)} PAXI`);
            }
          }
        }
      } catch (e: any) {
        console.error('❌ Pool reserve check failed:', e);
        if (e.message?.includes('Pool doesn')) {
          throw e;
        }
      }
      
      let prc20Address: string;
      let offerDenom: string;
      
      if (fromToken.address === 'upaxi') {
        // Swap PAXI to PRC20
        prc20Address = toToken.address;
        offerDenom = 'upaxi';
      } else if (toToken.address === 'upaxi') {
        // Swap PRC20 to PAXI
        prc20Address = fromToken.address;
        offerDenom = fromToken.address;
      } else {
        throw new Error('Direct PRC20 to PRC20 swap not supported yet. Please swap to PAXI first, then to your target token.');
      }
      
      // CRITICAL FIX: Calculate expected output using CONSTANT PRODUCT FORMULA (AMM)
      // Pool uses: Output = (input × outputReserve) / (inputReserve + input)
      // NOT simple: Output = input × price
      let recalculatedOutputHuman = 0;
      let poolReservesDebug: any = {};
      
      if (fromToken.address === 'upaxi') {
        // PAXI → PRC20: Swapping PAXI for tokens
        const poolData = await getPoolPrice(toToken.address);
        if (poolData) {
          const inputAmountHuman = parseFloat(fromAmount); // PAXI in human units
          const paxiReserve = poolData.reserves.paxi; // PAXI reserve in human units
          const tokenReserve = poolData.reserves.token; // Token reserve in human units
          
          // AMM formula: outputAmount = (inputAmount × tokenReserve) / (paxiReserve + inputAmount)
          recalculatedOutputHuman = (inputAmountHuman * tokenReserve) / (paxiReserve + inputAmountHuman);
          
          poolReservesDebug = {
            paxiReserve: paxiReserve,
            tokenReserve: tokenReserve,
            inputPaxi: inputAmountHuman,
            outputToken: recalculatedOutputHuman
          };
          
          console.log(`📊 AMM Calculation (PAXI → ${toToken.symbol}):`, {
            formula: '(input × tokenReserve) / (paxiReserve + input)',
            input: `${inputAmountHuman} PAXI`,
            paxiReserve: `${paxiReserve.toFixed(6)} PAXI`,
            tokenReserve: `${tokenReserve.toFixed(6)} ${toToken.symbol}`,
            output: `${recalculatedOutputHuman.toFixed(8)} ${toToken.symbol}`,
            calculation: `(${inputAmountHuman} × ${tokenReserve}) / (${paxiReserve} + ${inputAmountHuman}) = ${recalculatedOutputHuman.toFixed(8)}`
          });
        }
      } else {
        // PRC20 → PAXI: Swapping tokens for PAXI
        const poolData = await getPoolPrice(fromToken.address);
        if (poolData) {
          const inputAmountHuman = parseFloat(fromAmount); // Token in human units
          const tokenReserve = poolData.reserves.token; // Token reserve in human units
          const paxiReserve = poolData.reserves.paxi; // PAXI reserve in human units
          
          // AMM formula: outputAmount = (inputAmount × paxiReserve) / (tokenReserve + inputAmount)
          recalculatedOutputHuman = (inputAmountHuman * paxiReserve) / (tokenReserve + inputAmountHuman);
          
          poolReservesDebug = {
            tokenReserve: tokenReserve,
            paxiReserve: paxiReserve,
            inputToken: inputAmountHuman,
            outputPaxi: recalculatedOutputHuman
          };
          
          console.log(`📊 AMM Calculation (${fromToken.symbol} → PAXI):`, {
            formula: '(input × paxiReserve) / (tokenReserve + input)',
            input: `${inputAmountHuman} ${fromToken.symbol}`,
            tokenReserve: `${tokenReserve.toFixed(6)} ${fromToken.symbol}`,
            paxiReserve: `${paxiReserve.toFixed(6)} PAXI`,
            output: `${recalculatedOutputHuman.toFixed(8)} PAXI`,
            calculation: `(${inputAmountHuman} × ${paxiReserve}) / (${tokenReserve} + ${inputAmountHuman}) = ${recalculatedOutputHuman.toFixed(8)}`
          });
        }
      }
      
      // Convert to base units with CORRECT decimals
      const expectedOutputBaseUnits = Math.floor(recalculatedOutputHuman * Math.pow(10, actualToDecimals));
      const slippagePercent = parseFloat(slippage) / 100;
      const minReceiveAmount = Math.floor(expectedOutputBaseUnits * (1 - slippagePercent));
      const minReceive = minReceiveAmount > 0 ? minReceiveAmount.toString() : '1';
      
      console.log('🎯 Slippage calculation:', {
        toAmountState: toAmount,
        recalculatedOutputHuman: recalculatedOutputHuman,
        actualToDecimals: actualToDecimals,
        expectedOutputBaseUnits: expectedOutputBaseUnits,
        slippage: slippage + '%',
        slippagePercent: slippagePercent,
        minReceiveAmountBaseUnits: minReceiveAmount,
        minReceive: minReceive,
        formula: `${recalculatedOutputHuman.toFixed(8)} × 10^${actualToDecimals} × (1 - ${slippage}%) = ${minReceive}`,
        poolReserves: poolReservesDebug
      });
      
      // Import executeSwap from keplr.ts
      const { executeSwap } = await import('@/lib/keplr');
      
      // Execute swap with custom registry
      const result = await executeSwap(
        selectedChain,
        {
          prc20Address,
          offerDenom,
          offerAmount: amountInBaseUnit,
          minReceive
        },
        '300000',
        `Swap ${fromToken.symbol} to ${toToken.symbol}`
      );
      
      console.log('📡 Swap result:', result);
      
      if (result.success) {
        console.log('✅ Swap successful! TxHash:', result.txHash);
        setTxResult({ success: true, txHash: result.txHash });
        
        // Reload balances after 3 seconds
        setTimeout(() => {
          if (walletAddress) {
            console.log('🔄 Reloading balances...');
            loadBalances(true);
          }
        }, 3000);
      } else {
        console.error('❌ Swap failed:', result.error);
        throw new Error(result.error || 'Swap failed');
      }
      
    } catch (error: any) {
      console.error('❌ Swap failed:', error);
      setTxResult({ 
        success: false, 
        error: error.message || 'Swap failed. Please try again.' 
      });
    } finally {
      setLoading(false);
    }
  };

  const connectWallet = async () => {
    if (!selectedChain) return;
    
    try {
      if (!(window as any).keplr) {
        setTxResult({ 
          success: false, 
          error: 'Please install Keplr wallet extension from https://www.keplr.app/' 
        });
        return;
      }
      
      await (window as any).keplr.enable(selectedChain.chain_id);
      const key = await (window as any).keplr.getKey(selectedChain.chain_id);
      setWalletAddress(key.bech32Address);
      console.log('✅ Wallet connected:', key.bech32Address);
      
      // Immediately load balances after manual connection
      if (tokens.length > 0) {
        console.log('🔄 Loading balances after wallet connection...');
        setTimeout(() => {
          loadBalances(true);
        }, 500); // Small delay to ensure token list is ready
      }
    } catch (error: any) {
      console.error('❌ Error connecting wallet:', error);
      setTxResult({ 
        success: false, 
        error: error.message || 'Failed to connect wallet. Please try again.' 
      });
    }
  };

  const formatBalance = (balance: string, decimals: number = 6): string => {
    if (!balance || balance === '0') return '0.0000';
    
    const num = Number(balance) / Math.pow(10, decimals);
    return num.toFixed(4);
  };

  const handleRefreshBalances = async () => {
    if (!walletAddress) return;
    console.log('🔄 Manual balance refresh triggered');
    await loadBalances(true);
  };

  const switchTokens = () => {
    if (!fromToken || !toToken) return;
    
    // Switch FROM and TO tokens
    const temp = fromToken;
    setFromToken(toToken);
    setToToken(temp);
    
    // Switch amounts
    setFromAmount(toAmount);
    setToAmount(fromAmount);
  };

  return (
    <div className="flex min-h-screen bg-[#0a0a0a]">
      {selectedChain && <Sidebar selectedChain={selectedChain} />}

      <div className="flex-1 flex flex-col">
        <Header chains={chains} selectedChain={selectedChain} onSelectChain={setSelectedChain} />

        <main className="flex-1 mt-32 lg:mt-16 p-4 md:p-6 overflow-auto">
          {/* Page Header */}
          <div className="mb-10">
            <div className="max-w-lg mx-auto">
              <div className="relative bg-gradient-to-b from-[#1a1a1a] to-[#151515] rounded-xl sm:rounded-2xl p-4 sm:p-8 border border-gray-800/50 shadow-2xl shadow-black/50">
                {/* Subtle top accent */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-1 bg-gradient-to-r from-transparent via-blue-500/50 to-transparent rounded-full"></div>
                
                <div className="text-center">
                  <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-white mb-1 sm:mb-2 tracking-tight">
                    PRC20 Token Swap
                  </h1>
                  <p className="text-gray-400 text-[10px] sm:text-xs mb-3 sm:mb-4">Swap between PRC20 tokens instantly</p>
                  
                  {/* Show wallet address only when connected */}
                  {walletAddress && (
                    <div className="inline-flex items-center gap-1.5">
                      <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-green-500/10 border border-green-500/20 rounded-full">
                        <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
                        <span className="text-[10px] sm:text-xs font-mono text-green-400 font-medium">
                          {walletAddress.slice(0, 6)}...{walletAddress.slice(-3)}
                        </span>
                      </div>
                      <button
                        onClick={handleRefreshBalances}
                        disabled={refreshing}
                        className="p-1 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 hover:border-blue-500/30 rounded-full transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
                        title="Refresh balances"
                      >
                        <RefreshCw className={`w-3 h-3 text-blue-400 group-hover:text-blue-300 ${refreshing ? 'animate-spin' : ''}`} />
                      </button>
                    </div>
                  )}
                  
                  {!walletAddress && (
                    <button
                      onClick={connectWallet}
                      className="inline-flex items-center justify-center gap-1 sm:gap-1.5 px-2.5 py-1 sm:px-4 sm:py-2 bg-blue-600 hover:bg-blue-500 text-white text-[10px] sm:text-xs font-semibold rounded-md sm:rounded-lg transition-all duration-200 shadow-lg shadow-blue-600/20 hover:shadow-blue-600/40"
                    >
                      <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      <span className="hidden xs:inline sm:inline">Connect Wallet</span>
                      <span className="inline xs:hidden sm:hidden">Connect</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Swap Container */}
          <div className="max-w-lg mx-auto">
            {/* Tabs - Responsive Grid */}
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mb-4">
              <button
                onClick={() => setActiveTab('swap')}
                className={`px-3 py-2 rounded-lg font-medium text-xs sm:text-sm transition-colors ${
                  activeTab === 'swap'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                Swap
              </button>
              <button
                onClick={() => setActiveTab('liquidity')}
                className={`px-3 py-2 rounded-lg font-medium text-xs sm:text-sm transition-colors ${
                  activeTab === 'liquidity'
                    ? 'bg-cyan-500 text-white'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                Liquidity
              </button>
              <button
                onClick={() => setActiveTab('transfer')}
                className={`px-3 py-2 rounded-lg font-medium text-xs sm:text-sm transition-colors ${
                  activeTab === 'transfer'
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                Transfer
              </button>
              <button
                onClick={() => setActiveTab('burn')}
                className={`px-3 py-2 rounded-lg font-medium text-xs sm:text-sm transition-colors ${
                  activeTab === 'burn'
                    ? 'bg-red-500 text-white'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                Burn
              </button>
              <button
                onClick={() => setActiveTab('info')}
                className={`px-3 py-2 rounded-lg font-medium text-xs sm:text-sm transition-colors ${
                  activeTab === 'info'
                    ? 'bg-purple-500 text-white'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                Info
              </button>
            </div>

            {/* Admin Panel - Disabled
            {isAdmin && selectedChain?.chain_id === 'paxi-mainnet' && (
              <div className="mb-4 bg-gradient-to-r from-yellow-900/20 to-yellow-800/20 border border-yellow-500/30 rounded-lg p-4">
                <button
                  onClick={() => setShowAdminPanel(!showAdminPanel)}
                  className="w-full flex items-center justify-between text-yellow-400 hover:text-yellow-300 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Shield className="w-5 h-5" />
                    <span className="font-semibold">Admin Panel - Token Verification</span>
                  </div>
                  <svg
                    className={`w-5 h-5 transition-transform ${showAdminPanel ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {showAdminPanel && (
                  <div className="mt-4 space-y-4">
                    <div className="flex gap-2">
                      <button
                        onClick={() => setVerifyAction('add')}
                        className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                          verifyAction === 'add'
                            ? 'bg-green-600 text-white'
                            : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                        }`}
                      >
                        <CheckCircle className="w-4 h-4 inline mr-2" />
                        Add Verified
                      </button>
                      <button
                        onClick={() => setVerifyAction('remove')}
                        className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                          verifyAction === 'remove'
                            ? 'bg-red-600 text-white'
                            : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                        }`}
                      >
                        <XCircle className="w-4 h-4 inline mr-2" />
                        Remove Verified
                      </button>
                    </div>

                    <div>
                      <label className="block text-sm text-gray-300 mb-2">
                        Contract Address
                      </label>
                      <input
                        type="text"
                        value={verifyContractAddress}
                        onChange={(e) => setVerifyContractAddress(e.target.value)}
                        placeholder="paxi1..."
                        className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500"
                      />
                    </div>

                    <button
                      onClick={handleVerifyContract}
                      disabled={verifying || !verifyContractAddress.trim()}
                      className="w-full px-4 py-3 bg-yellow-600 hover:bg-yellow-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-all"
                    >
                      {verifying ? (
                        <span className="flex items-center justify-center gap-2">
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          Processing...
                        </span>
                      ) : (
                        <span>
                          {verifyAction === 'add' ? '✓ Add to Verified List' : '✗ Remove from Verified List'}
                        </span>
                      )}
                    </button>

                    <div className="text-xs text-gray-400 bg-gray-900/50 rounded p-3 border border-gray-800">
                      <p className="font-semibold text-yellow-400 mb-1">💡 Admin Instructions:</p>
                      <ul className="list-disc list-inside space-y-1">
                        <li>Enter PRC-20 contract address</li>
                        <li>Click "Add" to add to verified list in backend</li>
                        <li>Click "Remove" to remove from verified list</li>
                        <li>Token list will auto-refresh after action</li>
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            ) */}

            {/* Price Chart - Show after tabs, before swap content */}
            {activeTab === 'swap' && (
              <>
                {/* Show chart for fromToken if it's PRC20 */}
                {fromToken?.address !== 'upaxi' && fromToken && (
                  <div className="mb-4">
                    <PRC20PriceChart
                      contractAddress={fromToken.address}
                      symbol={fromToken.symbol}
                    />
                  </div>
                )}
                {/* Show chart for toToken if it's PRC20 and fromToken is not PRC20 */}
                {!fromToken && toToken?.address !== 'upaxi' && toToken && (
                  <div className="mb-4">
                    <PRC20PriceChart
                      contractAddress={toToken.address}
                      symbol={toToken.symbol}
                    />
                  </div>
                )}
              </>
            )}

            {activeTab === 'swap' && (
            <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-6">
              {/* Settings Button */}
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-white">Swap</h2>
                <button
                  onClick={() => setShowSettings(!showSettings)}
                  className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
                >
                  <Settings className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              {/* Settings Panel */}
              {showSettings && (
                <div className="mb-4 p-4 bg-[#0f0f0f] border border-gray-700 rounded-lg">
                  <div className="mb-2">
                    <label className="block text-sm text-gray-400 mb-2">Slippage Tolerance</label>
                    <div className="flex gap-2">
                      {['0.1', '0.5', '1.0'].map((value) => (
                        <button
                          key={value}
                          onClick={() => setSlippage(value)}
                          className={`flex-1 px-3 py-2 rounded-lg text-sm transition-colors ${
                            slippage === value
                              ? 'bg-blue-500 text-white'
                              : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                          }`}
                        >
                          {value}%
                        </button>
                      ))}
                      <input
                        type="number"
                        value={slippage}
                        onChange={(e) => setSlippage(e.target.value)}
                        placeholder="Custom"
                        className="w-20 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* From Token */}
              <div className="mb-2">
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm text-gray-400">From</label>
                  {walletAddress && fromToken && fromToken.balance && (
                    <button
                      onClick={() => {
                        const maxAmount = formatBalance(fromToken.balance || '0', fromToken.decimals);
                        setFromAmount(maxAmount);
                      }}
                      className="text-xs text-blue-400 hover:text-blue-300 transition-colors font-semibold"
                    >
                      MAX
                    </button>
                  )}
                </div>
                <div className="bg-[#0f0f0f] border border-gray-700 rounded-lg p-4">
                  <div className="flex justify-between items-center mb-2">
                    <input
                      type="number"
                      value={fromAmount}
                      onChange={(e) => setFromAmount(e.target.value)}
                      placeholder="0.0"
                      className="bg-transparent text-2xl text-white font-semibold focus:outline-none w-full"
                    />
                    <button
                      onClick={() => setShowFromTokenModal(true)}
                      className="ml-4 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors flex items-center gap-2 min-w-[120px]"
                    >
                      {fromToken ? (
                        <>
                          {fromToken.logo && (
                            <Image src={fromToken.logo} alt={fromToken.symbol} width={20} height={20} className="w-5 h-5 rounded-full" unoptimized />
                          )}
                          <span>{fromToken.symbol}</span>
                        </>
                      ) : (
                        <span>Select</span>
                      )}
                      <svg className="w-4 h-4 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>
                  
                  {/* Amount Slider */}
                  {fromToken && walletAddress && fromToken.balance && fromToken.balance !== '0' && (
                    <div className="mb-3 px-1">
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={swapPercentage}
                        onChange={(e) => {
                          const percentage = parseInt(e.target.value);
                          setSwapPercentage(percentage);
                          const balance = formatBalance(fromToken.balance || '0', fromToken.decimals);
                          const amount = (parseFloat(balance) * percentage / 100).toFixed(fromToken.decimals);
                          setFromAmount(amount);
                        }}
                        className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider-thumb"
                        style={{
                          background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${swapPercentage}%, #374151 ${swapPercentage}%, #374151 100%)`
                        }}
                      />
                      <div className="flex justify-between items-center mt-1">
                        <span className="text-xs text-gray-500">25%</span>
                        <span className="text-xs text-gray-500">50%</span>
                        <span className="text-xs text-gray-500">Max</span>
                      </div>
                    </div>
                  )}

                  {fromToken && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 text-gray-500">
                          {fromToken.logo && <Image src={fromToken.logo} alt={fromToken.name} width={16} height={16} className="w-4 h-4 rounded-full" unoptimized />}
                          <span>{fromToken.name}</span>
                        </div>
                        {walletAddress && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              const maxAmount = formatBalance(fromToken.balance || '0', fromToken.decimals);
                              setFromAmount(maxAmount);
                            }}
                            className="text-gray-400 hover:text-white transition-colors cursor-pointer"
                            title="Click to use max balance"
                          >
                            Balance: <span className="text-white font-medium">{formatBalance(fromToken.balance || '0', fromToken.decimals)}</span> {fromToken.symbol}
                          </button>
                          <button
                            onClick={handleRefreshBalances}
                            disabled={refreshing}
                            className="p-1 hover:bg-gray-700 rounded transition-colors disabled:opacity-50"
                            title="Refresh balance"
                          >
                            <RefreshCw className={`w-3 h-3 text-gray-400 hover:text-blue-400 ${refreshing ? 'animate-spin' : ''}`} />
                          </button>
                        </div>
                        )}
                      </div>
                      {fromToken.address !== 'upaxi' && marketPrices[fromToken.address] && (
                        <div className="flex items-center justify-between text-xs">
                          <div className="text-gray-500">
                            {(marketPrices[fromToken.address].price_paxi || marketPrices[fromToken.address].price_usd).toFixed(6)} PAXI
                          </div>
                          {marketPrices[fromToken.address].price_change_24h !== 0 && (
                            <div className={`flex items-center gap-1 font-medium ${
                              marketPrices[fromToken.address].price_change_24h > 0 ? 'text-green-400' : 'text-red-400'
                            }`}>
                              {marketPrices[fromToken.address].price_change_24h > 0 ? '↑' : '↓'}
                              {Math.abs(marketPrices[fromToken.address].price_change_24h).toFixed(2)}%
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Switch Button */}
              <div className="flex justify-center -my-2 relative z-10">
                <button
                  onClick={switchTokens}
                  disabled={!fromToken || !toToken}
                  className={`p-2 bg-[#1a1a1a] border-2 border-gray-800 rounded-xl transition-all ${
                    fromToken && toToken 
                      ? 'hover:bg-gray-800 hover:border-blue-500 cursor-pointer' 
                      : 'opacity-50 cursor-not-allowed'
                  }`}
                  title="Switch tokens"
                >
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                  </svg>
                </button>
              </div>

              {/* To Token */}
              <div className="mb-4">
                <label className="block text-sm text-gray-400 mb-2">To</label>
                <div className="bg-[#0f0f0f] border border-gray-700 rounded-lg p-4">
                  <div className="flex justify-between items-center mb-2">
                    <input
                      type="number"
                      value={toAmount}
                      onChange={(e) => setToAmount(e.target.value)}
                      placeholder="0.0"
                      className="bg-transparent text-2xl text-white font-semibold focus:outline-none w-full"
                      readOnly
                    />
                    <button
                      onClick={() => setShowToTokenModal(true)}
                      disabled={!fromToken || fromToken.address !== 'upaxi'}
                      className={`ml-4 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors flex items-center gap-2 min-w-[120px] ${
                        !fromToken || fromToken.address !== 'upaxi' ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-700'
                      }`}
                      title={fromToken?.address === 'upaxi' ? 'Select PRC20 token' : 'TO token is always PAXI when swapping from PRC20'}
                    >
                      {toToken ? (
                        <>
                          {toToken.logo && (
                            <Image src={toToken.logo} alt={toToken.symbol} width={20} height={20} className="w-5 h-5 rounded-full" unoptimized />
                          )}
                          <span>{toToken.symbol}</span>
                        </>
                      ) : (
                        <span>Select</span>
                      )}
                      <svg className="w-4 h-4 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>
                  {toToken && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 text-gray-500">
                          {toToken.logo && <Image src={toToken.logo} alt={toToken.name} width={16} height={16} className="w-4 h-4 rounded-full" unoptimized />}
                          <span>{toToken.name}</span>
                        </div>
                        {walletAddress && (
                          <div className="text-gray-400">
                            Balance: <span className="text-white font-medium">{formatBalance(toToken.balance || '0', toToken.decimals)}</span> {toToken.symbol}
                          </div>
                        )}
                      </div>
                      {toToken.address !== 'upaxi' && marketPrices[toToken.address] && (
                        <div className="flex items-center justify-between text-xs">
                          <div className="text-gray-500">
                            {(marketPrices[toToken.address].price_paxi || marketPrices[toToken.address].price_usd).toFixed(6)} PAXI
                          </div>
                          {marketPrices[toToken.address].price_change_24h !== 0 && (
                            <div className={`flex items-center gap-1 font-medium ${
                              marketPrices[toToken.address].price_change_24h > 0 ? 'text-green-400' : 'text-red-400'
                            }`}>
                              {marketPrices[toToken.address].price_change_24h > 0 ? '↑' : '↓'}
                              {Math.abs(marketPrices[toToken.address].price_change_24h).toFixed(2)}%
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Advanced Options */}
              {fromToken && toToken && (
                <div className="mb-4">
                  <button
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors mb-2"
                  >
                    <Settings className="w-4 h-4" />
                    Advanced Options
                    <svg
                      className={`w-4 h-4 transition-transform ${showAdvanced ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {showAdvanced && (
                    <div className="p-4 bg-[#0f0f0f] border border-gray-700 rounded-lg space-y-4">
                      {/* Amount Slider */}
                      {fromToken.balance && fromToken.balance !== '0' && (
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <label className="text-sm text-gray-400">Amount Percentage</label>
                            <span className="text-sm text-white font-medium">{swapPercentage}%</span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={swapPercentage}
                            onChange={(e) => {
                              const percentage = parseInt(e.target.value);
                              setSwapPercentage(percentage);
                              const balance = formatBalance(fromToken.balance || '0', fromToken.decimals);
                              const amount = (parseFloat(balance) * percentage / 100).toFixed(fromToken.decimals);
                              setFromAmount(amount);
                            }}
                            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider-thumb"
                          />
                          <div className="flex justify-between text-xs text-gray-500">
                            <span>0%</span>
                            <span>25%</span>
                            <span>50%</span>
                            <span>75%</span>
                            <span>100%</span>
                          </div>
                        </div>
                      )}

                      {/* Slippage Tolerance */}
                      <div className="space-y-2">
                        <label className="text-sm text-gray-400">Slippage Tolerance</label>
                        <div className="flex gap-2">
                          {['0.1', '0.5', '1.0'].map((value) => (
                            <button
                              key={value}
                              onClick={() => setSlippage(value)}
                              className={`flex-1 py-2 text-sm rounded ${
                                slippage === value
                                  ? 'bg-blue-500 text-white'
                                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                              } transition-colors`}
                            >
                              {value}%
                            </button>
                          ))}
                          <input
                            type="number"
                            value={slippage}
                            onChange={(e) => setSlippage(e.target.value)}
                            placeholder="Custom"
                            className="w-20 px-2 py-2 bg-gray-800 border border-gray-700 rounded text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            step="0.1"
                            min="0"
                            max="50"
                          />
                        </div>
                      </div>

                      {/* Memo */}
                      <div className="space-y-2">
                        <label className="text-sm text-gray-400">Memo (Optional)</label>
                        <input
                          type="text"
                          value={memo}
                          onChange={(e) => setMemo(e.target.value)}
                          placeholder="Add a note to your transaction"
                          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                          maxLength={256}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Swap Details */}
              {fromToken && toToken && fromAmount && toAmount && (
                <div className="mb-4 p-4 bg-[#0f0f0f] border border-gray-700 rounded-lg space-y-2">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs text-gray-500">Real-time Pool Data</span>
                    <button
                      onClick={() => {
                        console.log('🔄 Refreshing prices (no cache)...');
                        loadMarketPrices();
                        // Trigger recalculation by clearing and resetting amount
                        const currentAmount = fromAmount;
                        setFromAmount('');
                        setTimeout(() => setFromAmount(currentAmount), 100);
                      }}
                      className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                    >
                      ↻ Refresh
                    </button>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Exchange Rate</span>
                    <span className="text-white font-mono">
                      1 {fromToken.symbol} = {
                        fromAmount && toAmount 
                          ? (parseFloat(toAmount) / parseFloat(fromAmount)).toFixed(6)
                          : '0.000000'
                      } {toToken.symbol}
                    </span>
                  </div>
                  {/* Show pool price in the swap direction for clarity */}
                  {fromToken.address === 'upaxi' && toToken.address !== 'upaxi' && marketPrices[toToken.address] && (
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">Pool Price</span>
                      <span className="text-gray-300">
                        1 {toToken.symbol} = {(marketPrices[toToken.address].price_paxi || marketPrices[toToken.address].price_usd).toFixed(6)} PAXI
                      </span>
                    </div>
                  )}
                  {fromToken.address !== 'upaxi' && toToken.address === 'upaxi' && marketPrices[fromToken.address] && (
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">Pool Price</span>
                      <span className="text-gray-300">
                        1 {fromToken.symbol} = {(marketPrices[fromToken.address].price_paxi || marketPrices[fromToken.address].price_usd).toFixed(6)} PAXI
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Price Impact</span>
                    <span className="text-green-400">&lt; 0.01%</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Minimum Received</span>
                    <span className="text-white">
                      {(() => {
                        const outputAmount = parseFloat(toAmount || '0');
                        const slippagePct = parseFloat(slippage || '0.5');
                        const minReceive = outputAmount * (1 - slippagePct / 100);
                        console.log(`🔢 Minimum Received calculation:`, {
                          toAmount,
                          outputAmount,
                          slippage,
                          slippagePct,
                          formula: `${outputAmount} * (1 - ${slippagePct}/100)`,
                          result: minReceive,
                          decimals: toToken.decimals
                        });
                        return minReceive.toFixed(Math.min(toToken.decimals, 6));
                      })()} {toToken.symbol}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Network Fee</span>
                    <span className="text-white">~0.001 PAXI</span>
                  </div>
                </div>
              )}

              {/* Warning */}
              <div className="mb-4 flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-yellow-400">
                  Please review all swap details carefully. Ensure you have enough balance for network fees.
                </p>
              </div>

              {/* Swap Button */}
              {/* Balance Warning */}
              {fromToken && fromAmount && parseFloat(fromAmount) > 0 && walletAddress && (
                <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                  <div className="flex items-start gap-2">
                    <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                    <div className="text-sm space-y-1 w-full">
                      <div className="flex justify-between text-gray-300">
                        <span className="text-gray-400">Swapping:</span>
                        <span className="font-semibold text-white">{fromAmount} {fromToken.symbol}</span>
                      </div>
                      <div className="flex justify-between text-gray-300">
                        <span className="text-gray-400">Balance:</span>
                        <span className="font-semibold text-white">
                          {formatBalance(fromToken.balance || '0', fromToken.decimals)} {fromToken.symbol}
                        </span>
                      </div>
                      {parseFloat(fromAmount) > parseFloat(formatBalance(fromToken.balance || '0', fromToken.decimals)) && (
                        <div className="text-red-400 font-semibold flex items-center gap-1 mt-2 pt-2 border-t border-red-500/30">
                          <AlertCircle className="w-4 h-4" />
                          Insufficient balance!
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {!walletAddress ? (
                <button
                  onClick={connectWallet}
                  className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-lg transition-colors"
                >
                  Connect Wallet to Swap
                </button>
              ) : (
                <button
                  onClick={handleSwap}
                  disabled={loading || !fromToken || !toToken || !fromAmount}
                  className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      Swapping...
                    </>
                  ) : (
                    <>
                      <Zap className="w-5 h-5" />
                      Swap
                    </>
                  )}
                </button>
              )}
            </div>
            )}

            {/* Transfer Tab */}
            {activeTab === 'transfer' && selectedChain && (
              <>
                {!walletAddress ? (
                  <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-6 text-center">
                    <p className="text-gray-400 mb-4">Connect your wallet to transfer tokens</p>
                    <button
                      onClick={connectWallet}
                      className="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
                    >
                      Connect Wallet
                    </button>
                  </div>
                ) : (
                  <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-6">
                    <h2 className="text-lg font-semibold text-white mb-4">Transfer Tokens</h2>
                    
                    {/* Token Selector */}
                    {!fromToken || fromToken.address === 'upaxi' ? (
                      <div className="mb-6">
                        <label className="block text-sm text-gray-400 mb-2">Select Token to Transfer</label>
                        <button
                          onClick={() => setShowFromTokenModal(true)}
                          className="w-full px-4 py-3 bg-[#0f0f0f] border border-gray-700 rounded-lg text-gray-400 hover:border-blue-500 transition-colors text-left flex items-center justify-between"
                        >
                          <span>Select a PRC20 token...</span>
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                      </div>
                    ) : (
                      <>
                        {/* Token Info with Change Button */}
                        <div className="mb-6 p-4 bg-[#0f0f0f] border border-gray-700 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-3">
                              {fromToken.logo ? (
                                <img 
                                  src={fromToken.logo} 
                                  alt={fromToken.symbol} 
                                  className="w-10 h-10 rounded-full" 
                                  onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                    const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                                    if (fallback) fallback.style.display = 'flex';
                                  }}
                                />
                              ) : null}
                              <div 
                                className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold"
                                style={{ display: fromToken.logo ? 'none' : 'flex' }}
                              >
                                {fromToken.symbol.substring(0, 2)}
                              </div>
                              <div>
                                <div className="text-white font-semibold">{fromToken.name}</div>
                                <div className="text-gray-400 text-sm">{fromToken.symbol}</div>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              {fromToken.balance && (
                                <div className="text-right">
                                  <div className="text-xs text-gray-400">Available Balance</div>
                                  <div className="text-white font-semibold">
                                    {formatBalance(fromToken.balance, fromToken.decimals)} {fromToken.symbol}
                                  </div>
                                </div>
                              )}
                              <button
                                onClick={() => setShowFromTokenModal(true)}
                                className="px-3 py-1 bg-gray-800 hover:bg-gray-700 text-white text-sm rounded transition-colors"
                              >
                                Change
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Import TransferTokensSection dynamically */}
                        {(() => {
                          const TransferTokensSection = require('@/components/TransferTokensSection').default;
                          return (
                            <TransferTokensSection
                              chain={selectedChain.chain_id}
                              token={fromToken}
                              onTransferComplete={() => {
                                loadBalances();
                              }}
                            />
                          );
                        })()}
                      </>
                    )}
                  </div>
                )}
              </>
            )}

            {/* Burn Tab */}
            {activeTab === 'burn' && selectedChain && (
              <>
                {!walletAddress ? (
                  <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-6 text-center">
                    <p className="text-gray-400 mb-4">Connect your wallet to burn tokens</p>
                    <button
                      onClick={connectWallet}
                      className="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
                    >
                      Connect Wallet
                    </button>
                  </div>
                ) : (
                  <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-6">
                    <h2 className="text-lg font-semibold text-white mb-4">Burn Tokens</h2>
                    
                    {/* Token Selector */}
                    {!fromToken || fromToken.address === 'upaxi' ? (
                      <div className="mb-6">
                        <label className="block text-sm text-gray-400 mb-2">Select Token to Burn</label>
                        <button
                          onClick={() => setShowFromTokenModal(true)}
                          className="w-full px-4 py-3 bg-[#0f0f0f] border border-gray-700 rounded-lg text-gray-400 hover:border-red-500 transition-colors text-left flex items-center justify-between"
                        >
                          <span>Select a PRC20 token...</span>
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                      </div>
                    ) : (
                      <>
                        {/* Token Info with Change Button */}
                        <div className="mb-6 p-4 bg-[#0f0f0f] border border-gray-700 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-3">
                              {fromToken.logo ? (
                                <img 
                                  src={fromToken.logo} 
                                  alt={fromToken.symbol} 
                                  className="w-10 h-10 rounded-full" 
                                  onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                    const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                                    if (fallback) fallback.style.display = 'flex';
                                  }}
                                />
                              ) : null}
                              <div 
                                className="w-10 h-10 rounded-full bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center text-white font-bold"
                                style={{ display: fromToken.logo ? 'none' : 'flex' }}
                              >
                                {fromToken.symbol.substring(0, 2)}
                              </div>
                              <div>
                                <div className="text-white font-semibold">{fromToken.name}</div>
                                <div className="text-gray-400 text-sm">{fromToken.symbol}</div>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              {fromToken.balance && (
                                <div className="text-right">
                                  <div className="text-xs text-gray-400">Available Balance</div>
                                  <div className="text-white font-semibold">
                                    {formatBalance(fromToken.balance, fromToken.decimals)} {fromToken.symbol}
                                  </div>
                                </div>
                              )}
                              <button
                                onClick={() => setShowFromTokenModal(true)}
                                className="px-3 py-1 bg-gray-800 hover:bg-gray-700 text-white text-sm rounded transition-colors"
                              >
                                Change
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Import BurnTokensSection dynamically */}
                        {(() => {
                          const BurnTokensSection = require('@/components/BurnTokensSection').default;
                          return (
                            <BurnTokensSection
                              chain={selectedChain}
                              token={fromToken}
                              onBurnComplete={() => {
                                loadBalances();
                              }}
                            />
                          );
                        })()}
                      </>
                    )}
                  </div>
                )}
              </>
            )}

            {/* Liquidity Tab */}
            {activeTab === 'liquidity' && selectedChain && (
              <>
                {!walletAddress ? (
                  <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-6 text-center">
                    <p className="text-gray-400 mb-4">Connect your wallet to manage liquidity</p>
                    <button
                      onClick={connectWallet}
                      className="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
                    >
                      Connect Wallet
                    </button>
                  </div>
                ) : (
                  <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-6">
                    <h2 className="text-lg font-semibold text-white mb-4">Manage Liquidity</h2>
                    
                    {/* Token Selector */}
                    {!fromToken || fromToken.address === 'upaxi' ? (
                      <div className="mb-6">
                        <label className="block text-sm text-gray-400 mb-2">Select Token for Liquidity Pool</label>
                        <button
                          onClick={() => setShowFromTokenModal(true)}
                          className="w-full px-4 py-3 bg-[#0f0f0f] border border-gray-700 rounded-lg text-gray-400 hover:border-cyan-500 transition-colors text-left flex items-center justify-between"
                        >
                          <span>Select a PRC20 token...</span>
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                      </div>
                    ) : (
                      <>
                        {/* Sub-tabs for Add/Remove */}
                        <div className="flex gap-2 mb-6">
                          <button
                            onClick={() => setLiquidityMode('add')}
                            className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                              liquidityMode === 'add'
                                ? 'bg-cyan-500 text-white'
                                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                            }`}
                          >
                            Add Liquidity
                          </button>
                          <button
                            onClick={() => setLiquidityMode('remove')}
                            className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                              liquidityMode === 'remove'
                                ? 'bg-orange-500 text-white'
                                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                            }`}
                          >
                            Remove Liquidity
                          </button>
                        </div>

                        {/* Token Info with Change Button */}
                        <div className="mb-6 p-4 bg-[#0f0f0f] border border-gray-700 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-3">
                              {fromToken.logo ? (
                                <img 
                                  src={fromToken.logo} 
                                  alt={fromToken.symbol} 
                                  className="w-10 h-10 rounded-full" 
                                  onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                    const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                                    if (fallback) fallback.style.display = 'flex';
                                  }}
                                />
                              ) : null}
                              <div 
                                className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center text-white font-bold"
                                style={{ display: fromToken.logo ? 'none' : 'flex' }}
                              >
                                {fromToken.symbol.substring(0, 2)}
                              </div>
                              <div>
                                <div className="text-white font-semibold">{fromToken.name}</div>
                                <div className="text-gray-400 text-sm">{fromToken.symbol} / PAXI Pool</div>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              {fromToken.balance && (
                                <div className="text-right">
                                  <div className="text-xs text-gray-400">Available Balance</div>
                                  <div className="text-white font-semibold">
                                    {formatBalance(fromToken.balance, fromToken.decimals)} {fromToken.symbol}
                                  </div>
                                </div>
                              )}
                              <button
                                onClick={() => setShowFromTokenModal(true)}
                                className="px-3 py-1 bg-gray-800 hover:bg-gray-700 text-white text-sm rounded transition-colors"
                              >
                                Change
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Render Add or Remove component based on mode */}
                        {liquidityMode === 'add' ? (
                          <AddLiquiditySection
                            chainData={selectedChain}
                            paxiToken={{
                              address: 'upaxi',
                              name: 'Paxi',
                              symbol: 'PAXI',
                              decimals: 6,
                              balance: toToken?.address === 'upaxi' ? toToken.balance : undefined
                            }}
                            prc20Token={fromToken}
                            onSuccess={() => {
                              loadBalances();
                            }}
                            onResult={(result) => setTxResult(result)}
                          />
                        ) : (
                          <RemoveLiquiditySection
                            chainData={selectedChain}
                            paxiToken={{
                              address: 'upaxi',
                              name: 'Paxi',
                              symbol: 'PAXI',
                              decimals: 6,
                              balance: toToken?.address === 'upaxi' ? toToken.balance : undefined
                            }}
                            prc20Token={fromToken}
                            walletAddress={walletAddress}
                            onSuccess={() => {
                              loadBalances();
                            }}
                            onResult={(result) => setTxResult(result)}
                          />
                        )}
                      </>
                    )}
                  </div>
                )}
              </>
            )}

            {/* Info Tab */}
            {activeTab === 'info' && selectedChain && (
              <>
                {!fromToken || fromToken.address === 'upaxi' ? (
                  <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-6 text-center">
                    <p className="text-gray-400">Select a PRC20 token to view information</p>
                  </div>
                ) : (
                  <>
                    {/* Import TokenMarketingInfo dynamically */}
                    {(() => {
                      const TokenMarketingInfo = require('@/components/TokenMarketingInfo').default;
                      const lcdUrl = selectedChain.api && selectedChain.api.length > 0 
                        ? selectedChain.api[0].address 
                        : 'https://mainnet-lcd.paxinet.io';
                      return (
                        <TokenMarketingInfo
                          lcdUrl={lcdUrl}
                          contractAddress={fromToken.address}
                          tokenSymbol={fromToken.symbol}
                        />
                      );
                    })()}
                  </>
                )}
              </>
            )}
          </div>
        </main>
        <Footer />
      </div>

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
                    <h3 className="text-2xl font-bold text-white">
                      {activeTab === 'liquidity' ? 'Liquidity Transaction Successful!' : 'Swap Successful!'}
                    </h3>
                    <p className="text-gray-400">
                      {activeTab === 'liquidity' 
                        ? 'Your liquidity transaction has been broadcast to the network' 
                        : 'Your swap has been broadcast to the network'}
                    </p>
                    <div className="flex items-center justify-center gap-2 text-sm text-blue-400 mt-2">
                      <RefreshCw className="w-3 h-3 animate-spin" />
                      <span>Refreshing balances...</span>
                    </div>
                  </div>
                  
                  {/* Transaction Hash */}
                  {txResult.txHash && (
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
                  )}
                  
                  {/* Action Buttons */}
                  <div className="flex gap-3 w-full pt-2">
                    <button
                      onClick={() => {
                        const chainPath = selectedChain?.chain_name.toLowerCase().replace(/\s+/g, '-') || '';
                        window.open(`/${chainPath}/transactions/${txResult.txHash}`, '_blank');
                      }}
                      className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-medium rounded-lg transition-all hover:scale-105 active:scale-95 shadow-lg shadow-blue-500/30"
                    >
                      View Transaction
                    </button>
                    <button
                      onClick={() => setTxResult(null)}
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
                      {activeTab === 'liquidity' ? 'Liquidity Transaction Failed' : 'Swap Failed'}
                    </h3>
                    <p className="text-gray-400 text-sm">{txResult.error || 'Transaction failed. Please try again.'}</p>
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

      {/* Token Selector Modal - From Token */}
      {showFromTokenModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[60] px-4">
          <div className="bg-[#1a1a1a] border border-gray-800 rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-white">Select Token</h3>
              <button
                onClick={() => {
                  setShowFromTokenModal(false);
                  setTokenSearchQuery('');
                }}
                className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Search Input */}
            <div className="mb-4">
              <input
                type="text"
                value={tokenSearchQuery}
                onChange={(e) => setTokenSearchQuery(e.target.value)}
                placeholder="Search by name, symbol, or contract address..."
                className="w-full px-4 py-3 bg-[#0f0f0f] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
            </div>

            {/* Token List - All tokens (PAXI and PRC20) for FROM selector */}
            <div className="max-h-96 overflow-y-auto space-y-2">
              {tokens
                .filter(token => {
                  if (!tokenSearchQuery) return true;
                  const query = tokenSearchQuery.toLowerCase();
                  return (
                    token.name.toLowerCase().includes(query) ||
                    token.symbol.toLowerCase().includes(query) ||
                    token.address.toLowerCase().includes(query)
                  );
                }).length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  No tokens found
                </div>
              ) : (
                tokens
                  .filter(token => {
                    if (!tokenSearchQuery) return true;
                    const query = tokenSearchQuery.toLowerCase();
                    return (
                      token.name.toLowerCase().includes(query) ||
                      token.symbol.toLowerCase().includes(query) ||
                      token.address.toLowerCase().includes(query)
                    );
                  })
                  .map((token) => (
                  <button
                    key={token.address}
                    onClick={() => {
                      setFromToken(token);
                      // If FROM is PRC20, TO = PAXI. If FROM is PAXI, clear TO for user to select
                      if (token.address !== 'upaxi') {
                        const paxiToken = tokens.find(t => t.address === 'upaxi');
                        if (paxiToken) setToToken(paxiToken);
                      } else {
                        setToToken(null);
                      }
                      setShowFromTokenModal(false);
                      setTokenSearchQuery('');
                    }}
                    className="w-full flex items-center gap-3 p-3 bg-[#0f0f0f] hover:bg-gray-800 border border-gray-700 hover:border-blue-500 rounded-lg transition-all"
                  >
                    {token.logo ? (
                      <img 
                        src={token.logo} 
                        alt={token.symbol} 
                        className="w-8 h-8 rounded-full" 
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                          const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                          if (fallback) fallback.style.display = 'flex';
                        }}
                      />
                    ) : null}
                    <div 
                      className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-sm"
                      style={{ display: token.logo ? 'none' : 'flex' }}
                    >
                      {token.symbol.substring(0, 2)}
                    </div>
                    <div className="flex-1 text-left">
                      <div className="text-white font-semibold">{token.symbol}</div>
                      <div className="text-gray-400 text-xs">{token.name}</div>
                    </div>
                    {walletAddress && token.balance && (
                      <div className="text-right">
                        <div className="text-white text-sm">{formatBalance(token.balance, token.decimals)}</div>
                      </div>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Token Selector Modal - To Token */}
      {showToTokenModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[60] px-4">
          <div className="bg-[#1a1a1a] border border-gray-800 rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-white">Select Token</h3>
              <button
                onClick={() => {
                  setShowToTokenModal(false);
                  setTokenSearchQuery('');
                }}
                className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Search Input */}
            <div className="mb-4">
              <input
                type="text"
                value={tokenSearchQuery}
                onChange={(e) => setTokenSearchQuery(e.target.value)}
                placeholder="Search PRC20 tokens..."
                className="w-full px-4 py-3 bg-[#0f0f0f] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
            </div>

            {/* Token List - Only PRC20 for TO selector (when FROM is PAXI) */}
            <div className="max-h-96 overflow-y-auto space-y-2">
              {tokens
                .filter(token => token.address !== 'upaxi') // Only PRC20, exclude PAXI
                .filter(token => {
                  if (!tokenSearchQuery) return true;
                  const query = tokenSearchQuery.toLowerCase();
                  return (
                    token.name.toLowerCase().includes(query) ||
                    token.symbol.toLowerCase().includes(query) ||
                    token.address.toLowerCase().includes(query)
                  );
                }).length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  No tokens found
                </div>
              ) : (
                tokens
                  .filter(token => token.address !== 'upaxi') // Only PRC20, exclude PAXI
                  .filter(token => {
                    if (!tokenSearchQuery) return true;
                    const query = tokenSearchQuery.toLowerCase();
                    return (
                      token.name.toLowerCase().includes(query) ||
                      token.symbol.toLowerCase().includes(query) ||
                      token.address.toLowerCase().includes(query)
                    );
                  })
                  .map((token) => (
                  <button
                    key={token.address}
                    onClick={() => {
                      setToToken(token);
                      // TO token is always PAXI, no need to change FROM
                      setShowToTokenModal(false);
                      setTokenSearchQuery('');
                    }}
                    className="w-full flex items-center gap-3 p-3 bg-[#0f0f0f] hover:bg-gray-800 border border-gray-700 hover:border-blue-500 rounded-lg transition-all"
                  >
                    {token.logo ? (
                      <img 
                        src={token.logo} 
                        alt={token.symbol} 
                        className="w-8 h-8 rounded-full" 
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                          const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                          if (fallback) fallback.style.display = 'flex';
                        }}
                      />
                    ) : null}
                    <div 
                      className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-sm"
                      style={{ display: token.logo ? 'none' : 'flex' }}
                    >
                      {token.symbol.substring(0, 2)}
                    </div>
                    <div className="flex-1 text-left">
                      <div className="text-white font-semibold">{token.symbol}</div>
                      <div className="text-gray-400 text-xs">{token.name}</div>
                    </div>
                    {walletAddress && token.balance && (
                      <div className="text-right">
                        <div className="text-white text-sm">{formatBalance(token.balance, token.decimals)}</div>
                      </div>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
