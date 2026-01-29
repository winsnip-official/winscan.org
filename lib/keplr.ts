import { ChainData } from '@/types/chain';
import { 
  signTransactionForEvm, 
  broadcastTransaction,
  fetchAccountWithEthSupport 
} from './evmSigning';

// Helper to get gov module type URL based on chain
function getGovMsgVoteTypeUrl(chainId: string): string {
  // All chains use standard cosmos gov v1beta1 for client-side signing
  // Backend API will handle the routing to correct module (atomone/cosmos)
  return '/cosmos.gov.v1beta1.MsgVote';
}

// Try multiple vote methods with fallback
async function tryVoteWithFallback(
  client: any,
  voterAddress: string,
  proposalId: string,
  option: number,
  fee: any,
  memo: string,
  chainId: string
) {
  const voteMethods = [
    {
      name: 'cosmos.gov.v1beta1',
      typeUrl: '/cosmos.gov.v1beta1.MsgVote',
    },
    {
      name: 'cosmos.gov.v1',
      typeUrl: '/cosmos.gov.v1.MsgVote',
    },
  ];

  // Add atomone specific if needed
  if (chainId.includes('atomone')) {
    voteMethods.unshift({
      name: 'atomone.gov.v1beta1',
      typeUrl: '/atomone.gov.v1beta1.MsgVote',
    });
  }

  let lastError;
  for (const method of voteMethods) {
    try {
      console.log(`Trying vote with ${method.name}...`);
      
      const voteMsg = {
        typeUrl: method.typeUrl,
        value: {
          proposalId: proposalId,
          voter: voterAddress,
          option: option,
        },
      };

      const result = await client.signAndBroadcast(
        voterAddress,
        [voteMsg],
        fee,
        memo
      );

      if (result.code === 0) {
        console.log(`✅ Vote successful with ${method.name}`);
        return { success: true, txHash: result.transactionHash, method: method.name };
      } else {
        console.log(`Failed with ${method.name}: ${result.rawLog}`);
        lastError = result.rawLog;
      }
    } catch (err: any) {
      console.log(`Error with ${method.name}: ${err.message}`);
      lastError = err.message;
      continue;
    }
  }

  return { success: false, error: lastError || 'All vote methods failed' };
}

export function calculateFee(chain: ChainData, gasLimit: string): { amount: Array<{ denom: string; amount: string }>; gas: string } {
  const denom = chain.assets?.[0]?.base || 'uatom';
  const exponent = parseInt(String(chain.assets?.[0]?.exponent || '6'));
  
  // CRITICAL: Lumen chain requires gasless transactions (zero fee)
  // Error: "gasless tx must have zero fee: invalid request" if fee is not zero
  if (chain.chain_id === 'lumen' || chain.chain_name === 'lumen-mainnet') {
    return {
      amount: [{ denom, amount: '0' }],
      gas: gasLimit,
    };
  }
  
  let feeAmount: string;
  
  // Priority 1: Use gas_price if specified
  if (chain.gas_price) {
    const gasPricePerUnit = parseFloat(chain.gas_price);
    const gasLimitNum = parseFloat(gasLimit);
    feeAmount = Math.ceil(gasLimitNum * gasPricePerUnit).toString();
  } 
  // Priority 2: Use fixed_min_gas_price from fees.fee_tokens (e.g., Injective)
  else if ((chain as any).fees?.fee_tokens?.[0]?.fixed_min_gas_price) {
    const gasPricePerUnit = parseFloat(String((chain as any).fees.fee_tokens[0].fixed_min_gas_price));
    const gasLimitNum = parseFloat(gasLimit);
    feeAmount = Math.ceil(gasLimitNum * gasPricePerUnit).toString();
  }
  // Priority 3: Use low_gas_price as fallback
  else if ((chain as any).fees?.fee_tokens?.[0]?.low_gas_price) {
    const gasPricePerUnit = parseFloat(String((chain as any).fees.fee_tokens[0].low_gas_price));
    const gasLimitNum = parseFloat(gasLimit);
    feeAmount = Math.ceil(gasLimitNum * gasPricePerUnit).toString();
  }
  // Priority 4: Calculate based on exponent for tokens with high decimals
  else if (exponent >= 18) {
    const gasLimitNum = parseFloat(gasLimit);
    // For 18 decimal tokens: default to 0.00025 per gas unit
    const minFee = parseFloat(chain.min_tx_fee || '0.00025');
    const multiplier = Math.pow(10, exponent);
    feeAmount = Math.ceil(gasLimitNum * minFee * multiplier).toString();
  } else if (exponent >= 12) {
    const minFee = parseFloat(chain.min_tx_fee || '0.025');
    const multiplier = Math.pow(10, exponent - 6);
    const baseFee = parseFloat(gasLimit) * minFee * multiplier;
    feeAmount = Math.ceil(baseFee * 2).toString();
  } else {
    const minFee = parseFloat(chain.min_tx_fee || '0.025');
    feeAmount = Math.ceil(parseFloat(gasLimit) * minFee).toString();
  }
  
  return {
    amount: [{ denom, amount: feeAmount }],
    gas: gasLimit,
  };
}

async function createEvmAccountParser() {
  try {
    const { accountFromAny } = await import('@cosmjs/stargate');
    
    return (input: any) => {
      try {
        if (input.typeUrl === '/ethermint.types.v1.EthAccount') {
          console.log('🔍 Parsing EthAccount (Amino mode - will query from chain)');
          
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
}

async function createEvmRegistry() {
  try {
    const { defaultRegistryTypes } = await import('@cosmjs/stargate');
    const { Registry } = await import('@cosmjs/proto-signing');
    
    if (typeof Registry !== 'function') {
      console.warn('Registry is not a constructor, using default registry');
      return null;
    }
    
    const registry = new Registry(defaultRegistryTypes);
    
    console.log('✅ Created EVM-compatible registry with default types');
    return registry;
  } catch (error) {
    console.error('Error creating EVM registry:', error);
    return null;
  }
}

// Create registry with custom gov module support (for AtomOne, etc)
async function createCustomGovRegistry(chainId: string) {
  try {
    const { defaultRegistryTypes } = await import('@cosmjs/stargate');
    const { Registry } = await import('@cosmjs/proto-signing');
    
    if (typeof Registry !== 'function') {
      console.warn('Registry is not a constructor, using default registry');
      return null;
    }
    
    const registry = new Registry(defaultRegistryTypes);
    
    // For AtomOne: map cosmos.gov types to atomone.gov
    if (chainId.includes('atomone')) {
      console.log('Creating AtomOne-compatible registry...');
      
      // Get the MsgVote type from default registry
      const msgVoteType = (registry as any).lookupType?.('/cosmos.gov.v1beta1.MsgVote');
      
      if (msgVoteType) {
        // Register AtomOne gov types using same structure as Cosmos
        try {
          registry.register('/atomone.gov.v1beta1.MsgVote', msgVoteType);
          console.log('✅ Registered /atomone.gov.v1beta1.MsgVote');
        } catch (err) {
          console.warn('Could not register AtomOne types, will use cosmos types');
        }
      }
    }
    
    console.log('✅ Created custom gov registry');
    return registry;
  } catch (error) {
    console.error('Error creating custom gov registry:', error);
    return null;
  }
}

export interface KeplrChainInfo {
  chainId: string;
  chainName: string;
  rpc: string;
  rest: string;
  bip44: {
    coinType: number;
  };
  bech32Config: {
    bech32PrefixAccAddr: string;
    bech32PrefixAccPub: string;
    bech32PrefixValAddr: string;
    bech32PrefixValPub: string;
    bech32PrefixConsAddr: string;
    bech32PrefixConsPub: string;
  };
  currencies: Array<{
    coinDenom: string;
    coinMinimalDenom: string;
    coinDecimals: number;
    coinGeckoId?: string;
    coinImageUrl?: string;
  }>;
  feeCurrencies: Array<{
    coinDenom: string;
    coinMinimalDenom: string;
    coinDecimals: number;
    coinGeckoId?: string;
    coinImageUrl?: string;
    gasPriceStep?: {
      low: number;
      average: number;
      high: number;
    };
  }>;
  stakeCurrency: {
    coinDenom: string;
    coinMinimalDenom: string;
    coinDecimals: number;
    coinGeckoId?: string;
    coinImageUrl?: string;
  };
  features?: string[];
}
export interface KeplrAccount {
  address: string;
  algo: string;
  pubKey: Uint8Array;
  isNanoLedger: boolean;
}
export function convertChainToKeplr(chain: ChainData, coinType?: 118 | 60): KeplrChainInfo {
  // Auto-detect coin_type from chain config, fallback to 118 (Cosmos standard)
  const detectedCoinType = chain.coin_type ? parseInt(chain.coin_type) as (118 | 60) : 118;
  const finalCoinType = coinType ?? detectedCoinType;
  
  const prefix = chain.addr_prefix || (chain as any).bech32_prefix || 'cosmos';
  const primaryAsset = chain.assets?.[0];
  
  // Get fee token from fees.fee_tokens if available, otherwise use primaryAsset
  const feeToken = (chain as any).fees?.fee_tokens?.[0];
  const feeDenom = feeToken?.denom || primaryAsset?.base || 'uatom';
  const feeSymbol = primaryAsset?.symbol || 'ATOM';
  const feeDecimals = primaryAsset ? (typeof primaryAsset.exponent === 'string' ? parseInt(primaryAsset.exponent) : primaryAsset.exponent) : 6;
  
  // Use unique chainName for Axone mainnet to avoid conflicts with testnet
  let uniqueChainName = chain.chain_name;
  if (chain.chain_id === 'axone-1') {
    uniqueChainName = 'Axone';  // Keplr uses this as unique identifier
  }
  
  console.log('🔧 Converting chain to Keplr config:', {
    chain: chain.chain_name,
    chainId: chain.chain_id,
    uniqueChainName,
    configCoinType: chain.coin_type,
    detectedCoinType,
    finalCoinType,
    feeDenom,
    stakingDenom: primaryAsset?.base
  });
  
  return {
    chainId: chain.chain_id || chain.chain_name,
    chainName: uniqueChainName,
    rpc: chain.rpc?.[0]?.address || '',
    rest: chain.api?.[0]?.address || '',
    bip44: {
      coinType: finalCoinType,
    },
    bech32Config: {
      bech32PrefixAccAddr: prefix,
      bech32PrefixAccPub: `${prefix}pub`,
      bech32PrefixValAddr: `${prefix}valoper`,
      bech32PrefixValPub: `${prefix}valoperpub`,
      bech32PrefixConsAddr: `${prefix}valcons`,
      bech32PrefixConsPub: `${prefix}valconspub`,
    },
    // Map all assets to currencies
    currencies: chain.assets?.map(asset => ({
      coinDenom: asset.symbol,
      coinMinimalDenom: asset.base,
      coinDecimals: typeof asset.exponent === 'string' ? parseInt(asset.exponent) : asset.exponent,
      ...(asset.coingecko_id && { coinGeckoId: asset.coingecko_id }),
      ...(asset.logo && { coinImageUrl: asset.logo }),
    })) || [],
    // Map all fee tokens to feeCurrencies with gas prices
    feeCurrencies: ((chain as any).fees?.fee_tokens || []).map((feeToken: any) => {
      // Find matching asset for this fee token
      const matchingAsset = chain.assets?.find(a => a.base === feeToken.denom);
      return {
        coinDenom: matchingAsset?.symbol || feeToken.denom.toUpperCase(),
        coinMinimalDenom: feeToken.denom,
        coinDecimals: matchingAsset ? (typeof matchingAsset.exponent === 'string' ? parseInt(matchingAsset.exponent) : matchingAsset.exponent) : 6,
        ...(matchingAsset?.coingecko_id && { coinGeckoId: matchingAsset.coingecko_id }),
        ...(matchingAsset?.logo && { coinImageUrl: matchingAsset.logo }),
        gasPriceStep: {
          low: feeToken.low_gas_price || feeToken.fixed_min_gas_price || 0.01,
          average: feeToken.average_gas_price || (feeToken.low_gas_price * 1.5) || 0.025,
          high: feeToken.high_gas_price || (feeToken.low_gas_price * 2) || 0.04,
        },
      };
    }),
    stakeCurrency: primaryAsset ? {
      coinDenom: primaryAsset.symbol,
      coinMinimalDenom: primaryAsset.base,
      coinDecimals: typeof primaryAsset.exponent === 'string' ? parseInt(primaryAsset.exponent) : primaryAsset.exponent,
      ...(primaryAsset.coingecko_id && { coinGeckoId: primaryAsset.coingecko_id }),
      ...(primaryAsset.logo && { coinImageUrl: primaryAsset.logo }),
    } : {
      coinDenom: 'ATOM',
      coinMinimalDenom: 'uatom',
      coinDecimals: 6,
    },
    features: (() => {
      const baseFeatures = coinType === 60 ? ['eth-address-gen', 'eth-key-sign'] : [];
      
      // Kiichain uses ethsecp256k1 even with coin_type 118
      if (chain.chain_id === 'oro_1336-1' || chain.chain_name === 'kiichain-test') {
        return ['eth-address-gen', 'eth-key-sign'];
      }
      
      return baseFeatures;
    })(),
  };
}
export function isKeplrInstalled(): boolean {
  return typeof window !== 'undefined' && !!window.keplr;
}

export function isLeapInstalled(): boolean {
  return typeof window !== 'undefined' && !!(window as any).leap;
}

export function isCosmostationInstalled(): boolean {
  return typeof window !== 'undefined' && !!(window as any).cosmostation;
}

export function getKeplr() {
  if (!isKeplrInstalled()) {
    throw new Error('Keplr extension is not installed. Please install it from https://www.keplr.app/');
  }
  return window.keplr!;
}

export function getLeap() {
  if (!isLeapInstalled()) {
    throw new Error('Leap extension is not installed. Please install it from https://www.leapwallet.io/');
  }
  return (window as any).leap;
}

export function getCosmostation() {
  if (!isCosmostationInstalled()) {
    throw new Error('Cosmostation extension is not installed. Please install it from https://cosmostation.io/');
  }
  return (window as any).cosmostation;
}
export async function suggestChain(chainInfo: KeplrChainInfo): Promise<void> {
  const keplr = getKeplr();
  try {
    if (chainInfo.bip44.coinType === 60) {
      // @ts-ignore - Keplr internal property
      const chainInfoWithEvm = {
        ...chainInfo,
        features: chainInfo.features || ['eth-address-gen', 'eth-key-sign', 'ibc-transfer'],
      };
      await keplr.experimentalSuggestChain(chainInfoWithEvm);
    } else {
      await keplr.experimentalSuggestChain(chainInfo);
    }
  } catch (error) {
    console.error('Failed to suggest chain to Keplr:', error);
    throw error;
  }
}

export async function connectKeplr(
  chain: ChainData, 
  coinType?: 118 | 60
): Promise<KeplrAccount> {
  return connectWalletWithType(chain, coinType, 'keplr');
}

async function _connectWalletCore(
  wallet: any,
  chain: ChainData,
  coinType?: 118 | 60,
  walletType: 'keplr' | 'leap' | 'cosmostation' = 'keplr'
): Promise<KeplrAccount> {
  const chainInfo = convertChainToKeplr(chain, coinType);
  let chainId = chainInfo.chainId;
  
  // Auto-detect coinType from chain config if not provided
  const finalCoinType = coinType ?? (chain.coin_type ? parseInt(chain.coin_type) as (118 | 60) : 118);

  console.log(`🔍 connect${walletType.charAt(0).toUpperCase() + walletType.slice(1)} Debug:`, {
    chain_name: chain.chain_name,
    chain_id: chain.chain_id,
    computed_chainId: chainId,
    configCoinType: chain.coin_type,
    finalCoinType,
    walletType
  });

  const rpcEndpoint = chain.rpc?.[0]?.address;
  if (rpcEndpoint) {
    try {
      console.log('📡 Verifying chain ID from RPC:', rpcEndpoint);
      const statusResponse = await fetch(`${rpcEndpoint}/status`);
      if (statusResponse.ok) {
        const statusData = await statusResponse.json();
        const rpcChainId = statusData.result?.node_info?.network;
        
        console.log('📡 RPC Chain ID:', rpcChainId);
        console.log('🔑 Config Chain ID:', chainId);
        
        if (rpcChainId && rpcChainId !== chainId) {
          chainId = rpcChainId;
          chainInfo.chainId = rpcChainId;
        }
      }
    } catch (rpcError) {
      console.warn('Could not verify chain ID from RPC, using config chain ID:', rpcError);
    }
  }

  try {
    try {
      await wallet.enable(chainId);
    } catch (enableError: any) {
      // Handle disconnected port error from Keplr extension
      if (enableError.message?.includes('disconnected port') || enableError.message?.includes('Extension context invalidated')) {
        console.warn('⚠️ Wallet extension disconnected, waiting for reconnection...');
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Retry enable after waiting
        try {
          await wallet.enable(chainId);
          console.log('✅ Successfully reconnected after port disconnect');
        } catch (retryError: any) {
          throw new Error('Wallet extension disconnected. Please refresh the page and try again.');
        }
      }
      
      if (coinType === 60 && !chainInfo.features?.includes('eth-address-gen')) {
        chainInfo.features = ['eth-address-gen', 'eth-key-sign', 'ibc-transfer'];
        console.log('🔧 Added EVM features to chain suggestion');
      }
      
      // Force re-suggest for Axone to fix chain ID mismatch
      if (chainId === 'axone-1' || chain.chain_name.includes('axone')) {
        console.log('🔧 [AXONE] Starting Axone-specific connection flow...');
        console.log('🔧 [AXONE] chainInfo.chainId:', chainInfo.chainId);
        console.log('🔧 [AXONE] chainInfo.chainName:', chainInfo.chainName);
        
        try {
          // Suggest the chain first to ensure it exists in Keplr
          console.log('🔧 [AXONE] Suggesting chain to Keplr...');
          await wallet.experimentalSuggestChain(chainInfo);
          
          // Wait for Keplr to process
          await new Promise(resolve => setTimeout(resolve, 800));
          
          // Now enable with the EXACT chainId from chainInfo
          console.log('🔧 [AXONE] Enabling chain with chainId:', chainInfo.chainId);
          await wallet.enable(chainInfo.chainId);
          
          // Get key using chainId (not chainName)
          console.log('🔧 [AXONE] Getting key from Keplr...');
          const testKey = await wallet.getKey(chainInfo.chainId);
          console.log('✅ [AXONE] Got address from Keplr:', testKey.bech32Address);
          console.log('✅ [AXONE] PubKey:', Buffer.from(testKey.pubKey).toString('hex'));
          
          // CRITICAL: Derive address from PubKey to verify correctness
          const { pubkeyToAddress } = await import('@cosmjs/amino');
          const derivedAddress = pubkeyToAddress(
            {
              type: 'tendermint/PubKeySecp256k1',
              value: Buffer.from(testKey.pubKey).toString('base64'),
            },
            chain.addr_prefix || 'axone'
          );
          console.log('✅ [AXONE] Address derived from PubKey:', derivedAddress);
          console.log('✅ [AXONE] Addresses match?', testKey.bech32Address === derivedAddress ? 'YES ✅' : 'NO ❌');
          
          // Use DERIVED address (from PubKey) instead of Keplr's bech32Address
          const correctAddress = derivedAddress;
          
          // If we got here, skip the normal flow below and return immediately
          const result = {
            address: correctAddress,
            pubKey: testKey.pubKey,
            algo: testKey.algo as 'secp256k1' | 'eth_secp256k1',
            isNanoLedger: testKey.isNanoLedger || false,
          };
          
          console.log('✅ [AXONE] Returning Axone account:', result.address);
          return result;
          
        } catch (suggestError: any) {
          console.error('❌ [AXONE] Force suggest failed:', suggestError);
          console.error('❌ [AXONE] Error details:', suggestError.message);
          throw new Error(`Failed to configure Axone: ${suggestError.message}. Please remove Axone from Keplr (Settings → Manage Chain Visibility) and try again.`);
        }
      }
      
      // Use wallet-specific method for suggesting chain
      if (walletType === 'cosmostation') {
        await wallet.cosmos.request({
          method: 'cos_addChain',
          params: chainInfo,
        });
      } else {
        await wallet.experimentalSuggestChain(chainInfo);
      }
      console.log(`✅ Chain suggested successfully to ${walletType}`);
      
      await wallet.enable(chainId);
      console.log('✅ Chain enabled after suggestion:', chainId);
    }
    
    let key;
    try {
      if (walletType === 'cosmostation') {
        const account = await wallet.cosmos.request({
          method: 'cos_account',
          params: { chainName: chainId },
        });
        key = {
          bech32Address: account.address,
          algo: 'secp256k1',
          pubKey: new Uint8Array(Buffer.from(account.publicKey, 'hex')),
          isNanoLedger: false,
        };
      } else {
        key = await wallet.getKey(chainId);
      }
      console.log(`✅ ${walletType} key retrieved for address:`, key.bech32Address);
    } catch (keyError: any) {
      if (keyError.message?.includes('EthAccount') || keyError.message?.includes('Unsupported type')) {
        console.log('🔄 EthAccount type detected, reconnecting with EVM support...');
        
        const evmChainInfo = {
          ...chainInfo,
          features: ['eth-address-gen', 'eth-key-sign', 'ibc-transfer'],
        };
        
        if (walletType === 'cosmostation') {
          await wallet.cosmos.request({
            method: 'cos_addChain',
            params: evmChainInfo,
          });
        } else {
          await wallet.experimentalSuggestChain(evmChainInfo);
        }
        await new Promise(resolve => setTimeout(resolve, 500));
        await wallet.enable(chainId);
        
        if (walletType === 'cosmostation') {
          const account = await wallet.cosmos.request({
            method: 'cos_account',
            params: { chainName: chainId },
          });
          key = {
            bech32Address: account.address,
            algo: 'secp256k1',
            pubKey: new Uint8Array(Buffer.from(account.publicKey, 'hex')),
            isNanoLedger: false,
          };
        } else {
          key = await wallet.getKey(chainId);
        }
        console.log(`✅ ${walletType} key retrieved after EVM re-config:`, key.bech32Address);
      } else {
        throw keyError;
      }
    }
    
    return {
      address: key.bech32Address,
      algo: key.algo,
      pubKey: key.pubKey,
      isNanoLedger: key.isNanoLedger || false,
    };
  } catch (error: any) {
    console.error(`Failed to connect to ${walletType}:`, error);
    
    if (error.message?.includes('EthAccount') || error.message?.includes('Unsupported type')) {
      throw new Error(`EVM chain not fully supported in this wallet version. Please: 1) Update ${walletType} to latest version, 2) Clear browser cache, 3) Reconnect wallet. Error: ${error.message}`);
    }
    
    if (error.message?.includes('chain id') || error.message?.includes('signer')) {
      throw new Error(`Chain ID mismatch. Please try: 1) Disconnect ${walletType} wallet, 2) Clear browser cache, 3) Reconnect. Chain ID: ${chainId}`);
    }
    
    throw error;
  }
}

// Main wallet connection function with wallet type selection
export async function connectWalletWithType(
  chain: ChainData, 
  coinType?: 118 | 60,
  walletType: 'keplr' | 'leap' | 'cosmostation' = 'keplr'
): Promise<KeplrAccount> {
  let wallet: any;
  
  if (walletType === 'leap') {
    if (!isLeapInstalled()) {
      throw new Error('Leap extension is not installed');
    }
    wallet = getLeap();
  } else if (walletType === 'cosmostation') {
    if (!isCosmostationInstalled()) {
      throw new Error('Cosmostation extension is not installed');
    }
    wallet = getCosmostation();
  } else {
    if (!isKeplrInstalled()) {
      throw new Error('Keplr extension is not installed');
    }
    wallet = getKeplr();
  }
  
  return _connectWalletCore(wallet, chain, coinType, walletType);
}
export function disconnectKeplr(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('keplr_account');
    localStorage.removeItem('keplr_chain_id');
    localStorage.removeItem('keplr_coin_type');
  }
}
export function saveKeplrAccount(account: KeplrAccount, chainId: string, coinType: number): void {
  if (typeof window !== 'undefined') {
    try {
      // Only save essential data to avoid quota exceeded
      const essentialData = {
        address: account.address,
        chainId: chainId,
        coinType: coinType
      };
      localStorage.setItem('keplr_account', JSON.stringify(essentialData));
      localStorage.setItem('keplr_chain_id', chainId);
      localStorage.setItem('keplr_coin_type', coinType.toString());
    } catch (error: any) {
      console.warn('⚠️ Failed to save to localStorage (quota exceeded):', error.message);
      // Aggressive cleanup: remove non-essential items
      try {
        // Keep only essential keplr data, clear everything else
        const keysToKeep = ['keplr_account', 'keplr_chain_id', 'keplr_coin_type'];
        const keysToRemove: string[] = [];
        
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && !keysToKeep.includes(key)) {
            keysToRemove.push(key);
          }
        }
        
        // Remove non-essential items
        keysToRemove.forEach(key => localStorage.removeItem(key));
        
        // Now try to save again
        const essentialData = {
          address: account.address,
          chainId: chainId,
          coinType: coinType
        };
        localStorage.setItem('keplr_account', JSON.stringify(essentialData));
        localStorage.setItem('keplr_chain_id', chainId);
        localStorage.setItem('keplr_coin_type', coinType.toString());
        console.log('✅ Saved to localStorage after cleanup');
      } catch (retryError) {
        console.error('❌ Could not save wallet data even after cleanup');
        // Use sessionStorage as last resort
        try {
          sessionStorage.setItem('keplr_account', JSON.stringify({
            address: account.address,
            chainId: chainId,
            coinType: coinType
          }));
          console.log('✅ Saved to sessionStorage as fallback');
        } catch (sessionError) {
          console.error('❌ Failed to save to sessionStorage:', sessionError);
        }
      }
    }
  }
}
export function getSavedKeplrAccount(): { account: KeplrAccount; chainId: string; coinType: number } | null {
  if (typeof window !== 'undefined') {
    // Try localStorage first
    let accountStr = localStorage.getItem('keplr_account');
    let chainId = localStorage.getItem('keplr_chain_id');
    let coinTypeStr = localStorage.getItem('keplr_coin_type');
    
    // Fallback to sessionStorage if not in localStorage
    if (!accountStr) {
      accountStr = sessionStorage.getItem('keplr_account');
      // Try to get chainId and coinType from sessionStorage account data
      if (accountStr) {
        try {
          const sessionData = JSON.parse(accountStr);
          chainId = sessionData.chainId || chainId;
          coinTypeStr = sessionData.coinType?.toString() || coinTypeStr;
        } catch (e) {
          console.error('Failed to parse sessionStorage account data');
        }
      }
    }
    
    if (accountStr && chainId && coinTypeStr) {
      return {
        account: JSON.parse(accountStr),
        chainId,
        coinType: parseInt(coinTypeStr),
      };
    }
  }
  return null;
}
export function onKeplrAccountChange(callback: (accounts: KeplrAccount[]) => void): void {
  if (typeof window !== 'undefined' && window.keplr) {
    window.addEventListener('keplr_keystorechange', async () => {
      const saved = getSavedKeplrAccount();
      if (saved) {
        try {
          const key = await window.keplr!.getKey(saved.chainId);
          callback([{
            address: key.bech32Address,
            algo: key.algo,
            pubKey: key.pubKey,
            isNanoLedger: key.isNanoLedger,
          }]);
        } catch (error) {
          console.error('Failed to get updated account:', error);
          callback([]);
        }
      }
    });
  }
}
declare global {
  interface Window {
    keplr?: {
      enable: (chainId: string) => Promise<void>;
      getKey: (chainId: string) => Promise<{
        bech32Address: string;
        algo: string;
        pubKey: Uint8Array;
        isNanoLedger: boolean;
      }>;
      experimentalSuggestChain: (chainInfo: KeplrChainInfo) => Promise<void>;
      getOfflineSigner: (chainId: string) => any;
      getOfflineSignerAuto: (chainId: string) => Promise<any>;
      getOfflineSignerOnlyAmino: (chainId: string) => Promise<any>;
      signAmino: (chainId: string, signer: string, signDoc: any, signOptions?: any) => Promise<any>;
    };
    leap?: {
      enable: (chainId: string) => Promise<void>;
      getKey: (chainId: string) => Promise<{
        bech32Address: string;
        algo: string;
        pubKey: Uint8Array;
        isNanoLedger: boolean;
      }>;
      experimentalSuggestChain: (chainInfo: KeplrChainInfo) => Promise<void>;
      getOfflineSigner: (chainId: string) => any;
      getOfflineSignerAuto: (chainId: string) => Promise<any>;
    };
    cosmostation?: {
      cosmos: {
        request: (params: { method: string; params?: any }) => Promise<any>;
      };
      providers: {
        keplr: any;
      };
    };
  }
}

export async function executeStaking(
  chain: ChainData,
  type: 'delegate' | 'undelegate' | 'redelegate' | 'withdraw_rewards' | 'withdraw_commission' | 'withdraw',
  params: {
    delegatorAddress: string;
    validatorAddress: string;
    amount?: string;
    validatorDstAddress?: string;
  },
  gasLimit: string = '300000',
  memo: string = ''
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  try {
    if (!isKeplrInstalled()) {
      throw new Error('Keplr extension is not installed');
    }

    const keplr = window.keplr!;
    let chainId = (chain.chain_id || chain.chain_name).trim();
    
    console.log('🔍 executeStaking Debug:', {
      chain_name: chain.chain_name,
      chain_id: chain.chain_id,
      computed_chainId: chainId,
      type: type,
      params: params
    });
    
    try {
      await keplr.enable(chainId);
      console.log('✅ Chain enabled:', chainId);
    } catch (error: any) {
      if (error.message?.includes('There is no chain info')) {
        console.log('Chain not found in Keplr, suggesting chain...');
        const rpcEndpoint = chain.rpc?.[0]?.address || '';
        const apiEndpoint = chain.api?.[0]?.address || '';
        const coinType = parseInt(chain.coin_type || '118');
        
        // For EVM chains with coin_type 60, use special Keplr config
        const keplrChainInfo: any = {
          chainId: chainId,
          chainName: chain.chain_name,
          rpc: rpcEndpoint,
          rest: apiEndpoint,
          bip44: {
            coinType: coinType,
          },
          bech32Config: {
            bech32PrefixAccAddr: chain.addr_prefix || 'cosmos',
            bech32PrefixAccPub: `${chain.addr_prefix || 'cosmos'}pub`,
            bech32PrefixValAddr: `${chain.addr_prefix || 'cosmos'}valoper`,
            bech32PrefixValPub: `${chain.addr_prefix || 'cosmos'}valoperpub`,
            bech32PrefixConsAddr: `${chain.addr_prefix || 'cosmos'}valcons`,
            bech32PrefixConsPub: `${chain.addr_prefix || 'cosmos'}valconspub`,
          },
          currencies: [
            {
              coinDenom: chain.assets?.[0]?.symbol || 'ATOM',
              coinMinimalDenom: chain.assets?.[0]?.base || 'uatom',
              coinDecimals: parseInt(String(chain.assets?.[0]?.exponent || '6')),
            },
          ],
          feeCurrencies: [
            {
              coinDenom: chain.assets?.[0]?.symbol || 'ATOM',
              coinMinimalDenom: chain.assets?.[0]?.base || 'uatom',
              coinDecimals: parseInt(String(chain.assets?.[0]?.exponent || '6')),
              gasPriceStep: {
                low: 0.01,
                average: 0.025,
                high: 0.04,
              },
            },
          ],
          stakeCurrency: {
            coinDenom: chain.assets?.[0]?.symbol || 'ATOM',
            coinMinimalDenom: chain.assets?.[0]?.base || 'uatom',
            coinDecimals: parseInt(String(chain.assets?.[0]?.exponent || '6')),
          },
        };
        
        // Add EVM-specific features for coin_type 60
        if (coinType === 60) {
          keplrChainInfo.features = ['eth-address-gen', 'eth-key-sign'];
        } else {
          keplrChainInfo.features = ['ibc-transfer'];
        }
        
        await keplr.experimentalSuggestChain(keplrChainInfo);
        
        await keplr.enable(chainId);
      } else {
        throw error;
      }
    }
    
    // Detect EVM chain for proper signer selection
    const isEvmChain = chainId.includes('_');
    const coinType = parseInt(chain.coin_type || '118');
    
    // For EVM chains, use getOfflineSigner (Direct mode)
    const offlineSigner = isEvmChain 
      ? await keplr.getOfflineSigner(chainId)
      : await keplr.getOfflineSignerAuto(chainId);
    
    const accounts = await offlineSigner.getAccounts();
    if (accounts.length === 0) {
      throw new Error('No accounts found');
    }
    
    // @ts-ignore
    const { SigningStargateClient } = await import('@cosmjs/stargate');
    
    const rpcEndpoint = chain.rpc?.[0]?.address || '';
    if (!rpcEndpoint) {
      throw new Error('No RPC endpoint available');
    }    let actualSigner = offlineSigner;
    try {
      const statusResponse = await fetch(`${rpcEndpoint}/status`);
      const statusData = await statusResponse.json();
      const rpcChainId = statusData.result.node_info.network;
      console.log('📡 RPC Chain ID:', rpcChainId);
      console.log('🔑 Keplr Chain ID:', chainId);
      
      if (rpcChainId !== chainId) {
        console.warn(`⚠️ Chain ID mismatch! RPC: ${rpcChainId}, Keplr: ${chainId}`);
        console.log('🔄 Re-creating offline signer with correct chain ID...');
        
        chainId = rpcChainId;
        
        await keplr.enable(chainId);
        
        actualSigner = await keplr.getOfflineSignerAuto(chainId);
        const correctedAccounts = await actualSigner.getAccounts();
        console.log('✅ Corrected offline signer created for chain ID:', chainId);
        console.log('Corrected account:', correctedAccounts[0].address);
        console.log('Corrected pubkey:', correctedAccounts[0].pubkey);
      }
    } catch (fetchError) {
      console.warn('Could not fetch chain ID from RPC, continuing with existing chainId:', chainId);
    }
    
    const clientOptions: any = { 
      broadcastTimeoutMs: 30000, 
      broadcastPollIntervalMs: 3000,
    };
    
    // Add EVM support if needed
    if (isEvmChain) {
      console.log('🔧 Detected EVM chain, adding EthAccount support');
      
      const registry = await createEvmRegistry();
      const accountParser = await createEvmAccountParser();
      
      if (registry) {
        clientOptions.registry = registry;
        console.log('✅ Using custom EVM registry');
      }
      
      if (accountParser) {
        clientOptions.accountParser = accountParser;
        console.log('✅ Using custom EVM account parser');
      }
    }
    
    // Use robust client connection with automatic failover
    const { connectStargateClient } = await import('./cosmosClient');
    const client = await connectStargateClient(rpcEndpoint, actualSigner) as any;
    
    console.log('✅ SigningStargateClient connected');

    let msg: any;
    const denom = chain.assets?.[0]?.base || 'uatom';

    const txType = type === 'withdraw' ? 'withdraw_rewards' : type;

    switch (txType) {
      case 'delegate':
        msg = {
          typeUrl: '/cosmos.staking.v1beta1.MsgDelegate',
          value: {
            delegatorAddress: params.delegatorAddress,
            validatorAddress: params.validatorAddress,
            amount: {
              denom: denom,
              amount: params.amount || '0',
            },
          },
        };
        break;

      case 'undelegate':
        msg = {
          typeUrl: '/cosmos.staking.v1beta1.MsgUndelegate',
          value: {
            delegatorAddress: params.delegatorAddress,
            validatorAddress: params.validatorAddress,
            amount: {
              denom: denom,
              amount: params.amount || '0',
            },
          },
        };
        break;

      case 'redelegate':
        msg = {
          typeUrl: '/cosmos.staking.v1beta1.MsgBeginRedelegate',
          value: {
            delegatorAddress: params.delegatorAddress,
            validatorSrcAddress: params.validatorAddress,
            validatorDstAddress: params.validatorDstAddress || '',
            amount: {
              denom: denom,
              amount: params.amount || '0',
            },
          },
        };
        break;

      case 'withdraw_rewards':
        msg = {
          typeUrl: '/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward',
          value: {
            delegatorAddress: params.delegatorAddress,
            validatorAddress: params.validatorAddress,
          },
        };
        break;

      case 'withdraw_commission':
        msg = {
          typeUrl: '/cosmos.distribution.v1beta1.MsgWithdrawValidatorCommission',
          value: {
            validatorAddress: params.validatorAddress,
          },
        };
        break;

      default:
        throw new Error('Invalid staking type');
    }

    const fee = calculateFee(chain, gasLimit);

    if (isEvmChain) {
      
      try {
        const restEndpoint = chain.api[0]?.address || '';
        if (!restEndpoint) {
          throw new Error('No REST endpoint available');
        }
        
        // Sign transaction with EVM support
        const signedTx = await signTransactionForEvm(
          offlineSigner,
          chainId,
          restEndpoint,
          params.delegatorAddress,
          [msg],
          fee,
          memo,
          coinType,
          false // Disable auto-simulation to avoid double approval
        );
        
        // Broadcast transaction
        const result = await broadcastTransaction(restEndpoint, signedTx);
        
        return { success: true, txHash: result.txhash };
      } catch (evmError: any) {
        console.error('❌ EVM signing/broadcast failed:', evmError);
        return { success: false, error: evmError.message };
      }
    }

    // Standard Cosmos SDK signing for non-EVM chains
    const result = await client.signAndBroadcast(
      params.delegatorAddress,
      [msg],
      fee,
      memo
    );

    if (result.code === 0) {
      return { success: true, txHash: result.transactionHash };
    } else {
      return { success: false, error: result.rawLog };
    }
  } catch (error: any) {
    console.error('Staking error:', error);
    return { success: false, error: error.message || 'Transaction failed' };
  }
}

export async function executeWithdrawAll(
  chain: ChainData,
  params: {
    delegatorAddress: string;
    validatorAddress: string;
    hasRewards: boolean;
    hasCommission: boolean;
  },
  gasLimit: string = '300000',
  memo: string = ''
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  try {
    if (!isKeplrInstalled()) {
      throw new Error('Keplr extension is not installed');
    }

    const keplr = window.keplr!;
    let chainId = (chain.chain_id || chain.chain_name).trim();
    
    console.log('🔍 executeWithdrawAll:', {
      hasRewards: params.hasRewards,
      hasCommission: params.hasCommission,
      chainId: chainId
    });
    
    await keplr.enable(chainId);
    
    // Detect EVM chain for proper signer selection
    const isEvmChain = chainId.includes('_');
    
    // Use Direct signing for EVM chains (better ethsecp256k1 support)
    const offlineSigner = isEvmChain 
      ? await keplr.getOfflineSigner(chainId)
      : await keplr.getOfflineSignerAuto(chainId);
    
    console.log('✅ Signer type:', isEvmChain ? 'Direct (EVM)' : 'Auto');
    
    // @ts-ignore
    const { SigningStargateClient } = await import('@cosmjs/stargate');
    
    let rpcEndpoint = '';
    const rpcList = chain.rpc || [];
    
    for (const rpc of rpcList) {
      if (rpc.tx_index === 'on') {
        rpcEndpoint = rpc.address;
        console.log('✅ Using RPC with tx_index enabled:', rpcEndpoint);
        break;
      }
    }
    
    if (!rpcEndpoint && rpcList.length > 0) {
      rpcEndpoint = rpcList[0].address;
      console.warn('⚠️ No RPC with tx_index found, using first available:', rpcEndpoint);
    }
    
    if (!rpcEndpoint) {
      throw new Error('No RPC endpoint available');
    }

    let actualSigner = offlineSigner;
    try {
      const statusResponse = await fetch(`${rpcEndpoint}/status`);
      const statusData = await statusResponse.json();
      const rpcChainId = statusData.result.node_info.network;
      
      if (rpcChainId !== chainId) {
        chainId = rpcChainId;
        await keplr.enable(chainId);
        actualSigner = await keplr.getOfflineSignerAuto(chainId);
      }
    } catch (fetchError) {
      console.warn('Could not verify chain ID from RPC');
    }
    
    const clientOptions: any = {
      broadcastTimeoutMs: 30000,
      broadcastPollIntervalMs: 3000,
    };

    // Add EVM support if needed
    if (isEvmChain) {
      console.log('🔧 Detected EVM chain, adding EthAccount support');
      
      const registry = await createEvmRegistry();
      const accountParser = await createEvmAccountParser();      if (registry) {
        clientOptions.registry = registry;
        console.log('✅ Using custom EVM registry');
      }
      
      if (accountParser) {
        clientOptions.accountParser = accountParser;
        console.log('✅ Using custom EVM account parser');
      }
    }
    
    const client = await SigningStargateClient.connectWithSigner(
      rpcEndpoint,
      actualSigner,
      clientOptions
    );
    
    console.log('✅ Client connected for withdraw all');

    const messages: any[] = [];
    
    if (params.hasRewards) {
      messages.push({
        typeUrl: '/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward',
        value: {
          delegatorAddress: params.delegatorAddress,
          validatorAddress: params.validatorAddress,
        },
      });
      console.log('📝 Added withdraw rewards message');
    }
    
    if (params.hasCommission) {
      messages.push({
        typeUrl: '/cosmos.distribution.v1beta1.MsgWithdrawValidatorCommission',
        value: {
          validatorAddress: params.validatorAddress,
        },
      });
      console.log('📝 Added withdraw commission message');
    }

    if (messages.length === 0) {
      throw new Error('No messages to send');
    }

    const denom = chain.assets?.[0]?.base || 'uatom';
    const gasPrice = `0.025${denom}`;

    console.log('📤 Sending transaction with', messages.length, 'message(s)');

    const fee = calculateFee(chain, gasLimit);

    const coinType = parseInt(chain.coin_type || '118');
    // Use EVM signing for chains with underscore in chain_id (regardless of coin_type)
    if (isEvmChain) {
      console.log('🔥 Using EVM-specific signing for withdraw all (EVM chain detected)');
      
      try {
        const restEndpoint = chain.api[0]?.address || '';
        if (!restEndpoint) {
          throw new Error('No REST endpoint available');
        }
        
        const signedTx = await signTransactionForEvm(
          offlineSigner,
          chainId,
          restEndpoint,
          params.delegatorAddress,
          messages,
          fee,
          memo,
          coinType,
          false // Disable simulation
        );
        
        const result = await broadcastTransaction(restEndpoint, signedTx);
        
        console.log('✅ EVM transaction successful!');
        console.log('Transaction hash:', result.txhash);
        
        return { success: true, txHash: result.txhash };
      } catch (evmError: any) {
        console.error('❌ EVM signing/broadcast failed:', evmError);
        return { success: false, error: evmError.message };
      }
    }

    const result = await client.signAndBroadcast(
      params.delegatorAddress,
      messages,
      fee,
      memo
    );

    console.log('Transaction result:', result);

    if (result.code === 0) {
      console.log('✅ Withdraw all successful!');
      return { success: true, txHash: result.transactionHash };
    } else {
      console.error('❌ Withdraw all failed:', result.rawLog);
      return { success: false, error: result.rawLog };
    }
  } catch (error: any) {
    console.error('Withdraw all error:', error);
    return { success: false, error: error.message || 'Transaction failed' };
  }
}

export async function executeWithdrawAllValidators(
  chain: ChainData,
  params: {
    delegatorAddress: string;
    validatorAddresses: string[];
  },
  gasLimit: string = '500000',
  memo: string = ''
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  try {
    if (!isKeplrInstalled()) {
      throw new Error('Keplr extension is not installed');
    }

    const keplr = window.keplr!;
    let chainId = (chain.chain_id || chain.chain_name).trim();
    
    console.log('🔍 executeWithdrawAllValidators:', {
      validatorCount: params.validatorAddresses.length,
      chainId: chainId
    });
    
    await keplr.enable(chainId);
    
    // Detect EVM chain for proper signer selection
    const isEvmChain = chainId.includes('_');
    
    // Use Direct signing for EVM chains (better ethsecp256k1 support)
    const offlineSigner = isEvmChain 
      ? await keplr.getOfflineSigner(chainId)
      : await keplr.getOfflineSignerAuto(chainId);
    
    console.log('✅ Signer type:', isEvmChain ? 'Direct (EVM)' : 'Auto');
    
    // @ts-ignore
    const { SigningStargateClient } = await import('@cosmjs/stargate');
    
    let rpcEndpoint = '';
    const rpcList = chain.rpc || [];
    
    for (const rpc of rpcList) {
      if (rpc.tx_index === 'on') {
        rpcEndpoint = rpc.address;
        console.log('✅ Using RPC with tx_index enabled:', rpcEndpoint);
        break;
      }
    }
    
    if (!rpcEndpoint && rpcList.length > 0) {
      rpcEndpoint = rpcList[0].address;
      console.warn('⚠️ No RPC with tx_index found, using first available:', rpcEndpoint);
    }
    
    if (!rpcEndpoint) {
      throw new Error('No RPC endpoint available');
    }

    let actualSigner = offlineSigner;
    try {
      const statusResponse = await fetch(`${rpcEndpoint}/status`);
      const statusData = await statusResponse.json();
      const rpcChainId = statusData.result.node_info.network;
      
      if (rpcChainId !== chainId) {
        chainId = rpcChainId;
        await keplr.enable(chainId);
        // Re-detect if EVM chain after chainId correction
        const isEvmChainCorrected = chainId.includes('_');
        actualSigner = isEvmChainCorrected 
          ? await keplr.getOfflineSigner(chainId)
          : await keplr.getOfflineSignerAuto(chainId);
      }
    } catch (fetchError) {
      console.warn('Could not verify chain ID from RPC');
    }
    
    const clientOptions: any = { 
      broadcastTimeoutMs: 30000, 
      broadcastPollIntervalMs: 3000,
    };
    
    // Add EVM support if needed
    if (isEvmChain) {
      console.log('🔧 Detected EVM chain (executeWithdrawAllValidators), adding EthAccount support');
      
      const registry = await createEvmRegistry();
      const accountParser = await createEvmAccountParser();
      
      if (registry) {
        clientOptions.registry = registry;
        console.log('✅ Using custom EVM registry');
      }
      
      if (accountParser) {
        clientOptions.accountParser = accountParser;
        console.log('✅ Using custom EVM account parser');
      }
    }
    
    const client = await SigningStargateClient.connectWithSigner(
      rpcEndpoint,
      actualSigner,
      clientOptions
    );
    
    console.log('✅ Client connected for withdraw all validators');

    const messages: any[] = params.validatorAddresses.map(validatorAddress => ({
      typeUrl: '/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward',
      value: {
        delegatorAddress: params.delegatorAddress,
        validatorAddress: validatorAddress,
      },
    }));
    
    console.log('📝 Created', messages.length, 'withdraw reward messages');

    if (messages.length === 0) {
      throw new Error('No validators to withdraw from');
    }

    const denom = chain.assets?.[0]?.base || 'uatom';
    const gasPrice = `0.025${denom}`;

    console.log('📤 Sending transaction with', messages.length, 'message(s)');

    const fee = calculateFee(chain, gasLimit);

    const coinType = parseInt(chain.coin_type || '118');
    // Use EVM signing for chains with underscore in chain_id (regardless of coin_type)
    if (isEvmChain) {
      console.log('🔥 Using EVM-specific signing for withdraw all validators (EVM chain detected)');
      
      try {
        const restEndpoint = chain.api[0]?.address || '';
        if (!restEndpoint) {
          throw new Error('No REST endpoint available');
        }
        
        const signedTx = await signTransactionForEvm(
          offlineSigner,
          chainId,
          restEndpoint,
          params.delegatorAddress,
          messages,
          fee,
          memo,
          coinType,
          false // Disable simulation
        );
        
        const result = await broadcastTransaction(restEndpoint, signedTx);
        
        console.log('✅ EVM transaction successful!');
        console.log('Transaction hash:', result.txhash);
        
        return { success: true, txHash: result.txhash };
      } catch (evmError: any) {
        console.error('❌ EVM signing/broadcast failed:', evmError);
        return { success: false, error: evmError.message };
      }
    }

    const result = await client.signAndBroadcast(
      params.delegatorAddress,
      messages,
      fee,
      memo
    );

    console.log('Transaction result:', result);

    if (result.code === 0) {
      console.log('✅ Withdraw all validators successful!');
      return { success: true, txHash: result.transactionHash };
    } else {
      console.error('❌ Withdraw all validators failed:', result.rawLog);
      return { success: false, error: result.rawLog };
    }
  } catch (error: any) {
    console.error('Withdraw all validators error:', error);
    return { success: false, error: error.message || 'Transaction failed' };
  }
}

export async function executeSend(
  chain: ChainData,
  params: {
    fromAddress: string;
    toAddress: string;
    amount: string;
    denom: string;
  },
  gasLimit: string = '200000',
  memo: string = 'Integrate WinScan'
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  try {
    if (!isKeplrInstalled()) {
      throw new Error('Keplr extension is not installed');
    }

    const keplr = window.keplr!;
    let chainId = (chain.chain_id || chain.chain_name).trim();
    
    console.log('🔍 executeSend Debug:', {
      chain_name: chain.chain_name,
      chain_id: chain.chain_id,
      computed_chainId: chainId,
      params: params
    });
    
    try {
      await keplr.enable(chainId);
      console.log('✅ Chain enabled:', chainId);
    } catch (error: any) {
      if (error.message?.includes('There is no chain info')) {
        console.log('Chain not found in Keplr, suggesting chain...');
        const rpcEndpoint = chain.rpc?.[0]?.address || '';
        const apiEndpoint = chain.api?.[0]?.address || '';
        
        await keplr.experimentalSuggestChain({
          chainId: chainId,
          chainName: chain.chain_name,
          rpc: rpcEndpoint,
          rest: apiEndpoint,
          bip44: {
            coinType: parseInt(chain.coin_type || '118'),
          },
          bech32Config: {
            bech32PrefixAccAddr: chain.addr_prefix || 'cosmos',
            bech32PrefixAccPub: `${chain.addr_prefix || 'cosmos'}pub`,
            bech32PrefixValAddr: `${chain.addr_prefix || 'cosmos'}valoper`,
            bech32PrefixValPub: `${chain.addr_prefix || 'cosmos'}valoperpub`,
            bech32PrefixConsAddr: `${chain.addr_prefix || 'cosmos'}valcons`,
            bech32PrefixConsPub: `${chain.addr_prefix || 'cosmos'}valconspub`,
          },
          currencies: [
            {
              coinDenom: chain.assets?.[0]?.symbol || 'ATOM',
              coinMinimalDenom: chain.assets?.[0]?.base || 'uatom',
              coinDecimals: parseInt(String(chain.assets?.[0]?.exponent || '6')),
            },
          ],
          feeCurrencies: [
            {
              coinDenom: chain.assets?.[0]?.symbol || 'ATOM',
              coinMinimalDenom: chain.assets?.[0]?.base || 'uatom',
              coinDecimals: parseInt(String(chain.assets?.[0]?.exponent || '6')),
              gasPriceStep: {
                low: 0.01,
                average: 0.025,
                high: 0.04,
              },
            },
          ],
          stakeCurrency: {
            coinDenom: chain.assets?.[0]?.symbol || 'ATOM',
            coinMinimalDenom: chain.assets?.[0]?.base || 'uatom',
            coinDecimals: parseInt(String(chain.assets?.[0]?.exponent || '6')),
          },
        });
        
        await keplr.enable(chainId);
      } else {
        throw error;
      }
    }
    
    // Detect EVM chain for proper signer selection
    const isEvmChain = chainId.includes('_');
    
    // Use Direct signing for EVM chains (better ethsecp256k1 support)
    const offlineSigner = isEvmChain 
      ? await keplr.getOfflineSigner(chainId)
      : await keplr.getOfflineSignerAuto(chainId);
    
    const accounts = await offlineSigner.getAccounts();
    if (accounts.length === 0) {
      throw new Error('No accounts found');
    }
    
    console.log('✅ Offline signer created for chain ID:', chainId, isEvmChain ? '(Direct for EVM)' : '');
    console.log('Account address:', accounts[0].address);
    
    // @ts-ignore
    const { SigningStargateClient } = await import('@cosmjs/stargate');
    
    let rpcEndpoint = '';
    const rpcList = chain.rpc || [];
    
    for (const rpc of rpcList) {
      if (rpc.tx_index === 'on') {
        rpcEndpoint = rpc.address;
        console.log('✅ Using RPC with tx_index enabled:', rpcEndpoint);
        break;
      }
    }
    
    if (!rpcEndpoint && rpcList.length > 0) {
      rpcEndpoint = rpcList[0].address;
      console.warn('⚠️ No RPC with tx_index found, using first available:', rpcEndpoint);
    }
    
    if (!rpcEndpoint) {
      throw new Error('No RPC endpoint available');
    }

    console.log('Connecting to RPC:', rpcEndpoint);
    
    let actualSigner = offlineSigner;
    try {
      const statusResponse = await fetch(`${rpcEndpoint}/status`);
      const statusData = await statusResponse.json();
      const rpcChainId = statusData.result.node_info.network;
      console.log('📡 RPC Chain ID:', rpcChainId);
      console.log('🔑 Keplr Chain ID:', chainId);
      
      if (rpcChainId !== chainId) {
        console.warn(`⚠️ Chain ID mismatch! RPC: ${rpcChainId}, Keplr: ${chainId}`);
        console.log('🔄 Re-creating offline signer with correct chain ID...');
        
        try {
          await keplr.enable(rpcChainId);
          actualSigner = await keplr.getOfflineSignerAuto(rpcChainId);
          chainId = rpcChainId;
          console.log('✅ Successfully re-created signer with RPC chain ID');
        } catch (e) {
          console.warn('Failed to recreate signer with RPC chain ID, proceeding with original:', e);
        }
      }
    } catch (e) {
      console.warn('Could not fetch chain ID from RPC status endpoint:', e);
    }

    const clientOptions: any = {};

    // Add EVM support if needed
    if (isEvmChain) {
      console.log('🔧 Detected EVM chain (executeSend), adding EthAccount support');
      
      const registry = await createEvmRegistry();
      const accountParser = await createEvmAccountParser();      if (registry) {
        clientOptions.registry = registry;
        console.log('✅ Using custom EVM registry');
      }
      
      if (accountParser) {
        clientOptions.accountParser = accountParser;
        console.log('✅ Using custom EVM account parser');
      }
    }

    const client = await SigningStargateClient.connectWithSigner(
      rpcEndpoint,
      actualSigner,
      clientOptions
    );

    console.log('✅ SigningStargateClient connected');

    const exponent = parseInt(String(chain.assets?.[0]?.exponent || '6'));
    const gasPrice = `0.025${params.denom}`;

    const sendMsg = {
      typeUrl: '/cosmos.bank.v1beta1.MsgSend',
      value: {
        fromAddress: params.fromAddress,
        toAddress: params.toAddress,
        amount: [{
          denom: params.denom,
          amount: params.amount,
        }],
      },
    };

    console.log('📤 Sending transaction:', sendMsg);

    const fee = calculateFee(chain, gasLimit);

    const coinType = parseInt(chain.coin_type || '118');
    if (isEvmChain) {
      console.log('🔥 Using EVM-specific signing for send (EVM chain)');
      
      try {
        const restEndpoint = chain.api[0]?.address || '';
        if (!restEndpoint) {
          throw new Error('No REST endpoint available');
        }
        
        const signedTx = await signTransactionForEvm(
          offlineSigner,
          chainId,
          restEndpoint,
          params.fromAddress,
          [sendMsg],
          fee,
          memo,
          coinType
        );
        
        const result = await broadcastTransaction(restEndpoint, signedTx);
        
        console.log('✅ EVM transaction successful!');
        console.log('Transaction hash:', result.txhash);
        
        return { success: true, txHash: result.txhash };
      } catch (evmError: any) {
        console.error('❌ EVM signing/broadcast failed:', evmError);
        return { success: false, error: evmError.message };
      }
    }

    const result = await client.signAndBroadcast(
      params.fromAddress,
      [sendMsg],
      fee,
      memo
    );

    console.log('Transaction result:', result);

    if (result.code === 0) {
      console.log('✅ Transaction successful!');
      console.log('Transaction hash:', result.transactionHash);
      return { success: true, txHash: result.transactionHash };
    } else {
      console.error('❌ Transaction failed:', result.rawLog);
      return { success: false, error: result.rawLog };
    }
  } catch (error: any) {
    console.error('Send error:', error);
    return { success: false, error: error.message || 'Transaction failed' };
  }
}

export async function executeVote(
  chain: ChainData,
  params: {
    voterAddress: string;
    proposalId: string;
    option: number; // 1=Yes, 2=Abstain, 3=No, 4=NoWithVeto
  },
  gasLimit: string = '200000',
  memo: string = 'Vote via WinScan'
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  try {
    if (!isKeplrInstalled()) {
      throw new Error('Keplr extension is not installed');
    }

    const keplr = window.keplr!;
    let chainId = (chain.chain_id || chain.chain_name).trim();
    
    console.log('🗳️ executeVote Debug:', {
      chain_name: chain.chain_name,
      chain_id: chain.chain_id,
      computed_chainId: chainId,
      params: params
    });
    
    try {
      await keplr.enable(chainId);
      console.log('✅ Chain enabled:', chainId);
    } catch (error: any) {
      if (error.message?.includes('There is no chain info')) {
        console.log('Chain not found in Keplr, suggesting chain...');
        const rpcEndpoint = chain.rpc?.[0]?.address || '';
        const apiEndpoint = chain.api?.[0]?.address || '';
        
        await keplr.experimentalSuggestChain({
          chainId: chainId,
          chainName: chain.chain_name,
          rpc: rpcEndpoint,
          rest: apiEndpoint,
          bip44: {
            coinType: parseInt(chain.coin_type || '118'),
          },
          bech32Config: {
            bech32PrefixAccAddr: chain.addr_prefix || 'cosmos',
            bech32PrefixAccPub: `${chain.addr_prefix || 'cosmos'}pub`,
            bech32PrefixValAddr: `${chain.addr_prefix || 'cosmos'}valoper`,
            bech32PrefixValPub: `${chain.addr_prefix || 'cosmos'}valoperpub`,
            bech32PrefixConsAddr: `${chain.addr_prefix || 'cosmos'}valcons`,
            bech32PrefixConsPub: `${chain.addr_prefix || 'cosmos'}valconspub`,
          },
          currencies: [
            {
              coinDenom: chain.assets?.[0]?.symbol || 'ATOM',
              coinMinimalDenom: chain.assets?.[0]?.base || 'uatom',
              coinDecimals: parseInt(String(chain.assets?.[0]?.exponent || '6')),
            },
          ],
          feeCurrencies: [
            {
              coinDenom: chain.assets?.[0]?.symbol || 'ATOM',
              coinMinimalDenom: chain.assets?.[0]?.base || 'uatom',
              coinDecimals: parseInt(String(chain.assets?.[0]?.exponent || '6')),
              gasPriceStep: {
                low: 0.01,
                average: 0.025,
                high: 0.04,
              },
            },
          ],
          stakeCurrency: {
            coinDenom: chain.assets?.[0]?.symbol || 'ATOM',
            coinMinimalDenom: chain.assets?.[0]?.base || 'uatom',
            coinDecimals: parseInt(String(chain.assets?.[0]?.exponent || '6')),
          },
        });
        
        await keplr.enable(chainId);
      } else {
        throw error;
      }
    }
    
    // Detect EVM chain for proper signer selection
    const isEvmChain = chainId.includes('_');
    
    // Use Direct signing for EVM chains (better ethsecp256k1 support)
    const offlineSigner = isEvmChain 
      ? await keplr.getOfflineSigner(chainId)
      : await keplr.getOfflineSignerAuto(chainId);
    
    console.log('✅ Signer type:', isEvmChain ? 'Direct (EVM)' : 'Auto');

    const rpcEndpoint = chain.rpc?.[0]?.address || '';
    if (!rpcEndpoint) {
      throw new Error('No RPC endpoint available');
    }

    let actualOfflineSigner = offlineSigner;
    
    try {
      const rpcResponse = await fetch(`${rpcEndpoint}/status`);
      if (rpcResponse.ok) {
        const rpcData = await rpcResponse.json();
        const rpcChainId = rpcData.result?.node_info?.network;
        if (rpcChainId && rpcChainId !== chainId) {
          console.warn(`⚠️ Chain ID mismatch! Config: ${chainId}, RPC: ${rpcChainId}. Using RPC chain ID.`);
          chainId = rpcChainId;
          await keplr.enable(chainId);
          actualOfflineSigner = await keplr.getOfflineSignerAuto(chainId);
        }
      }
    } catch (rpcError) {
      console.warn('Could not verify RPC chain ID:', rpcError);
    }

    const accounts = await actualOfflineSigner.getAccounts();
    if (accounts.length === 0) {
      throw new Error('No accounts found');
    }
    
    console.log('✅ Voter address:', accounts[0].address);
    
    // @ts-ignore
    const { SigningStargateClient, GasPrice } = await import('@cosmjs/stargate');
    
    const gasPrice = GasPrice.fromString(`${chain.min_tx_fee || '0.025'}${chain.assets?.[0]?.base || 'uatom'}`);
    
    const clientOptions: any = {
      gasPrice,
      broadcastTimeoutMs: 30000,
      broadcastPollIntervalMs: 3000,
    };
    
    // Add EVM support if needed
    if (isEvmChain) {
      console.log('🔧 Detected EVM chain (executeVote), adding EthAccount support');
      
      const evmRegistry = await createEvmRegistry();
      const accountParser = await createEvmAccountParser();
      
      if (evmRegistry) {
        clientOptions.registry = evmRegistry;
        console.log('✅ Using custom EVM registry');
      }
      
      if (accountParser) {
        clientOptions.accountParser = accountParser;
        console.log('✅ Using custom EVM account parser');
      }
    } else {
      // Use custom gov registry for chains with different gov modules
      const govRegistry = await createCustomGovRegistry(chainId);
      if (govRegistry) {
        clientOptions.registry = govRegistry;
        console.log('✅ Using custom gov registry');
      }
    }
    
    const client = await SigningStargateClient.connectWithSigner(
      rpcEndpoint,
      actualOfflineSigner,
      clientOptions
    );

    console.log('Voting on proposal...');

    const fee = calculateFee(chain, gasLimit);

    console.log('Broadcasting transaction...');

    const coinType = parseInt(chain.coin_type || '118');
    if (isEvmChain) {
      console.log('🔥 Using EVM-specific signing for vote (EVM chain)');
      
      try {
        const restEndpoint = chain.api[0]?.address || '';
        if (!restEndpoint) {
          throw new Error('No REST endpoint available');
        }

        const voteTypeUrl = getGovMsgVoteTypeUrl(chainId);
        const voteMsg = {
          typeUrl: voteTypeUrl,
          value: {
            proposalId: params.proposalId,
            voter: params.voterAddress,
            option: params.option,
          },
        };
        
        const signedTx = await signTransactionForEvm(
          actualOfflineSigner,
          chainId,
          restEndpoint,
          params.voterAddress,
          [voteMsg],
          fee,
          memo,
          coinType
        );
        
        const result = await broadcastTransaction(restEndpoint, signedTx);
        
        console.log('✅ EVM transaction successful!');
        console.log('Transaction hash:', result.txhash);
        
        return { success: true, txHash: result.txhash };
      } catch (evmError: any) {
        console.error('❌ EVM signing/broadcast failed:', evmError);
        return { success: false, error: evmError.message };
      }
    }

    // Try multiple vote methods with fallback
    const result = await tryVoteWithFallback(
      client,
      params.voterAddress,
      params.proposalId,
      params.option,
      fee,
      memo,
      chainId
    );

    if (result.success) {
      console.log('✅ Vote successful!');
      console.log('Transaction hash:', result.txHash);
      return { success: true, txHash: result.txHash };
    } else {
      console.error('❌ Vote failed:', result.error);
      return { success: false, error: result.error };
    }
  } catch (error: any) {
    console.error('Vote error:', error);
    return { success: false, error: error.message || 'Vote failed' };
  }
}

export async function executeUnjail(
  chain: ChainData,
  params: {
    validatorAddress: string;
  },
  gasLimit: string = '300000',
  memo: string = ''
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  try {
    if (!isKeplrInstalled()) {
      throw new Error('Keplr extension is not installed');
    }

    const keplr = window.keplr!;
    let chainId = (chain.chain_id || chain.chain_name).trim();
    
    console.log('🔓 executeUnjail:', {
      validatorAddress: params.validatorAddress,
      chainId: chainId
    });
    
    await keplr.enable(chainId);
    
    // Detect EVM chain for proper signer selection
    const isEvmChain = chainId.includes('_');
    
    // Use Direct signing for EVM chains (better ethsecp256k1 support)
    const offlineSigner = isEvmChain 
      ? await keplr.getOfflineSigner(chainId)
      : await keplr.getOfflineSignerAuto(chainId);
    
    console.log('✅ Signer type:', isEvmChain ? 'Direct (EVM)' : 'Auto');
    
    // @ts-ignore - Import required modules
    const { SigningStargateClient } = await import('@cosmjs/stargate');
    // @ts-ignore
    const { Registry, defaultRegistryTypes } = await import('@cosmjs/stargate');
    // @ts-ignore
    const { MsgUnjail } = await import('cosmjs-types/cosmos/slashing/v1beta1/tx');
    
    // @ts-ignore - Registry types are complex, ignore for custom message
    const registry = new Registry([
      ...defaultRegistryTypes,
      ['/cosmos.slashing.v1beta1.MsgUnjail', MsgUnjail],
    ]);
    
    // Add EVM support for chains like Shido
    if (isEvmChain) {
      console.log('🔧 Detected EVM chain, using Direct signing');
    }
    
    console.log('✅ Custom registry created with MsgUnjail' + (isEvmChain ? ' and EVM support' : ''));
    
    let rpcEndpoint = '';
    const rpcList = chain.rpc || [];
    
    for (const rpc of rpcList) {
      if (rpc.tx_index === 'on') {
        rpcEndpoint = rpc.address;
        console.log('✅ Using RPC with tx_index enabled:', rpcEndpoint);
        break;
      }
    }
    
    if (!rpcEndpoint && rpcList.length > 0) {
      rpcEndpoint = rpcList[0].address;
      console.log('⚠️ Using first available RPC (no tx_index info):', rpcEndpoint);
    }
    
    if (!rpcEndpoint) {
      throw new Error('No RPC endpoint available for this chain');
    }

    let actualSigner = offlineSigner;
    try {
      const statusResponse = await fetch(`${rpcEndpoint}/status`);
      const statusData = await statusResponse.json();
      const rpcChainId = statusData.result.node_info.network;
      
      if (rpcChainId !== chainId) {
      console.log('🔄 Updating chain ID from', chainId, 'to', rpcChainId);
      chainId = rpcChainId;
      await keplr.enable(chainId);
      
      // Re-get signer with correct method for chain type
      if (isEvmChain) {
        actualSigner = await keplr.getOfflineSigner(chainId);
        console.log('✅ Got EVM signer for unjail with updated chain ID');
      } else {
        actualSigner = await keplr.getOfflineSignerAuto(chainId);
      }
    }
  } catch (fetchError) {
    console.warn('Could not verify chain ID from RPC');
  }

    const clientOptions: any = {
      registry,
      broadcastTimeoutMs: 30000,
      broadcastPollIntervalMs: 3000,
    };
    
    // Add EVM account parser if needed
    if (isEvmChain) {
      console.log('🔧 Adding EVM account parser for executeUnjail');
      
      const accountParser = await createEvmAccountParser();
      
      if (accountParser) {
        clientOptions.accountParser = accountParser;
        console.log('✅ Using custom EVM account parser for unjail');
      }
    }

    const client = await SigningStargateClient.connectWithSigner(
      rpcEndpoint, 
      actualSigner,
      clientOptions
    );
    
    console.log('✅ SigningStargateClient connected with custom registry');
    
    const accounts = await actualSigner.getAccounts();
    const signerAddress = accounts[0].address;
    
    console.log('👤 Signer address:', signerAddress);
    console.log('🔓 Unjail validator:', params.validatorAddress);

    const unjailMsg = {
      typeUrl: '/cosmos.slashing.v1beta1.MsgUnjail',
      value: {
        validatorAddr: params.validatorAddress,
      },
    };

    console.log('📝 Unjail message:', unjailMsg);

    const fee = calculateFee(chain, gasLimit);

    console.log('💰 Fee:', fee);
    console.log('📄 Memo:', memo || 'Unjail via WinScan');

    const coinType = parseInt(chain.coin_type || '118');
    if (isEvmChain) {
      console.log('🔥 Using EVM-specific signing for unjail (EVM chain)');
      
      try {
        const restEndpoint = chain.api[0]?.address || '';
        if (!restEndpoint) {
          throw new Error('No REST endpoint available');
        }
        
        const signedTx = await signTransactionForEvm(
          actualSigner,
          chainId,
          restEndpoint,
          signerAddress,
          [unjailMsg],
          fee,
          memo || 'Unjail via WinScan',
          coinType,
          true,
          registry
        );
        
        const result = await broadcastTransaction(restEndpoint, signedTx);
        
        console.log('✅ EVM transaction successful!');
        console.log('Transaction hash:', result.txhash);
        
        return { success: true, txHash: result.txhash };
      } catch (evmError: any) {
        console.error('❌ EVM signing/broadcast failed:', evmError);
        return { success: false, error: evmError.message };
      }
    }

    const result = await client.signAndBroadcast(
      signerAddress,
      [unjailMsg],
      fee,
      memo || 'Unjail via WinScan'
    );

    console.log('✅ Unjail result:', result);

    if (result.code === 0) {
      return {
        success: true,
        txHash: result.transactionHash,
      };
    } else {
      return {
        success: false,
        error: result.rawLog || 'Unjail transaction failed',
      };
    }
  } catch (error: any) {
    console.error('❌ Unjail error:', error);
    return { success: false, error: error.message || 'Unjail failed' };
  }
}

export async function executeEditValidatorCommission(
  chain: ChainData,
  params: {
    validatorAddress: string;
    commissionRate: string; // decimal string (e.g., "0.05" for 5%)
  },
  gasLimit: string = '300000',
  memo: string = ''
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  try {
    if (!isKeplrInstalled()) {
      throw new Error('Keplr extension is not installed');
    }

    const keplr = window.keplr!;
    let chainId = (chain.chain_id || chain.chain_name).trim();
    
    console.log('📝 executeEditValidatorCommission:', {
      validatorAddress: params.validatorAddress,
      commissionRate: params.commissionRate,
      chainId: chainId
    });
    
    await keplr.enable(chainId);
    
    // Detect EVM chain for proper signer selection
    const isEvmChain = chainId.includes('_');
    
    // Use Direct signing for EVM chains (better ethsecp256k1 support)
    const offlineSigner = isEvmChain 
      ? await keplr.getOfflineSigner(chainId)
      : await keplr.getOfflineSignerAuto(chainId);
    
    console.log('✅ Signer type:', isEvmChain ? 'Direct (EVM)' : 'Auto');
    
    // @ts-ignore - Import required modules
    const { SigningStargateClient } = await import('@cosmjs/stargate');
    // @ts-ignore
    const { Registry, defaultRegistryTypes } = await import('@cosmjs/stargate');
    // @ts-ignore
    const { MsgEditValidator } = await import('cosmjs-types/cosmos/staking/v1beta1/tx');
    
    // @ts-ignore - Registry types are complex, ignore for custom message
    const registry = new Registry([
      ...defaultRegistryTypes,
      ['/cosmos.staking.v1beta1.MsgEditValidator', MsgEditValidator],
    ]);
    
    if (isEvmChain) {
      console.log('🔧 Detected EVM chain, using Direct signing');
    }
    
    console.log('✅ Custom registry created with MsgEditValidator' + (isEvmChain ? ' and EVM support' : ''));
    
    let rpcEndpoint = '';
    const rpcList = chain.rpc || [];
    
    for (const rpc of rpcList) {
      if (rpc.tx_index === 'on') {
        rpcEndpoint = rpc.address;
        console.log('✅ Using RPC with tx_index enabled:', rpcEndpoint);
        break;
      }
    }
    
    if (!rpcEndpoint && rpcList.length > 0) {
      rpcEndpoint = rpcList[0].address;
      console.log('⚠️ Using first available RPC (no tx_index info):', rpcEndpoint);
    }
    
    if (!rpcEndpoint) {
      throw new Error('No RPC endpoint available for this chain');
    }

    let actualSigner = offlineSigner;
    try {
      const statusResponse = await fetch(`${rpcEndpoint}/status`);
      const statusData = await statusResponse.json();
      const rpcChainId = statusData.result.node_info.network;
      
      if (rpcChainId !== chainId) {
        console.log('🔄 Updating chain ID from', chainId, 'to', rpcChainId);
        chainId = rpcChainId;
        await keplr.enable(chainId);
        actualSigner = isEvmChain 
          ? await keplr.getOfflineSigner(chainId)
          : await keplr.getOfflineSignerAuto(chainId);
      }
    } catch (rpcError) {
      console.warn('⚠️ Could not verify chain ID from RPC, using', chainId);
    }

    const client = await SigningStargateClient.connectWithSigner(
      rpcEndpoint,
      actualSigner,
      { registry }
    );

    console.log('✅ SigningStargateClient connected with custom registry');

    const accounts = await actualSigner.getAccounts();
    const signerAddress = accounts[0].address;

    console.log('👤 Signer address:', signerAddress);

    // Create MsgEditValidator message
    // Convert commission rate to integer (multiply by 10^18)
    // Example: "0.09" -> "90000000000000000"
    // The SDK expects an integer representation, not decimal string
    const rateStr = params.commissionRate.trim();
    let rateFloat: number;
    
    if (rateStr.includes('.')) {
      rateFloat = parseFloat(rateStr);
    } else {
      rateFloat = parseFloat(rateStr);
    }
    
    // Multiply by 10^18 and convert to string (no decimal point)
    const rateInteger = Math.round(rateFloat * 1e18).toString();

    // Send with description object (cannot be empty/omitted)
    const editValidatorMsg = {
      typeUrl: '/cosmos.staking.v1beta1.MsgEditValidator',
      value: MsgEditValidator.fromPartial({
        description: {
          moniker: '[do-not-modify]',
          identity: '[do-not-modify]',
          website: '[do-not-modify]',
          securityContact: '[do-not-modify]',
          details: '[do-not-modify]',
        },
        validatorAddress: params.validatorAddress,
        commissionRate: rateInteger,
      }),
    };

    console.log('📝 Edit validator message:', editValidatorMsg);

    const fee = calculateFee(chain, gasLimit);

    console.log('💰 Fee:', fee);
    console.log('📄 Memo:', memo || 'Edit Commission via WinScan');

    const coinType = parseInt(chain.coin_type || '118');
    if (isEvmChain) {
      console.log('🔥 Using EVM-specific signing for edit commission (EVM chain)');
      
      try {
        const restEndpoint = chain.api[0]?.address || '';
        if (!restEndpoint) {
          throw new Error('No REST endpoint available');
        }
        
        const signedTx = await signTransactionForEvm(
          actualSigner,
          chainId,
          restEndpoint,
          signerAddress,
          [editValidatorMsg],
          fee,
          memo || 'Edit Commission via WinScan',
          coinType,
          true,
          registry
        );
        
        const result = await broadcastTransaction(restEndpoint, signedTx);
        
        console.log('✅ EVM transaction successful!');
        console.log('Transaction hash:', result.txhash);
        
        return { success: true, txHash: result.txhash };
      } catch (evmError: any) {
        console.error('❌ EVM signing/broadcast failed:', evmError);
        return { success: false, error: evmError.message };
      }
    }

    const result = await client.signAndBroadcast(
      signerAddress,
      [editValidatorMsg],
      fee,
      memo || 'Edit Commission via WinScan'
    );

    console.log('✅ Edit commission result:', result);

    if (result.code === 0) {
      return {
        success: true,
        txHash: result.transactionHash,
      };
    } else {
      return {
        success: false,
        error: result.rawLog || 'Edit commission transaction failed',
      };
    }
  } catch (error: any) {
    console.error('❌ Edit commission error:', error);
    return { success: false, error: error.message || 'Edit commission failed' };
  }
}

/**
 * Safe JSON stringify that handles BigInt
 */
function safeStringify(obj: any, space?: number): string {
  return JSON.stringify(obj, (key, value) =>
    typeof value === 'bigint' ? value.toString() : value
  , space);
}

/**
 * Check and approve PRC20 allowance for swap pool
 */
async function ensurePRC20Allowance(
  client: any,
  signerAddress: string,
  tokenAddress: string,
  spenderAddress: string,
  amount: string,
  chain: ChainData
): Promise<boolean> {
  try {
    console.log('🔍 Checking PRC20 allowance...', {
      token: tokenAddress,
      spender: spenderAddress,
      amount: amount
    });

    // Query current allowance
    const allowanceQuery = {
      allowance: {
        owner: signerAddress,
        spender: spenderAddress
      }
    };
    
    const queryBase64 = Buffer.from(JSON.stringify(allowanceQuery)).toString('base64');
    
    // Get LCD endpoint from chain config
    const lcdEndpoints = chain.api || [];
    const lcdUrl = lcdEndpoints.length > 0 ? lcdEndpoints[0].address : 'https://mainnet-lcd.paxinet.io';
    
    const response = await fetch(
      `${lcdUrl}/cosmwasm/wasm/v1/contract/${tokenAddress}/smart/${queryBase64}`
    );
    
    if (response.ok) {
      const data = await response.json();
      const currentAllowance = data.data?.allowance || '0';
      console.log('📊 Current allowance:', currentAllowance);
      
      // If allowance is sufficient, no need to approve
      if (BigInt(currentAllowance) >= BigInt(amount)) {
        console.log('✅ Allowance sufficient, no approval needed');
        return true;
      }
    }
    
    console.log('⚠️ Insufficient allowance, requesting approval from wallet...');
    console.log('   Token contract:', tokenAddress);
    console.log('   Spender (pool):', spenderAddress);
    console.log('   Amount to approve:', amount);
    console.log('   Signer address:', signerAddress);
    
    // Prepare approval message
    const increaseAllowanceMsg = {
      increase_allowance: {
        spender: spenderAddress,
        amount: amount,
        expires: null
      }
    };
    
    console.log('📝 Approval message:', safeStringify(increaseAllowanceMsg, 2));
    
    try {
      // Calculate fee - use 300k gas (actual usage ~254k)
      const fee = calculateFee(chain, '300000');
      console.log('💰 Fee:', safeStringify(fee));
      
      console.log('🔐 Requesting wallet signature for approval...');
      
      // Execute approval transaction
      const result = await client.execute(
        signerAddress,
        tokenAddress,
        increaseAllowanceMsg,
        fee,
        'Approve PRC20 token for swap'
      );
      
      console.log('📡 Approval transaction broadcast!');
      console.log('   Result:', safeStringify(result, 2));
      
      if (result.transactionHash) {
        console.log('✅ Approval successful!');
        console.log('   Tx Hash:', result.transactionHash);
        console.log('   Height:', result.height);
        console.log('   Gas used:', result.gasUsed);
        
        // Wait for tx to be indexed
        console.log('⏳ Waiting 2 seconds for transaction to be indexed...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        console.log('✅ Approval complete, ready for swap!');
        return true;
      } else {
        console.error('❌ No transaction hash in result');
        console.error('   Full result:', result);
        return false;
      }
    } catch (execError: any) {
      console.error('❌ Approval execution error!');
      console.error('   Error type:', execError.constructor?.name);
      console.error('   Error message:', execError.message);
      console.error('   Error code:', execError.code);
      console.error('   Error log:', execError.log);
      
      // More specific error messages
      if (execError.message?.includes('insufficient funds')) {
        throw new Error('Insufficient PAXI for transaction fee (need ~0.006 PAXI)');
      } else if (execError.message?.includes('rejected')) {
        throw new Error('Approval rejected in wallet');
      } else if (execError.message?.includes('account sequence')) {
        throw new Error('Sequence mismatch - please try again');
      } else {
        throw new Error(`Approval failed: ${execError.message || 'Unknown error'}`);
      }
    }
  } catch (error: any) {
    console.error('❌ Error in ensurePRC20Allowance:', error);
    console.error('   Full error:', error);
    throw error;
  }
}

export async function executeSwap(
  chain: ChainData,
  params: {
    prc20Address: string;
    offerDenom: string;
    offerAmount: string;
    minReceive: string;
  },
  gasLimit: string = '300000',
  memo: string = ''
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  try {
    if (!isKeplrInstalled()) {
      throw new Error('Keplr extension is not installed');
    }

    const keplr = window.keplr!;
    let chainId = (chain.chain_id || chain.chain_name).trim();
    
    console.log('🔄 executeSwap:', {
      prc20: params.prc20Address,
      offerDenom: params.offerDenom,
      offerAmount: params.offerAmount,
      chainId: chainId
    });
    
    await keplr.enable(chainId);
    
    const offlineSigner = await keplr.getOfflineSignerAuto(chainId);
    
    // @ts-ignore - Import required modules
    const { SigningStargateClient } = await import('@cosmjs/stargate');
    // @ts-ignore
    const { Registry, defaultRegistryTypes } = await import('@cosmjs/stargate');
    // @ts-ignore
    const protobuf = await import('protobufjs/minimal');
    
    // Create MsgSwap interface dengan proper protobuf writer
    const MsgSwap = {
      encode(message: any, writer: any = protobuf.Writer.create()) {
        if (message.creator !== '') {
          writer.uint32(10).string(message.creator);
        }
        if (message.prc20 !== '') {
          writer.uint32(18).string(message.prc20);
        }
        if (message.offerDenom !== '') {
          writer.uint32(26).string(message.offerDenom);
        }
        if (message.offerAmount !== '') {
          writer.uint32(34).string(message.offerAmount);
        }
        if (message.minReceive !== '') {
          writer.uint32(42).string(message.minReceive);
        }
        return writer;
      },
      decode(input: any, length?: number) {
        const reader = input instanceof protobuf.Reader ? input : new protobuf.Reader(input);
        let end = length === undefined ? reader.len : reader.pos + length;
        const message: any = {
          creator: '',
          prc20: '',
          offerDenom: '',
          offerAmount: '',
          minReceive: ''
        };
        while (reader.pos < end) {
          const tag = reader.uint32();
          switch (tag >>> 3) {
            case 1:
              message.creator = reader.string();
              break;
            case 2:
              message.prc20 = reader.string();
              break;
            case 3:
              message.offerDenom = reader.string();
              break;
            case 4:
              message.offerAmount = reader.string();
              break;
            case 5:
              message.minReceive = reader.string();
              break;
            default:
              reader.skipType(tag & 7);
              break;
          }
        }
        return message;
      },
      fromJSON(object: any) {
        return {
          creator: object.creator ?? '',
          prc20: object.prc20 ?? '',
          offerDenom: object.offerDenom ?? '',
          offerAmount: object.offerAmount ?? '',
          minReceive: object.minReceive ?? ''
        };
      },
      toJSON(message: any) {
        return {
          creator: message.creator,
          prc20: message.prc20,
          offerDenom: message.offerDenom,
          offerAmount: message.offerAmount,
          minReceive: message.minReceive
        };
      },
      fromPartial(object: any) {
        return {
          creator: object.creator ?? '',
          prc20: object.prc20 ?? '',
          offerDenom: object.offerDenom ?? '',
          offerAmount: object.offerAmount ?? '',
          minReceive: object.minReceive ?? ''
        };
      }
    };
    
    // @ts-ignore - Registry types are complex
    const registry = new Registry([
      ...defaultRegistryTypes,
      ['/x.swap.types.MsgSwap', MsgSwap],
    ]);
    
    console.log('✅ Custom registry created with MsgSwap');
    
    let rpcEndpoint = '';
    const rpcList = chain.rpc || [];
    
    for (const rpc of rpcList) {
      if (rpc.tx_index === 'on') {
        rpcEndpoint = rpc.address;
        break;
      }
    }
    
    if (!rpcEndpoint && rpcList.length > 0) {
      rpcEndpoint = rpcList[0].address;
    }
    
    if (!rpcEndpoint) {
      throw new Error('No RPC endpoint available for this chain');
    }

    const clientOptions: any = {
      registry,
      broadcastTimeoutMs: 30000,
      broadcastPollIntervalMs: 3000,
    };

    const client = await SigningStargateClient.connectWithSigner(
      rpcEndpoint, 
      offlineSigner,
      clientOptions
    );
    
    console.log('✅ SigningStargateClient connected with custom registry');
    
    const accounts = await offlineSigner.getAccounts();
    const signerAddress = accounts[0].address;
    
    console.log('👤 Signer address:', signerAddress);

    // CRITICAL: PRC20 → PAXI swaps need approval for swap module account
    if (params.offerDenom !== 'upaxi') {
      console.log('🔐 PRC20 swap detected, need approval for swap module...');
      console.log('   Token:', params.offerDenom);
      console.log('   Amount to swap:', params.offerAmount);
      
      try {
        // Create CosmWasm client for contract execution (approval)
        const { SigningCosmWasmClient } = await import('@cosmjs/cosmwasm-stargate');
        const { GasPrice } = await import('@cosmjs/stargate');
        
        console.log('🔗 Creating CosmWasm client...');
        const wasmClient = await SigningCosmWasmClient.connectWithSigner(
          rpcEndpoint,
          offlineSigner,
          { gasPrice: GasPrice.fromString('0.025upaxi') }
        );
        
        // CRITICAL: Swap module account address (from successful transaction analysis)
        // This is the module account that executes transfer_from during swap
        const SWAP_MODULE_ACCOUNT = 'paxi1mfru9azs5nua2wxcd4sq64g5nt7nn4n80r745t';
        
        console.log('📋 Swap module account:', SWAP_MODULE_ACCOUNT);
        
        // Query actual balance from contract
        console.log('💰 Querying token balance...');
        const balanceQuery = { balance: { address: signerAddress } };
        const balanceQueryB64 = Buffer.from(JSON.stringify(balanceQuery)).toString('base64');
        
        const lcdEndpoints = chain.api || [];
        const lcdUrl = lcdEndpoints.length > 0 ? lcdEndpoints[0].address : 'https://mainnet-lcd.paxinet.io';
        
        const balanceResp = await fetch(
          `${lcdUrl}/cosmwasm/wasm/v1/contract/${params.offerDenom}/smart/${balanceQueryB64}`
        );
        
        if (balanceResp.ok) {
          const balanceData = await balanceResp.json();
          const actualBalance = balanceData.data?.balance || '0';
          
          const balanceBigInt = BigInt(actualBalance);
          const swapAmountBigInt = BigInt(params.offerAmount);
          const isSufficient = balanceBigInt >= swapAmountBigInt;
          
          console.log('📊 Balance check:', {
            actualBalance: actualBalance,
            swapAmount: params.offerAmount,
            sufficient: isSufficient
          });
          
          if (!isSufficient) {
            const shortfall = swapAmountBigInt - balanceBigInt;
            throw new Error(
              `Insufficient balance! Need ${shortfall.toString()} more tokens. Please refresh page.`
            );
          }
          
          console.log('✅ Balance sufficient');
        }
        
        // Approve swap module to transfer tokens (1.5x for safety)
        const approveAmount = (BigInt(params.offerAmount) * BigInt(150) / BigInt(100)).toString();
        
        console.log('💳 Approving swap module:', {
          tokenContract: params.offerDenom,
          spender: SWAP_MODULE_ACCOUNT,
          swapAmount: params.offerAmount,
          approveAmount: approveAmount
        });
        
        await ensurePRC20Allowance(
          wasmClient,
          signerAddress,
          params.offerDenom,
          SWAP_MODULE_ACCOUNT, // Approve swap module account
          approveAmount,
          chain
        );
        
        console.log('✅ Swap module approved, ready to swap!');
        
      } catch (error: any) {
        console.error('❌ Preparation failed:', error);
        throw new Error(`Failed to prepare swap: ${error.message}`);
      }
    }

    const swapMsg = {
      typeUrl: '/x.swap.types.MsgSwap',
      value: {
        creator: signerAddress,
        prc20: params.prc20Address,
        offerDenom: params.offerDenom,
        offerAmount: params.offerAmount,
        minReceive: params.minReceive,
      },
    };

    console.log('📝 Swap message:', swapMsg);

    // Use higher gas for PRC20 → PAXI swaps (needs more gas for transfer_from + swap)
    const finalGasLimit = params.offerDenom !== 'upaxi' ? '500000' : gasLimit;
    const fee = calculateFee(chain, finalGasLimit);

    console.log('💰 Fee:', {
      gasLimit: finalGasLimit,
      fee: fee
    });

    const result = await client.signAndBroadcast(
      signerAddress,
      [swapMsg],
      fee,
      memo || 'Swap via WinScan'
    );

    console.log('✅ Swap result:', result);

    if (result.code === 0) {
      return {
        success: true,
        txHash: result.transactionHash,
      };
    } else {
      return {
        success: false,
        error: result.rawLog || 'Swap transaction failed',
      };
    }
  } catch (error: any) {
    console.error('❌ Swap error:', error);
    return { success: false, error: error.message || 'Swap failed' };
  }
}

export async function enableAutoCompound(
  chain: ChainData,
  params: {
    validatorAddress: string;
    minAmount?: string;
    frequency?: 'minutely' | 'hourly' | 'daily' | 'weekly' | 'monthly';
    duration?: number;
    durationUnit?: 'month' | 'year';
    grantee?: string; // Optional custom grantee address
    includeVote?: boolean; // Grant vote permission (for validators)
    includeCommission?: boolean; // Grant commission withdrawal permission (for validators)
  }
) {
  try {
    if (!window.keplr && !window.leap && !window.cosmostation) {
      throw new Error('Please install Keplr, Leap, or Cosmostation wallet');
    }

    const chainId = chain.chain_id || chain.chain_name;
    if (!chainId) {
      throw new Error('Chain ID is required');
    }

    // Check if chain supports authz module
    const unsupportedChains = ['paxi-mainnet', 'paxi-testnet'];
    if (unsupportedChains.includes(chainId)) {
      throw new Error('Auto-Compound is not supported on this chain. The chain does not have the authz module enabled.');
    }

    const coinType = parseInt(chain.coin_type || '118');
    const isEvmChain = coinType === 60;
    
    // Suggest chain to wallet
    const chainInfo = convertChainToKeplr(chain);
    try {
      if (window.keplr) {
        await window.keplr.experimentalSuggestChain(chainInfo);
        await window.keplr.enable(chainId);
      } else if (window.leap) {
        await window.leap.experimentalSuggestChain(chainInfo);
        await window.leap.enable(chainId);
      } else if (window.cosmostation) {
        await window.cosmostation.providers.keplr.experimentalSuggestChain(chainInfo);
        await window.cosmostation.providers.keplr.enable(chainId);
      }
    } catch (e) {
      console.error('Error suggesting chain:', e);
    }

    const { SigningStargateClient } = await import('@cosmjs/stargate');
    
    // Get offline signer
    let offlineSigner;
    if (window.keplr) {
      offlineSigner = isEvmChain 
        ? await window.keplr.getOfflineSigner(chainId)
        : await window.keplr.getOfflineSignerAuto(chainId);
    } else if (window.leap) {
      offlineSigner = isEvmChain 
        ? await window.leap.getOfflineSigner(chainId)
        : await window.leap.getOfflineSignerAuto(chainId);
    } else if (window.cosmostation) {
      offlineSigner = window.cosmostation.providers.keplr.getOfflineSigner(chainId);
    } else {
      throw new Error('No wallet available');
    }

    const accounts = await offlineSigner.getAccounts();
    const delegatorAddress = accounts[0].address;

    // Connect to RPC
    const rpcEndpoint = chain.rpc[0]?.address;
    if (!rpcEndpoint) {
      throw new Error('No RPC endpoint available');
    }

    const clientOptions: any = {};
    
    // Add EVM support if needed
    if (isEvmChain) {
      console.log('🔧 Detected EVM chain, adding EthAccount support for enableAutoCompound');
      
      const registry = await createEvmRegistry();
      const accountParser = await createEvmAccountParser();
      
      if (registry) {
        clientOptions.registry = registry;
        console.log('✅ Using custom EVM registry');
      }
      
      if (accountParser) {
        clientOptions.accountParser = accountParser;
        console.log('✅ Using custom EVM account parser');
      }
    }

    const client = await SigningStargateClient.connectWithSigner(
      rpcEndpoint,
      offlineSigner,
      clientOptions
    );

    // For EVM chains, fetch account to ensure proper pubkey handling
    if (isEvmChain) {
      try {
        const restEndpoint = chain.api?.[0]?.address || rpcEndpoint.replace(':26657', ':1317');
        await fetchAccountWithEthSupport(restEndpoint, delegatorAddress);
        console.log('✅ EVM account fetched successfully for auto-compound');
      } catch (fetchError) {
        console.warn('⚠️ Could not fetch EVM account:', fetchError);
      }
    }

    // Import auto-compound storage
    const { saveAutoCompoundStatus } = await import('./autoCompoundStorage');

    // Grant authorization for auto-compound
    // This allows a bot to claim rewards and redelegate on behalf of user
    const durationInSeconds = params.duration 
      ? params.duration * (params.durationUnit === 'year' ? 365 * 24 * 60 * 60 : 30 * 24 * 60 * 60)
      : 365 * 24 * 60 * 60; // Default 1 year

    // Validate bot address (grantee) is provided and different from wallet
    if (!params.grantee) {
      throw new Error('Bot address is required. Please provide the auto-compound bot address.');
    }

    const grantee = params.grantee;
    
    // Validate grantee is different from granter (wallet address)
    if (grantee === delegatorAddress) {
      throw new Error('Bot address cannot be the same as your wallet address. Please provide a different bot address.');
    }
    
    // Validate address format matches chain prefix
    const expectedPrefix = chain.addr_prefix || (chain as any).bech32_prefix || 'cosmos';
    if (!grantee.startsWith(expectedPrefix)) {
      throw new Error(`Invalid bot address format. Address must start with "${expectedPrefix}" for this chain.`);
    }
    
    console.log('✅ Using bot address:', grantee);

    // Use the proper protobuf-encoded grant builder from grantBuilder.ts
    // If includeVote or includeCommission is true, use the advanced grant builder
    let grantMsgs: any[];
    
    if (params.includeVote || params.includeCommission) {
      console.log('🔧 Creating grants with additional permissions:', {
        includeVote: params.includeVote,
        includeCommission: params.includeCommission
      });
      
      const { createAutoCompoundGrantsWithPermissions } = await import('./grantBuilder');
      grantMsgs = createAutoCompoundGrantsWithPermissions(
        delegatorAddress,
        grantee,
        params.validatorAddress,
        durationInSeconds,
        {
          includeVote: params.includeVote,
          includeCommission: params.includeCommission
        }
      );
    } else {
      const { createSimpleAutoCompoundGrant } = await import('./grantBuilder');
      grantMsgs = createSimpleAutoCompoundGrant(
        delegatorAddress,
        grantee,
        params.validatorAddress,
        durationInSeconds
      );
    }

    // Adjust gas limit based on number of grants
    const gasLimit = grantMsgs.length > 1 ? `${300000 + (grantMsgs.length - 1) * 150000}` : '300000';
    const fee = calculateFee(chain, gasLimit);
    
    let result: any;
    
    // For EVM chains, use Keplr's native signing to properly handle ethsecp256k1 pubkeys
    if (isEvmChain) {
      console.log('🔧 Using Keplr native signing for EVM chain');
      
      try {
        const restEndpoint = chain.api?.[0]?.address || rpcEndpoint.replace(':26657', ':1317');
        
        // Use signTransactionForEvm which properly handles ethsecp256k1 pubkeys
        const { signTransactionForEvm, broadcastTransaction } = await import('./evmSigning');
        
        const txRaw = await signTransactionForEvm(
          offlineSigner,
          chainId,
          restEndpoint,
          delegatorAddress,
          grantMsgs,
          {
            amount: fee.amount,
            gas: fee.gas,
          },
          'Enable Auto-Compound via WinScan',
          coinType,
          false, // Don't auto-simulate for grants
          clientOptions.registry
        );
        
        const broadcastResult = await broadcastTransaction(restEndpoint, txRaw);
        
        result = {
          code: broadcastResult.code,
          transactionHash: broadcastResult.txhash,
          rawLog: broadcastResult.raw_log,
        };
        
        console.log('✅ EVM transaction broadcast result:', result);
      } catch (evmError: any) {
        console.error('❌ EVM signing/broadcast error:', evmError);
        throw evmError;
      }
    } else {
      // For non-EVM chains, use SigningStargateClient.signAndBroadcast
      result = await client.signAndBroadcast(
        delegatorAddress,
        grantMsgs,
        fee,
        'Enable Auto-Compound via WinScan'
      );
    }

    if (result.code === 0) {
      // Save to localStorage with settings (including the grantee address used)
      saveAutoCompoundStatus(
        chainId,
        params.validatorAddress,
        true,
        coinType,
        {
          minAmount: params.minAmount || '0',
          frequency: params.frequency || 'daily',
          duration: params.duration || 1,
          durationUnit: params.durationUnit || 'year'
        },
        grantee, // Store the actual grantee used (custom or default)
        delegatorAddress // Store the granter (wallet) address
      );

      return {
        success: true,
        txHash: result.transactionHash,
      };
    } else {
      return {
        success: false,
        error: result.rawLog || 'Failed to enable auto-compound',
      };
    }
  } catch (error: any) {
    console.error('❌ Enable auto-compound error:', error);
    return { success: false, error: error.message || 'Failed to enable auto-compound' };
  }
}

export async function disableAutoCompound(
  chain: ChainData,
  params: {
    validatorAddress: string;
  }
) {
  try {
    if (!window.keplr && !window.leap && !window.cosmostation) {
      throw new Error('Please install Keplr, Leap, or Cosmostation wallet');
    }

    const chainId = chain.chain_id || chain.chain_name;
    if (!chainId) {
      throw new Error('Chain ID is required');
    }

    const coinType = parseInt(chain.coin_type || '118');
    const isEvmChain = coinType === 60;
    
    const { SigningStargateClient } = await import('@cosmjs/stargate');
    
    let offlineSigner;
    if (window.keplr) {
      offlineSigner = isEvmChain 
        ? await window.keplr.getOfflineSigner(chainId)
        : await window.keplr.getOfflineSignerAuto(chainId);
    } else if (window.leap) {
      offlineSigner = isEvmChain 
        ? await window.leap.getOfflineSigner(chainId)
        : await window.leap.getOfflineSignerAuto(chainId);
    } else if (window.cosmostation) {
      offlineSigner = window.cosmostation.providers.keplr.getOfflineSigner(chainId);
    } else {
      throw new Error('No wallet available');
    }

    const accounts = await offlineSigner.getAccounts();
    const delegatorAddress = accounts[0].address;

    const rpcEndpoint = chain.rpc[0]?.address;
    if (!rpcEndpoint) {
      throw new Error('No RPC endpoint available');
    }

    const clientOptions: any = {};
    
    // Add EVM support if needed
    if (isEvmChain) {
      console.log('🔧 Detected EVM chain, adding EthAccount support for disableAutoCompound');
      
      const registry = await createEvmRegistry();
      const accountParser = await createEvmAccountParser();
      
      if (registry) {
        clientOptions.registry = registry;
        console.log('✅ Using custom EVM registry');
      }
      
      if (accountParser) {
        clientOptions.accountParser = accountParser;
        console.log('✅ Using custom EVM account parser');
      }
    }

    const client = await SigningStargateClient.connectWithSigner(
      rpcEndpoint,
      offlineSigner,
      clientOptions
    );

    // For EVM chains, fetch account to ensure proper pubkey handling
    if (isEvmChain) {
      try {
        const restEndpoint = chain.api?.[0]?.address || rpcEndpoint.replace(':26657', ':1317');
        await fetchAccountWithEthSupport(restEndpoint, delegatorAddress);
        console.log('✅ EVM account fetched successfully for auto-compound disable');
      } catch (fetchError) {
        console.warn('⚠️ Could not fetch EVM account:', fetchError);
      }
    }

    // Revoke authorization
    // Get the actual grantee that was used when enabling
    const { getAutoCompoundStatus } = await import('./autoCompoundStorage');
    const acStatus = getAutoCompoundStatus(chainId, params.validatorAddress);
    
    let grantee: string | undefined;
    if (acStatus && acStatus.granteeAddress && acStatus.granteeAddress !== 'auto') {
      // Use the custom grantee that was stored when enabled
      grantee = acStatus.granteeAddress;
      console.log('✅ Using stored grantee address:', grantee);
    } else {
      console.log('⚠️ No stored grantee found, will query blockchain for actual grant');
    }
    
    console.log('🔧 Initial disable auto-compound setup:', {
      chainId,
      validator: params.validatorAddress,
      delegator: delegatorAddress,
      granteeFromStorage: grantee,
      storedGrantee: acStatus?.granteeAddress
    });

    // Query existing grants to find the ACTUAL grantee address
    let actualGranteeFound = false;
    try {
      // Use REST API endpoint instead of RPC
      const restEndpoint = chain.api?.[0]?.address || rpcEndpoint.replace(':26657', ':1317');
      
      console.log(`🔍 Querying all grants for: ${delegatorAddress}`);
      
      // First, try to get all grants for this granter
      const allGrantsQuery = await fetch(`${restEndpoint}/cosmos/authz/v1beta1/grants/granter/${delegatorAddress}`);
      if (allGrantsQuery.ok) {
        const allGrantsData = await allGrantsQuery.json();
        console.log('📋 All grants found:', allGrantsData);
        
        // Look for StakeAuthorization grants (for MsgDelegate)
        const delegateGrants = allGrantsData.grants?.filter((g: any) => {
          const authType = g.authorization?.['@type'] || '';
          return authType.includes('StakeAuthorization') || authType.includes('GenericAuthorization');
        }) || [];
        
        if (delegateGrants.length > 0) {
          console.log(`✅ Found ${delegateGrants.length} staking authorization grant(s)`);
          
          // Check if any grant is for the specific validator
          const validatorGrant = delegateGrants.find((g: any) => {
            const allowList = g.authorization?.allow_list?.address || [];
            return allowList.includes(params.validatorAddress);
          });
          
          if (validatorGrant) {
            // Use the grantee from the validator-specific grant
            grantee = validatorGrant.grantee;
            actualGranteeFound = true;
            console.log(`✅ Found validator-specific grant with grantee: ${grantee}`);
          } else {
            // Use the first staking authorization grant
            grantee = delegateGrants[0].grantee;
            actualGranteeFound = true;
            console.log(`✅ Using first staking grant grantee: ${grantee}`);
          }
        } else {
          console.warn('⚠️ No staking authorization grants found');
          throw new Error('No active auto-compound authorization found. Please enable auto-compound first or the authorization may have expired.');
        }
      } else {
        console.error('❌ Failed to query grants:', await allGrantsQuery.text());
      }
    } catch (queryError: any) {
      console.error('❌ Error querying grants:', queryError);
      
      if (!actualGranteeFound) {
        // If we couldn't find the grant, return error immediately instead of trying to revoke
        throw new Error(`Could not find active auto-compound authorization. ${queryError.message || 'Please try enabling auto-compound again.'}`);
      }
    }
    
    if (!actualGranteeFound) {
      throw new Error('No active auto-compound authorization found for this validator. Please enable auto-compound first.');
    }
    
    if (!grantee) {
      throw new Error('Unable to determine bot address. Please enable auto-compound again.');
    }
    
    console.log('✅ Final revoke parameters:', {
      granter: delegatorAddress,
      grantee: grantee,
      msgTypeUrl: '/cosmos.staking.v1beta1.MsgDelegate'
    });

    const revokeMsg = {
      typeUrl: '/cosmos.authz.v1beta1.MsgRevoke',
      value: {
        granter: delegatorAddress,
        grantee: grantee,
        msgTypeUrl: '/cosmos.staking.v1beta1.MsgDelegate'
      }
    };

    const fee = calculateFee(chain, '200000');
    
    // For EVM chains, use special signing method
    if (isEvmChain) {
      try {
        const restEndpoint = chain.api?.[0]?.address || rpcEndpoint.replace(':26657', ':1317');
        
        console.log('🔧 Using EVM signing for auto-compound revoke');
        
        // Sign transaction for EVM chain
        const signedTx = await signTransactionForEvm(
          offlineSigner,
          chainId,
          restEndpoint,
          delegatorAddress,
          [revokeMsg],
          fee,
          'Disable Auto-Compound via WinScan',
          coinType,
          false
        );
        
        // Broadcast transaction
        const broadcastResult = await broadcastTransaction(restEndpoint, signedTx);
        
        if (broadcastResult.code === 0 || !broadcastResult.code) {
          // Update localStorage
          const { saveAutoCompoundStatus } = await import('./autoCompoundStorage');
          saveAutoCompoundStatus(chainId, params.validatorAddress, false, coinType);
          
          return {
            success: true,
            txHash: broadcastResult.txhash,
          };
        } else {
          return {
            success: false,
            error: broadcastResult.raw_log || 'Failed to disable auto-compound',
          };
        }
      } catch (evmError: any) {
        console.error('❌ EVM auto-compound disable failed:', evmError);
        return { success: false, error: evmError.message };
      }
    }
    
    // Standard Cosmos SDK signing for non-EVM chains
    const result = await client.signAndBroadcast(
      delegatorAddress,
      [revokeMsg],
      fee,
      'Disable Auto-Compound via WinScan'
    );

    if (result.code === 0) {
      // Update localStorage
      const { saveAutoCompoundStatus } = await import('./autoCompoundStorage');
      saveAutoCompoundStatus(chainId, params.validatorAddress, false, coinType);

      return {
        success: true,
        txHash: result.transactionHash,
      };
    } else {
      return {
        success: false,
        error: result.rawLog || 'Failed to disable auto-compound',
      };
    }
  } catch (error: any) {
    console.error('❌ Disable auto-compound error:', error);
    return { success: false, error: error.message || 'Failed to disable auto-compound' };
  }
}

// ============ LIQUIDITY FUNCTIONS ============

export async function executeProvideLiquidity(
  chain: ChainData,
  params: {
    prc20Address: string;
    paxiAmount: string;
    prc20Amount: string;
  },
  gasLimit: string = '600000',
  memo: string = ''
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  try {
    if (!isKeplrInstalled()) {
      throw new Error('Keplr extension is not installed');
    }

    const keplr = window.keplr!;
    let chainId = (chain.chain_id || chain.chain_name).trim();
    
    console.log('💧 executeProvideLiquidity:', {
      prc20: params.prc20Address,
      paxiAmount: params.paxiAmount,
      prc20Amount: params.prc20Amount,
      chainId: chainId
    });
    
    await keplr.enable(chainId);
    
    const offlineSigner = await keplr.getOfflineSignerAuto(chainId);
    
    // @ts-ignore - Import required modules
    const { SigningStargateClient } = await import('@cosmjs/stargate');
    // @ts-ignore
    const { SigningCosmWasmClient } = await import('@cosmjs/cosmwasm-stargate');
    // @ts-ignore
    const { Registry, defaultRegistryTypes } = await import('@cosmjs/stargate');
    // @ts-ignore
    const { GasPrice } = await import('@cosmjs/stargate');
    // @ts-ignore
    const protobuf = await import('protobufjs/minimal');
    
    // Create MsgProvideLiquidity interface
    const MsgProvideLiquidity = {
      encode(message: any, writer: any = protobuf.Writer.create()) {
        if (message.creator !== '') {
          writer.uint32(10).string(message.creator);
        }
        if (message.prc20 !== '') {
          writer.uint32(18).string(message.prc20);
        }
        if (message.paxiAmount !== '') {
          writer.uint32(26).string(message.paxiAmount);
        }
        if (message.prc20Amount !== '') {
          writer.uint32(34).string(message.prc20Amount);
        }
        return writer;
      },
      decode(input: any, length?: number) {
        const reader = input instanceof protobuf.Reader ? input : new protobuf.Reader(input);
        let end = length === undefined ? reader.len : reader.pos + length;
        const message: any = {
          creator: '',
          prc20: '',
          paxiAmount: '',
          prc20Amount: ''
        };
        while (reader.pos < end) {
          const tag = reader.uint32();
          switch (tag >>> 3) {
            case 1:
              message.creator = reader.string();
              break;
            case 2:
              message.prc20 = reader.string();
              break;
            case 3:
              message.paxiAmount = reader.string();
              break;
            case 4:
              message.prc20Amount = reader.string();
              break;
            default:
              reader.skipType(tag & 7);
              break;
          }
        }
        return message;
      },
      fromJSON(object: any) {
        return {
          creator: object.creator ?? '',
          prc20: object.prc20 ?? '',
          paxiAmount: object.paxiAmount ?? '',
          prc20Amount: object.prc20Amount ?? ''
        };
      },
      toJSON(message: any) {
        return {
          creator: message.creator,
          prc20: message.prc20,
          paxiAmount: message.paxiAmount,
          prc20Amount: message.prc20Amount
        };
      },
      fromPartial(object: any) {
        return {
          creator: object.creator ?? '',
          prc20: object.prc20 ?? '',
          paxiAmount: object.paxiAmount ?? '',
          prc20Amount: object.prc20Amount ?? ''
        };
      }
    };
    
    // @ts-ignore - Registry types are complex
    const registry = new Registry([
      ...defaultRegistryTypes,
      ['/x.swap.types.MsgProvideLiquidity', MsgProvideLiquidity],
    ]);
    
    console.log('✅ Custom registry created with MsgProvideLiquidity');
    
    let rpcEndpoint = '';
    const rpcList = chain.rpc || [];
    
    for (const rpc of rpcList) {
      if (rpc.tx_index === 'on') {
        rpcEndpoint = rpc.address;
        break;
      }
    }
    
    if (!rpcEndpoint && rpcList.length > 0) {
      rpcEndpoint = rpcList[0].address;
    }
    
    if (!rpcEndpoint) {
      throw new Error('No RPC endpoint available for this chain');
    }

    const clientOptions: any = {
      registry,
      broadcastTimeoutMs: 30000,
      broadcastPollIntervalMs: 3000,
    };

    const client = await SigningStargateClient.connectWithSigner(
      rpcEndpoint, 
      offlineSigner,
      clientOptions
    );
    
    console.log('✅ SigningStargateClient connected with custom registry');
    
    const accounts = await offlineSigner.getAccounts();
    const signerAddress = accounts[0].address;
    
    console.log('👤 Signer address:', signerAddress);

    // Step 1: Increase allowance for swap module
    const SWAP_MODULE_ACCOUNT = 'paxi1mfru9azs5nua2wxcd4sq64g5nt7nn4n80r745t';
    
    console.log('🔐 Increasing allowance for swap module...');
    
    try {
      const wasmClient = await SigningCosmWasmClient.connectWithSigner(
        rpcEndpoint,
        offlineSigner,
        { gasPrice: GasPrice.fromString('0.025upaxi') }
      );
      
      await ensurePRC20Allowance(
        wasmClient,
        signerAddress,
        params.prc20Address,
        SWAP_MODULE_ACCOUNT,
        params.prc20Amount,
        chain
      );
      
      console.log('✅ Allowance increased');
      
    } catch (error: any) {
      console.error('❌ Allowance increase failed:', error);
      throw new Error(`Failed to increase allowance: ${error.message}`);
    }

    // Step 2: Provide liquidity
    // Note: paxiAmount needs to include denom suffix
    const provideLiquidityMsg = {
      typeUrl: '/x.swap.types.MsgProvideLiquidity',
      value: {
        creator: signerAddress,
        prc20: params.prc20Address,
        paxiAmount: `${params.paxiAmount}upaxi`,
        prc20Amount: params.prc20Amount,
      },
    };

    const fee = calculateFee(chain, gasLimit);

    console.log('📡 Sending provide liquidity transaction...');

    const result = await client.signAndBroadcast(
      signerAddress,
      [provideLiquidityMsg],
      fee,
      memo
    );

    if (result.code === 0) {
      console.log('✅ Liquidity provided successfully! TxHash:', result.transactionHash);
      return {
        success: true,
        txHash: result.transactionHash,
      };
    } else {
      console.error('❌ Provide liquidity failed:', result.rawLog);
      return {
        success: false,
        error: result.rawLog || 'Failed to provide liquidity',
      };
    }
  } catch (error: any) {
    console.error('❌ Provide liquidity error:', error);
    return { success: false, error: error.message || 'Failed to provide liquidity' };
  }
}

export async function executeWithdrawLiquidity(
  chain: ChainData,
  params: {
    prc20Address: string;
    lpAmount: string;
  },
  gasLimit: string = '300000',
  memo: string = ''
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  try {
    if (!isKeplrInstalled()) {
      throw new Error('Keplr extension is not installed');
    }

    const keplr = window.keplr!;
    let chainId = (chain.chain_id || chain.chain_name).trim();
    
    console.log('💸 executeWithdrawLiquidity:', {
      prc20: params.prc20Address,
      lpAmount: params.lpAmount,
      chainId: chainId
    });
    
    await keplr.enable(chainId);
    
    const offlineSigner = await keplr.getOfflineSignerAuto(chainId);
    
    // @ts-ignore - Import required modules
    const { SigningStargateClient } = await import('@cosmjs/stargate');
    // @ts-ignore
    const { Registry, defaultRegistryTypes } = await import('@cosmjs/stargate');
    // @ts-ignore
    const protobuf = await import('protobufjs/minimal');
    
    // Create MsgWithdrawLiquidity interface
    const MsgWithdrawLiquidity = {
      encode(message: any, writer: any = protobuf.Writer.create()) {
        if (message.creator !== '') {
          writer.uint32(10).string(message.creator);
        }
        if (message.prc20 !== '') {
          writer.uint32(18).string(message.prc20);
        }
        if (message.lpAmount !== '') {
          writer.uint32(26).string(message.lpAmount);
        }
        return writer;
      },
      decode(input: any, length?: number) {
        const reader = input instanceof protobuf.Reader ? input : new protobuf.Reader(input);
        let end = length === undefined ? reader.len : reader.pos + length;
        const message: any = {
          creator: '',
          prc20: '',
          lpAmount: ''
        };
        while (reader.pos < end) {
          const tag = reader.uint32();
          switch (tag >>> 3) {
            case 1:
              message.creator = reader.string();
              break;
            case 2:
              message.prc20 = reader.string();
              break;
            case 3:
              message.lpAmount = reader.string();
              break;
            default:
              reader.skipType(tag & 7);
              break;
          }
        }
        return message;
      },
      fromJSON(object: any) {
        return {
          creator: object.creator ?? '',
          prc20: object.prc20 ?? '',
          lpAmount: object.lpAmount ?? ''
        };
      },
      toJSON(message: any) {
        return {
          creator: message.creator,
          prc20: message.prc20,
          lpAmount: message.lpAmount
        };
      },
      fromPartial(object: any) {
        return {
          creator: object.creator ?? '',
          prc20: object.prc20 ?? '',
          lpAmount: object.lpAmount ?? ''
        };
      }
    };
    
    // @ts-ignore - Registry types are complex
    const registry = new Registry([
      ...defaultRegistryTypes,
      ['/x.swap.types.MsgWithdrawLiquidity', MsgWithdrawLiquidity],
    ]);
    
    console.log('✅ Custom registry created with MsgWithdrawLiquidity');
    
    let rpcEndpoint = '';
    const rpcList = chain.rpc || [];
    
    for (const rpc of rpcList) {
      if (rpc.tx_index === 'on') {
        rpcEndpoint = rpc.address;
        break;
      }
    }
    
    if (!rpcEndpoint && rpcList.length > 0) {
      rpcEndpoint = rpcList[0].address;
    }
    
    if (!rpcEndpoint) {
      throw new Error('No RPC endpoint available for this chain');
    }

    const clientOptions: any = {
      registry,
      broadcastTimeoutMs: 30000,
      broadcastPollIntervalMs: 3000,
    };

    const client = await SigningStargateClient.connectWithSigner(
      rpcEndpoint, 
      offlineSigner,
      clientOptions
    );
    
    console.log('✅ SigningStargateClient connected with custom registry');
    
    const accounts = await offlineSigner.getAccounts();
    const signerAddress = accounts[0].address;
    
    console.log('👤 Signer address:', signerAddress);

    const withdrawMsg = {
      typeUrl: '/x.swap.types.MsgWithdrawLiquidity',
      value: {
        creator: signerAddress,
        prc20: params.prc20Address,
        lpAmount: params.lpAmount,
      },
    };

    const fee = calculateFee(chain, gasLimit);

    console.log('📡 Sending withdraw liquidity transaction...');

    const result = await client.signAndBroadcast(
      signerAddress,
      [withdrawMsg],
      fee,
      memo
    );

    if (result.code === 0) {
      console.log('✅ Liquidity withdrawn successfully! TxHash:', result.transactionHash);
      return {
        success: true,
        txHash: result.transactionHash,
      };
    } else {
      console.error('❌ Withdraw liquidity failed:', result.rawLog);
      return {
        success: false,
        error: result.rawLog || 'Failed to withdraw liquidity',
      };
    }
  } catch (error: any) {
    console.error('❌ Withdraw liquidity error:', error);
    return { success: false, error: error.message || 'Failed to withdraw liquidity' };
  }
}

