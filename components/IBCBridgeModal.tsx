'use client';

import { useState, useEffect } from 'react';
import { X, ArrowRightLeft, ArrowDown, Wallet, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { ChainData } from '@/types/chain';

interface IBCBridgeModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourceChain: ChainData;
  connectedChains: Array<{
    chainId: string;
    chainName: string;
    logo: string | null;
  }>;
}

export default function IBCBridgeModal({ 
  isOpen, 
  onClose, 
  sourceChain, 
  connectedChains
}: IBCBridgeModalProps) {
  const [selectedDestChain, setSelectedDestChain] = useState<string>('');
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
  const [swapToToken, setSwapToToken] = useState('uosmo');
  const [transferStep, setTransferStep] = useState<'idle' | 'transferring' | 'waiting' | 'swapping' | 'complete'>('idle');

  // Helper to fetch balance for reversed direction
  const fetchReversedBalance = async () => {
    if (!selectedDestChain || !walletConnected) return;

    try {
      const destChain = connectedChains.find(c => c.chainId === selectedDestChain);
      if (!destChain) return;

      const chainIdMap: Record<string, string> = {
        'osmosis': 'osmosis-1',
        'osmosis-mainnet': 'osmosis-1',
        'cosmoshub': 'cosmoshub-4',
        'cosmoshub-mainnet': 'cosmoshub-4',
        'noble': 'noble-1',
        'noble-mainnet': 'noble-1',
      };

      // IBC denom mapping for tokens on foreign chains
      const ibcDenoms: Record<string, Record<string, string>> = {
        'osmosis-1': {
          'lumera-mainnet': 'ibc/32C4AEE2B3C4F767A351FA821AB0140B10CB690CDED27D9FCC857859B44432B9',
          'epix-mainnet': 'ibc/EPIX_IBC_DENOM',
          'warden-mainnet': 'ibc/WARDEN_IBC_DENOM',
          'axone-mainnet': 'ibc/AXONE_IBC_DENOM',
          'gitopia-mainnet': 'ibc/GITOPIA_IBC_DENOM',
          'atomone-mainnet': 'ibc/ATOMONE_IBC_DENOM',
          'zenrock-mainnet': 'ibc/ZENROCK_IBC_DENOM',
          'shido-mainnet': 'ibc/SHIDO_IBC_DENOM',
        },
      };

      const commonDenoms: Record<string, string> = {
        'osmosis-1': 'uosmo',
        'cosmoshub-4': 'uatom',
        'noble-1': 'uusdc',
      };

      const commonRpcs: Record<string, string> = {
        'osmosis-1': 'https://rpc.osmosis.zone',
        'cosmoshub-4': 'https://rpc.cosmos.network',
        'noble-1': 'https://rpc.noble.strange.love',
      };

      const normalizedName = destChain.chainName.toLowerCase().replace(/\s+/g, '-');
      const chainId = chainIdMap[normalizedName] || destChain.chainId;
      
      // Use IBC denom if available, otherwise use native denom
      const denom = ibcDenoms[chainId]?.[sourceChain.chain_name] || commonDenoms[chainId];
      const rpc = commonRpcs[chainId];

      if (!denom || !rpc) {
        setBalance('0');
        return;
      }

      await (window as any).keplr.enable(chainId);
      const offlineSigner = await (window as any).keplr.getOfflineSigner(chainId);
      const accounts = await offlineSigner.getAccounts();

      const { SigningStargateClient } = await import('@cosmjs/stargate');
      const client = await SigningStargateClient.connectWithSigner(rpc, offlineSigner);
      const bal = await client.getBalance(accounts[0].address, denom);
      
      // Use correct exponent for balance formatting
      const exponent = sourceChain.assets[0]?.exponent 
        ? parseInt(String(sourceChain.assets[0].exponent)) 
        : 6;
      const formatted = (parseInt(bal.amount) / Math.pow(10, exponent)).toFixed(6);
      setBalance(formatted);
    } catch (error) {
      console.error('Reversed balance fetch error:', error);
      setBalance('0');
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    const checkWallet = async () => {
      if (typeof window !== 'undefined' && (window as any).keplr) {
        try {
          const chainIdMap: Record<string, string> = {
            'osmosis': 'osmosis-1',
            'osmosis-mainnet': 'osmosis-1',
            'cosmoshub': 'cosmoshub-4',
            'cosmoshub-mainnet': 'cosmoshub-4',
            'noble': 'noble-1',
            'noble-mainnet': 'noble-1',
          };

          // Determine which chain to connect to and fetch balance from
          let chainId: string;
          let denom: string;
          let rpc: string;

          if (isReversed && selectedDestChain) {
            // Reversed: fetch from destination chain (which becomes source)
            const destChain = connectedChains.find(c => c.chainId === selectedDestChain);
            if (!destChain) return;

            const normalizedName = destChain.chainName.toLowerCase().replace(/\s+/g, '-');
            chainId = chainIdMap[normalizedName] || destChain.chainId;

            // For reversed transfers, we need to use IBC denom format
            // When tokens are on a foreign chain, they have an IBC denom hash
            const ibcDenoms: Record<string, Record<string, string>> = {
              'osmosis-1': {
                'lumera-mainnet': 'ibc/32C4AEE2B3C4F767A351FA821AB0140B10CB690CDED27D9FCC857859B44432B9',
                'epix-mainnet': 'ibc/EPIX_IBC_DENOM',
                'warden-mainnet': 'ibc/WARDEN_IBC_DENOM',
                'axone-mainnet': 'ibc/AXONE_IBC_DENOM',
                'gitopia-mainnet': 'ibc/GITOPIA_IBC_DENOM',
                'atomone-mainnet': 'ibc/ATOMONE_IBC_DENOM',
                'zenrock-mainnet': 'ibc/ZENROCK_IBC_DENOM',
                'shido-mainnet': 'ibc/SHIDO_IBC_DENOM',
              },
            };

            const commonDenoms: Record<string, string> = {
              'osmosis-1': 'uosmo',
              'cosmoshub-4': 'uatom',
              'noble-1': 'uusdc',
            };

            const commonRpcs: Record<string, string> = {
              'osmosis-1': 'https://rpc.osmosis.zone',
              'cosmoshub-4': 'https://rpc.cosmos.network',
              'noble-1': 'https://rpc.noble.strange.love',
            };

            // Use IBC denom if transferring back to origin chain, otherwise use native denom
            denom = ibcDenoms[chainId]?.[sourceChain.chain_name] || commonDenoms[chainId] || 'utoken';
            rpc = commonRpcs[chainId] || '';

            if (!rpc) {
              return;
            }
          } else {
            // Normal: fetch from source chain
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
              
              // Use correct exponent for balance formatting
              const exponent = sourceChain.assets[0]?.exponent 
                ? parseInt(String(sourceChain.assets[0].exponent)) 
                : 6;
              const formatted = (parseInt(bal.amount) / Math.pow(10, exponent)).toFixed(6);
              setBalance(formatted);
            } catch (error) {
              console.error('Balance fetch error:', error);
              setBalance('0');
            }
          }
        } catch (error) {
          console.error('Wallet check error:', error);
        }
      }
    };
    checkWallet();
  }, [sourceChain, isOpen, isReversed, selectedDestChain, connectedChains]);

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

        // When reversed, fetch address from source chain (which becomes destination)
        // When not reversed, fetch address from selected destination chain
        let targetChainId: string;
        
        if (isReversed) {
          // Reversed: destination is the original source chain
          targetChainId = sourceChain.chain_id || sourceChain.chain_name;
        } else {
          // Normal: destination is the selected chain
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

  const handleTransfer = async () => {
    if (!walletConnected || !selectedDestChain || !amount || !receiverAddress) {
      alert('Please fill all fields');
      return;
    }

    setIsProcessing(true);
    setTxStatus('idle');
    setTxMessage('');
    setTransferStep('transferring');

    try {
      const destChain = connectedChains.find(c => c.chainId === selectedDestChain);
      if (!destChain) throw new Error('Destination chain not found');

      // Determine actual source and destination based on direction
      let actualSourceChain: ChainData | typeof destChain;
      let actualDestChain: ChainData | typeof destChain;
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
        
        // For reversed transfers, we need to use IBC denom format
        // When tokens are on a foreign chain, they have an IBC denom hash
        // Example: LUME on Osmosis = ibc/32C4AEE2B3C4F767A351FA821AB0140B10CB690CDED27D9FCC857859B44432B9
        // To find IBC denoms: https://www.mintscan.io/osmosis/assets
        const ibcDenoms: Record<string, Record<string, string>> = {
          'osmosis-1': {
            'lumera-mainnet': 'ibc/32C4AEE2B3C4F767A351FA821AB0140B10CB690CDED27D9FCC857859B44432B9',
            'epix-mainnet': 'ibc/EPIX_IBC_DENOM',             'warden-mainnet': 'ibc/WARDEN_IBC_DENOM',             'axone-mainnet': 'ibc/AXONE_IBC_DENOM',             'gitopia-mainnet': 'ibc/GITOPIA_IBC_DENOM',             'atomone-mainnet': 'ibc/ATOMONE_IBC_DENOM',             'zenrock-mainnet': 'ibc/ZENROCK_IBC_DENOM',             'shido-mainnet': 'ibc/SHIDO_IBC_DENOM',           },
        };
        
        // Try to get IBC denom, fallback to common denoms
        const commonDenoms: Record<string, string> = {
          'osmosis-1': 'uosmo',
          'cosmoshub-4': 'uatom',
          'noble-1': 'uusdc',
        };
        
        actualSourceDenom = ibcDenoms[actualSourceChainId]?.[sourceChain.chain_name] || 
                           commonDenoms[actualSourceChainId] || 
                           'utoken';
        
        // We need RPC for the selected chain - this is a limitation
        // For now, use a fallback approach
        actualSourceRpc = null; // Will need to handle this
      } else {
        // Normal: transfer FROM source chain TO selected chain
        actualSourceChainId = sourceChain.chain_id || sourceChain.chain_name;
        actualDestChainName = destChain.chainName;
        actualSourceDenom = sourceChain.assets[0].base;
        actualSourceRpc = sourceChain.rpc[0];
      }

      await (window as any).keplr.enable(actualSourceChainId);
      
      // Detect EVM chain for proper signer selection (same pattern as keplr.ts)
      const isEvmChain = actualSourceChainId.includes('_');
      
      // Use Direct signing for EVM chains (better ethsecp256k1 support)
      const offlineSigner = isEvmChain 
        ? await (window as any).keplr.getOfflineSigner(actualSourceChainId)
        : await (window as any).keplr.getOfflineSignerAuto(actualSourceChainId);
      
      const accounts = await offlineSigner.getAccounts();
      const senderAddress = accounts[0].address;

      // Fetch IBC channel - need to swap source/dest for reversed
      const channelSourceName = isReversed ? destChain.chainName : sourceChain.chain_name;
      const channelDestName = isReversed ? sourceChain.chain_name : destChain.chainName;
      
      const response = await fetch(`/api/ibc/channels?sourceChain=${channelSourceName}&destChain=${channelDestName}`);
      const channelData = await response.json();
      
      if (!channelData.channel) {
        throw new Error('No IBC channel found');
      }

      const { SigningStargateClient, defaultRegistryTypes } = await import('@cosmjs/stargate');
      const { Registry } = await import('@cosmjs/proto-signing');
      
      // Create client options with EVM support if needed
      const clientOptions: any = { registry: new Registry(defaultRegistryTypes) };
      
      // Add EVM support for chains with underscore in chain_id (coin_type 60)
      if (isEvmChain) {
        // Import EVM helper functions from keplr.ts pattern
        const createEvmRegistry = async () => {
          try {
            const registry = new Registry(defaultRegistryTypes);
            return registry;
          } catch (error) {
            console.error('Error creating EVM registry:', error);
            return null;
          }
        };
        
        const createEvmAccountParser = async () => {
          try {
            const { accountFromAny } = await import('@cosmjs/stargate');
            
            return (input: any) => {
              try {
                if (input.typeUrl === '/ethermint.types.v1.EthAccount') {
                  return {
                    address: '',
                    pubkey: null,
                    accountNumber: 0,
                    sequence: 0,
                  };
                }
                
                return accountFromAny(input);
              } catch (error) {
                console.error('Account parser error:', error);
                try {
                  return accountFromAny(input);
                } catch (fallbackError) {
                  console.error('Fallback parser also failed:', fallbackError);
                  return {
                    address: '',
                    pubkey: null,
                    accountNumber: 0,
                    sequence: 0,
                  };
                }
              }
            };
          } catch (error) {
            console.error('Error creating account parser:', error);
            return null;
          }
        };
        
        const registry = await createEvmRegistry();
        const accountParser = await createEvmAccountParser();
        
        if (registry) {
          clientOptions.registry = registry;
        }
        
        if (accountParser) {
          clientOptions.accountParser = accountParser;
        }
      }
      
      // For reversed transfers, we need to construct RPC endpoint differently
      let rpcEndpoint: string;
      if (isReversed) {
        // Use common RPC endpoints for known chains
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

      const timeoutTimestamp = Math.floor(Date.now() / 1000) + 600;

      // Get token exponent for proper amount calculation
      const tokenExponent = isReversed 
        ? 6 // Common chains use 6 decimals (OSMO, ATOM, USDC)
        : parseInt(String(sourceChain.assets[0]?.exponent || '6'));

      // Calculate fee based on token exponent and gas price
      // For high exponent tokens (18 decimals), use much smaller fee
      let feeAmount: string;
      if (tokenExponent >= 18) {
        // For 18 decimal tokens: 0.0001 token = 100000000000000 (1e14)
        feeAmount = '100000000000000'; // 1e14 as string to avoid scientific notation
      } else if (tokenExponent >= 12) {
        // For 12 decimal tokens
        feeAmount = '500000000000'; // 5e11 as string
      } else {
        // For 6 decimal tokens (standard)
        feeAmount = '10000';
      }

      // Convert amount to smallest unit using string manipulation to avoid scientific notation
      const amountFloat = parseFloat(amount);
      let transferAmount: string;
      
      if (tokenExponent >= 18) {
        // For high exponent tokens, use BigInt to avoid scientific notation
        // Split into integer and decimal parts
        const [intPart, decPart = ''] = amount.split('.');
        const paddedDec = decPart.padEnd(tokenExponent, '0').slice(0, tokenExponent);
        transferAmount = intPart + paddedDec;
        // Remove leading zeros
        transferAmount = transferAmount.replace(/^0+/, '') || '0';
      } else {
        // For lower exponents, safe to use multiplication
        transferAmount = Math.floor(amountFloat * Math.pow(10, tokenExponent)).toString();
      }

      // For EVM chains, use special signing method
      let transferTxHash: string = '';
      
      if (isEvmChain) {
        try {
          const restEndpoint = isReversed 
            ? (() => {
                const commonRests: Record<string, string> = {
                  'osmosis-1': 'https://lcd.osmosis.zone',
                  'cosmoshub-4': 'https://api.cosmos.network',
                  'noble-1': 'https://api.noble.strange.love',
                };
                return commonRests[actualSourceChainId] || '';
              })()
            : (sourceChain.api?.[0]?.address || '');
          
          if (!restEndpoint) {
            throw new Error('No REST endpoint available for EVM signing');
          }
          
          // Import EVM signing functions
          const { signTransactionForEvm, broadcastTransaction } = await import('@/lib/evmSigning');
          
          // Create IBC transfer message
          const ibcTransferMsg = {
            typeUrl: '/ibc.applications.transfer.v1.MsgTransfer',
            value: {
              sourcePort: 'transfer',
              sourceChannel: channelData.channel,
              token: {
                denom: actualSourceDenom,
                amount: transferAmount,
              },
              sender: senderAddress,
              receiver: receiverAddress,
              timeoutHeight: undefined,
              timeoutTimestamp: BigInt(Math.floor(Date.now() / 1000) * 1e9 + 600 * 1e9),
              memo: 'WinScan',
            },
          };
          
          const fee = {
            amount: [{ denom: actualSourceDenom, amount: feeAmount }],
            gas: '500000',
          };
          
          const coinType = parseInt(sourceChain.coin_type || '60');
          
          // Sign transaction using EVM method
          const signedTx = await signTransactionForEvm(
            offlineSigner,
            actualSourceChainId,
            restEndpoint,
            senderAddress,
            [ibcTransferMsg],
            fee,
            '',
            coinType,
            false // Disable auto-simulation for IBC transfers
          );
          
          // Broadcast transaction
          const result = await broadcastTransaction(restEndpoint, signedTx);
          
          if (result.code !== 0) {
            throw new Error(result.raw_log || 'Transaction failed');
          }
          
          const transferTxHash = result.txhash;
          
          // Don't show popup yet if auto-swap is enabled
          // Continue to auto-swap logic below
          
        } catch (evmError: any) {
          console.error('❌ EVM signing/broadcast failed:', evmError);
          throw evmError;
        }
      } else {
        // Standard Cosmos SDK signing for non-EVM chains
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
          Math.floor(Date.now() / 1000) * 1e9 + 600 * 1e9, // timeoutTimestamp in nanoseconds
          {
            amount: [{ denom: actualSourceDenom, amount: feeAmount }],
            gas: '500000',
          },
          'WinScan'
        );

        if (result.code !== 0) {
          throw new Error(result.rawLog || 'Transaction failed');
        }

        transferTxHash = result.transactionHash;
      }
      
      // Step 2: If auto-swap is enabled and destination is Osmosis, wait and then swap
      if (enableAutoSwap && !isReversed && selectedChainInfo?.chainName.toLowerCase().includes('osmosis')) {
        setTransferStep('waiting');
        
        // Smart polling: Check balance every 5 seconds instead of waiting 60 seconds
        const maxWaitTime = 120000; // Max 2 minutes
        const pollInterval = 5000; // Check every 5 seconds
        let elapsedTime = 0;
        let balanceArrived = false;
        
        // Step 3: Execute swap on Osmosis using osmojs with dynamic routing
        try {
          const osmosisChainId = 'osmosis-1';
          await (window as any).keplr.enable(osmosisChainId);
          
          // Import osmojs
          const { osmosis } = await import('osmojs');
          const { getSigningOsmosisClient } = await import('osmojs');
          
          // Use Amino signer only (coin_type 118, no ethermint)
          const osmosisOfflineSigner = await (window as any).keplr.getOfflineSignerOnlyAmino(osmosisChainId);
          const osmosisAccounts = await osmosisOfflineSigner.getAccounts();
          const osmosisAddress = osmosisAccounts[0].address;
          
          // Connect using osmojs client with Amino signer
          const osmosisClient = await getSigningOsmosisClient({
            rpcEndpoint: 'https://rpc.osmosis.zone',
            signer: osmosisOfflineSigner,
          });
          
          // Calculate expected amount for matching
          const sourceExponent = parseInt(String(sourceChain.assets[0]?.exponent || '6'));
          const osmosisExponent = 6;
          const transferAmountInt = BigInt(transferAmount);
          let expectedAmountOnOsmosis: bigint;
          
          if (sourceExponent > osmosisExponent) {
            expectedAmountOnOsmosis = transferAmountInt / BigInt(Math.pow(10, sourceExponent - osmosisExponent));
          } else if (sourceExponent < osmosisExponent) {
            expectedAmountOnOsmosis = transferAmountInt * BigInt(Math.pow(10, osmosisExponent - sourceExponent));
          } else {
            expectedAmountOnOsmosis = transferAmountInt;
          }
          
          let tokenDenomOnOsmosis: string | null = null;
          let tokenInAmount: string = '0';
          
          // Poll for balance arrival
          while (elapsedTime < maxWaitTime && !balanceArrived) {
            await new Promise(resolve => setTimeout(resolve, pollInterval));
            elapsedTime += pollInterval;
            
            try {
              // Query all balances on Osmosis
              const allBalances = await osmosisClient.getAllBalances(osmosisAddress);
              const ibcBalances = allBalances.filter(b => b.denom.startsWith('ibc/'));
              
              // Find matching IBC denom by amount (within 1% tolerance)
              const tolerance = 0.01;
              
              for (const balance of ibcBalances) {
                const balanceAmount = BigInt(balance.amount);
                const diff = balanceAmount > expectedAmountOnOsmosis 
                  ? balanceAmount - expectedAmountOnOsmosis 
                  : expectedAmountOnOsmosis - balanceAmount;
                
                const percentDiff = Number(diff * BigInt(10000) / expectedAmountOnOsmosis) / 10000;
                
                if (percentDiff <= tolerance) {
                  tokenDenomOnOsmosis = balance.denom;
                  tokenInAmount = balance.amount;
                  balanceArrived = true;
                  break;
                }
              }
              
              // Fallback: use highest balance IBC denom if we've waited long enough
              if (!balanceArrived && elapsedTime >= 30000 && ibcBalances.length > 0) {
                const sortedBalances = [...ibcBalances].sort((a, b) => 
                  BigInt(b.amount) > BigInt(a.amount) ? 1 : -1
                );
                tokenDenomOnOsmosis = sortedBalances[0].denom;
                tokenInAmount = sortedBalances[0].amount;
                balanceArrived = true;
                break;
              }
              
            } catch (pollError) {
              console.error('Polling error:', pollError);
              // Continue polling
            }
          }
          
          if (!tokenDenomOnOsmosis) {
            throw new Error(`Could not detect IBC denom after ${maxWaitTime / 1000}s. Please swap manually on Osmosis.`);
          }
          
          setTransferStep('swapping');
          
          // Get optimal route from Osmosis SQS router (auto-detects best pools)
          const routerUrl = `https://sqs.osmosis.zone/router/quote?tokenIn=${tokenInAmount}${tokenDenomOnOsmosis}&tokenOutDenom=${swapToToken}`;
          
          const routeResponse = await fetch(routerUrl);
          
          if (!routeResponse.ok) {
            const errorText = await routeResponse.text();
            console.error('❌ Router response error:', errorText);
            throw new Error(`Failed to get swap route from Osmosis router: ${routeResponse.status}`);
          }
          
          const routeData = await routeResponse.json();
          
          if (!routeData.amount_out || !routeData.route || routeData.route.length === 0) {
            throw new Error(`No valid swap route found for ${sourceChain.assets[0].symbol} to ${swapToToken}`);
          }
          
          // Extract routes from SQS response (pools auto-detected by router)
          const routes = routeData.route[0].pools.map((pool: any) => {
            return {
              poolId: BigInt(pool.id),
              tokenOutDenom: pool.token_out_denom,
            };
          });
          
          // Calculate minimum output with 5% slippage
          const expectedOut = routeData.amount_out;
          const minOut = Math.floor(parseInt(expectedOut) * 0.95).toString();
          
          // Build swap message using osmojs MessageComposer with dynamic routes
          const msg = osmosis.poolmanager.v1beta1.MessageComposer.withTypeUrl.swapExactAmountIn({
            sender: osmosisAddress,
            routes: routes,
            tokenIn: {
              denom: tokenDenomOnOsmosis,
              amount: tokenInAmount,
            },
            tokenOutMinAmount: minOut,
          });
          
          const fee = {
            amount: [{ denom: 'uosmo', amount: '5000' }],
            gas: '550000',
          };
          
          // Sign and broadcast
          const swapResult = await osmosisClient.signAndBroadcast(
            osmosisAddress,
            [msg],
            fee,
            'WinScan'
          );
          
          if (swapResult.code !== 0) {
            throw new Error(swapResult.rawLog || 'Swap transaction failed');
          }
          
          const swapTxHash = swapResult.transactionHash;
          
          setTransferStep('complete');
          setTxStatus('success');
          setTxMessage(`Transfer and swap successful! Transfer: ${transferTxHash}, Swap: ${swapTxHash}`);
          
          // Show success popup with both transaction hashes
          if (typeof window !== 'undefined') {
            const overlay = document.createElement('div');
            overlay.style.cssText = 'position: fixed; inset: 0; background: rgba(0,0,0,0.85); z-index: 9999; display: flex; align-items: center; justify-content: center;';
            
            const popup = document.createElement('div');
            popup.style.cssText = 'background: #1a1a1a; border: 2px solid #22c55e; border-radius: 16px; padding: 32px; max-width: 450px; text-align: center; box-shadow: 0 20px 60px rgba(34, 197, 94, 0.3);';
            popup.innerHTML = `
              <style>
                @keyframes pulse-glow {
                  0%, 100% { opacity: 1; transform: scale(1); }
                  50% { opacity: 0.5; transform: scale(1.1); }
                }
                @keyframes bounce-check {
                  0%, 100% { transform: translateY(0); }
                  50% { transform: translateY(-10px); }
                }
                .glow-bg { animation: pulse-glow 2s ease-in-out infinite; }
                .bounce-icon { animation: bounce-check 1s ease-in-out 2; }
              </style>
              <div style="position: relative; width: 80px; height: 80px; margin: 0 auto 20px;">
                <div class="glow-bg" style="position: absolute; inset: 0; background: rgba(34, 197, 94, 0.2); border-radius: 50%; filter: blur(24px);"></div>
                <div style="position: relative; width: 80px; height: 80px; background: linear-gradient(135deg, #22c55e 0%, #10b981 100%); border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 8px 32px rgba(34, 197, 94, 0.5);">
                  <svg class="bounce-icon" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                </div>
              </div>
              <h3 style="color: white; font-size: 24px; font-weight: bold; margin-bottom: 12px;">Transfer & Swap Complete!</h3>
              <p style="color: #9ca3af; font-size: 14px; margin-bottom: 20px;">Your tokens have been transferred and swapped successfully</p>
              
              <div style="background: #111; border: 1px solid #374151; border-radius: 8px; padding: 12px; margin-bottom: 12px;">
                <p style="color: #6b7280; font-size: 12px; margin-bottom: 4px;">Transfer Tx</p>
                <p style="color: #22c55e; font-size: 11px; font-family: monospace; word-break: break-all;">${transferTxHash}</p>
              </div>
              
              <div style="background: #111; border: 1px solid #374151; border-radius: 8px; padding: 12px; margin-bottom: 12px;">
                <p style="color: #6b7280; font-size: 12px; margin-bottom: 4px;">Swap Tx</p>
                <p style="color: #22c55e; font-size: 11px; font-family: monospace; word-break: break-all;">${swapTxHash}</p>
              </div>
              
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
        } catch (swapError: any) {
          console.error('Swap error:', swapError);
          // Transfer succeeded but swap failed - show partial success
          setTxStatus('error');
          setTxMessage(`Transfer successful (${transferTxHash}) but swap failed: ${swapError.message}. Please swap manually on Osmosis.`);
        }
      } else {
        // No auto-swap, just show transfer success
        setTransferStep('complete');
        setTxStatus('success');
        setTxMessage(`Transfer successful! Tx: ${transferTxHash}`);
        
        // Show success popup
        if (typeof window !== 'undefined') {
          const overlay = document.createElement('div');
          overlay.style.cssText = 'position: fixed; inset: 0; background: rgba(0,0,0,0.85); z-index: 9999; display: flex; align-items: center; justify-content: center;';
          
          const popup = document.createElement('div');
          popup.style.cssText = 'background: #1a1a1a; border: 2px solid #22c55e; border-radius: 16px; padding: 32px; max-width: 400px; text-align: center; box-shadow: 0 20px 60px rgba(34, 197, 94, 0.3);';
          popup.innerHTML = `
            <style>
              @keyframes pulse-glow {
                0%, 100% { opacity: 1; transform: scale(1); }
                50% { opacity: 0.5; transform: scale(1.1); }
              }
              @keyframes bounce-check {
                0%, 100% { transform: translateY(0); }
                50% { transform: translateY(-10px); }
              }
              .glow-bg { animation: pulse-glow 2s ease-in-out infinite; }
              .bounce-icon { animation: bounce-check 1s ease-in-out 2; }
            </style>
            <div style="position: relative; width: 80px; height: 80px; margin: 0 auto 20px;">
              <div class="glow-bg" style="position: absolute; inset: 0; background: rgba(34, 197, 94, 0.2); border-radius: 50%; filter: blur(24px);"></div>
              <div style="position: relative; width: 80px; height: 80px; background: linear-gradient(135deg, #22c55e 0%, #10b981 100%); border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 8px 32px rgba(34, 197, 94, 0.5);">
                <svg class="bounce-icon" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              </div>
            </div>
            <h3 style="color: white; font-size: 24px; font-weight: bold; margin-bottom: 12px;">Transfer Successful!</h3>
            <p style="color: #9ca3af; font-size: 14px; margin-bottom: 20px;">Your IBC transaction has been successfully sent</p>
            <div style="background: #111; border: 1px solid #374151; border-radius: 8px; padding: 12px; margin-bottom: 12px;">
              <p style="color: #6b7280; font-size: 12px; margin-bottom: 4px;">Transaction Hash</p>
              <p style="color: #22c55e; font-size: 13px; font-family: monospace; word-break: break-all;">${transferTxHash}</p>
            </div>
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
      }
      
      setAmount('');
      
      // Refresh balance
      try {
        const { SigningStargateClient } = await import('@cosmjs/stargate');
        const refreshClient = await SigningStargateClient.connectWithSigner(rpcEndpoint, offlineSigner, clientOptions);
        const bal = await refreshClient.getBalance(senderAddress, actualSourceDenom);
        const exponent = isReversed 
          ? 6 
          : parseInt(String(sourceChain.assets[0]?.exponent || '6'));
        const formatted = (parseInt(bal.amount) / Math.pow(10, exponent)).toFixed(6);
        setBalance(formatted);
      } catch (balanceError) {
        console.error('Failed to refresh balance:', balanceError);
        // Non-critical error, just log it
      }
      
    } catch (error: any) {
      console.error('Transfer error:', error);
      setTxStatus('error');
      setTxMessage(error.message || 'Transfer failed');
      setTransferStep('idle');
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
    
    // Trigger balance fetch by updating a dependency
    // The useEffect will handle fetching the correct balance
  };

  if (!isOpen) return null;

  const selectedChainInfo = connectedChains.find(c => c.chainId === selectedDestChain);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <ArrowRightLeft className="w-4 h-4 text-blue-500" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">IBC Bridge</h2>
              <p className="text-gray-500 text-xs">Powered by WinScan</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-3">
          {walletConnected ? (
            <>
              {/* Wallet Info */}
              <div className="bg-[#111111] border border-gray-800 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-3 h-3 text-green-500" />
                    <span className="text-gray-400 text-xs">Connected</span>
                  </div>
                  <span className="text-white text-xs font-mono">
                    {walletAddress.slice(0, 8)}...{walletAddress.slice(-6)}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-2 mt-2 border-t border-gray-800">
                  <span className="text-gray-500 text-xs">Balance</span>
                  <span className="text-white text-sm font-medium">
                    {balance} {isReversed && selectedChainInfo 
                      ? (selectedChainInfo.chainName.toLowerCase().includes('osmosis') ? 'OSMO' : 
                         selectedChainInfo.chainName.toLowerCase().includes('cosmos') ? 'ATOM' : 
                         selectedChainInfo.chainName.toLowerCase().includes('noble') ? 'USDC' : 'TOKEN')
                      : (sourceChain.assets[0]?.symbol || 'TOKEN')}
                  </span>
                </div>
              </div>

              {/* From Chain */}
              <div className="bg-[#111111] border border-gray-800 rounded-lg p-3">
                <label className="text-gray-400 text-xs mb-2 block">From</label>
                {!isReversed ? (
                  <div className="flex items-center gap-2">
                    <img 
                      src={sourceChain.logo} 
                      alt={sourceChain.chain_name}
                      className="w-6 h-6 rounded-full"
                    />
                    <div className="text-white text-sm font-medium">{sourceChain.chain_name}</div>
                  </div>
                ) : selectedChainInfo ? (
                  <div className="flex items-center gap-2">
                    {selectedChainInfo.logo ? (
                      <img 
                        src={selectedChainInfo.logo} 
                        alt={selectedChainInfo.chainName}
                        className="w-6 h-6 rounded-full"
                      />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-purple-500" />
                    )}
                    <div className="text-white text-sm font-medium">{selectedChainInfo.chainName}</div>
                  </div>
                ) : (
                  <div className="text-gray-500 text-sm">Select destination first</div>
                )}
              </div>

              {/* Swap Direction Button */}
              <div className="flex justify-center -my-1 relative z-10">
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
              <div className="bg-[#111111] border border-gray-800 rounded-lg p-3">
                <label className="text-gray-400 text-xs mb-2 block">To</label>
                {!isReversed ? (
                  <select
                    value={selectedDestChain}
                    onChange={(e) => setSelectedDestChain(e.target.value)}
                    className="w-full bg-[#0a0a0a] border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                  >
                    <option value="">Select destination</option>
                    {connectedChains.map((chain) => (
                      <option key={chain.chainId} value={chain.chainId}>
                        {chain.chainName}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="flex items-center gap-2">
                    <img 
                      src={sourceChain.logo} 
                      alt={sourceChain.chain_name}
                      className="w-6 h-6 rounded-full"
                    />
                    <div className="text-white text-sm font-medium">{sourceChain.chain_name}</div>
                  </div>
                )}
              </div>

              {/* Auto-Swap Option */}
              {!isReversed && selectedChainInfo?.chainName.toLowerCase().includes('osmosis') && (
                <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      id="autoSwap"
                      checked={enableAutoSwap}
                      onChange={(e) => setEnableAutoSwap(e.target.checked)}
                      className="mt-1 w-4 h-4 rounded border-gray-600 text-purple-500 focus:ring-purple-500 focus:ring-offset-0 bg-gray-700"
                    />
                    <div className="flex-1">
                      <label htmlFor="autoSwap" className="text-white font-medium text-sm cursor-pointer flex items-center gap-2">
                        Auto-Swap on Arrival
                        <span className="px-2 py-0.5 bg-purple-500 text-white text-xs rounded-full">BETA</span>
                      </label>
                      <p className="text-gray-400 text-xs mt-1">
                        Swap to OSMO when tokens arrive
                      </p>
                      {enableAutoSwap && (
                        <div className="mt-3 pt-3 border-t border-purple-500/20">
                          <label className="text-gray-400 text-xs mb-2 block">Swap to:</label>
                          <select
                            value={swapToToken}
                            onChange={(e) => setSwapToToken(e.target.value)}
                            className="w-full bg-[#0a0a0a] border border-purple-500/30 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500"
                          >
                            <option value="uosmo">OSMO</option>
                            <option value="ibc/27394FB092D2ECCD56123C74F36E4C1F926001CEADA9CA97EA622B25F41E5EB2">ATOM</option>
                            <option value="ibc/D189335C6E4A68B513C10AB227BF1C1D38C746766278BA3EEB4FB14124F1D858">USDC</option>
                          </select>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Amount */}
              <div className="bg-[#111111] border border-gray-800 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-gray-400 text-xs">Amount</label>
                  <span className="text-gray-500 text-xs">
                    Available: {balance}
                  </span>
                </div>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => handleAmountChange(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-[#0a0a0a] border border-gray-700 rounded-lg px-3 py-2 text-white text-lg font-medium focus:outline-none focus:border-blue-500 mb-3"
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
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider mb-2"
                  style={{
                    background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${sliderValue}%, #374151 ${sliderValue}%, #374151 100%)`
                  }}
                />
                
                {/* Percentage Buttons */}
                <div className="flex items-center justify-between gap-2">
                  <button
                    onClick={() => handleSliderChange(25)}
                    className="flex-1 py-1.5 px-2 bg-[#0a0a0a] hover:bg-gray-800 border border-gray-700 text-gray-300 text-xs rounded-lg transition-colors"
                  >
                    25%
                  </button>
                  <button
                    onClick={() => handleSliderChange(50)}
                    className="flex-1 py-1.5 px-2 bg-[#0a0a0a] hover:bg-gray-800 border border-gray-700 text-gray-300 text-xs rounded-lg transition-colors"
                  >
                    50%
                  </button>
                  <button
                    onClick={() => handleSliderChange(75)}
                    className="flex-1 py-1.5 px-2 bg-[#0a0a0a] hover:bg-gray-800 border border-gray-700 text-gray-300 text-xs rounded-lg transition-colors"
                  >
                    75%
                  </button>
                  <button
                    onClick={setMaxAmount}
                    className="flex-1 py-1.5 px-2 bg-white hover:bg-gray-200 text-black text-xs font-medium rounded-lg transition-colors"
                  >
                    Max
                  </button>
                </div>
              </div>

              {/* Receiver Address */}
              <div className="bg-[#111111] border border-gray-800 rounded-lg p-3">
                <label className="text-gray-400 text-xs mb-2 block">Receiver Address</label>
                <input
                  type="text"
                  value={receiverAddress}
                  onChange={(e) => setReceiverAddress(e.target.value)}
                  placeholder="Auto-filled from Keplr"
                  className="w-full bg-[#0a0a0a] border border-gray-700 rounded-lg px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-blue-500"
                  readOnly
                />
              </div>

              {/* Transfer Button */}
              <button
                onClick={handleTransfer}
                disabled={isProcessing || !selectedDestChain || !amount}
                className="w-full bg-white hover:bg-gray-200 disabled:bg-gray-700 disabled:cursor-not-allowed text-black disabled:text-gray-400 font-bold py-4 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    Confirm Transfer
                  </>
                )}
              </button>

              {/* Progress Indicators for Auto-Swap */}
              {isProcessing && enableAutoSwap && transferStep !== 'idle' && (
                <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-4">
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      {transferStep === 'transferring' ? (
                        <Loader2 className="w-4 h-4 text-purple-400 animate-spin" />
                      ) : (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      )}
                      <span className={`text-sm ${transferStep === 'transferring' ? 'text-purple-400' : 'text-green-500'}`}>
                        Transferring via IBC
                      </span>
                    </div>
                    
                    {(transferStep === 'waiting' || transferStep === 'swapping' || transferStep === 'complete') && (
                      <div className="flex items-center gap-3">
                        {transferStep === 'waiting' ? (
                          <Loader2 className="w-4 h-4 text-purple-400 animate-spin" />
                        ) : (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        )}
                        <span className={`text-sm ${transferStep === 'waiting' ? 'text-purple-400' : 'text-green-500'}`}>
                          Waiting for arrival
                        </span>
                      </div>
                    )}
                    
                    {(transferStep === 'swapping' || transferStep === 'complete') && (
                      <div className="flex items-center gap-3">
                        {transferStep === 'swapping' ? (
                          <Loader2 className="w-4 h-4 text-purple-400 animate-spin" />
                        ) : (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        )}
                        <span className={`text-sm ${transferStep === 'swapping' ? 'text-purple-400' : 'text-green-500'}`}>
                          Swapping to {swapToToken === 'uosmo' ? 'OSMO' : swapToToken}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Error Message Only */}
              {txStatus === 'error' && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
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
              <div className="bg-blue-500/5 border border-blue-500/10 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                  <p className="text-blue-300 text-xs">
                    IBC transfers take 1-3 minutes. Address auto-filled from Keplr.
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
                onClick={() => window.location.reload()}
                className="bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-6 rounded-lg transition-colors"
              >
                Connect Wallet
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
