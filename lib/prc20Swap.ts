import { SigningCosmWasmClient } from '@cosmjs/cosmwasm-stargate';
import { SigningStargateClient, defaultRegistryTypes } from '@cosmjs/stargate';
import { Registry, EncodeObject } from '@cosmjs/proto-signing';
import { coins, StdFee, GasPrice } from '@cosmjs/stargate';

// Swap contract address (from transaction analysis)
export const SWAP_MODULE_ADDRESS = 'paxi1mfru9azs5nua2wxcd4sq64g5nt7nn4n80r745t';

// Gas configuration for Paxi network
export const GAS_CONFIG = {
  // Gas limits for different operations (based on actual usage)
  INCREASE_ALLOWANCE: 250_000,  // Actual: ~230k, so use 250k for safety
  SWAP: 250_000,
  PROVIDE_LIQUIDITY: 300_000,
  WITHDRAW_LIQUIDITY: 250_000,
  TRANSFER_PRC20: 150_000,
  TRANSFER_NATIVE: 100_000,
  
  // Gas price (0.025 upaxi per gas unit)
  GAS_PRICE: '0.025',
};

/**
 * Calculate fee from gas limit
 * @param gasLimit - gas limit for the transaction
 * @param gasPrice - gas price in upaxi (default: 0.025)
 * @returns StdFee object
 */
export function calculateFee(gasLimit: number, gasPrice: string = GAS_CONFIG.GAS_PRICE): StdFee {
  const gasPriceNum = parseFloat(gasPrice);
  const feeAmount = Math.ceil(gasLimit * gasPriceNum);
  
  return {
    amount: coins(feeAmount, 'upaxi'),
    gas: gasLimit.toString(),
  };
}

/**
 * Calculate optimal gas limit with multiplier for safety
 * @param baseGas - base gas limit
 * @param multiplier - safety multiplier (default: 1.3 for 30% buffer)
 */
export function calculateGasWithBuffer(baseGas: number, multiplier: number = 1.3): number {
  return Math.ceil(baseGas * multiplier);
}

/**
 * Official Paxi Messages from API Documentation:
 * 
 * POST /tx/swap/provide_liquidity - typesMsgProvideLiquidity
 * POST /tx/swap/swap - typesMsgSwap  
 * POST /tx/swap/withdraw_liquidity - typesMsgWithdrawLiquidity
 * 
 * GET /paxi/swap/pool/{prc20} - Query pool info
 * GET /paxi/swap/position/{creator}/{prc20} - Query position
 * GET /paxi/swap/all_pools - Query all pools
 */

/**
 * Create Amino converters for Paxi Swap module
 * Returns amino types for use with AminoTypes
 */
export function createPaxiSwapAminoConverters() {
  return {
    '/x.swap.types.MsgSwap': {
      aminoType: 'paxi/swap/MsgSwap',
      toAmino: (value: any) => ({
        creator: value.creator,
        prc20: value.prc20,
        offer_denom: value.offerDenom || value.offer_denom,
        offer_amount: value.offerAmount || value.offer_amount,
        min_receive: value.minReceive || value.min_receive,
      }),
      fromAmino: (value: any) => ({
        creator: value.creator,
        prc20: value.prc20,
        offerDenom: value.offer_denom,
        offerAmount: value.offer_amount,
        minReceive: value.min_receive,
      }),
    },
    '/x.swap.types.MsgProvideLiquidity': {
      aminoType: 'paxi/swap/MsgProvideLiquidity',
      toAmino: (value: any) => ({
        creator: value.creator,
        prc20: value.prc20,
        paxi_amount: value.paxiAmount || value.paxi_amount,
        prc20_amount: value.prc20Amount || value.prc20_amount,
      }),
      fromAmino: (value: any) => ({
        creator: value.creator,
        prc20: value.prc20,
        paxiAmount: value.paxi_amount,
        prc20Amount: value.prc20_amount,
      }),
    },
    '/x.swap.types.MsgWithdrawLiquidity': {
      aminoType: 'paxi/swap/MsgWithdrawLiquidity',
      toAmino: (value: any) => ({
        creator: value.creator,
        prc20: value.prc20,
        lp_amount: value.lpAmount || value.lp_amount,
      }),
      fromAmino: (value: any) => ({
        creator: value.creator,
        prc20: value.prc20,
        lpAmount: value.lp_amount,
      }),
    },
  };
}

/**
 * Swap PRC20 Token to PAXI
 * According to official docs: POST /tx/swap/swap with typesMsgSwap
 * 
 * CLI equivalent:
 * paxid tx wasm execute <prc20> '{"increase_allowance":{"spender":"swap_module","amount":"<amount>"}}' --gas 150000 --fees 3750upaxi
 * paxid tx swap swap --prc20 <prc20> --offer-denom <prc20> --offer-amount <amount> --min-receive <min> --gas 250000 --fees 6250upaxi
 * 
 * @param creator - sender address
 * @param prc20 - PRC20 contract address
 * @param offerAmount - amount to swap
 * @param minReceive - minimum amount to receive (slippage protection)
 * @param customGasPrice - optional custom gas price (default: 0.025 upaxi)
 */
export async function swapTokenToPAXI(
  client: SigningCosmWasmClient,
  creator: string,
  prc20: string,
  offerAmount: string,
  minReceive: string = '1',
  customGasPrice?: string
) {
  // Step 1: Increase allowance for swap module
  const increaseAllowanceMsg = {
    increase_allowance: {
      spender: SWAP_MODULE_ADDRESS,
      amount: offerAmount,
    },
  };

  // Calculate fee for allowance (150k gas @ 0.025 = 3750 upaxi)
  const allowanceFee = calculateFee(
    GAS_CONFIG.INCREASE_ALLOWANCE,
    customGasPrice || GAS_CONFIG.GAS_PRICE
  );

  console.log('Executing increase_allowance with fee:', allowanceFee);
  
  const allowanceTx = await client.execute(
    creator,
    prc20,
    increaseAllowanceMsg,
    allowanceFee,
    'Approve token for swap'
  );

  console.log('Allowance approved, tx hash:', allowanceTx.transactionHash);

  // Step 2: Create MsgSwap message (official typesMsgSwap structure)
  const swapMsg = {
    typeUrl: '/x.swap.types.MsgSwap',
    value: {
      creator,           // string - sender address
      prc20,            // string - PRC20 contract address
      offerDenom: prc20, // string - "upaxi" or PRC20 contract address
      offerAmount,      // string - supports big.Int
      minReceive,       // string - slippage protection
    },
  };

  // Calculate fee for swap (250k gas @ 0.025 = 6250 upaxi)
  const swapFee = calculateFee(
    GAS_CONFIG.SWAP,
    customGasPrice || GAS_CONFIG.GAS_PRICE
  );

  return {
    allowanceTxHash: allowanceTx.transactionHash,
    message: swapMsg,
    estimatedFee: swapFee,
  };
}

/**
 * Swap PAXI to PRC20 Token
 * Direct MsgSwap with funds (official typesMsgSwap structure)
 * 
 * CLI equivalent:
 * paxid tx swap swap --prc20 <prc20> --offer-denom upaxi --offer-amount <amount> --min-receive <min> --gas 250000 --fees 6250upaxi
 * 
 * NOTE: NO allowance needed for native PAXI token!
 * 
 * @param creator - sender address
 * @param prc20 - PRC20 contract address
 * @param offerAmount - amount of PAXI to swap (in upaxi)
 * @param minReceive - minimum amount of tokens to receive
 * @param customGasPrice - optional custom gas price (default: 0.025 upaxi)
 */
export async function swapPAXIToToken(
  creator: string,
  prc20: string,
  offerAmount: string,
  minReceive: string = '1',
  customGasPrice?: string
) {
  const swapMsg = {
    typeUrl: '/x.swap.types.MsgSwap',
    value: {
      creator,              // string - sender address
      prc20,               // string - PRC20 contract address
      offerDenom: 'upaxi', // string - "upaxi" for native PAXI
      offerAmount,         // string - amount in upaxi (supports big.Int)
      minReceive,          // string - slippage protection
    },
  };

  // Calculate fee for swap (250k gas @ 0.025 = 6250 upaxi)
  const swapFee = calculateFee(
    GAS_CONFIG.SWAP,
    customGasPrice || GAS_CONFIG.GAS_PRICE
  );

  return {
    message: swapMsg,
    estimatedFee: swapFee,
  };
}

/**
 * Transfer PRC20 Token
 * Using MsgExecuteContract with transfer action
 * @param customGasPrice - optional custom gas price (default: 0.025 upaxi)
 */
export async function transferPRC20Token(
  client: SigningCosmWasmClient,
  senderAddress: string,
  tokenContract: string,
  recipientAddress: string,
  amount: string,
  memo?: string,
  customGasPrice?: string
) {
  const transferMsg = {
    transfer: {
      recipient: recipientAddress,
      amount: amount,
    },
  };

  // Calculate fee (150k gas @ 0.025 = 3750 upaxi)
  const fee = calculateFee(
    GAS_CONFIG.TRANSFER_PRC20,
    customGasPrice || GAS_CONFIG.GAS_PRICE
  );
  
  const result = await client.execute(
    senderAddress,
    tokenContract,
    transferMsg,
    fee,
    memo || 'PRC20 token transfer'
  );

  return result;
}

/**
 * Transfer Native PAXI
 * Using MsgSend
 * @param customGasPrice - optional custom gas price (default: 0.025 upaxi)
 */
export async function transferNativePAXI(
  client: SigningCosmWasmClient,
  senderAddress: string,
  recipientAddress: string,
  amount: string,
  memo?: string,
  customGasPrice?: string
) {
  // Calculate fee (100k gas @ 0.025 = 2500 upaxi)
  const fee = calculateFee(
    GAS_CONFIG.TRANSFER_NATIVE,
    customGasPrice || GAS_CONFIG.GAS_PRICE
  );
  
  const result = await client.sendTokens(
    senderAddress,
    recipientAddress,
    coins(amount, 'upaxi'),
    fee,
    memo || 'PAXI transfer'
  );

  return result;
}

/**
 * Get token balance (PRC20)
 */
export async function getTokenBalance(
  client: SigningCosmWasmClient,
  tokenContract: string,
  address: string
): Promise<string> {
  const queryMsg = {
    balance: {
      address: address,
    },
  };

  const result = await client.queryContractSmart(tokenContract, queryMsg);
  return result.balance || '0';
}

/**
 * Get native PAXI balance
 * Uses Cosmos bank API: GET /cosmos/bank/v1beta1/balances/{address}
 */
export async function getNativeBalance(
  lcdEndpoint: string,
  address: string,
  denom: string = 'upaxi'
): Promise<string> {
  try {
    const response = await fetch(
      `${lcdEndpoint}/cosmos/bank/v1beta1/balances/${address}`
    );
    
    if (!response.ok) {
      console.error('Failed to fetch native balance:', response.statusText);
      return '0';
    }
    
    const data = await response.json();
    const balance = data.balances?.find((b: any) => b.denom === denom);
    
    return balance?.amount || '0';
  } catch (error) {
    console.error('Error fetching native balance:', error);
    return '0';
  }
}

/**
 * Get all balances for an address
 * Uses Cosmos bank API: GET /cosmos/bank/v1beta1/balances/{address}
 */
export async function getAllBalances(
  lcdEndpoint: string,
  address: string
): Promise<Array<{ denom: string; amount: string }>> {
  try {
    const response = await fetch(
      `${lcdEndpoint}/cosmos/bank/v1beta1/balances/${address}`
    );
    
    if (!response.ok) {
      return [];
    }
    
    const data = await response.json();
    return data.balances || [];
  } catch (error) {
    console.error('Error fetching all balances:', error);
    return [];
  }
}

/**
 * Get token allowance
 */
export async function getTokenAllowance(
  client: SigningCosmWasmClient,
  tokenContract: string,
  owner: string,
  spender: string
): Promise<string> {
  const queryMsg = {
    allowance: {
      owner: owner,
      spender: spender,
    },
  };

  const result = await client.queryContractSmart(tokenContract, queryMsg);
  return result.allowance || '0';
}

/**
 * Calculate swap output from pool reserves (using constant product formula)
 * @param amountIn - input amount
 * @param reserveIn - reserve of input token in pool
 * @param reserveOut - reserve of output token in pool
 * @param feeRate - swap fee rate (default 0.003 = 0.3%)
 * @returns estimated output amount and price impact
 */
export function calculateSwapOutput(
  amountIn: string,
  reserveIn: string,
  reserveOut: string,
  feeRate: number = 0.003
): { estimatedOutput: string; priceImpact: string; effectivePrice: string } {
  const amountInBig = BigInt(amountIn);
  const reserveInBig = BigInt(reserveIn);
  const reserveOutBig = BigInt(reserveOut);
  
  // Apply fee
  const feeMultiplier = Math.floor((1 - feeRate) * 1000);
  const amountInWithFee = (amountInBig * BigInt(feeMultiplier)) / BigInt(1000);
  
  // Constant product formula: (x + Δx) * (y - Δy) = x * y
  // Δy = (y * Δx) / (x + Δx)
  const numerator = reserveOutBig * amountInWithFee;
  const denominator = reserveInBig + amountInWithFee;
  const amountOut = numerator / denominator;
  
  // Calculate price impact
  // Price impact = (amountOut / reserveOut) * 100
  const priceImpact = Number((amountOut * BigInt(10000)) / reserveOutBig) / 100;
  
  // Effective price
  const effectivePrice = Number(amountInBig * BigInt(1000000) / amountOut) / 1000000;
  
  return {
    estimatedOutput: amountOut.toString(),
    priceImpact: priceImpact.toFixed(4),
    effectivePrice: effectivePrice.toFixed(6),
  };
}

/**
 * Estimate swap with real pool data
 */
export async function estimateSwapOutput(
  lcdEndpoint: string,
  prc20: string,
  offerDenom: string,
  offerAmount: string
): Promise<{
  estimatedOutput: string;
  priceImpact: string;
  effectivePrice: string;
  minimumReceived: string;
  fee: string;
} | null> {
  try {
    // Get pool info
    const pool = await queryPool(lcdEndpoint, prc20);
    if (!pool) return null;
    
    const isOfferPaxi = offerDenom === 'upaxi';
    const reserveIn = isOfferPaxi ? pool.reservePaxi : pool.reservePrc20;
    const reserveOut = isOfferPaxi ? pool.reservePrc20 : pool.reservePaxi;
    
    const result = calculateSwapOutput(offerAmount, reserveIn, reserveOut);
    
    // Calculate minimum received with 0.5% slippage
    const minReceived = (BigInt(result.estimatedOutput) * BigInt(995)) / BigInt(1000);
    
    return {
      ...result,
      minimumReceived: minReceived.toString(),
      fee: '0.003', // 0.3% swap fee
    };
  } catch (error) {
    console.error('Error estimating swap:', error);
    return null;
  }
}

/**
 * Provide Liquidity (PUMP feature - Initial mint/funding)
 * POST /tx/swap/provide_liquidity from official docs
 * Creates or adds to liquidity pool for a PRC20 token
 * Target tercapai → Token dibagikan ke liquidity providers
 * 
 * @param creator - sender address
 * @param prc20 - PRC20 contract address
 * @param paxiAmount - amount of PAXI to provide (in upaxi)
 * @param prc20Amount - amount of PRC20 tokens to provide
 * @param customGasPrice - optional custom gas price (default: 0.025 upaxi)
 */
export async function provideLiquidity(
  client: SigningCosmWasmClient,
  creator: string,
  prc20: string,
  paxiAmount: string,
  prc20Amount: string,
  customGasPrice?: string
) {
  // Step 1: Approve PRC20 tokens for swap module
  const approveMsg = {
    increase_allowance: {
      spender: SWAP_MODULE_ADDRESS,
      amount: prc20Amount,
    },
  };

  // Calculate fee for allowance (150k gas @ 0.025 = 3750 upaxi)
  const approveFee = calculateFee(
    GAS_CONFIG.INCREASE_ALLOWANCE,
    customGasPrice || GAS_CONFIG.GAS_PRICE
  );

  const approveTx = await client.execute(
    creator,
    prc20,
    approveMsg,
    approveFee,
    'Approve tokens for liquidity'
  );

  // Step 2: Create MsgProvideLiquidity message (official structure)
  const provideLiquidityMsg = {
    typeUrl: '/x.swap.types.MsgProvideLiquidity',
    value: {
      creator,        // string - sender address
      prc20,          // string - PRC20 contract address
      paxiAmount,     // string - amount of PAXI (upaxi)
      prc20Amount,    // string - amount of PRC20 tokens
    },
  };

  // Calculate fee for provide liquidity (300k gas @ 0.025 = 7500 upaxi)
  const liquidityFee = calculateFee(
    GAS_CONFIG.PROVIDE_LIQUIDITY,
    customGasPrice || GAS_CONFIG.GAS_PRICE
  );

  return {
    approveTxHash: approveTx.transactionHash,
    message: provideLiquidityMsg,
    estimatedFee: liquidityFee,
  };
}

/**
 * Withdraw Liquidity
 * POST /tx/swap/withdraw_liquidity from official docs
 * Removes liquidity from pool and returns tokens
 * 
 * @param creator - sender address
 * @param prc20 - PRC20 contract address
 * @param lpAmount - amount of LP tokens to burn
 * @param customGasPrice - optional custom gas price (default: 0.025 upaxi)
 */
export function withdrawLiquidity(
  creator: string,
  prc20: string,
  lpAmount: string,
  customGasPrice?: string
) {
  const withdrawMsg = {
    typeUrl: '/x.swap.types.MsgWithdrawLiquidity',
    value: {
      creator,      // string - sender address
      prc20,        // string - PRC20 contract address
      lpAmount,     // string - amount of LP tokens
    },
  };

  // Calculate fee (250k gas @ 0.025 = 6250 upaxi)
  const withdrawFee = calculateFee(
    GAS_CONFIG.WITHDRAW_LIQUIDITY,
    customGasPrice || GAS_CONFIG.GAS_PRICE
  );

  return {
    message: withdrawMsg,
    estimatedFee: withdrawFee,
  };
}

/**
 * Query Pool Information
 * GET /paxi/swap/pool/{prc20} from official docs
 * Returns pool reserves, prices, and total shares
 */
export async function queryPool(
  lcdEndpoint: string,
  prc20: string
): Promise<{
  prc20: string;
  reservePaxi: string;
  reservePrc20: string;
  pricePaxiPerPrc20: string;
  pricePrc20PerPaxi: string;
  totalShares: string;
} | null> {
  try {
    const response = await fetch(`${lcdEndpoint}/paxi/swap/pool/${prc20}`);
    
    if (!response.ok) {
      console.error(`Failed to query pool ${prc20}:`, response.status, response.statusText);
      return null;
    }
    
    const data = await response.json();
    
    // Validate response structure
    if (!data || !data.pool) {
      console.error('Invalid pool response structure:', data);
      return null;
    }
    
    const pool = data.pool;
    
    return {
      prc20: pool.prc20 || prc20,
      reservePaxi: pool.reserve_paxi || pool.reservePaxi || '0',
      reservePrc20: pool.reserve_prc20 || pool.reservePrc20 || '0',
      pricePaxiPerPrc20: pool.price_paxi_per_prc20 || pool.pricePaxiPerPrc20 || '0',
      pricePrc20PerPaxi: pool.price_prc20_per_paxi || pool.pricePrc20PerPaxi || '0',
      totalShares: pool.total_shares || pool.totalShares || '0',
    };
  } catch (error) {
    console.error('Error querying pool:', error);
    return null;
  }
}

/**
 * Query User Position (LP Position)
 * GET /paxi/swap/position/{creator}/{prc20} from official docs
 * Returns user's LP position and expected amounts
 */
export async function queryPosition(
  lcdEndpoint: string,
  creator: string,
  prc20: string
): Promise<{
  position: {
    creator: string;
    prc20: string;
    lpAmount: string;
  };
  expectedPaxi: string;
  expectedPrc20: string;
} | null> {
  try {
    const response = await fetch(`${lcdEndpoint}/paxi/swap/position/${creator}/${prc20}`);
    if (!response.ok) return null;
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error querying position:', error);
    return null;
  }
}

/**
 * Query All Pools
 * GET /paxi/swap/all_pools from official docs
 * Returns list of all liquidity pools
 */
export async function queryAllPools(
  lcdEndpoint: string
): Promise<Array<{
  prc20: string;
  reservePaxi: string;
  reservePrc20: string;
  pricePaxiPerPrc20: string;
  pricePrc20PerPaxi: string;
  totalShares: string;
}>> {
  try {
    const response = await fetch(`${lcdEndpoint}/paxi/swap/all_pools`);
    if (!response.ok) return [];
    const data = await response.json();
    
    // Normalize response
    const pools = data.pools || data.pool || [];
    
    return pools.map((pool: any) => ({
      prc20: pool.prc20,
      reservePaxi: pool.reserve_paxi || pool.reservePaxi || '0',
      reservePrc20: pool.reserve_prc20 || pool.reservePrc20 || '0',
      pricePaxiPerPrc20: pool.price_paxi_per_prc20 || pool.pricePaxiPerPrc20 || '0',
      pricePrc20PerPaxi: pool.price_prc20_per_paxi || pool.pricePrc20PerPaxi || '0',
      totalShares: pool.total_shares || pool.totalShares || '0',
    }));
  } catch (error) {
    console.error('Error querying all pools:', error);
    return [];
  }
}

/**
 * Query Swap Module Parameters
 * GET /paxi/swap/params from official docs
 * Returns swap fee rate and other parameters
 */
export async function querySwapParams(
  lcdEndpoint: string
): Promise<{
  feeRate: string;
  minLiquidityPaxi: string;
  minLiquidityPrc20: string;
} | null> {
  try {
    const response = await fetch(`${lcdEndpoint}/paxi/swap/params`);
    if (!response.ok) return null;
    const data = await response.json();
    
    return {
      feeRate: data.params?.fee_rate || '0.003',
      minLiquidityPaxi: data.params?.min_liquidity_paxi || '1000000',
      minLiquidityPrc20: data.params?.min_liquidity_prc20 || '1000000',
    };
  } catch (error) {
    console.error('Error querying swap params:', error);
    return null;
  }
}

/**
 * Calculate Pool Statistics (TVL, Volume, APR)
 */
export interface PoolStats {
  tvlUsd: number;
  volume24h: number;
  volume7d: number;
  fees24h: number;
  apr: number;
  priceChange24h: number;
}

export async function getPoolStats(
  lcdEndpoint: string,
  prc20: string,
  paxiPriceUsd: number = 0.01
): Promise<PoolStats | null> {
  try {
    const pool = await queryPool(lcdEndpoint, prc20);
    if (!pool) return null;
    
    // Calculate TVL
    const tvlPaxi = Number(pool.reservePaxi) / 1_000_000; // Convert from upaxi
    const tvlUsd = tvlPaxi * paxiPriceUsd * 2; // Both sides of pool
    
    // Mock volume and fees (would need historical data from indexer)
    // In production, you'd query transaction history or indexer
    const volume24h = tvlUsd * 0.1; // Mock: 10% of TVL
    const volume7d = volume24h * 7;
    const fees24h = volume24h * 0.003; // 0.3% fee
    
    // Calculate APR from fees
    const yearlyFees = fees24h * 365;
    const apr = (yearlyFees / tvlUsd) * 100;
    
    return {
      tvlUsd,
      volume24h,
      volume7d,
      fees24h,
      apr,
      priceChange24h: 0, // Would need price history
    };
  } catch (error) {
    console.error('Error calculating pool stats:', error);
    return null;
  }
}

/**
 * Get user's liquidity provider share percentage
 */
export async function getUserPoolShare(
  lcdEndpoint: string,
  creator: string,
  prc20: string
): Promise<{
  sharePercentage: number;
  lpAmount: string;
  expectedPaxi: string;
  expectedPrc20: string;
} | null> {
  try {
    const [position, pool] = await Promise.all([
      queryPosition(lcdEndpoint, creator, prc20),
      queryPool(lcdEndpoint, prc20),
    ]);
    
    if (!position || !pool) return null;
    
    const userLp = BigInt(position.position.lpAmount);
    const totalLp = BigInt(pool.totalShares);
    
    const sharePercentage = totalLp > BigInt(0) 
      ? Number((userLp * BigInt(10000)) / totalLp) / 100 
      : 0;
    
    return {
      sharePercentage,
      lpAmount: position.position.lpAmount,
      expectedPaxi: position.expectedPaxi,
      expectedPrc20: position.expectedPrc20,
    };
  } catch (error) {
    console.error('Error getting user pool share:', error);
    return null;
  }
}



/**
 * Create MsgProvideLiquidity for adding liquidity
 * POST /tx/swap/provide_liquidity
 */
export function createAddLiquidityMsg(
  creator: string,
  prc20: string,
  paxiAmount: string,
  prc20Amount: string
): EncodeObject {
  return {
    typeUrl: '/paxi.swap.v1.MsgProvideLiquidity',
    value: {
      creator,
      prc20,
      paxiAmount,
      prc20Amount
    }
  };
}

/**
 * Create MsgWithdrawLiquidity for removing liquidity
 * POST /tx/swap/withdraw_liquidity
 */
export function createRemoveLiquidityMsg(
  creator: string,
  prc20: string,
  lpAmount: string
): EncodeObject {
  return {
    typeUrl: '/paxi.swap.v1.MsgWithdrawLiquidity',
    value: {
      creator,
      prc20,
      lpAmount
    }
  };
}

/**
 * Calculate LP tokens to receive when adding liquidity
 * For first deposit: lpTokens = sqrt(paxiAmount * prc20Amount)
 * For subsequent deposits: lpTokens = min(paxiAmount / poolPaxi, prc20Amount / poolPrc20) * totalLpSupply
 */
export function calculateLPTokens(
  paxiAmount: string,
  prc20Amount: string,
  poolPaxi: string,
  poolPrc20: string,
  totalLpSupply: string
): string {
  const paxiIn = BigInt(paxiAmount);
  const prc20In = BigInt(prc20Amount);
  const reservePaxi = BigInt(poolPaxi);
  const reservePrc20 = BigInt(poolPrc20);
  const totalLp = BigInt(totalLpSupply);
  
  // First deposit
  if (totalLp === BigInt(0)) {
    // lpTokens = sqrt(paxiAmount * prc20Amount)
    const product = paxiIn * prc20In;
    const sqrt = BigInt(Math.floor(Math.sqrt(Number(product))));
    return sqrt.toString();
  }
  
  // Subsequent deposits
  // lpTokens = min(paxiAmount / poolPaxi, prc20Amount / poolPrc20) * totalLpSupply
  const lpFromPaxi = (paxiIn * totalLp) / reservePaxi;
  const lpFromPrc20 = (prc20In * totalLp) / reservePrc20;
  
  const lpTokens = lpFromPaxi < lpFromPrc20 ? lpFromPaxi : lpFromPrc20;
  
  return lpTokens.toString();
}

/**
 * Calculate amounts to receive when removing liquidity
 */
export function calculateRemoveLiquidityAmounts(
  lpAmount: string,
  poolPaxi: string,
  poolPrc20: string,
  totalLpSupply: string
): { paxiAmount: string; prc20Amount: string } {
  const lpTokens = BigInt(lpAmount);
  const reservePaxi = BigInt(poolPaxi);
  const reservePrc20 = BigInt(poolPrc20);
  const totalLp = BigInt(totalLpSupply);
  
  if (totalLp === BigInt(0)) {
    return { paxiAmount: '0', prc20Amount: '0' };
  }
  
  // paxiAmount = (lpTokens / totalLpSupply) * poolPaxi
  const paxiAmount = (lpTokens * reservePaxi) / totalLp;
  
  // prc20Amount = (lpTokens / totalLpSupply) * poolPrc20
  const prc20Amount = (lpTokens * reservePrc20) / totalLp;
  
  return {
    paxiAmount: paxiAmount.toString(),
    prc20Amount: prc20Amount.toString()
  };
}

/**
 * Calculate impermanent loss
 * IL = 2 * sqrt(priceRatio) / (1 + priceRatio) - 1
 * where priceRatio = currentPrice / initialPrice
 */
export function calculateImpermanentLoss(
  initialPrice: number,
  currentPrice: number
): { loss: number; percentage: number } {
  if (initialPrice <= 0 || currentPrice <= 0) {
    return { loss: 0, percentage: 0 };
  }
  
  const priceRatio = currentPrice / initialPrice;
  const sqrtRatio = Math.sqrt(priceRatio);
  
  // IL formula
  const il = 2 * sqrtRatio / (1 + priceRatio) - 1;
  
  return {
    loss: il,
    percentage: il * 100
  };
}

/**
 * Get Paxi network statistics
 */
export async function getPaxiNetworkStats(
  lcdEndpoint: string
): Promise<{
  totalSupply: string;
  circulatingSupply: string;
  lockedVesting: string;
  totalTxs: string;
  lastBlockGas: string;
} | null> {
  try {
    const [
      totalSupplyRes,
      circulatingSupplyRes,
      lockedVestingRes,
      totalTxsRes,
      lastBlockGasRes
    ] = await Promise.all([
      fetch(`${lcdEndpoint}/paxi/paxi/total_supply`),
      fetch(`${lcdEndpoint}/paxi/paxi/circulating_supply`),
      fetch(`${lcdEndpoint}/paxi/paxi/locked_vesting`),
      fetch(`${lcdEndpoint}/paxi/paxi/total_txs`),
      fetch(`${lcdEndpoint}/paxi/paxi/last_block_gas_used`)
    ]);
    
    const [
      totalSupply,
      circulatingSupply,
      lockedVesting,
      totalTxs,
      lastBlockGas
    ] = await Promise.all([
      totalSupplyRes.json(),
      circulatingSupplyRes.json(),
      lockedVestingRes.json(),
      totalTxsRes.json(),
      lastBlockGasRes.json()
    ]);
    
    return {
      totalSupply: totalSupply.total_supply || '0',
      circulatingSupply: circulatingSupply.circulating_supply || '0',
      lockedVesting: lockedVesting.locked_vesting || '0',
      totalTxs: totalTxs.total_txs || '0',
      lastBlockGas: lastBlockGas.gas_used || '0'
    };
  } catch (error) {
    console.error('Error fetching Paxi network stats:', error);
    return null;
  }
}

/**
 * Query vesting unlock schedules
 * GET /paxi/paxi/unlock_schedules
 */
export async function queryUnlockSchedules(
  lcdEndpoint: string
): Promise<any[]> {
  try {
    const response = await fetch(`${lcdEndpoint}/paxi/paxi/unlock_schedules`);
    if (!response.ok) {
      throw new Error(`Failed to fetch unlock schedules: ${response.statusText}`);
    }
    const data = await response.json();
    return data.schedules || [];
  } catch (error) {
    console.error('Error querying unlock schedules:', error);
    return [];
  }
}
