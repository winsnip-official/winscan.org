# Chain Configuration Guidelines

## File Naming Standard

**Format:** `{network}-{type}.json`
- network: lowercase, no spaces (e.g., `tellor`, `lumera`, `bitbadges-1`)
- type: `mainnet` or `test`

**Examples:**
- ✅ `tellor-mainnet.json`
- ✅ `lumera-test.json`
- ✅ `bitbadges-1-mainnet.json`
- ❌ `Tellor.json` (wrong: uppercase, no suffix)
- ❌ `tellor_mainnet.json` (wrong: underscore instead of dash)

## Chain JSON Structure

```json
{
  "chain_name": "tellor-mainnet",           // MUST match filename without .json
  "chain_id": "tellor-mainnet",             // Can be same as chain_name or different
  "pretty_name": "Tellor Mainnet",          // Display name
  "network_type": "mainnet",                // mainnet or testnet
  "bech32_prefix": "tellor",                // Address prefix
  "slip44": 118,
  "fees": {
    "fee_tokens": [{
      "denom": "loya",
      "fixed_min_gas_price": 0.001
    }]
  },
  "staking": {
    "staking_tokens": [{
      "denom": "loya"
    }]
  },
  "rpc": [
    { "address": "https://rpc1.example.com" },
    { "address": "https://rpc2.example.com" }
  ],
  "api": [
    { "address": "https://api1.example.com" },
    { "address": "https://api2.example.com" }
  ]
}
```

## Adding New Chain - Quick Steps

### 1. Create Chain File
Copy template:
```bash
cp Chains/_template.json Chains/yourchain-mainnet.json
```

### 2. Edit Chain Config
Update these fields in `Chains/yourchain-mainnet.json`:
- `chain_name`: "yourchain-mainnet"
- `chain_id`: Get from `curl https://rpc.example.com/status | jq .result.node_info.network`
- `pretty_name`: "Your Chain Mainnet"
- `bech32_prefix`: Get from any wallet address (e.g., "cosmos", "tellor", "osmo")
- `rpc`: List of RPC endpoints
- `api`: List of REST API endpoints
- `fees.fee_tokens[0].denom`: Native token denom
- `staking.staking_tokens[0].denom`: Staking token denom

### 3. Test Chain Config
```bash
# Test RPC endpoint
curl https://your-rpc.com/status

# Test REST API
curl https://your-api.com/cosmos/base/tendermint/v1beta1/node_info

# Test validators endpoint
curl https://your-api.com/cosmos/staking/v1beta1/validators?status=BOND_STATUS_BONDED
```

### 4. Deploy
```bash
# Frontend auto-detects new chain file
git add Chains/yourchain-mainnet.json
git commit -m "Add yourchain-mainnet"
git push origin main

# Backend auto-loads on restart (or wait for auto-reload)
```

**Note:** The frontend reads chain list from its own local `Chains/` folder via `/api/chains` route. The SSL backend is only used for blockchain data (blocks, transactions, validators). This means:
- ✅ New chains appear immediately after GitHub merge + Vercel deploy
- ⚠️ Blockchain data won't load until backend is synced (if backend is separate)
- 💡 Best practice: Deploy backend from same GitHub repo for auto-sync

## Backend Architecture

```
Frontend Request Flow:

1. Chain List:
   User → Frontend → /api/chains → Reads local Chains/*.json → Returns chain list ✅

2. Blockchain Data:
   User → Frontend → SSL Load Balancer → ssl.winsnip.xyz (primary)
                                       ↘ ssl2.winsnip.xyz (fallback)
                                                ↓
                                         Fetches from blockchain RPC/API
```

The SSL load balancer (`lib/sslLoadBalancer.ts`) provides:
- Automatic failover between `ssl.winsnip.xyz` and `ssl2.winsnip.xyz`
- Health checking every 30 seconds
- Latency-based routing
- No chain-specific configuration needed

**Important:** If your backend is deployed separately from GitHub, you need to manually sync the `Chains/` folder to the backend server when adding new chains. Otherwise, the chain will appear in the list but blockchain data won't load.

## Common Issues

### Issue: "Chain not found" error
**Cause:** Filename doesn't match `chain_name` field
**Fix:** Rename file to match exactly: `{chain_name}.json`

### Issue: Block proposer shows address instead of moniker
**Cause:** Validator consensus pubkey not matching
**Fix:** Verify RPC returns correct proposer_address format (should be hex)

### Issue: Slow loading or timeout
**Cause:** RPC/API endpoints unreliable
**Fix:** Add more fallback endpoints in `rpc` and `api` arrays

### Issue: "No RPC URL configured"
**Cause:** Empty or missing `rpc` array
**Fix:** Add at least one working RPC endpoint

## Chain Name Mapping

Frontend URL → Chain File:
- `/tellor-mainnet/blocks` → `Chains/tellor-mainnet.json`
- `/lumera-test/validators` → `Chains/lumera-test.json`
- `/bitbadges-1/accounts` → `Chains/bitbadges-1.json`

**Rule:** URL path segment MUST match filename (without .json)

## Verification Checklist

Before adding new chain:
- [ ] RPC endpoint responds to `/status`
- [ ] REST API responds to `/cosmos/base/tendermint/v1beta1/node_info`
- [ ] Validators endpoint returns at least 1 validator
- [ ] Filename matches `chain_name` field exactly
- [ ] `chain_name` uses lowercase and dashes only
- [ ] `bech32_prefix` matches actual addresses
- [ ] At least 2 RPC and 2 API endpoints for redundancy
- [ ] Tested locally before pushing to production

## Frequently Asked Questions

### Q: Do I need to update `sslLoadBalancer.ts` when adding a new chain?
**A:** NO! The SSL load balancer only manages failover between backend servers (`ssl.winsnip.xyz` and `ssl2.winsnip.xyz`). Chain configurations are automatically read from the `Chains/` folder by both frontend and backend. Just add your chain JSON file to `Chains/` and you're done.

### Q: Will my chain appear on the frontend if I only update GitHub?
**A:** YES! The frontend reads chain data from its own local `Chains/` folder, NOT from the SSL backend. When you:
1. Add `Chains/yourchain.json` to GitHub
2. Owner merges your PR
3. Vercel auto-deploys → Frontend immediately has your chain ✅

The SSL backend (`ssl.winsnip.xyz`) is only used for blockchain data (blocks, transactions, validators), NOT for chain list.

### Q: What is the SSL backend used for then?
**A:** The SSL backend provides blockchain data APIs:
- `/api/blocks` - Block data
- `/api/transactions` - Transaction data  
- `/api/validators` - Validator data
- `/api/balance` - Account balances
- etc.

But `/api/chains` is served by the **frontend itself** from the local `Chains/` folder.

### Q: So users can add chains without owner updating the backend?
**A:** YES! Architecture:
```
User PR → GitHub → Vercel Auto-Deploy → Frontend reads Chains/ folder → Chain appears ✅
                                                                      ↓
                                                    Blockchain data fetched from ssl.winsnip.xyz
```

### Q: How does the backend know about my new chain?
**A:** The backend (`ssl.winsnip.xyz`) also reads from the `Chains/` folder. If the backend is deployed from the same GitHub repo, it will auto-update. If not, the owner needs to manually sync the `Chains/` folder to the backend server.

### Q: What if the backend doesn't have my chain yet?
**A:** The chain will still appear in the frontend chain list, but blockchain data (blocks, validators, etc.) won't load until the backend is updated. Users will see "Loading..." or error messages when trying to view chain details.

### Q: Can users contribute new chains via GitHub?
**A:** Yes! Users can:
1. Fork the repository
2. Add their chain JSON to `Chains/` folder
3. Submit a Pull Request
4. No code changes needed, just the chain config file
5. Chain appears on frontend immediately after merge ✅
6. Backend data works after owner syncs backend (if needed)

## Migration from Old Format

Old format (WRONG):
```
Chains/Tellor.json           → Chains/tellor-mainnet.json
Chains/Lumera.json           → Chains/lumera-mainnet.json
Chains/Emperia-test.json     → Chains/empeiria-test.json
```

Run migration script:
```bash
node scripts/migrate-chains.js
```
