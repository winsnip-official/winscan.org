# Deployment Guide

## 🚀 Vercel Deployment (Recommended)

WinScan is optimized for deployment on Vercel with automatic builds and deployments.

### Quick Setup

1. **Import Repository to Vercel**
   - Go to [vercel.com](https://vercel.com)
   - Click "Add New Project"
   - Import `winsnip-official/winscan.org`

2. **Configure Project**
   - Framework Preset: **Next.js**
   - Root Directory: `./`
   - Build Command: `npm run build`
   - Output Directory: `.next`
   - Install Command: `npm install`

3. **Environment Variables**
   Add these in Vercel Dashboard → Settings → Environment Variables:

   ```env
   NEXT_PUBLIC_API_URL=https://ssl.winsnip.xyz
   NEXT_PUBLIC_API_URL_FALLBACK=https://ssl2.winsnip.xyz
   NEXT_PUBLIC_BACKEND_URL=https://ssl.winsnip.xyz
   NEXT_PUBLIC_WINSCAN_URL=https://winscan.winsnip.xyz
   NEXT_PUBLIC_API_TIMEOUT=8000
   NEXT_PUBLIC_CACHE_TTL=30000
   NEXT_PUBLIC_POLL_VALIDATOR_DETAIL=30000
   NEXT_PUBLIC_POLL_VALIDATORS=30000
   NEXT_PUBLIC_POLL_OVERVIEW=20000
   NEXT_PUBLIC_POLL_BLOCKS=15000
   NEXT_PUBLIC_POLL_TRANSACTIONS=15000
   NEXT_PUBLIC_POLL_UPTIME=30000
   ```

4. **Deploy**
   - Click "Deploy"
   - Vercel will automatically build and deploy

### Branch Deployments

**Production (main branch):**
- URL: `winscan.winsnip.xyz` (custom domain)
- Auto-deploy: ✅ Enabled
- Branch: `main`

**Preview (dev branch):**
- URL: `winscan-dev.vercel.app` (auto-generated)
- Auto-deploy: ✅ Enabled
- Branch: `dev`

**Pull Requests:**
- Each PR gets unique preview URL
- Auto-deploy: ✅ Enabled

### Custom Domain Setup

1. Go to Vercel Dashboard → Settings → Domains
2. Add domain: `winscan.winsnip.xyz`
3. Configure DNS:
   ```
   Type: CNAME
   Name: winscan
   Value: cname.vercel-dns.com
   ```
4. Wait for DNS propagation (5-10 minutes)

---

## 🐳 Docker Deployment (Alternative)

For self-hosted deployment using Docker.

### Dockerfile

```dockerfile
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED 1

RUN npm run build

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["node", "server.js"]
```

### Docker Compose

```yaml
version: '3.8'

services:
  winscan:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_API_URL=https://ssl.winsnip.xyz
      - NEXT_PUBLIC_API_URL_FALLBACK=https://ssl2.winsnip.xyz
      - NEXT_PUBLIC_BACKEND_URL=https://ssl.winsnip.xyz
      - NEXT_PUBLIC_WINSCAN_URL=https://winscan.winsnip.xyz
    restart: unless-stopped
```

### Build & Run

```bash
# Build image
docker build -t winscan .

# Run container
docker run -p 3000:3000 \
  -e NEXT_PUBLIC_API_URL=https://ssl.winsnip.xyz \
  -e NEXT_PUBLIC_API_URL_FALLBACK=https://ssl2.winsnip.xyz \
  winscan

# Or use docker-compose
docker-compose up -d
```

---

## 🖥️ VPS Deployment (PM2)

For deployment on VPS using PM2 process manager.

### Prerequisites

```bash
# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2
sudo npm install -g pm2
```

### Deployment Steps

```bash
# Clone repository
git clone https://github.com/winsnip-official/winscan.org.git
cd winscan.org

# Install dependencies
npm install

# Build application
npm run build

# Start with PM2
pm2 start npm --name "winscan" -- start

# Save PM2 configuration
pm2 save

# Setup PM2 startup
pm2 startup
```

### PM2 Configuration (ecosystem.config.js)

```javascript
module.exports = {
  apps: [{
    name: 'winscan',
    script: 'npm',
    args: 'start',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
      NEXT_PUBLIC_API_URL: 'https://ssl.winsnip.xyz',
      NEXT_PUBLIC_API_URL_FALLBACK: 'https://ssl2.winsnip.xyz',
      NEXT_PUBLIC_BACKEND_URL: 'https://ssl.winsnip.xyz',
      NEXT_PUBLIC_WINSCAN_URL: 'https://winscan.winsnip.xyz'
    }
  }]
}
```

### Nginx Configuration

```nginx
server {
    listen 80;
    server_name winscan.winsnip.xyz;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### SSL with Certbot

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d winscan.winsnip.xyz

# Auto-renewal
sudo certbot renew --dry-run
```

---

## 🔄 CI/CD with GitHub Actions (Optional)

If you want automated deployment via GitHub Actions instead of Vercel auto-deploy.

### Vercel Deploy Action

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Vercel

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'
```

**Required Secrets:**
- `VERCEL_TOKEN` - Get from Vercel → Settings → Tokens
- `VERCEL_ORG_ID` - Get from `.vercel/project.json`
- `VERCEL_PROJECT_ID` - Get from `.vercel/project.json`

---

## 📊 Monitoring & Analytics

### Vercel Analytics

Enable in Vercel Dashboard → Analytics:
- ✅ Web Analytics
- ✅ Speed Insights
- ✅ Audience Insights

### Environment-Specific Configs

**Production:**
- Domain: `winscan.winsnip.xyz`
- Branch: `main`
- Analytics: Enabled

**Staging:**
- Domain: `winscan-dev.vercel.app`
- Branch: `dev`
- Analytics: Enabled

**Preview:**
- Domain: Auto-generated per PR
- Branch: Feature branches
- Analytics: Disabled

---

## 🔧 Troubleshooting

### Build Fails

**Issue:** Build fails with "Module not found"
```bash
# Solution: Clean install
rm -rf node_modules package-lock.json .next
npm install
npm run build
```

**Issue:** Environment variables not working
```bash
# Solution: Check variable names start with NEXT_PUBLIC_
# Restart Vercel deployment after adding variables
```

### Performance Issues

**Issue:** Slow page loads
```bash
# Solution: Enable caching in next.config.js
# Check API response times
# Optimize images with next/image
```

### Domain Issues

**Issue:** Custom domain not working
```bash
# Solution: Check DNS propagation
dig winscan.winsnip.xyz

# Verify CNAME record
nslookup winscan.winsnip.xyz
```

---

## 📚 Resources

- [Vercel Documentation](https://vercel.com/docs)
- [Next.js Deployment](https://nextjs.org/docs/deployment)
- [PM2 Documentation](https://pm2.keymetrics.io/docs)
- [Docker Documentation](https://docs.docker.com)
