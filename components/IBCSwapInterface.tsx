'use client';

import { useState, useEffect } from 'react';
import { Repeat, Wallet, AlertCircle, CheckCircle, Loader2, TrendingUp } from 'lucide-react';
import { ChainData } from '@/types/chain';

interface IBCSwapInterfaceProps {
  chain: ChainData;
}

interface Token {
  denom: string;
  symbol: string;
  name: string;
  decimals: number;
  logo?: string;
}

export default function IBCSwapInterface({ chain }: IBCSwapInterfaceProps) {
  const [fromToken, setFromToken] = useState<string>('');
  const [toToken, setToToken] = useState<string>('');
  const [fromAmount, setFromAmount] = useState('');
  const [toAmount, setToAmount] = useState('');
  const [walletConnected, setWalletConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState('');
  const [balance, setBalance] = useState('0');
  const [isProcessing, setIsProcessing] = useState(false);
  const [txStatus, setTxStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [txMessage, setTxMessage] = useState('');
  const [availableTokens, setAvailableTokens] = useState<Token[]>([]);
  const [slippage, setSlippage] = useState('0.5');

  useEffect(() => {
    // Load available tokens
    const tokens: Token[] = [
      {
        denom: chain.assets[0]?.base || 'utoken',
        symbol: chain.assets[0]?.symbol || 'TOKEN',
        name: chain.assets[0]?.symbol || 'Native Token',
        decimals: 6,
      },
      // Add more tokens from IBC connections
      {
        denom: 'ibc/OSMOSIS',
        symbol: 'OSMO',
        name: 'Osmosis',
        decimals: 6,
      },
      {
        denom: 'ibc/ATOM',
        symbol: 'ATOM',
        name: 'Cosmos Hub',
        decimals: 6,
      },
    ];
    setAvailableTokens(tokens);
    
    // Set default tokens
    if (tokens.length >= 2) {
      setFromToken(tokens[0].denom);
      setToToken(tokens[1].denom);
    }
  }, [chain]);

  useEffect(() => {
    // Check if Keplr wallet is connected
    const checkWallet = async () => {
      if (typeof window !== 'undefined' && (window as any).keplr) {
        try {
          const chainId = chain.chain_id;
          await (window as any).keplr.enable(chainId);
          const offlineSigner = await (window as any).keplr.getOfflineSigner(chainId);
          const accounts = await offlineSigner.getAccounts();
          if (accounts.length > 0) {
            setWalletConnected(true);
            setWalletAddress(accounts[0].address);
            
            // Fetch balance
            try {
              const { SigningStargateClient } = await import('@cosmjs/stargate');
              
              const rpcEndpoint = chain.rpc[0]?.address || chain.rpc[0];
              const client = await SigningStargateClient.connectWithSigner(
                typeof rpcEndpoint === 'string' ? rpcEndpoint : rpcEndpoint.address,
                offlineSigner
              );
              const bal = await client.getBalance(accounts[0].address, chain.assets[0].base);
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
  }, [chain]);

  useEffect(() => {
    // Calculate estimated output amount
    if (fromAmount && fromToken && toToken) {
      // Simple mock calculation - in production, fetch from DEX API
      const rate = 0.95; // Mock exchange rate
      const estimated = (parseFloat(fromAmount) * rate).toFixed(6);
      setToAmount(estimated);
    } else {
      setToAmount('');
    }
  }, [fromAmount, fromToken, toToken]);

  const connectWallet = async () => {
    if (typeof window === 'undefined' || !(window as any).keplr) {
      alert('Please install Keplr wallet extension');
      return;
    }

    try {
      const chainId = chain.chain_id;
      await (window as any).keplr.enable(chainId);
      const offlineSigner = await (window as any).keplr.getOfflineSigner(chainId);
      const accounts = await offlineSigner.getAccounts();
      
      if (accounts.length > 0) {
        setWalletConnected(true);
        setWalletAddress(accounts[0].address);
        
        // Fetch balance
        try {
          const { SigningStargateClient } = await import('@cosmjs/stargate');
          
          const rpcEndpoint = chain.rpc[0]?.address || chain.rpc[0];
          const client = await SigningStargateClient.connectWithSigner(
            typeof rpcEndpoint === 'string' ? rpcEndpoint : rpcEndpoint.address,
            offlineSigner
          );
          const bal = await client.getBalance(accounts[0].address, chain.assets[0].base);
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

  const handleSwap = async () => {
    if (!walletConnected || !fromToken || !toToken || !fromAmount) {
      alert('Please fill all fields and connect wallet');
      return;
    }

    setIsProcessing(true);
    setTxStatus('idle');
    setTxMessage('');

    try {
      // Initialize Keplr
      const chainId = chain.chain_id;
      await (window as any).keplr.enable(chainId);
      const offlineSigner = await (window as any).keplr.getOfflineSigner(chainId);
      const accounts = await offlineSigner.getAccounts();
      const senderAddress = accounts[0].address;

      const { SigningStargateClient } = await import('@cosmjs/stargate');
      
      const rpcEndpoint = chain.rpc[0]?.address || chain.rpc[0];
      const client = await SigningStargateClient.connectWithSigner(
        typeof rpcEndpoint === 'string' ? rpcEndpoint : rpcEndpoint.address,
        offlineSigner
      );

      // Check if chain has poolmanager (Osmosis-based chains)
      const isOsmosis = chain.chain_name.toLowerCase().includes('osmosis') || 
                        chain.chain_id?.toLowerCase().includes('osmosis');

      if (isOsmosis) {
        // Use Osmosis poolmanager swap
        const swapMsg = {
          typeUrl: '/osmosis.poolmanager.v1beta1.MsgSwapExactAmountIn',
          value: {
            sender: senderAddress,
            routes: [
              {
                poolId: '1',
                tokenOutDenom: toToken,
              }
            ],
            tokenIn: {
              denom: fromToken,
              amount: (parseFloat(fromAmount) * 1e6).toString(),
            },
            tokenOutMinAmount: (parseFloat(toAmount) * (1 - parseFloat(slippage) / 100) * 1e6).toString(),
          },
        };

        const fee = {
          amount: [{ denom: chain.assets[0].base, amount: '5000' }],
          gas: '300000',
        };

        const result = await client.signAndBroadcast(senderAddress, [swapMsg], fee);

        if (result.code === 0) {
          setTxStatus('success');
          setTxMessage(`Swapped ${fromAmount} ${fromTokenInfo?.symbol} for ${toAmount} ${toTokenInfo?.symbol}. Tx: ${result.transactionHash}`);
        } else {
          throw new Error(result.rawLog || 'Swap failed');
        }
      } else {
        // For non-Osmosis chains, show info message
        setTxStatus('error');
        setTxMessage(`Swap functionality is only available on Osmosis-based chains. This chain (${chain.chain_name}) does not support native swaps yet.`);
        setIsProcessing(false);
        return;
      }

      setFromAmount('');
      setToAmount('');
      
      // Refresh balance
      try {
        const bal = await client.getBalance(senderAddress, chain.assets[0].base);
        const formatted = (parseInt(bal.amount) / 1e6).toFixed(6);
        setBalance(formatted);
      } catch (error) {
        console.error('Balance refresh error:', error);
      }
    } catch (error: any) {
      console.error('Swap error:', error);
      setTxStatus('error');
      setTxMessage(error.message || 'Swap failed');
    } finally {
      setIsProcessing(false);
    }
  };

  const switchTokens = () => {
    const tempToken = fromToken;
    setFromToken(toToken);
    setToToken(tempToken);
    setFromAmount('');
    setToAmount('');
  };

  const fromTokenInfo = availableTokens.find(t => t.denom === fromToken);
  const toTokenInfo = availableTokens.find(t => t.denom === toToken);

  return (
    <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-purple-500/10 rounded-lg">
          <Repeat className="w-6 h-6 text-purple-500" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">Swap</h2>
          <p className="text-gray-400 text-sm">Exchange tokens instantly</p>
        </div>
      </div>

      {!walletConnected ? (
        <button
          onClick={connectWallet}
          className="w-full bg-purple-500 hover:bg-purple-600 text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
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
                {balance} {chain.assets[0]?.symbol || 'TOKEN'}
              </span>
            </div>
          </div>

          {/* From Token */}
          <div className="bg-[#111111] border border-gray-800 rounded-lg p-4">
            <label className="text-gray-400 text-sm mb-2 block">From</label>
            <div className="flex items-center gap-2 mb-3">
              <select
                value={fromToken}
                onChange={(e) => setFromToken(e.target.value)}
                className="flex-1 bg-[#0a0a0a] border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple-500"
              >
                {availableTokens.map((token) => (
                  <option key={token.denom} value={token.denom}>
                    {token.symbol}
                  </option>
                ))}
              </select>
            </div>
            <input
              type="number"
              value={fromAmount}
              onChange={(e) => setFromAmount(e.target.value)}
              placeholder="0.00"
              className="w-full bg-[#0a0a0a] border border-gray-700 rounded-lg px-4 py-3 text-white text-lg focus:outline-none focus:border-purple-500"
              step="0.000001"
              min="0"
            />
            {fromTokenInfo && (
              <div className="text-gray-500 text-xs mt-2">{fromTokenInfo.name}</div>
            )}
          </div>

          {/* Switch Button */}
          <div className="flex justify-center -my-2 relative z-10">
            <button
              onClick={switchTokens}
              className="p-2 bg-[#1a1a1a] border-2 border-gray-800 rounded-full hover:border-purple-500 transition-colors"
            >
              <Repeat className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          {/* To Token */}
          <div className="bg-[#111111] border border-gray-800 rounded-lg p-4">
            <label className="text-gray-400 text-sm mb-2 block">To (estimated)</label>
            <div className="flex items-center gap-2 mb-3">
              <select
                value={toToken}
                onChange={(e) => setToToken(e.target.value)}
                className="flex-1 bg-[#0a0a0a] border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple-500"
              >
                {availableTokens.map((token) => (
                  <option key={token.denom} value={token.denom}>
                    {token.symbol}
                  </option>
                ))}
              </select>
            </div>
            <input
              type="text"
              value={toAmount}
              readOnly
              placeholder="0.00"
              className="w-full bg-[#0a0a0a] border border-gray-700 rounded-lg px-4 py-3 text-white text-lg focus:outline-none cursor-not-allowed"
            />
            {toTokenInfo && (
              <div className="text-gray-500 text-xs mt-2">{toTokenInfo.name}</div>
            )}
          </div>

          {/* Slippage Settings */}
          <div className="bg-[#111111] border border-gray-800 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <label className="text-gray-400 text-sm">Slippage Tolerance</label>
              <div className="flex items-center gap-2">
                {['0.5', '1', '3'].map((value) => (
                  <button
                    key={value}
                    onClick={() => setSlippage(value)}
                    className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                      slippage === value
                        ? 'bg-purple-500 text-white'
                        : 'bg-[#0a0a0a] text-gray-400 hover:text-white'
                    }`}
                  >
                    {value}%
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Swap Button */}
          <button
            onClick={handleSwap}
            disabled={isProcessing || !fromAmount || !toAmount}
            className="w-full bg-purple-500 hover:bg-purple-600 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Swapping...
              </>
            ) : (
              <>
                <Repeat className="w-5 h-5" />
                Swap
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
          <div className="bg-purple-500/5 border border-purple-500/10 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <TrendingUp className="w-4 h-4 text-purple-400 flex-shrink-0 mt-0.5" />
              <div className="text-purple-300 text-xs">
                <p>Prices are estimated. Slippage tolerance protects you from price changes during execution.</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
