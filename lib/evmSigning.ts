// This file uses dynamic imports to avoid webpack bundling issues in browser
// All cosmjs imports are loaded on-demand

export async function simulateTransaction(
  restUrl: string,
  txRaw: any
): Promise<{ gasUsed: string; gasWanted: string }> {
  try {
    const { TxRaw } = await import('cosmjs-types/cosmos/tx/v1beta1/tx');
    const { toBase64 } = await import('@cosmjs/encoding');
    
    const txBytes = TxRaw.encode(txRaw).finish();
    const txBytesBase64 = toBase64(txBytes);
    
    console.log('🧪 Simulating transaction...');
    
    const response = await fetch(`${restUrl}/cosmos/tx/v1beta1/simulate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tx_bytes: txBytesBase64,
      }),
    });
    
    if (!response.ok) {
      const error = await response.text();
      console.error('❌ Simulation failed:', error);
      throw new Error(`Simulation failed: ${error}`);
    }
    
    const result = await response.json();
    
    console.log('✅ Simulation successful:', {
      gasUsed: result.gas_info?.gas_used,
      gasWanted: result.gas_info?.gas_wanted,
    });
    
    return {
      gasUsed: result.gas_info?.gas_used || '0',
      gasWanted: result.gas_info?.gas_wanted || '0',
    };
  } catch (error: any) {
    console.error('❌ Simulation error:', error);
    throw error;
  }
}

export function getPubkeyTypeUrl(coinType: number, existingPubKey?: any, chainId?: string): string {
  // Always prefer existing pubkey type from account
  if (existingPubKey && existingPubKey['@type']) {
    return existingPubKey['@type'];
  }
  
  // Check if chain is EVM-compatible by chain_id pattern (contains underscore)
  const isEvmChain = chainId && chainId.includes('_');
  
  // EVM chains (Evmos, Injective, Warden, etc.) use ethsecp256k1
  if (isEvmChain || coinType === 60) {
    return '/ethermint.crypto.v1.ethsecp256k1.PubKey';
  }
  
  return '/cosmos.crypto.secp256k1.PubKey';
}

export function extractBaseAccount(accountData: any): any {
  let value = accountData;
  
  const baseAccount = value.BaseAccount || value.baseAccount || value.base_account;
  if (baseAccount) {
    value = baseAccount;
  }
  
  const baseVestingAccount = 
    value.BaseVestingAccount || 
    value.baseVestingAccount || 
    value.base_vesting_account;
  if (baseVestingAccount) {
    value = baseVestingAccount;
    
    const nestedBase = value.BaseAccount || value.baseAccount || value.base_account;
    if (nestedBase) {
      value = nestedBase;
    }
  }
  
  const nestedAccount = value.account;
  if (nestedAccount) {
    value = nestedAccount;
  }
  
  return value;
}

export async function fetchAccountWithEthSupport(
  restUrl: string, 
  address: string
): Promise<any> {
  const response = await fetch(`${restUrl}/cosmos/auth/v1beta1/accounts/${address}`);
  
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('Account does not exist on chain');
    }
    throw new Error(`Failed to fetch account: ${response.statusText}`);
  }
  
  const data = await response.json();
  const account = extractBaseAccount(data.account);
  
  console.log('📋 Fetched account:', {
    address: account.address,
    accountNumber: account.account_number,
    sequence: account.sequence,
    pubKey: account.pub_key
  });
  
  return account;
}

export async function makeAuthInfoBytesForEvm(
  account: any,
  signerPubkey: Uint8Array,
  fee: { amount: Array<{ denom: string; amount: string }>; gasLimit: string },
  coinType: number,
  chainId: string,
  mode?: number
): Promise<Uint8Array> {
  const { SignMode } = await import('cosmjs-types/cosmos/tx/signing/v1beta1/signing');
  const { AuthInfo, Fee } = await import('cosmjs-types/cosmos/tx/v1beta1/tx');
  const { PubKey } = await import('cosmjs-types/cosmos/crypto/secp256k1/keys');
  
  const signMode = mode !== undefined ? mode : SignMode.SIGN_MODE_DIRECT;
  const pubkeyTypeUrl = getPubkeyTypeUrl(coinType, account.pub_key, chainId);
  
  console.log('🔑 Creating AuthInfo with:', {
    pubkeyType: pubkeyTypeUrl,
    coinType,
    chainId,
    sequence: account.sequence,
    feeAmount: fee.amount[0]?.amount,
    feeDenom: fee.amount[0]?.denom,
    gasLimit: fee.gasLimit
  });
  
  const sequence = parseInt(account.sequence);
  const sequenceBigInt = BigInt(sequence);
  const gasLimitBigInt = BigInt(fee.gasLimit);
  
  // Encode pubkey based on type
  let encodedPubkey: Uint8Array;
  if (pubkeyTypeUrl === '/ethermint.crypto.v1.ethsecp256k1.PubKey') {
    // For ethsecp256k1, use the same encoding as secp256k1
    // The structure is identical, only the type URL differs
    encodedPubkey = PubKey.encode({
      key: signerPubkey,
    }).finish();
  } else {
    // Standard cosmos secp256k1
    encodedPubkey = PubKey.encode({
      key: signerPubkey,
    }).finish();
  }
  
  console.log('🔧 Encoding Fee with:', {
    feeAmountArray: fee.amount,
    feeAmountValue: fee.amount[0]?.amount,
    gasLimitBigInt: gasLimitBigInt.toString()
  });
  
  const authInfo = AuthInfo.encode({
    signerInfos: [
      {
        publicKey: {
          typeUrl: pubkeyTypeUrl,
          value: encodedPubkey,
        },
        sequence: sequenceBigInt,
        modeInfo: { single: { mode: signMode } },
      },
    ],
    fee: Fee.fromPartial({
      amount: fee.amount,
      gasLimit: gasLimitBigInt,
    }),
  }).finish() as Uint8Array;
  
  try {
    const decodedAuth = AuthInfo.decode(authInfo);
  } catch (e) {
    console.warn('Could not verify AuthInfo');
  }
  
  return authInfo;
}

export async function makeBodyBytes(
  registry: any,
  messages: any[],
  memo: string = ''
): Promise<Uint8Array> {
  const { TxBody } = await import('cosmjs-types/cosmos/tx/v1beta1/tx');
  const { MsgGrant, MsgRevoke } = await import('cosmjs-types/cosmos/authz/v1beta1/tx');
  const { MsgSend, MsgMultiSend } = await import('cosmjs-types/cosmos/bank/v1beta1/tx');
  const { MsgDelegate, MsgUndelegate, MsgBeginRedelegate, MsgCreateValidator, MsgEditValidator } = await import('cosmjs-types/cosmos/staking/v1beta1/tx');
  const { MsgWithdrawDelegatorReward, MsgWithdrawValidatorCommission, MsgSetWithdrawAddress, MsgFundCommunityPool } = await import('cosmjs-types/cosmos/distribution/v1beta1/tx');
  const { MsgVote, MsgVoteWeighted, MsgDeposit, MsgSubmitProposal } = await import('cosmjs-types/cosmos/gov/v1beta1/tx');
  const { MsgTransfer } = await import('cosmjs-types/ibc/applications/transfer/v1/tx');
  
  // Map of typeUrl to encoder - comprehensive list of common Cosmos SDK messages
  const encoders: Record<string, any> = {
    // Authz
    '/cosmos.authz.v1beta1.MsgGrant': MsgGrant,
    '/cosmos.authz.v1beta1.MsgRevoke': MsgRevoke,
    // Bank
    '/cosmos.bank.v1beta1.MsgSend': MsgSend,
    '/cosmos.bank.v1beta1.MsgMultiSend': MsgMultiSend,
    // Staking
    '/cosmos.staking.v1beta1.MsgDelegate': MsgDelegate,
    '/cosmos.staking.v1beta1.MsgUndelegate': MsgUndelegate,
    '/cosmos.staking.v1beta1.MsgBeginRedelegate': MsgBeginRedelegate,
    '/cosmos.staking.v1beta1.MsgCreateValidator': MsgCreateValidator,
    '/cosmos.staking.v1beta1.MsgEditValidator': MsgEditValidator,
    // Distribution
    '/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward': MsgWithdrawDelegatorReward,
    '/cosmos.distribution.v1beta1.MsgWithdrawValidatorCommission': MsgWithdrawValidatorCommission,
    '/cosmos.distribution.v1beta1.MsgSetWithdrawAddress': MsgSetWithdrawAddress,
    '/cosmos.distribution.v1beta1.MsgFundCommunityPool': MsgFundCommunityPool,
    // Gov
    '/cosmos.gov.v1beta1.MsgVote': MsgVote,
    '/cosmos.gov.v1beta1.MsgVoteWeighted': MsgVoteWeighted,
    '/cosmos.gov.v1beta1.MsgDeposit': MsgDeposit,
    '/cosmos.gov.v1beta1.MsgSubmitProposal': MsgSubmitProposal,
    // IBC Transfer
    '/ibc.applications.transfer.v1.MsgTransfer': MsgTransfer,
  };
  
  // Encode messages to Any format
  const anyMsgs = messages.map((m) => {
    try {
      // Check if we have a direct encoder for this message type
      const encoder = encoders[m.typeUrl];
      if (encoder) {
        const msgBytes = encoder.encode(m.value).finish();
        return {
          typeUrl: m.typeUrl,
          value: msgBytes,
        };
      }
      
      // Fallback to registry if available
      if (registry && registry.encodeAsAny) {
        return registry.encodeAsAny(m);
      }
      
      // Last resort: assume value is already encoded
      return {
        typeUrl: m.typeUrl,
        value: m.value,
      };
    } catch (encodeError: any) {
      console.error('❌ Failed to encode message:', m.typeUrl, encodeError);
      throw new Error(`Failed to encode message ${m.typeUrl}: ${encodeError.message}`);
    }
  });
  
  return TxBody.encode(
    TxBody.fromPartial({
      messages: anyMsgs,
      memo,
    })
  ).finish();
}

export async function signTransactionForEvm(
  signer: any,
  chainId: string,
  restUrl: string,
  address: string,
  messages: any[],
  fee: { amount: Array<{ denom: string; amount: string }>; gas: string },
  memo: string,
  coinType: number,
  autoSimulate: boolean = true,
  customRegistry?: any
): Promise<any> {
  const { Registry, makeSignDoc } = await import('@cosmjs/proto-signing');
  const { TxRaw } = await import('cosmjs-types/cosmos/tx/v1beta1/tx');
  const { fromBase64 } = await import('@cosmjs/encoding');
  const { SignMode } = await import('cosmjs-types/cosmos/tx/signing/v1beta1/signing');
  
  // Use custom registry if provided, otherwise create empty registry
  // Messages are encoded manually in makeBodyBytes to avoid type conflicts
  const registry = customRegistry || new Registry();
  
  const account = await fetchAccountWithEthSupport(restUrl, address);
  
  const accounts = await signer.getAccounts();
  if (!accounts || accounts.length === 0) {
    throw new Error('No accounts found in signer');
  }
  const signerAccount = accounts[0];
  
  console.log('📝 Signing transaction:', {
    chainId,
    accountNumber: account.account_number,
    sequence: account.sequence,
    messages: messages.length,
    memo,
    fee
  });
  
  const txBodyBytes = await makeBodyBytes(registry, messages, memo);
  
  // First attempt: try simulation with minimal fee
  let finalFee = fee;
  
  if (autoSimulate) {
    try {
      console.log('🔬 Attempting simulation to get actual gas requirement...');
      
      // Create temp tx with minimal fee for simulation
      const tempAuthInfoBytes = await makeAuthInfoBytesForEvm(
        account,
        signerAccount.pubkey,
        {
          amount: [{ denom: fee.amount[0].denom, amount: '1' }],
          gasLimit: fee.gas || '300000',
        },
        coinType,
        chainId,
        SignMode.SIGN_MODE_DIRECT
      );
      
      const tempSignDoc = makeSignDoc(
        txBodyBytes,
        tempAuthInfoBytes,
        chainId,
        parseInt(account.account_number)
      );
      
      const { signature: tempSig, signed: tempSigned } = await signer.signDirect(address, tempSignDoc);
      
      const tempTxRaw = TxRaw.fromPartial({
        bodyBytes: tempSigned.bodyBytes,
        authInfoBytes: tempSigned.authInfoBytes,
        signatures: [fromBase64(tempSig.signature)],
      });
      
      const simResult = await simulateTransaction(restUrl, tempTxRaw);
      const gasUsed = parseInt(simResult.gasUsed);
      const gasWithBuffer = Math.ceil(gasUsed * 1.3); // Add 30% buffer
      
      console.log('📊 Simulation results:', {
        gasUsed,
        gasWithBuffer,
        originalGasLimit: fee.gas
      });
      
      // Now calculate fee based on actual gas needed
      // Get minimum gas price from node config
      try {
        const configResponse = await fetch(`${restUrl}/cosmos/base/node/v1beta1/config`);
        if (configResponse.ok) {
          const configData = await configResponse.json();
          const minGasPrice = configData.minimum_gas_price || '10award';
          
          // Parse minimum gas price (format: "10award")
          const match = minGasPrice.match(/^([\d.]+)(\w+)$/);
          if (match) {
            const pricePerGas = parseFloat(match[1]);
            const denom = match[2];
            const calculatedFee = Math.ceil(gasWithBuffer * pricePerGas).toString();
            
            console.log('💰 Calculated fee from chain config:', {
              minGasPrice,
              pricePerGas,
              gasWithBuffer,
              calculatedFee,
              denom
            });
            
            finalFee = {
              amount: [{ denom, amount: calculatedFee }],
              gas: gasWithBuffer.toString()
            };
          }
        }
      } catch (configError) {
        console.warn('⚠️ Could not fetch node config, using original fee');
      }
      
    } catch (simError: any) {
      console.warn('⚠️ Simulation failed, using original fee:', simError.message);
    }
  }
  
  const authInfoBytes = await makeAuthInfoBytesForEvm(
    account,
    signerAccount.pubkey,
    {
      amount: finalFee.amount,
      gasLimit: finalFee.gas || '300000',
    },
    coinType,
    chainId,
    SignMode.SIGN_MODE_DIRECT
  );
  
  const signDoc = makeSignDoc(
    txBodyBytes,
    authInfoBytes,
    chainId,
    parseInt(account.account_number)
  );
  
  const { signature, signed } = await signer.signDirect(address, signDoc);
  
  console.log('✍️ Transaction signed successfully with final fee:', finalFee);
  
  return TxRaw.fromPartial({
    bodyBytes: signed.bodyBytes,
    authInfoBytes: signed.authInfoBytes,
    signatures: [fromBase64(signature.signature)],
  });
}

export async function broadcastTransaction(
  restUrl: string,
  txRaw: any,
  chainId?: string
): Promise<any> {
  const { TxRaw } = await import('cosmjs-types/cosmos/tx/v1beta1/tx');
  const { AuthInfo } = await import('cosmjs-types/cosmos/tx/v1beta1/tx');
  const { toBase64 } = await import('@cosmjs/encoding');
  
  const txBytes = TxRaw.encode(txRaw).finish();
  const txBytesBase64 = toBase64(txBytes);
  
  // Decode AuthInfo to verify fee
  try {
    const authInfo = AuthInfo.decode(txRaw.authInfoBytes);
    console.log('🔍 Decoded AuthInfo fee:', {
      amount: authInfo.fee?.amount,
      gasLimit: authInfo.fee?.gasLimit?.toString()
    });
  } catch (e) {
    console.warn('Could not decode AuthInfo:', e);
  }
  
  console.log('📡 Broadcasting transaction...', {
    txBytesLength: txBytes.length,
    chainId
  });
  
  // Use proxy API to avoid CORS issues
  const useProxy = typeof window !== 'undefined' && chainId;
  const broadcastUrl = useProxy 
    ? `/api/broadcast?chain=${chainId}`
    : `${restUrl}/cosmos/tx/v1beta1/txs`;
  
  console.log('📡 Broadcast URL:', broadcastUrl, useProxy ? '(via proxy)' : '(direct)');
  
  const response = await fetch(broadcastUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      tx_bytes: txBytesBase64,
      mode: 'BROADCAST_MODE_SYNC',
    }),
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Broadcast failed: ${error}`);
  }
  
  const result = await response.json();
  
  console.log('📨 Broadcast result:', result);
  
  if (result.tx_response?.code !== 0) {
    throw new Error(
      `Transaction failed with code ${result.tx_response.code}: ${result.tx_response.raw_log}`
    );
  }
  
  return result.tx_response;
}
