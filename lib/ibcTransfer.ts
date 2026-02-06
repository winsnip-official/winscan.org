/**
 * IBC Transfer utilities for cross-chain token transfers
 * Uses Keplr/Leap wallet for signing
 */

import { SigningStargateClient } from '@cosmjs/stargate';
import { getIBCChannel } from './ibcChannels';

export interface IBCTransferParams {
  sourceChain: string;
  destChain: string;
  token: {
    denom: string;
    amount: string;
  };
  recipientAddress: string;
  senderAddress: string;
  memo?: string;
}

export interface IBCTransferMsg {
  typeUrl: string;
  value: {
    sourcePort: string;
    sourceChannel: string;
    token: {
      denom: string;
      amount: string;
    };
    sender: string;
    receiver: string;
    timeoutHeight?: {
      revisionNumber: string;
      revisionHeight: string;
    };
    timeoutTimestamp: string;
    memo?: string;
  };
}

/**
 * Build IBC transfer message
 */
export async function buildIBCTransferMsg(params: IBCTransferParams): Promise<IBCTransferMsg | null> {
  // Try to get channel from API first
  try {
    const response = await fetch(`/api/ibc/channels?sourceChain=${params.sourceChain}&destChain=${params.destChain}`);
    if (response.ok) {
      const channelData = await response.json();
      if (channelData.channel) {
        // Timeout: 10 minutes from now
        const timeoutTimestamp = (Date.now() + 10 * 60 * 1000) * 1_000_000; // nanoseconds

        return {
          typeUrl: '/ibc.applications.transfer.v1.MsgTransfer',
          value: {
            sourcePort: 'transfer',
            sourceChannel: channelData.channel,
            token: {
              denom: params.token.denom,
              amount: params.token.amount,
            },
            sender: params.senderAddress,
            receiver: params.recipientAddress,
            timeoutTimestamp: timeoutTimestamp.toString(),
            memo: params.memo || '',
          },
        };
      }
    }
  } catch (error) {
    console.warn('Failed to fetch channel from API, falling back to static mapping:', error);
  }

  // Fallback to static mapping
  const channel = getIBCChannel(params.sourceChain, params.destChain);
  
  if (!channel) {
    console.error(`No IBC channel found from ${params.sourceChain} to ${params.destChain}`);
    return null;
  }

  // Timeout: 10 minutes from now
  const timeoutTimestamp = (Date.now() + 10 * 60 * 1000) * 1_000_000; // nanoseconds

  return {
    typeUrl: '/ibc.applications.transfer.v1.MsgTransfer',
    value: {
      sourcePort: 'transfer',
      sourceChannel: channel.channelId,
      token: {
        denom: params.token.denom,
        amount: params.token.amount,
      },
      sender: params.senderAddress,
      receiver: params.recipientAddress,
      timeoutTimestamp: timeoutTimestamp.toString(),
      memo: params.memo || '',
    },
  };
}

/**
 * Estimate IBC transfer fee
 */
export function estimateIBCFee(sourceChain: string) {
  // Default gas estimation per chain
  const feeConfigs: Record<string, { denom: string; amount: string; gas: string }> = {
    'paxi-mainnet': {
      denom: 'upaxi',
      amount: '15000',
      gas: '200000',
    },
    'cosmoshub-mainnet': {
      denom: 'uatom',
      amount: '5000',
      gas: '200000',
    },
    'osmosis-mainnet': {
      denom: 'uosmo',
      amount: '5000',
      gas: '200000',
    },
    'noble-mainnet': {
      denom: 'uusdc',
      amount: '1000',
      gas: '200000',
    },
    'kiichain-test': {
      denom: 'akii',
      amount: '10000',
      gas: '200000',
    },
    'lumera-mainnet': {
      denom: 'ulume',
      amount: '5000',
      gas: '200000',
    },
  };

  return feeConfigs[sourceChain] || {
    denom: 'stake',
    amount: '5000',
    gas: '200000',
  };
}

/**
 * Execute IBC transfer using Keplr wallet
 */
export async function executeIBCTransfer(
  params: IBCTransferParams,
  rpcEndpoint: string
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  try {
    // Check if Keplr is available
    if (!window.keplr) {
      return {
        success: false,
        error: 'Keplr wallet not found. Please install Keplr extension.',
      };
    }

    // Build transfer message
    const msg = await buildIBCTransferMsg(params);
    if (!msg) {
      return {
        success: false,
        error: 'Invalid IBC route or channel not found',
      };
    }

    // Suggest chain if not already added (this will auto-add from registry)
    try {
      await window.keplr.enable(params.sourceChain);
    } catch (err: any) {
      // If chain not found, try suggesting it
      if (err.message?.includes('There is no chain info')) {
        return {
          success: false,
          error: `Chain ${params.sourceChain} not found in Keplr. Please add it manually first.`,
        };
      }
      throw err;
    }
    
    const offlineSigner = await window.keplr.getOfflineSignerAuto(params.sourceChain);
    const accounts = await offlineSigner.getAccounts();
    
    if (accounts.length === 0) {
      return {
        success: false,
        error: 'No accounts found in wallet',
      };
    }

    // Validate RPC endpoint
    if (!rpcEndpoint || typeof rpcEndpoint !== 'string' || rpcEndpoint.trim() === '') {
      return {
        success: false,
        error: 'RPC endpoint not configured for this chain',
      };
    }

    // Create signing client - Keplr handles EthAccount automatically
    let client;
    try {
      client = await SigningStargateClient.connectWithSigner(
        rpcEndpoint,
        offlineSigner
      );
    } catch (err: any) {
      return {
        success: false,
        error: `Failed to connect to RPC: ${err.message || 'Connection failed'}`,
      };
    }

    // Estimate fee
    const feeConfig = estimateIBCFee(params.sourceChain);
    const fee = {
      amount: [{ denom: feeConfig.denom, amount: feeConfig.amount }],
      gas: feeConfig.gas,
    };

    // Sign and broadcast transaction
    const result = await client.signAndBroadcast(
      params.senderAddress,
      [msg],
      fee,
      params.memo || ''
    );

    if (result.code !== 0) {
      return {
        success: false,
        error: `Transaction failed: ${result.rawLog}`,
      };
    }

    return {
      success: true,
      txHash: result.transactionHash,
    };
  } catch (error: any) {
    console.error('IBC transfer error:', error);
    return {
      success: false,
      error: error.message || 'Unknown error occurred',
    };
  }
}

/**
 * Format IBC transfer command for CLI reference
 */
export function formatIBCTransferCommand(params: IBCTransferParams): string {
  const channel = getIBCChannel(params.sourceChain, params.destChain);
  if (!channel) return '';

  const feeConfig = estimateIBCFee(params.sourceChain);
  
  return `# IBC Transfer Command
paxid tx ibc-transfer transfer transfer ${channel.channelId} \\
  ${params.recipientAddress} \\
  ${params.token.amount}${params.token.denom} \\
  --from <wallet> \\
  --chain-id ${params.sourceChain} \\
  --gas auto \\
  --gas-adjustment 1.5 \\
  --fees ${feeConfig.amount}${feeConfig.denom}`;
}
