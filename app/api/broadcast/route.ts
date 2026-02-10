import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const chain = searchParams.get('chain');

    if (!chain) {
      return NextResponse.json({ error: 'Chain parameter required' }, { status: 400 });
    }

    // Load chain config
    const fs = await import('fs');
    const path = await import('path');
    const chainsDir = path.join(process.cwd(), 'Chains');
    const files = fs.readdirSync(chainsDir);
    
    let chainConfig: any = null;
    for (const file of files) {
      if (file.endsWith('.json')) {
        const config = JSON.parse(fs.readFileSync(path.join(chainsDir, file), 'utf-8'));
        if (config.chain_name === chain || config.chain_id === chain) {
          chainConfig = config;
          break;
        }
      }
    }

    if (!chainConfig || !chainConfig.api || chainConfig.api.length === 0) {
      return NextResponse.json({
        error: 'Chain not found or no API endpoints'
      }, { status: 404 });
    }

    const restUrl = chainConfig.api[0].address;
    const body = await request.json();

    console.log(`[Broadcast Proxy] Broadcasting to ${restUrl} for chain ${chain}`);

    // Forward request to chain's REST API
    const response = await fetch(`${restUrl}/cosmos/tx/v1beta1/txs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`[Broadcast Proxy] Failed: ${error}`);
      return NextResponse.json(
        { error: `Broadcast failed: ${error}` },
        { status: response.status }
      );
    }

    const result = await response.json();
    console.log(`[Broadcast Proxy] Success:`, result.tx_response?.txhash);

    return NextResponse.json(result);

  } catch (error: any) {
    console.error('[Broadcast Proxy] Error:', error.message);
    
    return NextResponse.json({
      error: error.message
    }, { status: 500 });
  }
}
