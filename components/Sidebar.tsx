'use client';
import { usePathname, useRouter } from 'next/navigation';
import PrefetchLink from '@/components/PrefetchLink';
import { 
  Home, 
  Box, 
  FileText, 
  Users, 
  Vote, 
  Wallet,
  Activity,
  Settings,
  Coins,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  Globe,
  RefreshCw,
  Shield,
  Network,
  ChevronDown,
  ChevronUp,
  Zap,
  Send,
  Cloud,
  ArrowRightLeft,
  Calculator
} from 'lucide-react';
import { useState, useMemo, useCallback, useEffect } from 'react';
import { ChainData } from '@/types/chain';
import { useLanguage } from '@/contexts/LanguageContext';
import { getTranslation } from '@/lib/i18n';
import PartnershipWidget from '@/components/PartnershipWidget';

interface SidebarProps {
  selectedChain: ChainData | null;
}
interface MenuItem {
  name: string;
  translationKey: string;
  path: string;
  icon: React.ReactNode;
  subItems?: MenuItem[];
}
export default function Sidebar({ selectedChain }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [expandedMenus, setExpandedMenus] = useState<Set<string>>(new Set());
  const pathname = usePathname();
  const router = useRouter();
  const { language } = useLanguage();
  const t = (key: string) => getTranslation(language, key);
  
  // Check if we're on a subdomain (e.g., epix.winscan.org)
  const isSubdomain = useMemo(() => {
    if (typeof window === 'undefined') return false;
    const hostname = window.location.hostname;
    // Only apply subdomain logic for *.winscan.org pattern
    // e.g., epix.winscan.org, paxi.winscan.org
    // NOT for winscan.winsnip.xyz (old domain with path-based routing)
    if (hostname.endsWith('.winscan.org')) {
      const subdomain = hostname.replace('.winscan.org', '');
      // Make sure it's a chain subdomain, not www or empty
      if (subdomain && subdomain !== 'www') {
        return true;
      }
    }
    return false;
  }, []);
  
  const chainPath = useMemo(() => {
    // If on subdomain, no chain prefix needed in paths
    if (isSubdomain) {
      return '';
    }
    const pathParts = pathname.split('/').filter(Boolean);
    if (pathParts.length > 0) {
      return `/${pathParts[0]}`;
    }
    return selectedChain ? `/${selectedChain.chain_name.toLowerCase().replace(/\s+/g, '-')}` : '';
  }, [pathname, selectedChain, isSubdomain]);
  const menuItems: MenuItem[] = useMemo(() => {
    const hasEvmSupport = selectedChain?.evm_rpc && selectedChain?.evm_wss && 
                          selectedChain.evm_rpc.length > 0 && selectedChain.evm_wss.length > 0;
    
    const items: MenuItem[] = [
      { name: 'Overview', translationKey: 'menu.overview', path: chainPath || '/', icon: <Home className="w-5 h-5" /> },
      { name: 'Blocks', translationKey: 'menu.blocks', path: `${chainPath}/blocks`, icon: <Box className="w-5 h-5" /> },
      { name: 'Transactions', translationKey: 'menu.transactions', path: `${chainPath}/transactions`, icon: <FileText className="w-5 h-5" /> },
      { 
        name: 'Validators', 
        translationKey: 'menu.validators', 
        path: `${chainPath}/validators`, 
        icon: <Users className="w-5 h-5" />,
        subItems: [
          { name: 'Validators', translationKey: 'menu.validators', path: `${chainPath}/validators`, icon: <Users className="w-4 h-4" /> },
          { name: 'Staking Calculator', translationKey: 'menu.stakingCalculator', path: `${chainPath}/staking-calculator`, icon: <Calculator className="w-4 h-4" /> },
          { name: 'Uptime', translationKey: 'menu.uptime', path: `${chainPath}/uptime`, icon: <Activity className="w-4 h-4" /> },
          { name: 'Proposals', translationKey: 'menu.proposals', path: `${chainPath}/proposals`, icon: <Vote className="w-4 h-4" /> },
        ]
      },
      { name: 'Assets', translationKey: 'menu.assets', path: `${chainPath}/assets`, icon: <Coins className="w-5 h-5" /> },
      { name: 'Accounts', translationKey: 'menu.accounts', path: `${chainPath}/accounts`, icon: <Wallet className="w-5 h-5" /> },
    ];

    // Add EVM menu if chain has EVM support
    if (hasEvmSupport) {
      items.push({
        name: 'EVM',
        translationKey: 'menu.evm',
        path: `${chainPath}/evm`,
        icon: <Zap className="w-5 h-5" />,
        subItems: [
          { name: 'EVM Blocks', translationKey: 'menu.evm.blocks', path: `${chainPath}/evm/blocks`, icon: <Box className="w-4 h-4" /> },
          { name: 'EVM Transactions', translationKey: 'menu.evm.transactions', path: `${chainPath}/evm/transactions`, icon: <FileText className="w-4 h-4" /> },
          // Disabled temporarily - data fetching not ready
          // { name: 'EVM NFTs', translationKey: 'menu.evm.nfts', path: `${chainPath}/evm/nfts`, icon: <Activity className="w-4 h-4" /> },
          // { name: 'EVM Tokens', translationKey: 'menu.evm.tokens', path: `${chainPath}/evm/tokens`, icon: <Coins className="w-4 h-4" /> },
          // { name: 'EVM Events', translationKey: 'menu.evm.events', path: `${chainPath}/evm/events`, icon: <Zap className="w-4 h-4" /> },
          // { name: 'EVM Pending', translationKey: 'menu.evm.pending', path: `${chainPath}/evm/pending`, icon: <Send className="w-4 h-4" /> },
        ]
      });
    }

    items.push(
      { 
        name: 'Network', 
        translationKey: 'menu.network', 
        path: `${chainPath}/network`, 
        icon: <Globe className="w-5 h-5" />,
        subItems: [
          { name: 'Network', translationKey: 'menu.network', path: `${chainPath}/network`, icon: <Globe className="w-4 h-4" /> },
          { name: 'Relayers', translationKey: 'menu.relayers', path: `${chainPath}/relayers`, icon: <Network className="w-4 h-4" /> },
          { name: 'IBC Transfer', translationKey: 'menu.ibcTransfer', path: `${chainPath}/ibc-transfer`, icon: <ArrowRightLeft className="w-4 h-4" /> },
          { name: 'Consensus', translationKey: 'menu.consensus', path: `${chainPath}/consensus`, icon: <Shield className="w-4 h-4" /> },
        ]
      },
      { 
        name: 'Tools', 
        translationKey: 'menu.tools', 
        path: `${chainPath}/endpoint-checker`, 
        icon: <Settings className="w-5 h-5" />,
        subItems: [
          { name: 'Endpoint Checker', translationKey: 'menu.rpcChecker', path: `${chainPath}/endpoint-checker`, icon: <Activity className="w-4 h-4" /> },
          { name: 'State Sync', translationKey: 'menu.statesync', path: `${chainPath}/statesync`, icon: <RefreshCw className="w-4 h-4" /> },
          { name: 'Parameters', translationKey: 'menu.parameters', path: `${chainPath}/parameters`, icon: <Settings className="w-4 h-4" /> },
          ...(selectedChain?.chain_name?.includes('lumera') ? [
            { name: 'Cascade Storage', translationKey: 'menu.cascade', path: `${chainPath}/cascade`, icon: <Cloud className="w-4 h-4" /> }
          ] : [])
        ]
      }
    );

    return items;
  }, [chainPath, selectedChain]);
  useEffect(() => {
    menuItems.forEach(item => {
      router.prefetch(item.path);
    });
  }, [menuItems, router]);
  const handleCollapse = useCallback(() => {
    setCollapsed(prev => !prev);
    localStorage.setItem('sidebar-collapsed', String(!collapsed));
  }, [collapsed]);
  const handleMobileToggle = useCallback(() => {
    setMobileOpen(prev => !prev);
  }, []);
  const closeMobile = useCallback(() => {
    setMobileOpen(false);
  }, []);
  
  const toggleMenu = useCallback((menuName: string) => {
    setExpandedMenus(prev => {
      const newSet = new Set(prev);
      if (newSet.has(menuName)) {
        newSet.delete(menuName);
      } else {
        newSet.add(menuName);
      }
      // Save to localStorage
      localStorage.setItem('expanded-menus', JSON.stringify(Array.from(newSet)));
      return newSet;
    });
  }, []);
  
  const isMenuExpanded = useCallback((menuName: string) => {
    return expandedMenus.has(menuName);
  }, [expandedMenus]);
  
  const isSubmenuActive = useCallback((item: MenuItem) => {
    if (!item.subItems) return false;
    return item.subItems.some(sub => pathname === sub.path || pathname.startsWith(sub.path + '/'));
  }, [pathname]);

  useEffect(() => {
    const savedState = localStorage.getItem('sidebar-collapsed');
    if (savedState === 'true') {
      setCollapsed(true);
    }
    
    // Load saved expanded menus from localStorage
    const savedExpandedMenus = localStorage.getItem('expanded-menus');
    if (savedExpandedMenus) {
      try {
        const parsed = JSON.parse(savedExpandedMenus);
        setExpandedMenus(new Set(parsed));
      } catch (e) {
        // Ignore parse errors
      }
    }
    
    // Auto-expand menus that contain the current active page
    const newExpandedMenus = new Set<string>(savedExpandedMenus ? JSON.parse(savedExpandedMenus) : []);
    menuItems.forEach(item => {
      if (item.subItems && isSubmenuActive(item)) {
        newExpandedMenus.add(item.name);
      }
    });
    setExpandedMenus(newExpandedMenus);
    localStorage.setItem('expanded-menus', JSON.stringify(Array.from(newExpandedMenus)));
  }, [menuItems, isSubmenuActive]);
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setMobileOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  return (
    <>
      <button
        onClick={handleMobileToggle}
        className="md:hidden fixed top-3 left-3 z-50 p-2.5 bg-gray-800 rounded-lg transition-all duration-200 active:scale-95 hover:bg-gray-700 shadow-lg min-h-[44px] min-w-[44px] flex items-center justify-center"
        aria-label="Toggle menu"
      >
        {mobileOpen ? <X className="w-5 h-5 text-white" /> : <Menu className="w-5 h-5 text-white" />}
      </button>
      {mobileOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-black/60 z-20 animate-fade-in backdrop-blur-sm"
          onClick={closeMobile}
        />
      )}
      <aside
        className={`fixed left-0 top-0 h-full bg-[#0f0f0f] border-r border-gray-800 transition-all duration-300 ease-in-out z-30 flex flex-col
          ${collapsed ? 'w-16' : 'w-64'} 
          ${mobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full md:translate-x-0'}
          max-md:w-72`}
      >
        {}
        <div className="h-16 flex items-center justify-between px-4 border-b border-gray-800 flex-shrink-0">
          {!collapsed && selectedChain && (
            <div className="flex items-center space-x-3 animate-fade-in">
              <img 
                src={selectedChain.logo} 
                alt={selectedChain.chain_name} 
                className="w-8 h-8 rounded-full object-cover"
                loading="eager"
              />
              <span className="text-white font-bold truncate">
                {selectedChain.chain_name}
              </span>
            </div>
          )}
          {collapsed && selectedChain && (
            <img 
              src={selectedChain.logo} 
              alt={selectedChain.chain_name} 
              className="w-8 h-8 rounded-full mx-auto object-cover"
              loading="eager"
            />
          )}
        </div>
        <nav className="py-4 overflow-y-auto flex-1 overscroll-contain">
          {menuItems.map((item) => {
            const hasSubItems = item.subItems && item.subItems.length > 0;
            const isExpanded = isMenuExpanded(item.name);
            const isActive = pathname === item.path || (hasSubItems && isSubmenuActive(item));
            const displayName = t(item.translationKey);
            
            return (
              <div key={item.path}>
                {hasSubItems ? (
                  <>
                    <button
                      onClick={() => toggleMenu(item.name)}
                      className={`w-full flex items-center px-4 py-3 transition-all duration-200 touch-manipulation select-none ${
                        isActive
                          ? 'bg-blue-500/10 text-blue-500 border-r-4 border-blue-500'
                          : 'text-gray-400 hover:bg-gray-800/50 hover:text-white active:bg-gray-700'
                      } ${collapsed ? 'justify-center' : 'space-x-3'}`}
                      title={collapsed ? displayName : ''}
                    >
                      <span className={`transition-transform ${isActive ? 'scale-110' : ''}`}>{item.icon}</span>
                      {!collapsed && (
                        <>
                          <span className="font-medium whitespace-nowrap flex-1 text-left">{displayName}</span>
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </>
                      )}
                    </button>
                    
                    {!collapsed && isExpanded && item.subItems && (
                      <div className="bg-[#0a0a0a]">
                        {item.subItems.map((subItem) => {
                          const isSubActive = pathname === subItem.path || pathname.startsWith(subItem.path + '/');
                          const subDisplayName = t(subItem.translationKey);
                          return (
                            <PrefetchLink
                              key={subItem.path}
                              href={subItem.path}
                              onClick={closeMobile}
                              className={`flex items-center pl-12 pr-4 py-2.5 transition-all duration-200 touch-manipulation select-none ${
                                isSubActive
                                  ? 'bg-blue-500/10 text-blue-500'
                                  : 'text-gray-400 hover:bg-gray-800/50 hover:text-white active:bg-gray-700'
                              } hover:translate-x-1`}
                            >
                              <span className={`transition-transform mr-3 ${isSubActive ? 'scale-110' : ''}`}>
                                {subItem.icon}
                              </span>
                              <span className="font-medium text-sm whitespace-nowrap">{subDisplayName}</span>
                              {isSubActive && (
                                <div className="ml-auto w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
                              )}
                            </PrefetchLink>
                          );
                        })}
                      </div>
                    )}
                  </>
                ) : (
                  <PrefetchLink
                    href={item.path}
                    onClick={closeMobile}
                    className={`flex items-center px-4 py-3 transition-all duration-200 touch-manipulation select-none ${
                      isActive
                        ? 'bg-blue-500/10 text-blue-500 border-r-4 border-blue-500'
                        : 'text-gray-400 hover:bg-gray-800/50 hover:text-white active:bg-gray-700'
                    } ${collapsed ? 'justify-center' : 'space-x-3'} 
                    ${!collapsed && !isActive ? 'hover:translate-x-1' : ''}`}
                    title={collapsed ? displayName : ''}
                  >
                    <span className={`transition-transform ${isActive ? 'scale-110' : ''}`}>{item.icon}</span>
                    {!collapsed && <span className="font-medium whitespace-nowrap">{displayName}</span>}
                    {!collapsed && isActive && (
                      <div className="ml-auto w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                    )}
                  </PrefetchLink>
                )}
              </div>
            );
          })}
        </nav>

        {/* Partnership Widget */}
        {!collapsed && <PartnershipWidget />}

        <div className="hidden md:block p-4 border-t border-gray-800 flex-shrink-0 mt-auto">
          <button
            onClick={handleCollapse}
            className="w-full p-2 bg-gray-800 rounded-lg hover:bg-gray-700 transition-all duration-200 hover:scale-105 active:scale-95 flex items-center justify-center"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? (
              <ChevronRight className="w-4 h-4 text-gray-400" />
            ) : (
              <>
                <ChevronLeft className="w-4 h-4 text-gray-400 mr-2" />
                <span className="text-xs text-gray-400">Collapse</span>
              </>
            )}
          </button>
        </div>
      </aside>
      <div className={`hidden md:block ${collapsed ? 'w-16' : 'w-64'} flex-shrink-0 transition-all duration-300`} />
    </>
  );
}
