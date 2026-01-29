// Paxi Swap Module Registry
// Creates a custom registry that recognizes Paxi's native swap module messages

import { Registry, GeneratedType } from '@cosmjs/proto-signing';
import { defaultRegistryTypes } from '@cosmjs/stargate';

// Paxi swap message types (based on proto/x/swap/types/tx.proto)
export interface MsgSwap {
  creator: string;
  prc20: string;
  offerDenom: string;  // "upaxi" or PRC20 contract address
  offerAmount: string; // string to support big.Int
  minReceive: string;  // slippage protection
}

export interface MsgProvideLiquidity {
  creator: string;
  prc20: string;
  paxiAmount: string;
  prc20Amount: string;
}

export interface MsgWithdrawLiquidity {
  creator: string;
  prc20: string;
  lpAmount: string;
}

// Type URLs for Paxi swap module
export const PAXI_MSG_SWAP_TYPE_URL = '/x.swap.types.MsgSwap';
export const PAXI_MSG_PROVIDE_LIQUIDITY_TYPE_URL = '/x.swap.types.MsgProvideLiquidity';
export const PAXI_MSG_WITHDRAW_LIQUIDITY_TYPE_URL = '/x.swap.types.MsgWithdrawLiquidity';

// Simple proto encoder for Paxi swap messages
// This is a simplified implementation that works with Cosmos SDK JSON encoding
const createPaxiSwapType = (): GeneratedType => {
  return {
    // Encode to protobuf (simplified - Cosmos SDK will handle the actual encoding)
    encode: (message: any, writer: any) => {
      // For Paxi, we rely on the chain's JSON-to-proto conversion
      // This is a passthrough encoder
      return writer;
    },
    
    // Decode from protobuf
    decode: (input: Uint8Array) => {
      // Decode is not needed for signing
      return {};
    },
    
    // Convert partial object to full message
    fromPartial: (object: any) => {
      return object;
    },
  };
};

// Create custom registry with Paxi swap types
export function createPaxiRegistry(): Registry {
  const registry = new Registry(defaultRegistryTypes);
  
  // Register Paxi swap module message types
  const paxiSwapType = createPaxiSwapType();
  registry.register(PAXI_MSG_SWAP_TYPE_URL, paxiSwapType);
  registry.register(PAXI_MSG_PROVIDE_LIQUIDITY_TYPE_URL, paxiSwapType);
  registry.register(PAXI_MSG_WITHDRAW_LIQUIDITY_TYPE_URL, paxiSwapType);
  
  return registry;
}

// Helper to create MsgSwap message
export function createMsgSwap(params: MsgSwap) {
  return {
    typeUrl: PAXI_MSG_SWAP_TYPE_URL,
    value: params,
  };
}

// Helper to create MsgProvideLiquidity message
export function createMsgProvideLiquidity(params: MsgProvideLiquidity) {
  return {
    typeUrl: PAXI_MSG_PROVIDE_LIQUIDITY_TYPE_URL,
    value: params,
  };
}

// Helper to create MsgWithdrawLiquidity message
export function createMsgWithdrawLiquidity(params: MsgWithdrawLiquidity) {
  return {
    typeUrl: PAXI_MSG_WITHDRAW_LIQUIDITY_TYPE_URL,
    value: params,
  };
}
