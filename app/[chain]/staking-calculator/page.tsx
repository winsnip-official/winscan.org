import { Metadata } from 'next';
import StakingCalculator from '@/components/StakingCalculator';
import { ChainData } from '@/types/chain';
import fs from 'fs';
import path from 'path';

interface PageProps {
  params: Promise<{ chain: string }>;
}

async function getChainData(chainSlug: string): Promise<ChainData | null> {
  try {
    const chainsDir = path.join(process.cwd(), 'Chains');
    const files = fs.readdirSync(chainsDir);
    
    for (const file of files) {
      if (file.endsWith('.json')) {
        const filePath = path.join(chainsDir, file);
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        const chain: ChainData = JSON.parse(fileContent);
        
        const normalizedChainName = chain.chain_name.toLowerCase().replace(/\s+/g, '-');
        if (normalizedChainName === chainSlug) {
          return chain;
        }
      }
    }
    return null;
  } catch (error) {
    console.error('Error loading chain data:', error);
    return null;
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { chain } = await params;
  const chainData = await getChainData(chain);
  
  return {
    title: `Staking Calculator - ${chainData?.chain_name || 'Chain'} | WinScan`,
    description: `Calculate your staking rewards for ${chainData?.chain_name || 'blockchain'}. Estimate daily, weekly, monthly, and yearly returns with compound interest.`,
  };
}

export default async function StakingCalculatorPage({ params }: PageProps) {
  const { chain } = await params;
  const chainData = await getChainData(chain);

  if (!chainData) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] pt-16 md:pt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-6 text-center">
            <p className="text-red-400">Chain not found</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] pt-16 md:pt-16 lg:hidden">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-4 sm:py-6 lg:py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">
            Staking Calculator
          </h1>
          <p className="text-gray-400 text-sm sm:text-base">
            Calculate your potential staking rewards for {chainData.chain_name}
          </p>
        </div>

        {/* Calculator Component */}
        <StakingCalculator selectedChain={chainData} />

        {/* Additional Info */}
        <div className="mt-6 bg-[#1a1a1a] border border-gray-800 rounded-lg p-4 sm:p-6">
          <h3 className="text-lg font-semibold text-white mb-3">How Staking Works</h3>
          <div className="space-y-3 text-sm text-gray-400">
            <p>
              <strong className="text-gray-300">Staking</strong> is the process of locking your tokens 
              to support network operations and earn rewards.
            </p>
            <p>
              <strong className="text-gray-300">APR (Annual Percentage Rate)</strong> represents the 
              yearly return on your staked tokens without compounding.
            </p>
            <p>
              <strong className="text-gray-300">Compound Interest</strong> means reinvesting your rewards 
              to earn additional returns over time.
            </p>
            <p>
              <strong className="text-gray-300">Validator Commission</strong> is typically deducted from 
              your rewards. Check individual validator rates before staking.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
