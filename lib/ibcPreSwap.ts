/**
 * IBC Pre-Swap Module
 * 
 * Handles swapping tokens on Osmosis BEFORE IBC transfer (reverse direction).
 * Used for: OSMO → LUME, ATOM → LUME, USDC → LUME
 */

export interface SwapResult {
  success: boolean;
  txHash: string;
  outputAmount: string;
  error?: string;
}

export interface TransferResult {
  success: boolean;
  swapTx?: string;
  transferTx: string;
  finalAmount: string;
  error?: string;
}

export interface SwapRoute {
  poolId: string;
  tokenIn: string;
  tokenOut: string;
  estimatedOutput: string;
  priceImpact: number;
}

/**
 * Calculate minimum output amount based on slippage tolerance
 */
function calculateMinOutput(amount: string, slippagePercent: number): string {
  const amountBigInt = BigInt(amount);
  const slippageFactor = BigInt(Math.floor((100 - slippagePercent) * 100));
  const minOutput = (amountBigInt * slippageFactor) / BigInt(10000);
  return minOutput.toString();
}

/**
 * Parse swap output amount from transaction events
 */
function parseSwapOutputFromEvents(events: readonly any[]): string {
  try {
    // Look for token_swapped event
    for (const event of events) {
      if (event.type === 'token_swapped') {
        const tokenOutAttr = event.attributes?.find(
          (attr: any) => attr.key === 'tokens_out'
        );
        if (tokenOutAttr) {
          // Format: "1000000uosmo" -> extract amount
          const match = tokenOutAttr.value.match(/^(\d+)/);
          if (match) {
            return match[1];
          }
        }
      }
    }
    
    // Fallback: look for coin_received event
    for (const event of events) {
      if (event.type === 'coin_received') {
        const amountAttr = event.attributes?.find(
          (attr: any) => attr.key === 'amount'
        );
        if (amountAttr) {
          const match = amountAttr.value.match(/^(\d+)/);
          if (match) {
            return match[1];
          }
        }
      }
    }
    
    throw new Error('Could not parse output amount from events');
  } catch (error) {
    console.error('[Pre-Swap] Error parsing output:', error);
    throw error;
  }
}

/**
 * Execute swap on Osmosis BEFORE IBC transfer
 * Used for reverse direction: OSMO → LUME
 */
export async function executePreSwapOnOsmosis(
  sourceToken: string,      // uosmo, ibc/ATOM, ibc/USDC, etc
  targetToken: string,      // LUME IBC denom on Osmosis
  amount: string,           // Amount in micro units
  slippage: number = 3      // Slippage tolerance in percent
): Promise<SwapResult> {
  try {
    console.log('[Pre-Swap] Starting swap on Osmosis...');
    console.log('[Pre-Swap] Source:', sourceToken);
    console.log('[Pre-Swap] Target:', targetToken);
    console.log('[Pre-Swap] Amount:', amount);
    console.log('[Pre-Swap] Slippage:', slippage + '%');
    
    // 1. Connect to Osmosis
    if (typeof window === 'undefined' || !(window as any).keplr) {
      throw new Error('Keplr wallet not found');
    }
    
    await (window as any).keplr.enable('osmosis-1');
    const offlineSigner = await (window as any).keplr.getOfflineSigner('osmosis-1');
    const accounts = await offlineSigner.getAccounts();
    const osmoAddress = accounts[0].address;
    
    console.log('[Pre-Swap] Connected to Osmosis:', osmoAddress);
    
    // 2. Get swap route
    const routeResponse = await fetch(
      `/api/osmosis/pools?action=route&tokenIn=${encodeURIComponent(sourceToken)}&tokenOut=${encodeURIComponent(targetToken)}`
    );
    
    if (!routeResponse.ok) {
      const errorData = await routeResponse.json();
      throw new Error(errorData.error || 'No swap route found');
    }
    
    const { route } = await routeResponse.json();
    
    if (!route) {
      throw new Error('No swap route available for this token pair');
    }
    
    console.log('[Pre-Swap] Route found:', route.poolId);
    
    // 3. Create swap message
    const { SigningStargateClient } = await import('@cosmjs/stargate');
    
    const client = await SigningStargateClient.connectWithSigner(
      'https://rpc.osmosis.zone',
      offlineSigner
    );
    
    // Parse pool IDs (support multi-hop)
    const poolIds = route.poolId.split(',');
    console.log('[Pre-Swap] Pool IDs:', poolIds);
    
    // Calculate minimum output
    const minOutput = calculateMinOutput(amount, slippage);
    console.log('[Pre-Swap] Minimum output:', minOutput);
    
    // Build swap message
    const swapMsg = {
      typeUrl: '/osmosis.gamm.v1beta1.MsgSwapExactAmountIn',
      value: {
        sender: osmoAddress,
        routes: poolIds.map((poolId: string, index: number) => ({
          poolId: poolId.trim(),
          tokenOutDenom: index === poolIds.length - 1 
            ? targetToken 
            : 'uosmo', // Multi-hop via OSMO
        })),
        tokenIn: {
          denom: sourceToken,
          amount: amount,
        },
        tokenOutMinAmount: minOutput,
      },
    };
    
    console.log('[Pre-Swap] Swap message created');
    
    // 4. Execute swap
    const fee = {
      amount: [{ denom: 'uosmo', amount: '5000' }],
      gas: '500000',
    };
    
    console.log('[Pre-Swap] Broadcasting transaction...');
    
    const result = await client.signAndBroadcast(osmoAddress, [swapMsg], fee);
    
    if (result.code !== 0) {
      throw new Error(result.rawLog || 'Swap transaction failed');
    }
    
    console.log('[Pre-Swap] Swap successful!');
    console.log('[Pre-Swap] TX Hash:', result.transactionHash);
    
    // 5. Parse output amount from events
    let outputAmount: string;
    try {
      outputAmount = parseSwapOutputFromEvents(result.events);
      console.log('[Pre-Swap] Output amount:', outputAmount);
    } catch (parseError) {
      console.warn('[Pre-Swap] Could not parse output, using estimated amount');
      // Fallback: estimate output (amount * 0.97 for ~3% slippage)
      outputAmount = (BigInt(amount) * BigInt(97) / BigInt(100)).toString();
    }
    
    return {
      success: true,
      txHash: result.transactionHash,
      outputAmount,
    };
  } catch (error: any) {
    console.error('[Pre-Swap] Error:', error);
    return {
      success: false,
      txHash: '',
      outputAmount: '0',
      error: error.message || 'Swap failed',
    };
  }
}

/**
 * Execute reverse transfer with pre-swap
 * Flow: Swap on Osmosis → IBC Transfer to Lumera
 */
export async function executeReverseTransferWithPreSwap(
  sourceToken: string,
  targetToken: string,
  amount: string,
  recipientAddress: string,
  slippage: number = 3,
  onProgress?: (step: number, message: string) => void
): Promise<TransferResult> {
  try {
    // Step 1: Pre-swap on Osmosis
    console.log('[Reverse Transfer] Step 1: Swapping on Osmosis...');
    onProgress?.(1, 'Swapping tokens on Osmosis...');
    
    const swapResult = await executePreSwapOnOsmosis(
      sourceToken,
      targetToken,
      amount,
      slippage
    );
    
    if (!swapResult.success) {
      throw new Error(swapResult.error || 'Pre-swap failed');
    }
    
    console.log('[Reverse Transfer] Swap complete:', swapResult.txHash);
    console.log('[Reverse Transfer] Output amount:', swapResult.outputAmount);
    
    // Step 2: IBC Transfer swapped tokens to Lumera
    console.log('[Reverse Transfer] Step 2: IBC Transfer to Lumera...');
    onProgress?.(2, 'Transferring tokens to Lumera...');
    
    // Get channel
    const channelResponse = await fetch(
      `/api/ibc/channels?sourceChain=osmosis-mainnet&destChain=lumera-mainnet`
    );
    
    if (!channelResponse.ok) {
      const errorData = await channelResponse.json();
      throw new Error(errorData.error || 'Failed to get IBC channel');
    }
    
    const channelData = await channelResponse.json();
    
    if (!channelData.channel) {
      throw new Error('No IBC channel found between Osmosis and Lumera');
    }
    
    console.log('[Reverse Transfer] Channel:', channelData.channel);
    
    // Execute IBC transfer
    const { SigningStargateClient } = await import('@cosmjs/stargate');
    
    await (window as any).keplr.enable('osmosis-1');
    const offlineSigner = await (window as any).keplr.getOfflineSigner('osmosis-1');
    const accounts = await offlineSigner.getAccounts();
    const senderAddress = accounts[0].address;
    
    const client = await SigningStargateClient.connectWithSigner(
      'https://rpc.osmosis.zone',
      offlineSigner
    );

    
    const transferResult = await client.sendIbcTokens(
      senderAddress,
      recipientAddress,
      {
        denom: targetToken, // LUME IBC denom on Osmosis
        amount: swapResult.outputAmount,
      },
      'transfer',
      channelData.channel,
      undefined,
      Math.floor(Date.now() / 1000) * 1e9 + 600 * 1e9, // 10 min timeout
      {
        amount: [{ denom: 'uosmo', amount: '10000' }],
        gas: '500000',
      },
      'WinScan Reverse Transfer with Pre-Swap'
    );
    
    if (transferResult.code !== 0) {
      throw new Error(transferResult.rawLog || 'IBC transfer failed');
    }
    
    console.log('[Reverse Transfer] IBC transfer complete:', transferResult.transactionHash);
    onProgress?.(3, 'Transfer complete! Tokens will arrive in 1-3 minutes.');
    
    return {
      success: true,
      swapTx: swapResult.txHash,
      transferTx: transferResult.transactionHash,
      finalAmount: swapResult.outputAmount,
    };
  } catch (error: any) {
    console.error('[Reverse Transfer] Error:', error);
    return {
      success: false,
      transferTx: '',
      finalAmount: '0',
      error: error.message || 'Reverse transfer failed',
    };
  }
}
