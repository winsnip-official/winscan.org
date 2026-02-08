import { createRoute } from '@/lib/routes/factory';
import { apiClient } from '@/lib/api/client';
import { NextRequest, NextResponse } from 'next/server';
import { fetchJSONWithFailover } from '@/lib/sslLoadBalancer';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const chain = searchParams.get('chain');

    if (!chain) {
      return NextResponse.json({ error: 'Chain parameter required' }, { status: 400 });
    }

    // Try backend first with failover
    const path = `/api/validators?chain=${chain}`;
    console.log('[Validators API] Fetching with failover');
    
    try {
      // Use failover: SSL1 -> SSL2
      const data = await fetchJSONWithFailover(path, {
        headers: { 'Accept': 'application/json' }
      });
      
      console.log(`[Validators API] ✅ Backend returned ${data.validators?.length || 0} validators for ${chain}`);
      return NextResponse.json(data, {
        headers: {
          'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60'
        }
      });
    } catch (backendError: any) {
      console.error('[Validators API] All backends failed:', backendError.message);
    }

    // Fallback: Fetch from chain RPC
    console.log('[Validators API] Trying RPC fallback for', chain);
    
    try {
      // Get chain config
      const chainsResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/chains`, {
        next: { revalidate: 300 }
      });
      
      if (!chainsResponse.ok) {
        throw new Error('Failed to fetch chain config');
      }

      const chains = await chainsResponse.json();
      const chainConfig = chains.find((c: any) => c.chain_name === chain);
      
      if (!chainConfig) {
        throw new Error(`Chain ${chain} not found in config`);
      }

      if (!chainConfig.rpc || chainConfig.rpc.length === 0) {
        throw new Error(`No RPC endpoints configured for ${chain}`);
      }

      // Try REST API first (cosmos/staking/v1beta1/validators)
      if (chainConfig.api && chainConfig.api.length > 0) {
        const apiUrl = chainConfig.api[0].address;
        console.log('[Validators API] Trying REST API:', apiUrl);
        
        try {
          const validatorsUrl = `${apiUrl}/cosmos/staking/v1beta1/validators?pagination.limit=200&status=BOND_STATUS_BONDED`;
          const validatorsResponse = await fetch(validatorsUrl, {
            next: { revalidate: 30 }
          });
          
          if (validatorsResponse.ok) {
            const validatorsData = await validatorsResponse.json();
            const validators = validatorsData.validators || [];
            
            console.log(`[Validators API] ✅ Fetched ${validators.length} validators from REST API for ${chain}`);
            
            // Transform REST API data
            const transformedValidators = validators.map((v: any) => ({
              moniker: v.description?.moniker || 'Unknown',
              operator_address: v.operator_address || '',
              consensus_address: v.consensus_pubkey?.key || '',
              jailed: v.jailed || false,
              status: v.status || 'BOND_STATUS_UNBONDED',
              tokens: v.tokens || '0',
              delegator_shares: v.delegator_shares || '0',
              commission: {
                commission_rates: {
                  rate: v.commission?.commission_rates?.rate || '0',
                  max_rate: v.commission?.commission_rates?.max_rate || '0',
                  max_change_rate: v.commission?.commission_rates?.max_change_rate || '0'
                }
              },
              voting_power: Math.floor(parseInt(v.tokens || '0') / 1000000),
              description: v.description || {},
              consensus_pubkey: v.consensus_pubkey || {}
            }));

            return NextResponse.json({
              validators: transformedValidators,
              source: 'rest-api',
              total: transformedValidators.length
            }, {
              headers: {
                'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60'
              }
            });
          }
        } catch (restError: any) {
          console.error('[Validators API] REST API failed:', restError.message);
        }
      }
      
      // Fallback to Tendermint RPC
      console.log('[Validators API] Trying Tendermint RPC fallback');
      const rpcUrl = chainConfig.rpc[0].address;
      
      // Fetch validators from chain RPC
      const validatorsUrl = `${rpcUrl}/validators?per_page=100`;
      const validatorsResponse = await fetch(validatorsUrl, {
        next: { revalidate: 30 }
      });
      
      if (!validatorsResponse.ok) {
        throw new Error(`RPC request failed: HTTP ${validatorsResponse.status}`);
      }

      const validatorsData = await validatorsResponse.json();
      const validators = validatorsData.result?.validators || [];
      
      console.log(`[Validators API] ✅ Fetched ${validators.length} validators from RPC for ${chain}`);
      
      // Transform RPC data to match backend format
      const transformedValidators = validators.map((v: any) => ({
        moniker: v.description?.moniker || 'Unknown',
        operator_address: v.operator_address || '',
        consensus_address: v.consensus_pubkey?.key || '',
        jailed: v.jailed || false,
        status: v.status || 'BOND_STATUS_UNBONDED',
        tokens: v.tokens || '0',
        delegator_shares: v.delegator_shares || '0',
        commission: {
          commission_rates: {
            rate: v.commission?.commission_rates?.rate || '0',
            max_rate: v.commission?.commission_rates?.max_rate || '0',
            max_change_rate: v.commission?.commission_rates?.max_change_rate || '0'
          }
        },
        voting_power: parseInt(v.voting_power || '0')
      }));

      return NextResponse.json({
        validators: transformedValidators,
        source: 'rpc',
        total: transformedValidators.length
      }, {
        headers: {
          'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60'
        }
      });

    } catch (rpcError: any) {
      console.error('[Validators API] RPC fallback failed:', rpcError.message);
      
      return NextResponse.json({
        error: 'Failed to fetch validators',
        message: rpcError.message,
        validators: []
      }, { status: 500 });
    }

  } catch (error: any) {
    console.error('[Validators API] Error:', error.message);
    
    return NextResponse.json({
      error: 'Internal server error',
      message: error.message,
      validators: []
    }, { status: 500 });
  }
}
