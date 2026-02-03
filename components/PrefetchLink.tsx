/**
 * PrefetchLink Component
 * Automatically prefetches page on hover for instant navigation
 */

'use client';

import Link from 'next/link';
import { usePrefetch } from '@/hooks/usePrefetch';
import { ReactNode, AnchorHTMLAttributes } from 'react';

interface PrefetchLinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  href: string;
  children: ReactNode;
  className?: string;
  prefetchDelay?: number; // Delay in ms before prefetching (default: 50ms)
}

export default function PrefetchLink({ 
  href, 
  children, 
  className = '',
  prefetchDelay = 50,
  ...props 
}: PrefetchLinkProps) {
  const { prefetch } = usePrefetch();
  let prefetchTimeout: NodeJS.Timeout;

  const handleMouseEnter = () => {
    // Delay prefetch slightly to avoid prefetching on accidental hovers
    prefetchTimeout = setTimeout(() => {
      prefetch(href);
    }, prefetchDelay);
  };

  const handleMouseLeave = () => {
    // Cancel prefetch if user moves away quickly
    if (prefetchTimeout) {
      clearTimeout(prefetchTimeout);
    }
  };

  return (
    <Link
      href={href}
      className={className}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      {...props}
    >
      {children}
    </Link>
  );
}
