# GitHub Actions Workflows

## Why No Build Workflow?

This project uses **Vercel** for automatic build and deployment. Vercel handles:
- ✅ Automatic builds on every push
- ✅ Preview deployments for PRs
- ✅ Production deployments
- ✅ Environment variables management
- ✅ CDN and edge optimization

GitHub Actions workflows are **not needed** for build/deploy because Vercel does it better and faster.

## What We Use Instead

### Vercel Auto-Deploy
- **Branch**: `dev` → Deploys to staging
- **Branch**: `main` → Deploys to production
- **Pull Requests**: Automatic preview deployments

### Dependabot
- Automatic dependency updates
- Security vulnerability alerts
- Configured in `.github/dependabot.yml`

### Renovate Bot (Optional)
- Advanced dependency management
- Smart grouping of updates
- Configured in `renovate.json`

## Manual Workflows (If Needed)

If you need to add workflows later, here are some useful ones:

### Code Quality Check
```yaml
name: Code Quality
on: [pull_request]
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm run lint
```

### Security Audit
```yaml
name: Security
on: [push, pull_request]
jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm audit
```

## Deployment

### Vercel Setup
1. Connect repository to Vercel
2. Configure environment variables in Vercel dashboard
3. Set production branch to `main`
4. Set development branch to `dev`
5. Done! Auto-deploy is active

### Environment Variables (Vercel)
Add these in Vercel dashboard:
```
NEXT_PUBLIC_API_URL=https://ssl.winsnip.xyz
NEXT_PUBLIC_API_URL_FALLBACK=https://ssl2.winsnip.xyz
NEXT_PUBLIC_BACKEND_URL=https://ssl.winsnip.xyz
NEXT_PUBLIC_WINSCAN_URL=https://winscan.winsnip.xyz
```

## Why This Approach?

1. **Simpler**: No complex CI/CD setup
2. **Faster**: Vercel's edge network is optimized
3. **Reliable**: Vercel handles all edge cases
4. **Cost-effective**: Free for open source
5. **Better DX**: Preview deployments for every PR

## Need Help?

- [Vercel Documentation](https://vercel.com/docs)
- [Next.js Deployment](https://nextjs.org/docs/deployment)
- [Vercel GitHub Integration](https://vercel.com/docs/git)
