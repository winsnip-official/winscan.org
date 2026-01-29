# GitHub Actions Workflows

This directory contains automated CI/CD workflows for the WinScan project.

## 🔒 Security Workflows

### `security-audit.yml`
**Triggers:** Push to dev/main, Pull Requests, Weekly schedule

**Jobs:**
- **Security Audit**: Checks npm dependencies for known vulnerabilities
- **CodeQL Analysis**: Static code analysis for security issues
- **Secret Scanning**: Scans for accidentally committed secrets/credentials

**Status:** ![Security Audit](https://github.com/winsnip-official/winscan.org/actions/workflows/security-audit.yml/badge.svg)

---

## 🔧 CI/CD Workflows

### `ci.yml`
**Triggers:** Push to dev, Pull Requests to dev/main

**Jobs:**
1. **Lint & Type Check**
   - ESLint validation
   - TypeScript type checking

2. **Build Test**
   - Full Next.js build
   - Validates build output

3. **Code Quality Check**
   - No console statements in production code
   - No TODO comments
   - No committed .env files

**Status:** ![CI/CD Pipeline](https://github.com/winsnip-official/winscan.org/actions/workflows/ci.yml/badge.svg)

---

### `deploy-production.yml`
**Triggers:** Push to main, Manual workflow dispatch

**Jobs:**
1. **Pre-deployment Security Check**
   - High-level security audit
   - Secret scanning

2. **Build & Deploy**
   - Production build
   - Deployment notification

**Status:** ![Deploy to Production](https://github.com/winsnip-official/winscan.org/actions/workflows/deploy-production.yml/badge.svg)

---

## 📋 Workflow Summary

| Workflow | Branch | Purpose | Required |
|----------|--------|---------|----------|
| Security Audit | dev, main | Security checks | ✅ Yes |
| CI/CD Pipeline | dev | Code quality & build | ✅ Yes |
| Deploy Production | main | Production deployment | ✅ Yes |

---

## 🚀 Usage

### For Development (dev branch)
```bash
# Make changes
git add .
git commit -m "feat: your feature"
git push origin dev

# CI/CD will automatically:
# 1. Run lint & type check
# 2. Test build
# 3. Check code quality
# 4. Run security audit
```

### For Production (main branch)
```bash
# Create PR from dev to main
# After approval and merge:
# 1. Full security audit
# 2. Production build
# 3. Deploy to production
```

---

## ⚙️ Configuration

### Required Secrets (GitHub Repository Settings)

Add these in: **Settings** → **Secrets and variables** → **Actions**

```
NEXT_PUBLIC_API_URL=https://ssl.winsnip.xyz
NEXT_PUBLIC_API_URL_FALLBACK=https://ssl2.winsnip.xyz
```

### Branch Protection

See [BRANCH_PROTECTION.md](./BRANCH_PROTECTION.md) for detailed setup instructions.

---

## 🛡️ Security Features

### Automated Checks
- ✅ Dependency vulnerability scanning
- ✅ CodeQL static analysis
- ✅ Secret detection (TruffleHog)
- ✅ Code quality validation
- ✅ Build verification

### Manual Review
- ✅ Pull request reviews required for main
- ✅ Status checks must pass
- ✅ Branch must be up to date

---

## 📊 Status Badges

Add these to your README.md:

```markdown
[![Security Audit](https://github.com/winsnip-official/winscan.org/actions/workflows/security-audit.yml/badge.svg)](https://github.com/winsnip-official/winscan.org/actions/workflows/security-audit.yml)
[![CI/CD](https://github.com/winsnip-official/winscan.org/actions/workflows/ci.yml/badge.svg)](https://github.com/winsnip-official/winscan.org/actions/workflows/ci.yml)
[![Deploy](https://github.com/winsnip-official/winscan.org/actions/workflows/deploy-production.yml/badge.svg)](https://github.com/winsnip-official/winscan.org/actions/workflows/deploy-production.yml)
```

---

## 🔧 Troubleshooting

### Workflow fails on security audit
- Check `npm audit` output
- Update vulnerable dependencies: `npm audit fix`
- For breaking changes, update manually

### Build fails
- Ensure all TypeScript errors are fixed
- Check for missing environment variables
- Verify all imports are correct

### CodeQL analysis fails
- Review security alerts in GitHub Security tab
- Fix identified vulnerabilities
- Re-run workflow

---

## 📚 Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [CodeQL Documentation](https://codeql.github.com/docs/)
- [Branch Protection Rules](./BRANCH_PROTECTION.md)
- [Contributing Guidelines](../CONTRIBUTING.md)
