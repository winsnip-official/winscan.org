<div align="center">
  <img src="app/icon.svg" alt="WinScan Logo" width="120" height="120" />
  
  # WinScan - Multi-Chain Blockchain Explorer
  
  **Modern, feature-rich blockchain explorer for Cosmos ecosystem with EVM support**
  
  [![Website](https://img.shields.io/badge/Website-winsnip.xyz-blue?style=for-the-badge)](https://winsnip.xyz)
  [![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)
  [![Twitter](https://img.shields.io/badge/Twitter-@winsnip-1DA1F2?style=for-the-badge)](https://twitter.com/winsnip)
  
  [![Build](https://github.com/winsnip-official/winscan.org/actions/workflows/build.yml/badge.svg)](https://github.com/winsnip-official/winscan.org/actions/workflows/build.yml)
  [![Known Vulnerabilities](https://img.shields.io/badge/vulnerabilities-0%20critical-brightgreen)](https://github.com/winsnip-official/winscan.org/security)
  [![Dependencies](https://img.shields.io/badge/dependencies-up%20to%20date-brightgreen)](https://github.com/winsnip-official/winscan.org/blob/dev/package.json)
  
  [Features](#-features) • [Quick Start](#-quick-start) • [Documentation](#-documentation) • [Supported Chains](#-supported-chains) • [Contributing](#-contributing)
  
</div>

---

## ✨ Features

<table>
<tr>
<td width="50%" valign="top">

### 🔍 Core Explorer Features

**Blockchain Data**
- 📊 Real-time blocks & transactions tracking
- 🔗 Transaction details with message decoding
- 📈 Block proposer & validator information
- 💰 Account balances & transaction history
- 🪙 Multi-asset support with holder tracking

**Validators & Staking**
- 👥 Complete validator list with uptime stats
- 📊 Voting power distribution charts
- 💎 Commission rates & delegation info
- 📈 24h/7d/30d performance analytics
- 🌍 Global validator node distribution map

**Governance**
- 🗳️ Active & historical proposals
- 📊 Voting results & participation rates
- ✅ Vote directly from the explorer
- 📢 Proposal status tracking
- 💬 Proposal descriptions & metadata

</td>
<td width="50%" valign="top">

### ⚡ Advanced Features

**EVM Support** (Hybrid Chains)
- 🔗 Dual Cosmos + EVM explorer
- 💸 EVM transactions & blocks
- 👛 EVM address tracking
- 📊 Gas analytics & statistics
- 🌐 WebSocket real-time updates
- 🔄 Parallel API fetching

**IBC & Cross-Chain**
- 🌉 IBC transfer tracking
- 📡 IBC channel monitoring
- 🔄 Packet lifecycle visualization
- 🗺️ IBC denom mapping
- 🌐 Multi-chain bridge interface

**PRC20 Token Support**
- 🪙 Token list & verification
- 📊 Price charts & volume tracking
- 💱 Token swap interface
- 👥 Holder distribution
- 🔥 Burn & transfer functions
- 💧 Liquidity pool management

</td>
</tr>
<tr>
<td width="50%" valign="top">

### 🛠️ Developer Tools

**Node Operators**
- 🔍 Endpoint checker (RPC/API/gRPC/WSS)
- ⚡ Latency measurement
- 🔄 State sync configuration generator
- 🌱 Active peers & seeds discovery
- 📋 One-click copy for quick setup

**Performance**
- 📦 Smart caching (5-min with background refresh)
- 🔄 Auto-refresh (4-second intervals)
- ⚡ CDN optimization
- 🎯 Stale-while-revalidate strategy
- 🚀 Parallel API requests

</td>
<td width="50%" valign="top">

### 🤖 Automation & Bots

**Telegram Monitor Bot** 🆕
- 📢 Validator missed blocks alerts
- 🗳️ Governance proposal notifications
- 🌐 32+ chains monitoring
- ⚙️ Configurable thresholds
- 🔗 Direct voting links
- [@winscan_monitor_bot](https://t.me/winscan_monitor_bot)

**IBC Relayer Service** 🆕
- ✅ Auto-relay IBC packets
- 🌐 35+ chains support
- 🖥️ Web UI control panel
- 📡 Real-time WebSocket updates
- 🔄 Auto-retry on failure

**Auto-Compound Bot**
- 🤖 Automated rewards compounding
- 🌐 Multi-chain support
- ⚙️ Configurable frequency
- 🗳️ Governance auto-voting
- 💰 Validator commission claiming

</td>
</tr>
<tr>
<td colspan="2">

### 🌍 User Experience

- 🏠 **Homepage with Chain List** - Browse all supported chains with elegant UI
- ⏳ **Elegant Loading Screen** - Professional animated loading with logo & particles
- 🌐 **Multi-Language Support** - 7 languages (EN, ID, JP, KR, CN, ES, RU)
- 💼 **Wallet Integration** - Keplr, Leap, Cosmostation
- 🎨 **Modern Dark UI** - Sleek, responsive design
- 📱 **Mobile Optimized** - Full mobile & tablet support
- 📱 **PWA Ready** - Installable Progressive Web App
- 🎯 **One-Click Copy** - Copy addresses, hashes, commands
- 🔐 **Secure** - Server-side API with CORS handling
- ⚡ **Fast Loading** - Optimized performance
- 🎛️ **Configurable** - Enable/disable homepage, customize branding

</td>
</tr>
</table>

---

## 🚀 Quick Start

```bash
# Clone repository
git clone https://github.com/winsnip-official/winscan.org.git
cd winscan.org

# Install dependencies
npm install

# Setup environment
cp .env.example .env
# Edit .env and configure:
# - NEXT_PUBLIC_API_URL (your backend API)
# - NEXT_PUBLIC_ENABLE_HOMEPAGE (1=enable, 0=disable)
# - NEXT_PUBLIC_DEFAULT_CHAIN (default chain when homepage disabled)

# Run development server
npm run dev
```

Visit **http://localhost:3000** to see the explorer in action.

📚 **[Homepage & Branding Configuration Guide](HOMEPAGE-CONFIG.md)** - Learn how to customize homepage, loading screen, logo, and more!

### Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm start            # Start production server
npm run lint         # Run ESLint
npm run chain:add    # Add new chain interactively
npm run chain:validate  # Validate chain configurations
npm run chain:list   # List all configured chains
```

---

## 📖 Documentation

<table>
<tr>
<td width="50%">

### 🎨 Customization & Branding

- **[Homepage & Branding Config](HOMEPAGE-CONFIG.md)** 🆕  
  Configure homepage, loading screen, logo & favicon
  
- **[Chain Configuration Guide](CHAIN-GUIDELINES.md)**  
  Add your blockchain to WinScan

</td>
<td width="50%">

### 🤖 Automation Services

- **[IBC Relayer Service](ibc-relayer/README.md)** 🆕  
  Automated IBC packet relaying with web UI
  
- **[Telegram Monitor Bot](telegram-monitor-bot/README.md)** 🆕  
  Real-time validator & governance alerts
  
- **[Auto-Compound Bot](autocompound-bot/README.md)**  
  Automated staking rewards compounding

</td>
</tr>
<tr>
<td colspan="2">

### 🛠️ Contributing & Support

- **[Contributing Guide](CONTRIBUTING.md)** - How to contribute to the project
- **[Security Policy](SECURITY.md)** - Report vulnerabilities responsibly  
- **[License](LICENSE)** - Usage terms and restrictions

</td>
</tr>
</table>

### 📚 Feature Guides

<details>
<summary><b>🔍 Endpoint Checker</b> - Test RPC/API connectivity & latency</summary>

**Test and validate your blockchain endpoints in real-time!**

**Supported Endpoints:**
- ✅ Cosmos RPC (Tendermint)
- ✅ Cosmos API/REST
- ✅ gRPC/gRPC-Web
- ✅ WebSocket
- ✅ EVM JSON-RPC
- ✅ EVM WebSocket

**Key Features:**
- 📊 Real-time testing with latency measurement
- ⚡ Response time in milliseconds
- 📈 Block height verification
- 🆔 Automatic chain ID detection
- 🎯 Auto-fill with chain defaults
- 🔄 Manual override for custom endpoints

**How to Use:**
1. Navigate to any chain → Tools → Endpoint Checker
2. Endpoints are auto-filled from chain configuration
3. Modify or add custom endpoints as needed
4. Click "Check All Endpoints"
5. View results with latency, block height, and status

</details>

<details>
<summary><b>🔄 State Sync</b> - Fast node synchronization with active peers</summary>

**Fast node synchronization with live peer discovery!**

**Features:**
- 📊 Live state sync info (latest block, trust height, hash)
- 🌐 Active peers discovery (top 10 most active)
- 🌱 Reliable seed nodes for bootstrapping
- 📋 One-click copy for peers/seeds
- 🔧 Customizable service name and home directory
- 📝 Auto-generated bash scripts for quick setup
- ⚡ Peers sorted by activity score
- 🔍 RPC with tx_index enabled

**How to Use:**
1. Navigate to any chain → Tools → State Sync
2. View current chain state
3. Check active peers and seeds list
4. Configure service name (e.g., `paxid`)
5. Set home directory (e.g., `$HOME/.paxi`)
6. Copy peers/seeds or use the automated script
7. Run the script on your server

</details>

---

## 🤖 Automation Services

### 🔗 IBC Relayer Service

<div align="center">
  <img src="https://img.shields.io/badge/Status-Production%20Ready-success?style=flat-square" alt="Production Ready"/>
  <img src="https://img.shields.io/badge/Chains-35+-blue?style=flat-square" alt="35+ Chains"/>
  <img src="https://img.shields.io/badge/WebSocket-Real--time-orange?style=flat-square" alt="Real-time"/>
</div>

Automated IBC packet relaying service - tinggal input chain, langsung jalan!

**Key Features:**
- ✅ Auto-relay IBC packets (send, recv, ack, timeout)
- ✅ Multi-chain support - pilih dari 35+ chains
- ✅ Web UI untuk control & monitoring
- ✅ Real-time updates via WebSocket
- ✅ Auto-retry on failure
- ✅ Production-ready dengan PM2 support

**Quick Start:**
```bash
cd ibc-relayer
./setup.bat         # Windows
# or
./setup.sh          # Linux/Mac

npm run dev
```

Visit **http://localhost:3000/relayer**

📚 **[Full Documentation](ibc-relayer/README.md)** | 🚀 **[Setup Guide](ibc-relayer/SETUP.md)**

---

### 📢 Telegram Monitor Bot

<div align="center">
  <img src="https://img.shields.io/badge/Bot-@winscan__monitor__bot-blue?style=flat-square&logo=telegram" alt="Telegram Bot"/>
  <img src="https://img.shields.io/badge/Chains-32+-success?style=flat-square" alt="32+ Chains"/>
  <img src="https://img.shields.io/badge/Alerts-Real--time-orange?style=flat-square" alt="Real-time Alerts"/>
</div>

Real-time monitoring and alerts for Cosmos validators and governance!

**Key Features:**
- ✅ **Missed Blocks Alerts** - Get notified when validators miss blocks
- ✅ **Governance Notifications** - Never miss a voting opportunity
- ✅ **Multi-Chain Support** - Monitor 32+ chains simultaneously
- ✅ **Smart Thresholds** - Configurable missed blocks limits
- ✅ **Anti-Spam** - Cooldown periods prevent notification flooding
- ✅ **Direct Voting** - One-click buttons to vote on WinScan
- ✅ **Live Statistics** - Check active proposals and validator uptime

**Available Commands:**
```
/start       - Start the bot
/subscribe   - Subscribe to validator/chain alerts
/list        - View your subscriptions
/proposals   - Check active governance proposals
/stats       - View chain statistics
/unsubscribe - Remove subscriptions
/help        - Show all commands
```

**Example Alerts:**

<details>
<summary>⚠️ Missed Blocks Alert</summary>

```
⚠️ MISSED BLOCKS ALERT ⚠️

┌─ 🔗 Chain: AtomOne Mainnet
├─ 👤 Validator: WinSnip Validator
├─ 📍 Address: atonevaloper1xxx...
└─ ⚡ Missed: 50 blocks

🚨 Action Required!
Your validator has missed 50 blocks.
Please check your validator node immediately.

⏰ Alert will not repeat for 1 hour
```

</details>

<details>
<summary>🗳️ Governance Proposal Alert</summary>

```
🗳️ NEW GOVERNANCE PROPOSAL 🗳️

┌─ 🔗 Chain: AtomOne Mainnet
├─ 🏷️ Proposal ID: #19
├─ 📝 Title: Update dynamic min deposit
├─ 💬 Description: During the v3 upgrade...
└─ 🗓️ Voting Period: 12/11/2025 ➜ 4 day(s) left

📢 Cast Your Vote!
Participate in governance to shape the future.

[🗳️ Vote on WinScan]
⏱️ Don't miss the voting deadline!
```

</details>

🔗 **[Start Monitoring: @winscan_monitor_bot](https://t.me/winscan_monitor_bot)**

📚 **[Full Documentation](telegram-monitor-bot/README.md)**

---

### 🤖 Auto-Compound Bot

<div align="center">
  <img src="https://img.shields.io/badge/Authz-Enabled-success?style=flat-square" alt="Authz"/>
  <img src="https://img.shields.io/badge/Multi--Chain-Cosmos%20%26%20EVM-blue?style=flat-square" alt="Multi-Chain"/>
</div>

WinScan includes a standalone auto-compound bot for validators to provide staking rewards compounding service to their delegators.

**Key Features:**
- ✅ Automated rewards compounding using Authz grants
- ✅ Multi-chain support (Cosmos SDK & EVM-compatible)
- ✅ Validator commission claiming
- ✅ Governance auto-voting
- ✅ Configurable frequency (hourly/daily/weekly/monthly)

**Quick Setup:**
```bash
cd autocompound-bot
npm install
cp .env.example .env
# Edit .env with your mnemonic
npm run build
npm start
```

📚 **[Full Documentation](autocompound-bot/README.md)**

---

## 🔧 Configuration & Deployment

### Adding New Chains

1. **Create chain configuration file:**
   ```bash
   npm run chain:add
   # or manually create: Chains/yourchain-mainnet.json
   ```

2. **Configure chain details:**
   ```json
   {
     "chain_name": "yourchain-mainnet",
     "chain_id": "yourchain-1",
     "pretty_name": "Your Chain Mainnet",
     "network_type": "mainnet",
     "bech32_prefix": "yourchain",
     "rpc": [{ "address": "https://rpc.example.com" }],
     "api": [{ "address": "https://api.example.com" }]
   }
   ```

3. **Validate configuration:**
   ```bash
   npm run chain:validate
   ```

📚 See **[CHAIN-GUIDELINES.md](CHAIN-GUIDELINES.md)** for complete format and examples.

### Environment Variables

Create `.env` file:
```env
# Optional: Custom SSL Backend (for advanced users)
# If you have your own backend API with SSL endpoints, configure them here
# If not set, the app will automatically use RPC/API from chain config files
API_URL=https://your-ssl-backend.com
API_URL_FALLBACK=https://your-ssl-backend-2.com

# Public API URL (for frontend)
NEXT_PUBLIC_API_URL=https://your-api.com
```

**Note for Public Users:**
- You **don't need** to set `API_URL` or `API_URL_FALLBACK`
- The explorer will automatically use RPC/API endpoints from chain configuration files in the `Chains/` folder
- SSL backend is only needed if you're running your own custom indexer/backend

### Deployment

**🚀 Vercel (Recommended)**

1. Import repository to Vercel
2. Add environment variables (optional - only if you have custom backend)
3. Deploy automatically on push

**🐳 Docker**

```bash
docker build -t winscan .
docker run -p 3000:3000 winscan
```

**🖥️ VPS with PM2**

```bash
npm run build
pm2 start npm --name "winscan" -- start
pm2 save
pm2 startup
```

📚 **Full deployment guide:** [.github/DEPLOYMENT.md](.github/DEPLOYMENT.md)

---

## 🛠️ Tech Stack

<div align="center">

| Category | Technology |
|----------|-----------|
| **Framework** | Next.js 14 (App Router) |
| **Language** | TypeScript |
| **Styling** | Tailwind CSS 4.x |
| **UI Components** | Lucide React Icons |
| **Charts & Visualization** | Recharts, Canvas API |
| **Blockchain SDK** | CosmJS, Cosmos SDK |
| **EVM Integration** | ethers.js 6.x, JSON-RPC |
| **Wallet Integration** | Keplr, Leap, Cosmostation |
| **API Client** | Axios, node-fetch |
| **State Management** | React Context API |
| **Internationalization** | Custom i18n system (7 languages) |
| **Performance** | React Window (virtualization) |
| **Caching** | Custom cache strategies |
| **Address Encoding** | bech32, cosmjs-types |

</div>

---

## 📜 License & Copyright

**© 2025 WinSnip Official. All Rights Reserved.**

This project is licensed under **MIT License with Additional Restrictions**.

<details>
<summary><b>View License Summary</b></summary>

### ✅ ALLOWED:
- Use for personal, educational, or commercial purposes
- Fork and modify the code
- Distribute and sublicense

### ❌ PROHIBITED:
- Remove or alter WinSnip branding, logos, or attribution
- Claim this work as your own
- Misrepresent the origin of this software

### ⚠️ REQUIRED:
- Maintain copyright notice and license in all copies
- Keep visible attribution to WinSnip in public deployments
- Include "Built on Trusted Infrastructure" or similar attribution

</details>

**For full license terms, see [LICENSE](LICENSE) file.**

Violation of these terms may result in legal action and license revocation.

---

## 💖 Support the Project

WinScan is free and open-source. If you find it useful, please consider supporting us!

<div align="center">

[![Sponsor](https://img.shields.io/badge/Sponsor-WinScan-red?style=for-the-badge&logo=github-sponsors)](https://github.com/sponsors/winsnip-official)
[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20A%20Coffee-Support-yellow?style=for-the-badge&logo=buy-me-a-coffee)](https://www.buymeacoffee.com/winsnip)

**Your sponsorship helps us:**
- 🚀 Add more chains
- ⚡ Improve performance
- 🛠️ Develop new features
- 📚 Better documentation
- 💰 Cover infrastructure costs

[Learn more about sponsorship](.github/SPONSORS.md)

</div>

---

## 🤝 Contributing

We welcome contributions from the community! Whether you're fixing bugs, adding features, or improving documentation, your help is appreciated.

### Quick Contribution Guide

1. **Fork** this repository
2. **Clone** your fork: `git clone https://github.com/YOUR-USERNAME/winscan.git`
3. **Create branch**: `git checkout -b feature/amazing-feature`
4. **Make changes** and test thoroughly
5. **Commit**: `git commit -m 'feat: add amazing feature'`
6. **Push**: `git push origin feature/amazing-feature`
7. **Open Pull Request** to `dev` branch

### Important Notes

- ⚠️ **Always target the `dev` branch**, not `main`
- ✅ Follow [Conventional Commits](https://www.conventionalcommits.org/) format
- ✅ Test your changes before submitting
- ✅ Update documentation if needed
- ✅ Keep PRs focused on a single feature/fix

📚 **Read the full guide:** [CONTRIBUTING.md](CONTRIBUTING.md)

### Good First Issues

New to the project? Look for issues labeled:
- `good first issue` - Perfect for beginners
- `help wanted` - Community contributions welcome
- `documentation` - Help improve docs

---

## 📞 Support & Community

<div align="center">

### Get Help & Stay Connected

| Platform | Link | Purpose |
|----------|------|---------|
| 🌐 **Website** | [winsnip.xyz](https://winsnip.xyz) | Official website & explorer |
| 🤖 **Telegram Bot** | [@winscan_monitor_bot](https://t.me/winscan_monitor_bot) | Validator & governance alerts |
| 💬 **Telegram Group** | [t.me/winsnip](https://t.me/winsnip) | Community support & discussions |
| 🐦 **Twitter** | [@winsnip](https://twitter.com/winsnip) | Updates & announcements |
| 💻 **GitHub** | [github.com/winsnip-official](https://github.com/winsnip-official) | Source code & issues |
| 📧 **Email** | admin@winsnip.xyz | Business inquiries |

</div>

### Need Help?

- 🐛 **Bug Reports:** [Create an Issue](https://github.com/winsnip-official/winscan/issues)
- 💡 **Feature Requests:** [Open a Discussion](https://github.com/winsnip-official/winscan/discussions)
- 🔒 **Security Issues:** See [SECURITY.md](SECURITY.md)
- 📖 **Documentation:** Check our [docs](#-documentation)

---

## 💎 Supported Chains

<div align="center">

### 🌟 Mainnets (19 Chains)

| Chain | Logo | Features | Status |
|-------|------|----------|--------|
| **AtomOne** | <img src="https://pbs.twimg.com/profile_images/1891894823390429185/9swkoZNn_400x400.png" width="24"/> | Cosmos | ✅ Active |
| **Axone** | <img src="https://pbs.twimg.com/profile_images/1841523650043772928/EeZIYE7B_400x400.jpg" width="24"/> | Cosmos | ✅ Active |
| **BitBadges** | <img src="https://raw.githubusercontent.com/cosmos/chain-registry/master/bitbadges/images/bitbadgeslogo.png" width="24"/> | Cosmos | ✅ Active |
| **CNHO Stables** | <img src="https://pbs.twimg.com/profile_images/1802555804798857216/ZTqy2yxX_400x400.jpg" width="24"/> | Cosmos | ✅ Active |
| **CosmosHub** | <img src="https://raw.githubusercontent.com/cosmos/chain-registry/master/cosmoshub/images/atom.png" width="24"/> | Cosmos | ✅ Active |
| **Gitopia** | <img src="https://raw.githubusercontent.com/cosmos/chain-registry/master/gitopia/images/gitopia.png" width="24"/> | Cosmos | ✅ Active |
| **Humans.ai** | <img src="https://raw.githubusercontent.com/cosmos/chain-registry/master/humans/images/heart-dark-mode.svg" width="24"/> | Cosmos | ✅ Active |
| **Lava Network** | <img src="https://raw.githubusercontent.com/cosmos/chain-registry/master/lava/images/lava.png" width="24"/> | Cosmos | ✅ Active |
| **Lumera** | <img src="https://pbs.twimg.com/profile_images/1914464060265127936/z2ONvvpp_400x400.png" width="24"/> | Cosmos | ✅ Active |
| **Noble** | <img src="https://raw.githubusercontent.com/cosmos/chain-registry/master/noble/images/stake.png" width="24"/> | Cosmos | ✅ Active |
| **Osmosis** | <img src="https://s2.coinmarketcap.com/static/img/coins/64x64/12220.png" width="24"/> | Cosmos | ✅ Active |
| **Paxi Network** | <img src="https://file.winsnip.xyz/file/uploads/paxi.jpg" width="24"/> | Cosmos | ✅ Active |
| **Shido** | <img src="https://raw.githubusercontent.com/cosmos/chain-registry/master/shido/images/shido.png" width="24"/> | Cosmos + EVM ⚡ | ✅ Active |
| **Sunrise** | <img src="https://pbs.twimg.com/profile_images/1950927820290715648/1HjqE_hD_400x400.jpg" width="24"/> | Cosmos | ✅ Active |
| **Tellor** | <img src="https://pbs.twimg.com/profile_images/1855433907556044800/_Bo9JjTR_400x400.png" width="24"/> | Cosmos | ✅ Active |
| **Uptick Network** | <img src="https://raw.githubusercontent.com/cosmos/chain-registry/master/uptick/images/uptick.png" width="24"/> | Cosmos + EVM ⚡ | ✅ Active |
| **Warden Protocol** | <img src="https://pbs.twimg.com/profile_images/1904848026742484992/nO3RP237_400x400.jpg" width="24"/> | Cosmos + EVM ⚡ | ✅ Active |
| **XRPL EVM Sidechain** | <img src="https://raw.githubusercontent.com/cosmos/chain-registry/master/xrplevm/images/xrplevm.png" width="24"/> | Cosmos + EVM ⚡ | ✅ Active |
| **Zenrock** | <img src="https://pbs.twimg.com/profile_images/1829585852831285259/EAxFe-gB_400x400.png" width="24"/> | Cosmos | ✅ Active |

### 🧪 Testnets (11 Chains)

| Chain | Logo | Network |
|-------|------|---------|
| **AtomOne** | <img src="https://pbs.twimg.com/profile_images/1891894823390429185/9swkoZNn_400x400.png" width="24"/> | Testnet |
| **CosmosHub** | <img src="https://raw.githubusercontent.com/cosmos/chain-registry/master/cosmoshub/images/atom.png" width="24"/> | Testnet |
| **Empeiria** | <img src="https://pbs.twimg.com/profile_images/1887069794798632960/IvxbLJcg_400x400.jpg" width="24"/> | Testnet |
| **Kiichain** | <img src="https://pbs.twimg.com/profile_images/1800553180083666944/zZe128CW_400x400.jpg" width="24"/> | Testnet |
| **Lumera** | <img src="https://pbs.twimg.com/profile_images/1914464060265127936/z2ONvvpp_400x400.png" width="24"/> | Testnet |
| **Noble** | <img src="https://raw.githubusercontent.com/cosmos/chain-registry/master/noble/images/stake.png" width="24"/> | Testnet |
| **Osmosis** | <img src="https://s2.coinmarketcap.com/static/img/coins/64x64/12220.png" width="24"/> | Testnet |
| **Safrochain** | <img src="https://pbs.twimg.com/profile_images/1938593981517955072/vTcJ4t5i_400x400.jpg" width="24"/> | Testnet |
| **Warden Barra** | <img src="https://pbs.twimg.com/profile_images/1904848026742484992/nO3RP237_400x400.jpg" width="24"/> | Testnet |
| **XRPL EVM** | <img src="https://raw.githubusercontent.com/cosmos/chain-registry/master/xrplevm/images/xrplevm.png" width="24"/> | Testnet |
| **Zenrock** | <img src="https://pbs.twimg.com/profile_images/1829585852831285259/EAxFe-gB_400x400.png" width="24"/> | Testnet |

</div>

**⚡ EVM Compatible Chains:** Shido, Uptick Network, Warden Protocol, XRPL EVM Sidechain support both Cosmos and EVM transactions with WebSocket real-time updates.

**🔗 Want to add your chain?** See **[CHAIN-GUIDELINES.md](CHAIN-GUIDELINES.md)** for instructions.

---

<div align="center">

## 🌟 Star History

[![Star History Chart](https://api.star-history.com/svg?repos=winsnip-official/winscan&type=Date)](https://star-history.com/#winsnip-official/winscan&Date)

---

### Made with ❤️ by [WinSnip](https://winsnip.xyz)

**If you find this project useful, please give it a ⭐️**

[![Website](https://img.shields.io/badge/🌐-winsnip.xyz-blue?style=for-the-badge)](https://winsnip.xyz)
[![Twitter](https://img.shields.io/badge/🐦-@winsnip-1DA1F2?style=for-the-badge)](https://twitter.com/winsnip)
[![Telegram](https://img.shields.io/badge/💬-WinSnip-26A5E4?style=for-the-badge)](https://t.me/winsnip)
[![GitHub](https://img.shields.io/badge/💻-GitHub-181717?style=for-the-badge&logo=github)](https://github.com/winsnip-official)

**Built on Trusted Infrastructure** | **Powered by Cosmos SDK** | **EVM Compatible**

</div>
