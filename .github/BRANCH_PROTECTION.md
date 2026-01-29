# Branch Protection Rules

## Branch Strategy

### `main` - Production Branch
- **Protected**: Yes
- **Direct Push**: ❌ Disabled
- **Merge Method**: Squash and merge only
- **Required Reviews**: 1 approval minimum
- **Status Checks**: All CI/CD checks must pass
- **Deploy**: Automatic deployment to production

### `dev` - Development Branch  
- **Protected**: Yes
- **Direct Push**: ✅ Allowed for maintainers
- **Merge Method**: Any
- **Required Reviews**: Optional
- **Status Checks**: All CI/CD checks must pass
- **Deploy**: Automatic deployment to staging/dev environment

## Workflow

```
feature/xxx → dev → main
     ↓         ↓      ↓
   Local    Staging  Production
```

### Development Flow

1. **Create feature branch from `dev`**
   ```bash
   git checkout dev
   git pull origin dev
   git checkout -b feature/your-feature-name
   ```

2. **Make changes and commit**
   ```bash
   git add .
   git commit -m "feat: your feature description"
   ```

3. **Push to dev branch**
   ```bash
   git push origin feature/your-feature-name
   # Create PR to dev branch
   ```

4. **After PR approved and merged to dev**
   - CI/CD runs automatically
   - Security checks performed
   - Build tested
   - Deploy to staging

5. **When ready for production**
   ```bash
   # Create PR from dev to main
   git checkout dev
   git pull origin dev
   # Create PR: dev → main
   ```

6. **After PR approved and merged to main**
   - Full security audit
   - Production build
   - Deploy to production

## Required Status Checks

### For `dev` branch:
- ✅ Lint & Type Check
- ✅ Build Test
- ✅ Code Quality Check

### For `main` branch:
- ✅ All dev checks
- ✅ Security Audit
- ✅ CodeQL Analysis
- ✅ Secret Scanning
- ✅ Dependency Review

## Setting Up Branch Protection (GitHub UI)

### For `main` branch:

1. Go to: **Settings** → **Branches** → **Add rule**
2. Branch name pattern: `main`
3. Enable:
   - ✅ Require a pull request before merging
   - ✅ Require approvals (1)
   - ✅ Dismiss stale pull request approvals when new commits are pushed
   - ✅ Require status checks to pass before merging
   - ✅ Require branches to be up to date before merging
   - ✅ Require conversation resolution before merging
   - ✅ Do not allow bypassing the above settings
4. Status checks required:
   - `Security Audit`
   - `CodeQL Analysis`
   - `Build Test`
   - `Lint & Type Check`

### For `dev` branch:

1. Go to: **Settings** → **Branches** → **Add rule**
2. Branch name pattern: `dev`
3. Enable:
   - ✅ Require status checks to pass before merging
   - ✅ Require branches to be up to date before merging
4. Status checks required:
   - `Build Test`
   - `Lint & Type Check`
   - `Code Quality Check`

## Commit Message Convention

Follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting, etc)
- `refactor:` - Code refactoring
- `perf:` - Performance improvements
- `test:` - Adding tests
- `chore:` - Maintenance tasks
- `ci:` - CI/CD changes

Example:
```bash
git commit -m "feat: add IBC bridge interface"
git commit -m "fix: resolve avatar clipping issue"
git commit -m "docs: update README with new features"
```

## Emergency Hotfix

For critical production issues:

1. Create hotfix branch from `main`
   ```bash
   git checkout main
   git pull origin main
   git checkout -b hotfix/critical-issue
   ```

2. Fix and test
   ```bash
   git add .
   git commit -m "hotfix: critical issue description"
   ```

3. Create PR to `main` with "HOTFIX" label
4. After merge to `main`, also merge to `dev`
   ```bash
   git checkout dev
   git merge main
   git push origin dev
   ```
