'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';

export default function LoadingScreen() {
  const [isLoading, setIsLoading] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Check if this is first visit in this session
    const hasVisited = sessionStorage.getItem('winscan_visited');
    
    if (hasVisited) {
      // Already visited, don't show loading screen
      setIsLoading(false);
      return;
    }
    
    // First visit - show loading screen
    setIsLoading(true);
    sessionStorage.setItem('winscan_visited', 'true');
    
    // Smooth progress animation
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          return 100;
        }
        return prev + 2;
      });
    }, 30);

    // Start fade out after 2 seconds
    const fadeTimer = setTimeout(() => {
      setFadeOut(true);
    }, 2000);

    // Hide loading screen after fade out
    const hideTimer = setTimeout(() => {
      setIsLoading(false);
    }, 2500);

    return () => {
      clearInterval(progressInterval);
      clearTimeout(fadeTimer);
      clearTimeout(hideTimer);
    };
  }, []);

  if (!isLoading) return null;

  return (
    <div 
      suppressHydrationWarning
      className={`fixed inset-0 z-[9999] bg-[#0a0a0a] flex items-center justify-center transition-opacity duration-500 ${
        fadeOut ? 'opacity-0' : 'opacity-100'
      }`}
    >
      {/* Animated grid background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1a1a1a_1px,transparent_1px),linear-gradient(to_bottom,#1a1a1a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_50%,#000_70%,transparent_110%)]"></div>
        
        {/* Animated gradient orbs */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl animate-pulse-slow"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-pulse-slower"></div>
      </div>

      <div className="relative flex flex-col items-center gap-12 px-4">
        {/* Logo container with 3D effect */}
        <div className="relative">
          {/* Glow effect */}
          <div className="absolute inset-0 -m-12">
            <div className="w-48 h-48 bg-gradient-to-r from-blue-500/30 via-purple-500/30 to-pink-500/30 rounded-full blur-2xl animate-spin-very-slow"></div>
          </div>
          
          {/* Rotating rings */}
          <div className="absolute inset-0 -m-10">
            <div className="w-44 h-44 border-2 border-blue-500/30 rounded-full animate-spin-slow"></div>
          </div>
          <div className="absolute inset-0 -m-8">
            <div className="w-40 h-40 border-2 border-purple-500/30 rounded-full animate-spin-reverse"></div>
          </div>
          <div className="absolute inset-0 -m-6">
            <div className="w-36 h-36 border border-pink-500/30 rounded-full animate-spin-slow" style={{ animationDuration: '5s' }}></div>
          </div>

          {/* Logo with scale animation */}
          <div className="relative w-28 h-28 animate-scale-pulse">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/30 to-purple-500/30 rounded-3xl blur-xl"></div>
            <Image
              src="/logo.svg"
              alt="WinScan Logo"
              width={112}
              height={112}
              priority
              className="relative object-contain drop-shadow-2xl"
            />
          </div>
        </div>

        {/* Text content */}
        <div className="text-center space-y-6">
          {/* Title with animated gradient */}
          <div className="space-y-2">
            <h1 className="text-4xl md:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 animate-gradient-x">
              WinScan
            </h1>
            <p className="text-gray-400 text-sm md:text-base font-medium tracking-wide">
              Multi-Chain Blockchain Explorer
            </p>
          </div>
          
          {/* Modern progress bar */}
          <div className="w-80 max-w-full space-y-2">
            <div className="relative h-2 bg-gray-800/50 rounded-full overflow-hidden backdrop-blur-sm border border-gray-700/50">
              <div 
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer"></div>
              </div>
            </div>
            <div className="flex justify-between items-center text-xs text-gray-500">
              <span>Loading...</span>
              <span className="font-mono">{progress}%</span>
            </div>
          </div>

          {/* Loading dots */}
          <div className="flex items-center justify-center gap-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
            <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
            <div className="w-2 h-2 bg-pink-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
          </div>
        </div>

        {/* Floating particles */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-[20%] left-[15%] w-2 h-2 bg-blue-400/40 rounded-full animate-float-1"></div>
          <div className="absolute top-[30%] right-[20%] w-1.5 h-1.5 bg-purple-400/40 rounded-full animate-float-2"></div>
          <div className="absolute bottom-[25%] left-[25%] w-1 h-1 bg-pink-400/40 rounded-full animate-float-3"></div>
          <div className="absolute bottom-[35%] right-[30%] w-2 h-2 bg-blue-300/40 rounded-full animate-float-4"></div>
          <div className="absolute top-[40%] left-[35%] w-1.5 h-1.5 bg-purple-300/40 rounded-full animate-float-5"></div>
          <div className="absolute top-[60%] right-[15%] w-1 h-1 bg-pink-300/40 rounded-full animate-float-6"></div>
        </div>
      </div>

      <style jsx>{`
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        
        @keyframes spin-reverse {
          from { transform: rotate(360deg); }
          to { transform: rotate(0deg); }
        }
        
        @keyframes spin-very-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        
        @keyframes scale-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
        
        @keyframes gradient-x {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        
        @keyframes pulse-slow {
          0%, 100% { opacity: 0.3; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.1); }
        }
        
        @keyframes pulse-slower {
          0%, 100% { opacity: 0.2; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(1.15); }
        }
        
        @keyframes float-1 {
          0%, 100% { transform: translate(0, 0); }
          33% { transform: translate(10px, -15px); }
          66% { transform: translate(-5px, -25px); }
        }
        
        @keyframes float-2 {
          0%, 100% { transform: translate(0, 0); }
          33% { transform: translate(-12px, 18px); }
          66% { transform: translate(8px, 10px); }
        }
        
        @keyframes float-3 {
          0%, 100% { transform: translate(0, 0); }
          33% { transform: translate(15px, 12px); }
          66% { transform: translate(-8px, 20px); }
        }
        
        @keyframes float-4 {
          0%, 100% { transform: translate(0, 0); }
          33% { transform: translate(-10px, -20px); }
          66% { transform: translate(12px, -8px); }
        }
        
        @keyframes float-5 {
          0%, 100% { transform: translate(0, 0); }
          33% { transform: translate(8px, 15px); }
          66% { transform: translate(-15px, 5px); }
        }
        
        @keyframes float-6 {
          0%, 100% { transform: translate(0, 0); }
          33% { transform: translate(-8px, -12px); }
          66% { transform: translate(10px, -18px); }
        }
        
        .animate-spin-slow {
          animation: spin-slow 3s linear infinite;
        }
        
        .animate-spin-reverse {
          animation: spin-reverse 4s linear infinite;
        }
        
        .animate-spin-very-slow {
          animation: spin-very-slow 8s linear infinite;
        }
        
        .animate-scale-pulse {
          animation: scale-pulse 2s ease-in-out infinite;
        }
        
        .animate-gradient-x {
          background-size: 200% 200%;
          animation: gradient-x 3s ease infinite;
        }
        
        .animate-shimmer {
          animation: shimmer 2s infinite;
        }
        
        .animate-pulse-slow {
          animation: pulse-slow 4s ease-in-out infinite;
        }
        
        .animate-pulse-slower {
          animation: pulse-slower 5s ease-in-out infinite;
        }
        
        .animate-float-1 {
          animation: float-1 6s ease-in-out infinite;
        }
        
        .animate-float-2 {
          animation: float-2 7s ease-in-out infinite;
        }
        
        .animate-float-3 {
          animation: float-3 5s ease-in-out infinite;
        }
        
        .animate-float-4 {
          animation: float-4 8s ease-in-out infinite;
        }
        
        .animate-float-5 {
          animation: float-5 6.5s ease-in-out infinite;
        }
        
        .animate-float-6 {
          animation: float-6 7.5s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
