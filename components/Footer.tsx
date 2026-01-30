export default function Footer() {
  return (
    <footer className="relative border-t border-gray-800 bg-[#0a0a0a] mt-auto overflow-hidden">
      {/* Subtle background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-gray-900/5 to-gray-900/10 pointer-events-none"></div>
      
      <div className="relative max-w-7xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          {/* Brand Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 group">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center transition-transform group-hover:scale-110">
                <img src="/icon.svg" alt="WinScan Logo" className="w-full h-full" />
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">WinScan</span>
            </div>
            <p className="text-gray-500 text-sm leading-relaxed">
              Next-generation blockchain explorer for Cosmos ecosystem.
            </p>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-500">Powered by</span>
              <a href="https://winsnip.xyz" target="_blank" rel="noopener noreferrer" className="text-white hover:text-gray-300 font-semibold transition-colors">
                @winsnip
              </a>
            </div>
          </div>
          
          {/* Quick Links */}
          <div>
            <h3 className="text-white font-semibold mb-4 text-sm">Quick Links</h3>
            <ul className="space-y-3">
              <li>
                <a href="https://github.com/winsnip-official/winscan" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-white transition-all text-sm flex items-center gap-2 group">
                  <svg className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-all group-hover:translate-x-0 -translate-x-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  <span>GitHub Repository</span>
                </a>
              </li>
              <li>
                <a href="https://winsnip.xyz" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-white transition-all text-sm flex items-center gap-2 group">
                  <svg className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-all group-hover:translate-x-0 -translate-x-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  <span>Official Website</span>
                </a>
              </li>
              <li>
                <a href="https://github.com/winsnip-official/winscan/blob/main/README.md" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-white transition-all text-sm flex items-center gap-2 group">
                  <svg className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-all group-hover:translate-x-0 -translate-x-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  <span>Documentation</span>
                </a>
              </li>
            </ul>
          </div>
          
          {/* Community & Social */}
          <div>
            <h3 className="text-white font-semibold mb-4 text-sm">Community</h3>
            <div className="space-y-3">
              <a
                href="https://twitter.com/winsnip"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 text-gray-500 hover:text-white transition-all group"
              >
                <div className="w-10 h-10 bg-gray-900 rounded-lg flex items-center justify-center border border-gray-800 group-hover:border-gray-700 group-hover:bg-gray-800 transition-all">
                  <svg className="w-5 h-5 group-hover:scale-110 transition-transform" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                </div>
                <div>
                  <div className="text-sm font-medium text-white">Twitter</div>
                  <div className="text-xs text-gray-600">Follow us for updates</div>
                </div>
              </a>
              
              <a
                href="https://github.com/winsnip-official"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 text-gray-500 hover:text-white transition-all group"
              >
                <div className="w-10 h-10 bg-gray-900 rounded-lg flex items-center justify-center border border-gray-800 group-hover:border-gray-700 group-hover:bg-gray-800 transition-all">
                  <svg className="w-5 h-5 group-hover:scale-110 transition-transform" fill="currentColor" viewBox="0 0 24 24">
                    <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <div className="text-sm font-medium text-white">GitHub</div>
                  <div className="text-xs text-gray-600">Contribute to project</div>
                </div>
              </a>
            </div>
          </div>
        </div>
        
        {/* Bottom Bar */}
        <div className="border-t border-gray-800 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span>© {new Date().getFullYear()} WinScan. Made with</span>
            <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
            </svg>
            <span>by</span>
            <a href="https://t.me/winsnip" target="_blank" rel="noopener noreferrer" className="text-white hover:text-gray-300 font-semibold transition-colors">
              @winsnip
            </a>
            <span>community</span>
          </div>
          
          <div className="flex items-center gap-4 text-xs text-gray-600">
            <a href="https://github.com/winsnip-official/winscan/blob/main/LICENSE" target="_blank" rel="noopener noreferrer" className="hover:text-gray-400 transition-colors">
              MIT License
            </a>
            <span>•</span>
            <a href="https://github.com/winsnip-official/winscan/issues" target="_blank" rel="noopener noreferrer" className="hover:text-gray-400 transition-colors">
              Report Issues
            </a>
            <span>•</span>
            <span>Built with Next.js</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
