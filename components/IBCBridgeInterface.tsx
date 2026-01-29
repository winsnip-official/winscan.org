'use client';

import { useState, useEffect } from 'react';
import { ArrowRightLeft, ArrowDown, Wallet, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { ChainData } from '@/types/chain';

interface IBCBridgeInterfaceProps {
  sourceChain: ChainData;
  connectedChains: Array<{
    chainId: string;
    chainName: string;
    logo: string | null;
  }>;
}

export default function IBCBridgeInterface({ sourceChain, connectedChains }: IBCBridgeInterfaceProps) {
  const [selectedDestChain, setSelectedDestChain] = useState<string>('');
  const [amount, setAmount] = useState('');
  const [receiverAddress, setReceiverAddress] = useState('');
  const [walletConnected, setWalletConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState('');
  const [balance, setBalance] = useState('0');
  const [isProcessing, setIsProcessing] = useState(false);
  const [txStatus, setTxStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [txMessage, setTxMessage] = useState('');

  useEffect(() => {
    // Check if Keplr wallet is connected
    const checkWallet = async () => {
      if (typeof window !== 'undefined' && (window as any).keplr) {
        try {
          const chainId = sourceChain.chain_id;
          await (window as any).keplr.enable(chainId);
          const offlineSigner = await (window as any).keplr.getOfflineSigner(chainId);
          const accounts = await offlineSigner.getAccounts();
          if (accounts.length > 0) {
            setWalletConnected(true);
            setWalletAddress(accounts[0].address);
            
            // Fetch balance
            try {
              const { SigningStargateClient } = await import('@cosmjs/stargate');
              
              const rpcEndpoint = sourceChain.rpc[0]?.address || sourceChain.rpc[0];
              const client = await SigningStargateClient.connectWithSigner(
                typeof rpcEndpoint === 'string' ? rpcEndpoint : rpcEndpoint.address,
                offlineSigner
              );
              const bal = await client.getBalance(accounts[0].address, sourceChain.assets[0].base);
              const formatted = (parseInt(bal.amount) / 1e6).toFixed(6);
              setBalance(formatted);
            } catch (error) {
              console.error('Balance fetch error:', error);
            }
          }
        } catch (error) {
          console.error('Wallet check error:', error);
        }
      }
    };
    checkWallet();
  }, [sourceChain]);

  useEffect(() => {
    // Auto-fetch receiver address when destination chain changes
    const fetchDestinationAddress = async () => {
      if (!selectedDestChain || !walletConnected) return;

      try {
        const destChain = connectedChains.find(c => c.chainId === selectedDestChain);
        if (!destChain) return;

        // Get destination chain ID from chain registry or use default
        let destChainId = destChain.chainId;
        
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
        destChainId = chainIdMap[normalizedName] || destChainId;

        // Try to get address for destination chain from Keplr
        if (typeof window !== 'undefined' && (window as any).keplr) {
          try {
            await (window as any).keplr.enable(destChainId);
            const offlineSigner = await (window as any).keplr.getOfflineSigner(destChainId);
            const accounts = await offlineSigner.getAccounts();
            if (accounts.length > 0) {
              setReceiverAddress(accounts[0].address);
              }
          } catch (error) {
            // Fallback: use same address (will work for same key)
            setReceiverAddress(walletAddress);
          }
        }
      } catch (error) {
        console.error('Error fetching destination address:', error);
      }
    };

    fetchDestinationAddress();
  }, [selectedDestChain, walletConnected, connectedChains, walletAddress]);

  const connectWallet = async () => {
    if (typeof window === 'undefined' || !(window as any).keplr) {
      alert('Please install Keplr wallet extension');
      return;
    }

    try {
      const chainId = sourceChain.chain_id;
      await (window as any).keplr.enable(chainId);
      const offlineSigner = await (window as any).keplr.getOfflineSigner(chainId);
      const accounts = await offlineSigner.getAccounts();
      
      if (accounts.length > 0) {
        setWalletConnected(true);
        setWalletAddress(accounts[0].address);
        
        // Fetch balance
        try {
          const { SigningStargateClient } = await import('@cosmjs/stargate');
          
          const rpcEndpoint = sourceChain.rpc[0]?.address || sourceChain.rpc[0];
          const client = await SigningStargateClient.connectWithSigner(
            typeof rpcEndpoint === 'string' ? rpcEndpoint : rpcEndpoint.address,
            offlineSigner
          );
          const bal = await client.getBalance(accounts[0].address, sourceChain.assets[0].base);
          const formatted = (parseInt(bal.amount) / 1e6).toFixed(6);
          setBalance(formatted);
        } catch (error) {
          console.error('Balance fetch error:', error);
        }
      }
    } catch (error) {
      console.error('Wallet connection error:', error);
      alert('Failed to connect wallet');
    }
  };

  const handleTransfer = async () => {
    if (!walletConnected || !selectedDestChain || !amount || !receiverAddress) {
      alert('Please fill all fields and connect wallet');
      return;
    }

    setIsProcessing(true);
    setTxStatus('idle');
    setTxMessage('');

    try {
      // Get destination chain info
      const destChain = connectedChains.find(c => c.chainId === selectedDestChain);
      if (!destChain) throw new Error('Destination chain not found');

      // Initialize Keplr
      const chainId = sourceChain.chain_id;
      await (window as any).keplr.enable(chainId);
      const offlineSigner = await (window as any).keplr.getOfflineSigner(chainId);
      const accounts = await offlineSigner.getAccounts();
      const senderAddress = accounts[0].address;

      // Get IBC channel info from API
      const response = await fetch(`/api/ibc/channels?sourceChain=${sourceChain.chain_name}&destChain=${destChain.chainName}`);
      const channelData = await response.json();
      
      if (!channelData.channel) {
        // If no channel found, show available destinations
        const availableMsg = channelData.availableDestinations?.length > 0
          ? `Available destinations: ${channelData.availableDestinations.join(', ')}`
          : 'No IBC channels configured for this chain yet';
        throw new Error(`No IBC channel found. ${availableMsg}`);
      }

      // Create IBC transfer message
      const { SigningStargateClient } = await import('@cosmjs/stargate');
      
      const rpcEndpoint = sourceChain.rpc[0]?.address || sourceChain.rpc[0];
      const client = await SigningStargateClient.connectWithSigner(
        typeof rpcEndpoint === 'string' ? rpcEndpoint : rpcEndpoint.address,
        offlineSigner
      );

      // Use sendIbcTokens helper method (built-in IBC transfer)
      const timeoutTimestamp = Math.floor(Date.now() / 1000) + 600; // 10 minutes

      const result = await client.sendIbcTokens(
        senderAddress,
        receiverAddress, // Use user-provided receiver address
        {
          denom: sourceChain.assets[0].base,
          amount: (parseFloat(amount) * 1e6).toString(),
        },
        'transfer',
        channelData.channel,
        undefined, // timeoutHeight
        Math.floor(Date.now() / 1000) * 1e9 + 600 * 1e9, // timeoutTimestamp in nanoseconds
        {
          amount: [{ denom: sourceChain.assets[0].base, amount: '5000' }],
          gas: '200000',
        },
        '' // memo
      );

      if (result.code === 0) {
        setTxStatus('success');
        setTxMessage(`Transfer successful! Tx: ${result.transactionHash}`);
        setAmount('');
        setReceiverAddress('');
      } else {
        throw new Error(result.rawLog || 'Transaction failed');
      }
    } catch (error: any) {
      console.error('Transfer error:', error);
      setTxStatus('error');
      setTxMessage(error.message || 'Transfer failed');
    } finally {
      setIsProcessing(false);
    }
  };

  const selectedChainInfo = connectedChains.find(c => c.chainId === selectedDestChain);

  return (
    <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-blue-500/10 rounded-lg">
          <ArrowRightLeft className="w-6 h-6 text-blue-500" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">IBC Bridge</h2>
          <p className="text-gray-400 text-sm">Transfer assets between chains</p>
        </div>
      </div>

      {/* Wallet Connection */}
      {!walletConnected ? (
        <button
          onClick={connectWallet}
          className="w-full bg-blue-500 hover:bg-blue-600 text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          <Wallet className="w-5 h-5" />
          Connect Keplr Wallet
        </button>
      ) : (
        <div className="space-y-4">
          {/* Connected Wallet */}
          <div className="bg-[#111111] border border-gray-800 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span className="text-gray-400 text-sm">Connected</span>
              </div>
              <span className="text-white text-sm font-mono">
                {walletAddress.slice(0, 10)}...{walletAddress.slice(-8)}
              </span>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-gray-800">
              <span className="text-gray-500 text-xs">Balance</span>
              <span className="text-white text-sm font-medium">
                {balance} {sourceChain.assets[0]?.symbol || 'TOKEN'}
              </span>
            </div>
          </div>

          {/* Source Chain */}
          <div className="bg-[#111111] border border-gray-800 rounded-lg p-4">
            <label className="text-gray-400 text-sm mb-2 block">From</label>
            <div className="flex items-center gap-3">
              <img 
                src={sourceChain.logo} 
                alt={sourceChain.chain_name}
                className="w-8 h-8 rounded-full"
              />
              <div>
                <div className="text-white font-medium">{sourceChain.chain_name}</div>
                <div className="text-gray-500 text-xs">{sourceChain.chain_id}</div>
              </div>
            </div>
          </div>

          {/* Arrow */}
          <div className="flex justify-center">
            <div className="p-2 bg-[#111111] border border-gray-800 rounded-full">
              <ArrowDown className="w-5 h-5 text-gray-400" />
            </div>
          </div>

          {/* Destination Chain */}
          <div className="bg-[#111111] border border-gray-800 rounded-lg p-4">
            <label className="text-gray-400 text-sm mb-2 block">To</label>
            <select
              value={selectedDestChain}
              onChange={(e) => setSelectedDestChain(e.target.value)}
              className="w-full bg-[#0a0a0a] border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500"
            >
              <option value="">Select destination chain</option>
              {connectedChains.map((chain) => (
                <option key={chain.chainId} value={chain.chainId}>
                  {chain.chainName}
                </option>
              ))}
            </select>
            {selectedChainInfo && (
              <div className="flex items-center gap-3 mt-3 pt-3 border-t border-gray-800">
                {selectedChainInfo.logo ? (
                  <img 
                    src={selectedChainInfo.logo} 
                    alt={selectedChainInfo.chainName}
                    className="w-6 h-6 rounded-full"
                  />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-purple-500" />
                )}
                <span className="text-gray-400 text-sm">{selectedChainInfo.chainName}</span>
              </div>
            )}
          </div>

          {/* Amount */}
          <div className="bg-[#111111] border border-gray-800 rounded-lg p-4">
            <label className="text-gray-400 text-sm mb-2 block">Amount</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="flex-1 bg-[#0a0a0a] border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500"
                step="0.000001"
                min="0"
              />
              <span className="text-gray-400 font-medium">
                {sourceChain.assets[0]?.symbol || 'TOKEN'}
              </span>
            </div>
          </div>

          {/* Receiver Address */}
          <div className="bg-[#111111] border border-gray-800 rounded-lg p-4">
            <label className="text-gray-400 text-sm mb-2 block">Receiver Address</label>
            <input
              type="text"
              value={receiverAddress}
              onChange={(e) => setReceiverAddress(e.target.value)}
              placeholder="osmo1... or same address"
              className="w-full bg-[#0a0a0a] border border-gray-700 rounded-lg px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-blue-500"
            />
            <button
              onClick={() => setReceiverAddress(walletAddress)}
              className="mt-2 text-blue-400 hover:text-blue-300 text-xs"
            >
              Use my address
            </button>
          </div>

          {/* Transfer Button */}
          <button
            onClick={handleTransfer}
            disabled={isProcessing || !selectedDestChain || !amount}
            className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <ArrowRightLeft className="w-5 h-5" />
                Transfer
              </>
            )}
          </button>

          {/* Status Messages */}
          {txStatus === 'success' && (
            <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="text-green-400 font-medium mb-1">Success!</div>
                  <div className="text-green-300 text-sm">{txMessage}</div>
                </div>
              </div>
            </div>
          )}

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
          <div className="bg-blue-500/5 border border-blue-500/10 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="text-blue-300 text-xs">
                <p className="mb-1 font-medium">Important Notes:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>IBC transfers typically take 1-3 minutes to complete</li>
                  <li>Make sure you have enough tokens for transaction fees</li>
                  <li>Verify the IBC channel is correct before transferring large amounts</li>
                  <li>Test with small amounts first</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
