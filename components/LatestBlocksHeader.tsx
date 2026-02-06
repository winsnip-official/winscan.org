'use client';
import { useEffect, useState } from 'react';
import { Box, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ChainData } from '@/types/chain';

interface Block {
  height: number;
  time: string;
  txs: number;
  hash: string;
}

interface LatestBlocksHeaderProps {
  selectedChain: ChainData | null;
}

export default function LatestBlocksHeader({ selectedChain }: LatestBlocksHeaderProps) {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [highlightedBlocks, setHighlightedBlocks] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!selectedChain) {
      setBlocks([]);
      return;
    }

    const fetchBlocks = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(`/api/blocks?chain=${selectedChain.chain_id || selectedChain.chain_name}&limit=5`);
        
        // Silent fail if API returns error
        if (!response.ok) {
          console.warn('Failed to fetch blocks:', response.status);
          return;
        }
        
        const data = await response.json();
        
        // Validate data
        if (!Array.isArray(data) || data.length === 0) {
          console.warn('No blocks data returned');
          return;
        }
        
        // Highlight new blocks
        if (blocks.length > 0 && data.length > 0) {
          const newBlockHeights = data
            .filter((block: Block) => !blocks.some(b => b.height === block.height))
            .map((block: Block) => block.height);
          
          if (newBlockHeights.length > 0) {
            setHighlightedBlocks(new Set(newBlockHeights));
            setTimeout(() => setHighlightedBlocks(new Set()), 3000);
          }
        }
        
        setBlocks(data);
      } catch (error) {
        console.warn('Error fetching blocks:', error);
        // Silent fail - don't show error to user
      } finally {
        setIsLoading(false);
      }
    };

    // Initial fetch only
    fetchBlocks();
  }, [selectedChain]);

  if (!selectedChain) {
    return null;
  }

  const chainPath = selectedChain.chain_name.toLowerCase().replace(/\s+/g, '-');

  return (
    <div className="hidden xl:flex items-center gap-3 px-4 py-2 bg-[#1a1a1a] border border-gray-700 rounded-lg h-[40px]">
      <div className="flex items-center gap-2">
        <Box className="w-5 h-5 text-blue-400" />
        <span className="text-sm font-semibold text-gray-300">Latest Blocks</span>
        {isLoading && (
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
        )}
      </div>
      
      <div className="flex items-center gap-2 pl-3 border-l border-gray-700">
        {blocks.length === 0 ? (
          <span className="text-xs text-gray-500">Loading...</span>
        ) : (
          blocks.slice(0, 1).map((block) => (
            <a
              key={block.height}
              href={`/${chainPath}/blocks/${block.height}`}
              className={`group relative px-3 py-1.5 bg-[#0f0f0f] border rounded-md hover:border-blue-500 transition-all duration-300 ${
                highlightedBlocks.has(block.height)
                  ? 'border-blue-500 bg-blue-500/5 animate-pulse'
                  : 'border-gray-800'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold text-blue-400 group-hover:text-blue-300">
                  #{block.height}
                </span>
                <span className="text-xs text-gray-500">
                  {block.txs} tx
                </span>
              </div>
              
              {/* Tooltip */}
              <div className="absolute top-full left-0 mt-2 w-64 p-3 bg-[#1a1a1a] border border-gray-700 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-400">Height</span>
                    <span className="text-xs font-mono text-white">#{block.height}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-400">Transactions</span>
                    <span className="text-xs text-white">{block.txs}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-400">Hash</span>
                    <span className="text-xs font-mono text-white">{block.hash.slice(0, 8)}...</span>
                  </div>
                  <div className="flex items-center gap-1 pt-2 border-t border-gray-800">
                    <Clock className="w-3 h-3 text-gray-500" />
                    <span className="text-xs text-gray-400">
                      {formatDistanceToNow(new Date(block.time), { addSuffix: true })}
                    </span>
                  </div>
                </div>
              </div>
            </a>
          ))
        )}
      </div>
    </div>
  );
}
