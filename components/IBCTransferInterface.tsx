'use client';

import React, { useState, useEffect } from 'react';
import { ArrowRightLeft, ArrowDown, Wallet, AlertCircle, CheckCircle, Loader2, Info } from 'lucide-react';
import { ChainData } from '@/types/chain';
import { executeReverseTransferWithPreSwap } from '@/lib/ibcPreSwap';

interface IBCTransferInterfaceProps {
  sourceChain: ChainData;
}

export default function IBCTransferInterface({ 
  sourceChain
}: IBCTransferInterfaceProps) {
  const [selectedDestChain, setSelectedDestChain] = useState<string>('');
  const [connectedChains, setConnectedChains] = useState<Array<{
    chainId: string;
    chainName: string;
    logo: string | null;
  }>>([]);
  const [loadingChains, setLoadingChains] = useState(true);
  const [amount, setAmount] = useState('');
  const [sliderValue, setSliderValue] = useState(0);
  const [receiverAddress, setReceiverAddress] = useState('');
  const [walletConnected, setWalletConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState('');
  const [balance, setBalance] = useState('0');
  const [isProcessing, setIsProcessing] = useState(false);
  const [txStatus, setTxStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [txMessage, setTxMessage] = useState('');
  const [isReversed, setIsReversed] = useState(false);
  const [enableAutoSwap, setEnableAutoSwap] = useState(false);
  const [swapToToken, setSwapToToken] = useState('OSMO');
  const [swapRoute, setSwapRoute] = useState<any>(null);
  
  // Pre-swap state (for reverse mode)
  const [enablePreSwap, setEnablePreSwap] = useState(false);
  const [preSwapToToken, setPreSwapToToken] = useState('LUME');
  const [preSwapRoute, setPreSwapRoute] = useState<any>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedSourceToken, setSelectedSourceToken] = useState('OSMO');
  const [preSwapSlippage, setPreSwapSlippage] = useState(3); // Default 3%
  const [showSlippageSettings, setShowSlippageSettings] = useState(false);
  
  // Source token selection (for normal mode - transfer IBC tokens back)
  const [selectedSourceDenom, setSelectedSourceDenom] = useState<string>('native');
  const [availableSourceTokens, setAvailableSourceTokens] = useState<Array<{
    denom: string;
    symbol: string;
    balance: string;
    isNative: boolean;
    originChain?: string;
  }>>([]);

  // Load connected chains from relayers API
  useEffect(() => {
    const loadConnectedChains = async () => {
      setLoadingChains(true);
      try {
        const response = await fetch(`/api/relayers?chain=${sourceChain.chain_name}`);
        if (response.ok) {
          const data = await response.json();
          const chains = (data.relayers || []).map((r: any) => ({
            chainId: r.chainId,
            chainName: r.chainName || r.chainId,
            logo: r.logo
          }));
          setConnectedChains(chains);
          } else {
          console.error('[IBCTransfer] Failed to load relayers');
          setConnectedChains([]);
        }
      } catch (error) {
        console.error('[IBCTransfer] Error loading relayers:', error);
        setConnectedChains([]);
      } finally {
        setLoadingChains(false);
      }
    };

    loadConnectedChains();
  }, [sourceChain.chain_name]);

  // Check if destination is Osmosis to show auto-swap option
  const isDestinationOsmosis = selectedDestChain && 
    (selectedDestChain.toLowerCase().includes('osmosis') || 
     connectedChains.find(c => c.chainId === selectedDestChain)?.chainName.toLowerCase().includes('osmosis'));
  
  // Check if source is Osmosis (for reverse mode)
  const isSourceOsmosis = isReversed && selectedDestChain &&
    (selectedDestChain.toLowerCase().includes('osmosis') ||
     connectedChains.find(c => c.chainId === selectedDestChain)?.chainName.toLowerCase().includes('osmosis'));

  // Hardcoded popular tokens untuk auto-swap (no need to query pools)
  const availableTokens = [
    { denom: 'uosmo', symbol: 'OSMO', liquidity: 'High' },
    { denom: 'ibc/27394FB092D2ECCD56123C74F36E4C1F926001CEADA9CA97EA622B25F41E5EB2', symbol: 'ATOM', liquidity: 'High' },
    { denom: 'ibc/D189335C6E4A68B513C10AB227BF1C1D38C746766278BA3EEB4FB14124F1D858', symbol: 'USDC', liquidity: 'High' },
  ];

  // Load swap route when token is selected
  useEffect(() => {
    const loadSwapRoute = async () => {
      if (!enableAutoSwap || !isDestinationOsmosis || isReversed) {
        setSwapRoute(null);
        return;
      }

      try {
        // Get IBC denom for source token on Osmosis
        const ibcDenomResponse = await fetch(
          `/api/osmosis/ibc-denom?sourceChain=${sourceChain.chain_name}&baseDenom=${sourceChain.assets[0].base}`
        );
        
        if (!ibcDenomResponse.ok) {
          setSwapRoute(null);
          return;
        }

        const ibcDenomData = await ibcDenomResponse.json();
        const sourceIbcDenom = ibcDenomData.ibcDenom;
        // Find target token denom
        const targetToken = availableTokens.find(t => t.symbol === swapToToken);
        if (!targetToken) {
          setSwapRoute(null);
          return;
        }
        
        // Get swap route
        const routeResponse = await fetch(
          `/api/osmosis/pools?action=route&tokenIn=${encodeURIComponent(sourceIbcDenom)}&tokenOut=${encodeURIComponent(targetToken.denom)}`
        );

        if (routeResponse.ok) {
          const routeData = await routeResponse.json();
          setSwapRoute(routeData.route);
        } else {
          const errorData = await routeResponse.json();
          setSwapRoute(null);
        }
      } catch (error) {
        console.error('[IBCTransfer] Failed to load swap route:', error);
        setSwapRoute(null);
      }
    };

    loadSwapRoute();
  }, [enableAutoSwap, swapToToken, isDestinationOsmosis, isReversed, sourceChain, availableTokens]);

  // Load pre-swap route when user enables pre-swap in reverse mode
  useEffect(() => {
    const loadPreSwapRoute = async () => {
      if (!enablePreSwap || !isReversed || !isSourceOsmosis) {
        setPreSwapRoute(null);
        return;
      }

      try {
        // Determine source token denom on Osmosis
        let sourceTokenDenom: string;
        if (selectedSourceToken === 'OSMO') {
          sourceTokenDenom = 'uosmo';
        } else if (selectedSourceToken === 'ATOM') {
          sourceTokenDenom = 'ibc/27394FB092D2ECCD56123C74F36E4C1F926001CEADA9CA97EA622B25F41E5EB2';
        } else if (selectedSourceToken === 'USDC') {
          sourceTokenDenom = 'ibc/D189335C6E4A68B513C10AB227BF1C1D38C746766278BA3EEB4FB14124F1D858';
        } else {
          sourceTokenDenom = 'uosmo'; // Default
        }
        
        // Get LUME IBC denom on Osmosis
        const ibcDenomResponse = await fetch(
          `/api/osmosis/ibc-denom?sourceChain=lumera-mainnet&baseDenom=ulume`
        );
        
        if (!ibcDenomResponse.ok) {
          setPreSwapRoute(null);
          return;
        }
        
        const ibcDenomData = await ibcDenomResponse.json();
        const lumeIbcDenom = ibcDenomData.ibcDenom;
        
        // Get swap route
        const routeResponse = await fetch(
          `/api/osmosis/pools?action=route&tokenIn=${encodeURIComponent(sourceTokenDenom)}&tokenOut=${encodeURIComponent(lumeIbcDenom)}`
        );
        
        if (routeResponse.ok) {
          const routeData = await routeResponse.json();
          setPreSwapRoute(routeData.route);
        } else {
          const errorData = await routeResponse.json();
          setPreSwapRoute(null);
        }
      } catch (error) {
        console.error('[Pre-Swap] Failed to load route:', error);
        setPreSwapRoute(null);
      }
    };
    
    loadPreSwapRoute();
  }, [enablePreSwap, isReversed, isSourceOsmosis, selectedSourceToken, preSwapToToken]);

  // Check wallet connection and fetch balance
  useEffect(() => {
    const checkWallet = async () => {
      if (typeof window !== 'undefined' && (window as any).keplr) {
        try {
          // Determine which chain to fetch balance from based on mode
          let chainId: string;
          let denom: string;
          let rpc: string;
          
          if (isReversed && selectedDestChain) {
            // REVERSE MODE: Fetch balance from destination chain (which becomes the source)
            const destChain = connectedChains.find(c => c.chainId === selectedDestChain);
            if (!destChain) return;
            
            // Map common chain names to chain IDs
            const chainIdMap: Record<string, string> = {
              'osmosis': 'osmosis-1',
              'osmosis-mainnet': 'osmosis-1',
              'cosmoshub': 'cosmoshub-4',
              'cosmoshub-mainnet': 'cosmoshub-4',
              'noble': 'noble-1',
              'noble-mainnet': 'noble-1',
            };
            
            const normalizedName = destChain.chainName.toLowerCase().replace(/\s+/g, '-');
            chainId = chainIdMap[normalizedName] || destChain.chainId;
            
            // Map common RPCs
            const commonRpcs: Record<string, string> = {
              'osmosis-1': 'https://rpc.osmosis.zone',
              'cosmoshub-4': 'https://rpc.cosmos.network',
              'noble-1': 'https://rpc.noble.strange.love',
            };
            
            rpc = commonRpcs[chainId] || '';
            if (!rpc) {
              return;
            }
            
            // Determine denom based on selected source token
            if (selectedSourceToken === 'OSMO') {
              denom = 'uosmo';
            } else if (selectedSourceToken === 'ATOM') {
              denom = 'ibc/27394FB092D2ECCD56123C74F36E4C1F926001CEADA9CA97EA622B25F41E5EB2';
            } else if (selectedSourceToken === 'USDC') {
              denom = 'ibc/D189335C6E4A68B513C10AB227BF1C1D38C746766278BA3EEB4FB14124F1D858';
            } else {
              denom = 'uosmo'; // Default
            }
          } else {
            // NORMAL MODE: Fetch from source chain (Lumera)
            chainId = sourceChain.chain_id || sourceChain.chain_name;
            denom = sourceChain.assets[0].base;
            const rpcEndpoint = sourceChain.rpc[0]?.address || sourceChain.rpc[0];
            rpc = typeof rpcEndpoint === 'string' ? rpcEndpoint : rpcEndpoint.address;
          }

          await (window as any).keplr.enable(chainId);
          const offlineSigner = await (window as any).keplr.getOfflineSigner(chainId);
          const accounts = await offlineSigner.getAccounts();
          
          if (accounts.length > 0) {
            setWalletConnected(true);
            setWalletAddress(accounts[0].address);
            
            // Fetch balance
            try {
              const { SigningStargateClient } = await import('@cosmjs/stargate');
              
              const client = await SigningStargateClient.connectWithSigner(rpc, offlineSigner);
              const bal = await client.getBalance(accounts[0].address, denom);
              
              // Use 6 decimals for all Cosmos tokens (standard)
              const exponent = 6;
              const formatted = (parseInt(bal.amount) / Math.pow(10, exponent)).toFixed(6);
              
              setBalance(formatted);
            } catch (error) {
              console.error('[Balance] Fetch error:', error);
              setBalance('0');
            }
          }
        } catch (error) {
          console.error('Wallet check error:', error);
        }
      }
    };
    
    checkWallet();
  }, [sourceChain, isReversed, selectedDestChain, connectedChains, selectedSourceToken]); // Re-fetch when mode or token changes

  // Auto-fill destination address
  useEffect(() => {
    const fetchDestinationAddress = async () => {
      if (!selectedDestChain || !walletConnected) return;

      try {
        const chainIdMap: Record<string, string> = {
          'osmosis': 'osmosis-1',
          'osmosis-mainnet': 'osmosis-1',
          'cosmoshub': 'cosmoshub-4',
          'cosmoshub-mainnet': 'cosmoshub-4',
          'noble': 'noble-1',
          'noble-mainnet': 'noble-1',
        };

        let targetChainId: string;
        
        if (isReversed) {
          targetChainId = sourceChain.chain_id || sourceChain.chain_name;
        } else {
          const destChain = connectedChains.find(c => c.chainId === selectedDestChain);
          if (!destChain) return;
          const normalizedName = destChain.chainName.toLowerCase().replace(/\s+/g, '-');
          targetChainId = chainIdMap[normalizedName] || destChain.chainId;
        }

        if (typeof window !== 'undefined' && (window as any).keplr) {
          try {
            await (window as any).keplr.enable(targetChainId);
            const offlineSigner = await (window as any).keplr.getOfflineSigner(targetChainId);
            const accounts = await offlineSigner.getAccounts();
            if (accounts.length > 0) {
              setReceiverAddress(accounts[0].address);
            }
          } catch (error) {
            setReceiverAddress(walletAddress);
          }
        }
      } catch (error) {
        console.error('Error fetching destination address:', error);
      }
    };

    fetchDestinationAddress();
  }, [selectedDestChain, walletConnected, connectedChains, walletAddress, isReversed, sourceChain]);

  const connectWallet = async () => {
    if (typeof window !== 'undefined' && (window as any).keplr) {
      try {
        const chainId = sourceChain.chain_id || sourceChain.chain_name;
        await (window as any).keplr.enable(chainId);
        window.location.reload();
      } catch (error) {
        console.error('Failed to connect wallet:', error);
      }
    } else {
      alert('Please install Keplr wallet extension');
    }
  };

  const executeOsmosisSwap = async (walletAddress: string, ibcAmount: string, targetToken: string) => {
    try {
      // Connect to Osmosis
      await (window as any).keplr.enable('osmosis-1');
      const offlineSigner = await (window as any).keplr.getOfflineSigner('osmosis-1');
      const accounts = await offlineSigner.getAccounts();
      const osmoAddress = accounts[0].address;
      
      const { SigningStargateClient, defaultRegistryTypes } = await import('@cosmjs/stargate');
      const { Registry } = await import('@cosmjs/proto-signing');
      
      const registry = new Registry(defaultRegistryTypes);

      const client = await SigningStargateClient.connectWithSigner(
        'https://rpc.osmosis.zone',
        offlineSigner,
        { registry }
      );

      // Get IBC denom for source token on Osmosis
      const ibcDenomResponse = await fetch(
        `/api/osmosis/ibc-denom?sourceChain=${sourceChain.chain_name}&baseDenom=${sourceChain.assets[0].base}`
      );
      
      if (!ibcDenomResponse.ok) {
        throw new Error('Could not determine IBC denom on Osmosis');
      }

      const ibcDenomData = await ibcDenomResponse.json();
      const sourceIbcDenom = ibcDenomData.ibcDenom;
      
      // Find target token denom
      const targetTokenInfo = availableTokens.find(t => t.symbol === targetToken);
      if (!targetTokenInfo) {
        throw new Error(`Target token ${targetToken} not found`);
      }

      const targetDenom = targetTokenInfo.denom;
      // Get swap route
      if (!swapRoute) {
        throw new Error('Swap route not available');
      }

      // Parse pool IDs (support multi-hop)
      const poolIds = swapRoute.poolId.split(',');
      
      // Create swap message
      const swapMsg = {
        typeUrl: '/osmosis.gamm.v1beta1.MsgSwapExactAmountIn',
        value: {
          sender: osmoAddress,
          routes: poolIds.map((poolId: string, index: number) => ({
            poolId: poolId,
            tokenOutDenom: index === poolIds.length - 1 ? targetDenom : 'uosmo', // Multi-hop via OSMO
          })),
          tokenIn: {
            denom: sourceIbcDenom,
            amount: ibcAmount,
          },
          tokenOutMinAmount: '1', // Minimum output (should calculate based on slippage)
        },
      };

      const fee = {
        amount: [{ denom: 'uosmo', amount: '5000' }],
        gas: '500000',
      };

      // Use signAndBroadcast with the message
      const result = await client.signAndBroadcast(osmoAddress, [swapMsg], fee);

      if (result.code !== 0) {
        throw new Error(result.rawLog || 'Swap failed');
      }

      return result;
    } catch (error) {
      console.error('[IBCTransfer] Osmosis swap error:', error);
      throw error;
    }
  };

  const handleTransfer = async () => {
    if (!walletConnected || !selectedDestChain || !amount || !receiverAddress) {
      alert('Please fill all fields');
      return;
    }

    setIsProcessing(true);
    setTxStatus('idle');
    setTxMessage('');
    setCurrentStep(0);

    try {
      // Check if this is a reverse transfer with pre-swap
      if (isReversed && enablePreSwap && isSourceOsmosis) {
        // Determine source token denom
        let sourceTokenDenom: string;
        if (selectedSourceToken === 'OSMO') {
          sourceTokenDenom = 'uosmo';
        } else if (selectedSourceToken === 'ATOM') {
          sourceTokenDenom = 'ibc/27394FB092D2ECCD56123C74F36E4C1F926001CEADA9CA97EA622B25F41E5EB2';
        } else if (selectedSourceToken === 'USDC') {
          sourceTokenDenom = 'ibc/D189335C6E4A68B513C10AB227BF1C1D38C746766278BA3EEB4FB14124F1D858';
        } else {
          sourceTokenDenom = 'uosmo';
        }
        
        // Get LUME IBC denom on Osmosis
        const ibcDenomResponse = await fetch(
          `/api/osmosis/ibc-denom?sourceChain=lumera-mainnet&baseDenom=ulume`
        );
        
        if (!ibcDenomResponse.ok) {
          throw new Error('Could not determine LUME IBC denom on Osmosis');
        }
        
        const ibcDenomData = await ibcDenomResponse.json();
        const lumeIbcDenom = ibcDenomData.ibcDenom;
        
        // Calculate amount in micro units
        const tokenExponent = 6; // Assuming 6 decimals for most tokens
        const amountInMicro = Math.floor(parseFloat(amount) * Math.pow(10, tokenExponent)).toString();
        
        // Execute pre-swap + IBC transfer
        const result = await executeReverseTransferWithPreSwap(
          sourceTokenDenom,
          lumeIbcDenom,
          amountInMicro,
          receiverAddress,
          preSwapSlippage, // Use user-configured slippage
          (step, message) => {
            setCurrentStep(step);
            setTxMessage(message);
          }
        );
        
        if (!result.success) {
          throw new Error(result.error || 'Reverse transfer with pre-swap failed');
        }
        
        setTxStatus('success');
        setTxMessage(
          `Transfer successful! ` +
          `Swap TX: ${result.swapTx?.slice(0, 8)}... | ` +
          `Transfer TX: ${result.transferTx.slice(0, 8)}...`
        );
        setAmount('');
        
        // Show success popup
        if (typeof window !== 'undefined') {
          const overlay = document.createElement('div');
          overlay.style.cssText = 'position: fixed; inset: 0; background: rgba(0,0,0,0.85); z-index: 9999; display: flex; align-items: center; justify-content: center;';
          
          const popup = document.createElement('div');
          popup.style.cssText = 'background: #1a1a1a; border: 2px solid #22c55e; border-radius: 16px; padding: 32px; max-width: 400px; text-align: center; box-shadow: 0 20px 60px rgba(34, 197, 94, 0.3);';
          
          popup.innerHTML = `
            <div style="width: 64px; height: 64px; background: #22c55e; border-radius: 50%; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center;">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </div>
            <h3 style="color: white; font-size: 24px; font-weight: bold; margin-bottom: 12px;">Swap & Transfer Complete!</h3>
            <p style="color: #9ca3af; font-size: 14px; margin-bottom: 20px;">Your tokens have been swapped and transferred successfully</p>
            <div style="background: #111; border: 1px solid #374151; border-radius: 8px; padding: 12px; margin-bottom: 12px;">
              <p style="color: #6b7280; font-size: 12px; margin-bottom: 4px;">Swap TX</p>
              <p style="color: #22c55e; font-size: 13px; font-family: monospace; word-break: break-all;">${result.swapTx}</p>
            </div>
            <div style="background: #111; border: 1px solid #374151; border-radius: 8px; padding: 12px; margin-bottom: 12px;">
              <p style="color: #6b7280; font-size: 12px; margin-bottom: 4px;">Transfer TX</p>
              <p style="color: #22c55e; font-size: 13px; font-family: monospace; word-break: break-all;">${result.transferTx}</p>
            </div>
            <p style="color: #9ca3af; font-size: 12px; margin-bottom: 12px;">Tokens will arrive on Lumera in 1-3 minutes</p>
            <p style="color: #6b7280; font-size: 11px; margin-bottom: 20px;">Powered by WinScan</p>
            <button onclick="this.closest('[style*=\\'position: fixed\\']').remove()" style="background: white; color: black; border: none; padding: 12px 32px; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 14px; width: 100%;">
              OK
            </button>
          `;
          
          overlay.appendChild(popup);
          document.body.appendChild(overlay);
          
          setTimeout(() => {
            if (document.body.contains(overlay)) {
              overlay.remove();
            }
          }, 15000);
        }
        
        setIsProcessing(false);
        return;
      }
      
      // Continue with normal transfer logic...
      const destChain = connectedChains.find(c => c.chainId === selectedDestChain);
      if (!destChain) throw new Error('Destination chain not found');

      // Determine actual source and destination based on direction
      let actualSourceChainId: string;
      let actualDestChainName: string;
      let actualSourceDenom: string;
      let actualSourceRpc: any;

      const chainIdMap: Record<string, string> = {
        'osmosis': 'osmosis-1',
        'osmosis-mainnet': 'osmosis-1',
        'cosmoshub': 'cosmoshub-4',
        'cosmoshub-mainnet': 'cosmoshub-4',
        'noble': 'noble-1',
        'noble-mainnet': 'noble-1',
      };

      if (isReversed) {
        // Reversed: transfer FROM selected chain TO source chain
        const normalizedName = destChain.chainName.toLowerCase().replace(/\s+/g, '-');
        actualSourceChainId = chainIdMap[normalizedName] || destChain.chainId;
        actualDestChainName = sourceChain.chain_name;
        
        const ibcDenoms: Record<string, Record<string, string>> = {
          'osmosis-1': {
            'lumera-mainnet': 'ibc/32C4AEE2B3C4F767A351FA821AB0140B10CB690CDED27D9FCC857859B44432B9',
            'epix-mainnet': 'ibc/EPIX_IBC_DENOM',
            'warden-mainnet': 'ibc/WARDEN_IBC_DENOM',
          },
        };
        
        const commonDenoms: Record<string, string> = {
          'osmosis-1': 'uosmo',
          'cosmoshub-4': 'uatom',
          'noble-1': 'uusdc',
        };
        
        actualSourceDenom = ibcDenoms[actualSourceChainId]?.[sourceChain.chain_name] || 
                           commonDenoms[actualSourceChainId] || 
                           'utoken';
        
        actualSourceRpc = null; // Will need to handle this
      } else {
        // Normal: transfer FROM source chain TO selected chain
        actualSourceChainId = sourceChain.chain_id || sourceChain.chain_name;
        actualDestChainName = destChain.chainName;
        actualSourceDenom = sourceChain.assets[0].base;
        actualSourceRpc = sourceChain.rpc[0];
      }

      await (window as any).keplr.enable(actualSourceChainId);
      
      const isEvmChain = actualSourceChainId.includes('_');
      const offlineSigner = isEvmChain 
        ? await (window as any).keplr.getOfflineSigner(actualSourceChainId)
        : await (window as any).keplr.getOfflineSignerAuto(actualSourceChainId);
      
      const accounts = await offlineSigner.getAccounts();
      const senderAddress = accounts[0].address;

      // Fetch IBC channel
      const channelSourceName = isReversed ? destChain.chainName : sourceChain.chain_name;
      const channelDestName = isReversed ? sourceChain.chain_name : destChain.chainName;
      
      const response = await fetch(`/api/ibc/channels?sourceChain=${channelSourceName}&destChain=${channelDestName}`);
      const channelData = await response.json();
      
      if (!channelData.channel) {
        throw new Error('No IBC channel found');
      }

      const { SigningStargateClient, defaultRegistryTypes } = await import('@cosmjs/stargate');
      const { Registry } = await import('@cosmjs/proto-signing');
      
      const clientOptions: any = { registry: new Registry(defaultRegistryTypes) };
      
      let rpcEndpoint: string;
      if (isReversed) {
        const commonRpcs: Record<string, string> = {
          'osmosis-1': 'https://rpc.osmosis.zone',
          'cosmoshub-4': 'https://rpc.cosmos.network',
          'noble-1': 'https://rpc.noble.strange.love',
        };
        rpcEndpoint = commonRpcs[actualSourceChainId] || '';
        if (!rpcEndpoint) {
          throw new Error('RPC endpoint not available for reversed transfer. Please use normal direction.');
        }
      } else {
        rpcEndpoint = typeof actualSourceRpc === 'string' 
          ? actualSourceRpc 
          : actualSourceRpc.address;
      }

      const client = await SigningStargateClient.connectWithSigner(
        rpcEndpoint,
        offlineSigner,
        clientOptions
      );

      const tokenExponent = isReversed 
        ? 6 
        : parseInt(String(sourceChain.assets[0]?.exponent || '6'));

      let feeAmount: string;
      if (tokenExponent >= 18) {
        feeAmount = '100000000000000';
      } else if (tokenExponent >= 12) {
        feeAmount = '500000000000';
      } else {
        feeAmount = '10000';
      }

      const amountFloat = parseFloat(amount);
      let transferAmount: string;
      
      if (tokenExponent >= 18) {
        const [intPart, decPart = ''] = amount.split('.');
        const paddedDec = decPart.padEnd(tokenExponent, '0').slice(0, tokenExponent);
        transferAmount = intPart + paddedDec;
        transferAmount = transferAmount.replace(/^0+/, '') || '0';
      } else {
        transferAmount = Math.floor(amountFloat * Math.pow(10, tokenExponent)).toString();
      }

      const result = await client.sendIbcTokens(
        senderAddress,
        receiverAddress,
        {
          denom: actualSourceDenom,
          amount: transferAmount,
        },
        'transfer',
        channelData.channel,
        undefined,
        Math.floor(Date.now() / 1000) * 1e9 + 600 * 1e9,
        {
          amount: [{ denom: actualSourceDenom, amount: feeAmount }],
          gas: '500000',
        },
        'WinScan IBC Transfer'
      );

      if (result.code !== 0) {
        throw new Error(result.rawLog || 'Transaction failed');
      }

      setTxStatus('success');
      setTxMessage(`Transfer successful! Tx: ${result.transactionHash}`);
      setAmount('');
      
      // Execute auto-swap if enabled and destination is Osmosis
      if (enableAutoSwap && isDestinationOsmosis && !isReversed) {
        try {
          setTxMessage(`Transfer successful! Tx: ${result.transactionHash}. Waiting for IBC relay to complete...`);
          
          // Wait for IBC transfer to complete (typically 1-3 minutes)
          await new Promise(resolve => setTimeout(resolve, 180000)); // 3 minutes
          
          setTxMessage(`IBC transfer complete. Executing auto-swap to ${swapToToken}...`);
          
          // Execute swap on Osmosis
          await executeOsmosisSwap(receiverAddress, transferAmount, swapToToken);
          
          setTxMessage(`Auto-swap successful! Your ${swapToToken} tokens are now in your wallet.`);
        } catch (swapError: any) {
          console.error('Auto-swap error:', swapError);
          setTxMessage(`Transfer successful (Tx: ${result.transactionHash}), but auto-swap failed: ${swapError.message}. Your IBC tokens are safe in your wallet.`);
        }
      }
      
      // Show success popup
      if (typeof window !== 'undefined') {
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position: fixed; inset: 0; background: rgba(0,0,0,0.85); z-index: 9999; display: flex; align-items: center; justify-content: center;';
        
        const popup = document.createElement('div');
        popup.style.cssText = 'background: #1a1a1a; border: 2px solid #22c55e; border-radius: 16px; padding: 32px; max-width: 400px; text-align: center; box-shadow: 0 20px 60px rgba(34, 197, 94, 0.3);';
        
        const autoSwapSection = enableAutoSwap && isDestinationOsmosis && !isReversed ? `
          <div style="background: #7c3aed20; border: 1px solid #7c3aed40; border-radius: 8px; padding: 12px; margin-bottom: 12px;">
            <p style="color: #a78bfa; font-size: 12px; margin-bottom: 4px;">🔄 Auto-Swap Enabled</p>
            <p style="color: #c4b5fd; font-size: 11px;">Will swap to ${swapToToken} after IBC completes (~3 min)</p>
          </div>
        ` : '';
        
        popup.innerHTML = `
          <div style="width: 64px; height: 64px; background: #22c55e; border-radius: 50%; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center;">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </div>
          <h3 style="color: white; font-size: 24px; font-weight: bold; margin-bottom: 12px;">Transfer ${enableAutoSwap && isDestinationOsmosis && !isReversed ? '& Swap ' : ''}Initiated!</h3>
          <p style="color: #9ca3af; font-size: 14px; margin-bottom: 20px;">Your IBC transaction has been successfully sent</p>
          <div style="background: #111; border: 1px solid #374151; border-radius: 8px; padding: 12px; margin-bottom: 12px;">
            <p style="color: #6b7280; font-size: 12px; margin-bottom: 4px;">Transaction Hash</p>
            <p style="color: #22c55e; font-size: 13px; font-family: monospace; word-break: break-all;">${result.transactionHash}</p>
          </div>
          ${autoSwapSection}
          <p style="color: #9ca3af; font-size: 12px; margin-bottom: 12px;">Transfer will complete in 1-3 minutes</p>
          <p style="color: #6b7280; font-size: 11px; margin-bottom: 20px;">Powered by WinScan</p>
          <button onclick="this.closest('[style*=\\'position: fixed\\']').remove()" style="background: white; color: black; border: none; padding: 12px 32px; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 14px; width: 100%;">
            OK
          </button>
        `;
        
        overlay.appendChild(popup);
        document.body.appendChild(overlay);
        
        setTimeout(() => {
          if (document.body.contains(overlay)) {
            overlay.remove();
          }
        }, 10000);
      }
      
    } catch (error: any) {
      console.error('Transfer error:', error);
      setTxStatus('error');
      setTxMessage(error.message || 'Transfer failed');
    } finally {
      setIsProcessing(false);
    }
  };

  const setMaxAmount = () => {
    const maxAmount = Math.max(0, parseFloat(balance) - 0.01);
    setAmount(maxAmount.toFixed(6));
    setSliderValue(100);
  };

  const handleSliderChange = (value: number) => {
    setSliderValue(value);
    const maxAmount = Math.max(0, parseFloat(balance) - 0.01);
    const calculatedAmount = (maxAmount * value) / 100;
    setAmount(calculatedAmount.toFixed(6));
  };

  const handleAmountChange = (value: string) => {
    setAmount(value);
    const maxAmount = Math.max(0, parseFloat(balance) - 0.01);
    const percentage = maxAmount > 0 ? (parseFloat(value) / maxAmount) * 100 : 0;
    setSliderValue(Math.min(100, Math.max(0, percentage)));
  };

  const handleSwapDirection = () => {
    const newReversed = !isReversed;
    setIsReversed(newReversed);
    setAmount('');
    setSliderValue(0);
    setReceiverAddress('');
    setBalance('0');
  };

  const selectedChainInfo = connectedChains.find(c => c.chainId === selectedDestChain);

  return (
    <div className="max-w-lg mx-auto bg-[#1a1a1a] border border-gray-800 rounded-xl shadow-lg p-6">
      <div className="text-center mb-6">
        <div className="flex justify-center mb-4">
          <div className="p-3 bg-blue-500/20 border border-blue-500/30 rounded-xl">
            <ArrowRightLeft className="w-8 h-8 text-blue-400" />
          </div>
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">
          IBC Transfer
        </h2>
        <p className="text-gray-400 text-sm">
          Transfer tokens between Cosmos chains
        </p>
      </div>

      {walletConnected ? (
        <>
          {/* Wallet Info */}
          <div className="bg-[#111111] border border-gray-800 rounded-lg p-4 mb-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span className="text-gray-400 text-sm">Connected</span>
              </div>
              <span className="text-white text-sm font-mono">
                {walletAddress.slice(0, 8)}...{walletAddress.slice(-6)}
              </span>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-gray-800">
              <span className="text-gray-500 text-sm">Balance</span>
              <span className="text-white font-medium">
                {balance} {isReversed && isSourceOsmosis 
                  ? selectedSourceToken
                  : (sourceChain.assets[0]?.symbol || 'TOKEN')}
              </span>
            </div>
          </div>

          {/* From Chain */}
          <div className="bg-[#111111] border border-gray-800 rounded-lg p-4 mb-2">
            <label className="text-gray-400 text-sm mb-2 block">From</label>
            {!isReversed ? (
              <div className="flex items-center gap-3">
                <img 
                  src={sourceChain.logo} 
                  alt={sourceChain.chain_name}
                  className="w-8 h-8 rounded-full"
                />
                <div className="text-white font-medium">{sourceChain.chain_name}</div>
              </div>
            ) : selectedChainInfo ? (
              <div className="flex items-center gap-3">
                {selectedChainInfo.logo ? (
                  <img 
                    src={selectedChainInfo.logo} 
                    alt={selectedChainInfo.chainName}
                    className="w-8 h-8 rounded-full"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500" />
                )}
                <div className="text-white font-medium">{selectedChainInfo.chainName}</div>
              </div>
            ) : (
              <div className="text-gray-500">Select destination first</div>
            )}
          </div>

          {/* Swap Direction Button */}
          <div className="flex justify-center -my-1 relative z-10 mb-2">
            <button
              onClick={handleSwapDirection}
              disabled={!selectedDestChain}
              className="p-2 bg-[#1a1a1a] border-2 border-gray-800 rounded-full hover:border-blue-500 hover:bg-gray-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              title="Swap direction"
            >
              <ArrowDown className={`w-4 h-4 text-gray-400 transition-transform ${isReversed ? 'rotate-180' : ''}`} />
            </button>
          </div>

          {/* To Chain */}
          <div className="bg-[#111111] border border-gray-800 rounded-lg p-4 mb-4">
            <label className="text-gray-400 text-sm mb-2 block">To</label>
            {!isReversed ? (
              <select
                value={selectedDestChain}
                onChange={(e) => setSelectedDestChain(e.target.value)}
                className="w-full bg-[#0a0a0a] border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
              >
                <option value="">Select destination</option>
                {connectedChains.map((chain) => (
                  <option key={chain.chainId} value={chain.chainId}>
                    {chain.chainName}
                  </option>
                ))}
              </select>
            ) : (
              <div className="flex items-center gap-3">
                <img 
                  src={sourceChain.logo} 
                  alt={sourceChain.chain_name}
                  className="w-8 h-8 rounded-full"
                />
                <div className="text-white font-medium">{sourceChain.chain_name}</div>
              </div>
            )}
          </div>

          {/* Auto-Swap Toggle - Only show when destination is Osmosis */}
          {!isReversed && isDestinationOsmosis && (
            <div className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/30 rounded-lg p-4 mb-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={enableAutoSwap}
                      onChange={(e) => setEnableAutoSwap(e.target.checked)}
                      className="w-4 h-4 rounded border-gray-600 text-blue-500 focus:ring-blue-500 focus:ring-offset-0 bg-gray-700"
                    />
                    <span className="ml-2 text-white font-medium">Auto-Swap on Arrival</span>
                  </label>
                  <span className="px-2 py-0.5 bg-purple-500/20 border border-purple-500/30 rounded text-purple-300 text-xs font-semibold">
                    BETA
                  </span>
                </div>
              </div>
              
              {enableAutoSwap && (
                <div className="space-y-3 pt-3 border-t border-purple-500/20">
                  <div>
                    <label className="text-gray-400 text-xs mb-1.5 block">
                      Swap to token when tokens arrive
                    </label>
                    <select
                      value={swapToToken}
                      onChange={(e) => setSwapToToken(e.target.value)}
                      className="w-full bg-[#0a0a0a] border border-purple-500/30 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500"
                    >
                      {availableTokens.map(token => (
                        <option key={token.denom} value={token.symbol}>
                          {token.symbol}
                        </option>
                      ))}
                    </select>
                  </div>
                  {swapRoute && (
                    <div className="text-xs text-purple-300 bg-purple-500/10 rounded p-2">
                      <div className="flex items-center gap-1 mb-1">
                        <CheckCircle className="w-3 h-3" />
                        <span className="font-medium">Route Found</span>
                      </div>
                      <div className="text-purple-400">
                        Pool ID: {swapRoute.poolId}
                        {swapRoute.poolId.includes(',') && ' (Multi-hop via OSMO)'}
                      </div>
                    </div>
                  )}
                  {!swapRoute && enableAutoSwap && (
                    <div className="text-xs text-yellow-300 bg-yellow-500/10 rounded p-2 border border-yellow-500/20">
                      <div className="flex items-center gap-1 mb-1">
                        <AlertCircle className="w-3 h-3" />
                        <span className="font-medium">No Route Available</span>
                      </div>
                      <div className="text-yellow-400">
                        {sourceChain.assets[0]?.symbol || 'Token'} may not have liquidity on Osmosis yet. 
                        Try selecting OSMO, ATOM, or USDC as target.
                      </div>
                    </div>
                  )}
                  <div className="text-xs text-purple-300">
                    ℹ️ Your tokens will automatically swap to {swapToToken} after arriving on Osmosis
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Pre-Swap Toggle - Only show when reversed and source is Osmosis */}
          {isReversed && isSourceOsmosis && (
            <div className="bg-gradient-to-r from-green-500/10 to-blue-500/10 border border-green-500/30 rounded-lg p-4 mb-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={enablePreSwap}
                      onChange={(e) => setEnablePreSwap(e.target.checked)}
                      className="w-4 h-4 rounded border-gray-600 text-green-500 focus:ring-green-500 focus:ring-offset-0 bg-gray-700"
                    />
                    <span className="ml-2 text-white font-medium">Auto-Swap Before Transfer</span>
                  </label>
                  <span className="px-2 py-0.5 bg-green-500/20 border border-green-500/30 rounded text-green-300 text-xs font-semibold">
                    BETA
                  </span>
                </div>
              </div>
              
              {enablePreSwap && (
                <div className="space-y-3 pt-3 border-t border-green-500/20">
                  <div>
                    <label className="text-gray-400 text-xs mb-1.5 block">
                      Select source token on Osmosis
                    </label>
                    <select
                      value={selectedSourceToken}
                      onChange={(e) => setSelectedSourceToken(e.target.value)}
                      className="w-full bg-[#0a0a0a] border border-green-500/30 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-green-500 mb-2"
                    >
                      <option value="OSMO">OSMO</option>
                      <option value="ATOM">ATOM</option>
                      <option value="USDC">USDC</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-gray-400 text-xs mb-1.5 block">
                      Swap {selectedSourceToken} to token before transfer
                    </label>
                    <select
                      value={preSwapToToken}
                      onChange={(e) => setPreSwapToToken(e.target.value)}
                      className="w-full bg-[#0a0a0a] border border-green-500/30 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-green-500"
                    >
                      <option value="LUME">LUME (native on Lumera)</option>
                    </select>
                  </div>
                  {preSwapRoute && (
                    <div className="text-xs text-green-300 bg-green-500/10 rounded p-2">
                      <div className="flex items-center gap-1 mb-1">
                        <CheckCircle className="w-3 h-3" />
                        <span className="font-medium">Route Found</span>
                      </div>
                      <div className="text-green-400">
                        Pool ID: {preSwapRoute.poolId}
                        {preSwapRoute.poolId.includes(',') && ' (Multi-hop via OSMO)'}
                      </div>
                    </div>
                  )}
                  {!preSwapRoute && enablePreSwap && (
                    <div className="text-xs text-yellow-300 bg-yellow-500/10 rounded p-2 border border-yellow-500/20">
                      <div className="flex items-center gap-1 mb-1">
                        <AlertCircle className="w-3 h-3" />
                        <span className="font-medium">No Route Available</span>
                      </div>
                      <div className="text-yellow-400">
                        No swap route found for {selectedSourceToken} → LUME. 
                        LUME may not have liquidity on Osmosis yet.
                      </div>
                    </div>
                  )}
                  <div className="text-xs text-green-300">
                    ℹ️ Your {selectedSourceToken} will be swapped to LUME on Osmosis, 
                    then transferred to Lumera as native LUME
                  </div>
                  
                  {/* Slippage Settings */}
                  <div className="pt-3 border-t border-green-500/20">
                    <button
                      onClick={() => setShowSlippageSettings(!showSlippageSettings)}
                      className="flex items-center justify-between w-full text-sm text-gray-400 hover:text-white transition-colors"
                    >
                      <span>Slippage Tolerance: {preSwapSlippage}%</span>
                      <svg 
                        className={`w-4 h-4 transition-transform ${showSlippageSettings ? 'rotate-180' : ''}`}
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    
                    {showSlippageSettings && (
                      <div className="mt-3 space-y-2">
                        <div className="flex gap-2">
                          {[0.5, 1, 3, 5].map((value) => (
                            <button
                              key={value}
                              onClick={() => setPreSwapSlippage(value)}
                              className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                                preSwapSlippage === value
                                  ? 'bg-green-500/20 border border-green-500/50 text-green-300'
                                  : 'bg-[#0a0a0a] border border-gray-700 text-gray-400 hover:border-green-500/30'
                              }`}
                            >
                              {value}%
                            </button>
                          ))}
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            value={preSwapSlippage}
                            onChange={(e) => {
                              const value = parseFloat(e.target.value);
                              if (!isNaN(value) && value >= 0 && value <= 50) {
                                setPreSwapSlippage(value);
                              }
                            }}
                            step="0.1"
                            min="0"
                            max="50"
                            className="flex-1 bg-[#0a0a0a] border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-green-500"
                            placeholder="Custom %"
                          />
                          <span className="text-gray-400 text-sm">Custom</span>
                        </div>
                        {preSwapSlippage > 5 && (
                          <div className="flex items-start gap-2 p-2 bg-yellow-500/10 border border-yellow-500/30 rounded">
                            <AlertCircle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                            <p className="text-xs text-yellow-300">
                              High slippage tolerance! You may receive significantly less tokens than expected.
                            </p>
                          </div>
                        )}
                        <p className="text-xs text-gray-400">
                          Your transaction will revert if the price changes unfavorably by more than this percentage.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Amount */}
          <div className="bg-[#111111] border border-gray-800 rounded-lg p-4 mb-4">
            <div className="flex items-center justify-between mb-2">
              <label className="text-gray-400 text-sm">Amount</label>
              <span className="text-gray-500 text-sm">
                Available: {balance} {isReversed && isSourceOsmosis ? selectedSourceToken : sourceChain.assets[0]?.symbol || 'TOKEN'}
              </span>
            </div>
            <input
              type="number"
              value={amount}
              onChange={(e) => handleAmountChange(e.target.value)}
              placeholder="0.00"
              className="w-full bg-[#0a0a0a] border border-gray-700 rounded-lg px-3 py-3 text-white text-lg font-medium focus:outline-none focus:border-blue-500 mb-3"
              step="0.000001"
              min="0"
            />

            {/* Slider */}
            <input
              type="range"
              min="0"
              max="100"
              value={sliderValue}
              onChange={(e) => handleSliderChange(parseInt(e.target.value))}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider mb-3"
              style={{
                background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${sliderValue}%, #374151 ${sliderValue}%, #374151 100%)`
              }}
            />
            
            {/* Percentage Buttons */}
            <div className="flex items-center justify-between gap-2">
              <button
                onClick={() => handleSliderChange(25)}
                className="flex-1 py-2 px-3 bg-[#0a0a0a] hover:bg-gray-800 border border-gray-700 text-gray-300 text-sm rounded-lg transition-colors"
              >
                25%
              </button>
              <button
                onClick={() => handleSliderChange(50)}
                className="flex-1 py-2 px-3 bg-[#0a0a0a] hover:bg-gray-800 border border-gray-700 text-gray-300 text-sm rounded-lg transition-colors"
              >
                50%
              </button>
              <button
                onClick={() => handleSliderChange(75)}
                className="flex-1 py-2 px-3 bg-[#0a0a0a] hover:bg-gray-800 border border-gray-700 text-gray-300 text-sm rounded-lg transition-colors"
              >
                75%
              </button>
              <button
                onClick={setMaxAmount}
                className="flex-1 py-2 px-3 bg-white hover:bg-gray-200 text-black text-sm font-medium rounded-lg transition-colors"
              >
                Max
              </button>
            </div>
          </div>

          {/* Receiver Address */}
          <div className="bg-[#111111] border border-gray-800 rounded-lg p-4 mb-4">
            <label className="text-gray-400 text-sm mb-2 block">Receiver Address</label>
            <input
              type="text"
              value={receiverAddress}
              onChange={(e) => setReceiverAddress(e.target.value)}
              placeholder="Auto-filled from Keplr"
              className="w-full bg-[#0a0a0a] border border-gray-700 rounded-lg px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Progress Indicator for Pre-Swap + Transfer */}
          {isProcessing && enablePreSwap && isReversed && currentStep > 0 && (
            <div className="bg-[#111111] border border-gray-800 rounded-lg p-4 mb-4">
              <div className="space-y-3">
                {/* Step 1: Pre-Swap */}
                <div className="flex items-center gap-3">
                  {currentStep >= 2 ? (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  ) : currentStep === 1 ? (
                    <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                  ) : (
                    <div className="w-5 h-5 rounded-full border-2 border-gray-600" />
                  )}
                  <div>
                    <div className="text-white font-medium">
                      Step 1: Swapping on Osmosis
                    </div>
                    <div className="text-gray-400 text-sm">
                      {selectedSourceToken} → {preSwapToToken}
                    </div>
                  </div>
                </div>
                
                {/* Step 2: IBC Transfer */}
                <div className="flex items-center gap-3">
                  {currentStep >= 3 ? (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  ) : currentStep === 2 ? (
                    <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                  ) : (
                    <div className="w-5 h-5 rounded-full border-2 border-gray-600" />
                  )}
                  <div>
                    <div className="text-white font-medium">
                      Step 2: IBC Transfer to Lumera
                    </div>
                    <div className="text-gray-400 text-sm">
                      Estimated time: 1-3 minutes
                    </div>
                  </div>
                </div>
                
                {/* Step 3: Complete */}
                <div className="flex items-center gap-3">
                  {currentStep >= 3 ? (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  ) : (
                    <div className="w-5 h-5 rounded-full border-2 border-gray-600" />
                  )}
                  <div>
                    <div className="text-white font-medium">
                      Complete
                    </div>
                    <div className="text-gray-400 text-sm">
                      {preSwapToToken} will arrive on Lumera
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Transfer Button */}
          <button
            onClick={handleTransfer}
            disabled={isProcessing || !selectedDestChain || !amount}
            className="w-full bg-white hover:bg-gray-200 disabled:bg-gray-700 disabled:cursor-not-allowed text-black disabled:text-gray-400 font-bold py-4 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 mb-4"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Processing...
              </>
            ) : enablePreSwap && isReversed && isSourceOsmosis ? (
              <>
                <ArrowRightLeft className="w-5 h-5" />
                Swap & Transfer to Lumera
              </>
            ) : enableAutoSwap && isDestinationOsmosis && !isReversed ? (
              <>
                <ArrowRightLeft className="w-5 h-5" />
                Transfer & Auto-Swap to {swapToToken}
              </>
            ) : (
              <>
                <ArrowRightLeft className="w-5 h-5" />
                Confirm Transfer
              </>
            )}
          </button>

          {/* Error Message */}
          {txStatus === 'error' && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="text-red-400 font-medium mb-1">Error</div>
                  <div className="text-red-300 text-sm">{txMessage}</div>
                </div>
              </div>
            </div>
          )}

          {/* Info */}
          <div className="bg-blue-500/5 border border-blue-500/10 rounded-lg p-4">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
              <p className="text-blue-300 text-sm">
                IBC transfers take 1-3 minutes. Address auto-filled from Keplr.
                Double-check recipient address before confirming.
              </p>
            </div>
          </div>

          <style jsx>{`
            .slider::-webkit-slider-thumb {
              appearance: none;
              width: 20px;
              height: 20px;
              border-radius: 50%;
              background: #3b82f6;
              cursor: pointer;
              border: 3px solid white;
              box-shadow: 0 2px 4px rgba(0,0,0,0.2);
            }
            .slider::-moz-range-thumb {
              width: 20px;
              height: 20px;
              border-radius: 50%;
              background: #3b82f6;
              cursor: pointer;
              border: 3px solid white;
              box-shadow: 0 2px 4px rgba(0,0,0,0.2);
            }
          `}</style>
        </>
      ) : (
        <div className="text-center py-8">
          <Wallet className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400 mb-4">Connect your Keplr wallet to continue</p>
          <button
            onClick={connectWallet}
            className="bg-blue-500 hover:bg-blue-600 text-white font-medium py-3 px-6 rounded-lg transition-colors"
          >
            Connect Wallet
          </button>
        </div>
      )}
    </div>
  );
}