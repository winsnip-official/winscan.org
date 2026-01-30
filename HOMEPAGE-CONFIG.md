# Homepage & Branding Configuration Guide

This guide explains how to configure the homepage, loading screen, and customize branding (logo, favicon) for WinScan Explorer.

---

## 📋 Table of Contents

1. [Homepage Configuration](#homepage-configuration)
2. [Loading Screen](#loading-screen)
3. [Logo & Favicon Customization](#logo--favicon-customization)
4. [Domain Whitelist Security](#domain-whitelist-security)
5. [Environment Variables](#environment-variables)

---

## 🏠 Homepage Configuration

### Enable/Disable Homepage

The homepage displays a list of all available blockchain networks. You can enable or disable it using environment variables.

#### Configuration File
Edit `.env` file in the root directory:

```env
# Homepage Configuration
NEXT_PUBLIC_ENABLE_HOMEPAGE=1
NEXT_PUBLIC_DEFAULT_CHAIN=paxi-mainnet
```

#### Options

| Variable | Value | Description |
|----------|-------|-------------|
| `NEXT_PUBLIC_ENABLE_HOMEPAGE` | `1` | **Enable homepage** - Shows chain list with hero section |
| `NEXT_PUBLIC_ENABLE_HOMEPAGE` | `0` | **Disable homepage** - Redirects directly to default chain |
| `NEXT_PUBLIC_DEFAULT_CHAIN` | `chain-name` | Default chain to redirect when homepage is disabled |

#### Examples

**Example 1: Enable Homepage (Multi-Chain Explorer)**
```env
NEXT_PUBLIC_ENABLE_HOMEPAGE=1
NEXT_PUBLIC_DEFAULT_CHAIN=paxi-mainnet
```
- Users see homepage with all chains
- Can select which chain to explore
- Best for multi-chain explorers

**Example 2: Disable Homepage (Single Chain Explorer)**
```env
NEXT_PUBLIC_ENABLE_HOMEPAGE=0
NEXT_PUBLIC_DEFAULT_CHAIN=osmosis-mainnet
```
- Users directly land on Osmosis explorer
- No chain selection page
- Best for single-chain focused explorers

---

## ⏳ Loading Screen

### Overview

The loading screen appears for 3 seconds when users first visit the website. It features:
- Animated logo with rotating rings
- Gradient background with glow effects
- Progress bar
- Floating particles
- Smooth fade-out transition

### Customization

#### File Location
```
components/LoadingScreen.tsx
```

#### Customize Duration

Change loading duration (default: 3 seconds):

```typescript
// In components/LoadingScreen.tsx

useEffect(() => {
  // Start fade out after 2.5 seconds
  const fadeTimer = setTimeout(() => {
    setFadeOut(true);
  }, 2500); // Change this value

  // Hide loading screen after 3 seconds total
  const hideTimer = setTimeout(() => {
    setIsLoading(false);
  }, 3000); // Change this value

  return () => {
    clearTimeout(fadeTimer);
    clearTimeout(hideTimer);
  };
}, []);
```

#### Customize Text

Change loading screen text:

```tsx
{/* Loading text with gradient */}
<div className="text-center space-y-3">
  <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-400 to-blue-400 animate-gradient">
    WinScan Explorer  {/* Change this */}
  </h2>
  <p className="text-gray-400 text-sm font-medium">
    Multi-Chain Blockchain Explorer  {/* Change this */}
  </p>
</div>
```

#### Customize Colors

Change gradient colors:

```tsx
{/* Background gradient */}
<div className="fixed inset-0 z-[9999] bg-gradient-to-br from-[#0a0a0a] via-[#0f0f0f] to-[#0a0a0a]">

{/* Glow effect */}
<div className="w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse"></div>

{/* Rings */}
<div className="w-40 h-40 border-2 border-blue-500/20 rounded-full"></div>
<div className="w-36 h-36 border-2 border-purple-500/20 rounded-full"></div>

{/* Progress bar */}
<div className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"></div>
```

#### Disable Loading Screen

To completely disable the loading screen:

1. Open `app/layout.tsx`
2. Remove or comment out the LoadingScreen component:

```tsx
// Before
<body className="antialiased">
  <LoadingScreen />  {/* Remove this line */}
  <LanguageProvider>
    ...
  </LanguageProvider>
</body>

// After
<body className="antialiased">
  <LanguageProvider>
    ...
  </LanguageProvider>
</body>
```

---

## 🎨 Logo & Favicon Customization

### Logo Files

WinScan uses SVG format for logo and favicon for best quality and scalability.

#### File Locations

```
public/
├── logo.svg       # Main logo (used in header, loading screen, homepage)
└── favicon.svg    # Browser tab icon
```

### How to Change Logo

#### Step 1: Prepare Your Logo

**Requirements:**
- Format: SVG (recommended) or PNG
- Size: 96x96px minimum (for logo.svg)
- Background: Transparent
- File size: < 50KB recommended

#### Step 2: Replace Logo Files

1. **Replace Main Logo:**
   ```bash
   # Backup original
   cp public/logo.svg public/logo.svg.backup
   
   # Replace with your logo
   cp /path/to/your-logo.svg public/logo.svg
   ```

2. **Replace Favicon:**
   ```bash
   # Backup original
   cp public/favicon.svg public/favicon.svg.backup
   
   # Replace with your favicon
   cp /path/to/your-favicon.svg public/favicon.svg
   ```

#### Step 3: Update Metadata (Optional)

If you want to use PNG instead of SVG for favicon:

Edit `app/layout.tsx`:

```typescript
export const metadata: Metadata = {
  title: "WinScan",
  description: "Multi-chain blockchain explorer powered by WinScan",
  icons: {
    icon: '/logo.png',      // Change to .png if needed
    apple: '/logo.png',     // Change to .png if needed
  },
};
```

### Logo Usage Locations

Your logo appears in these locations:

1. **Loading Screen** (`components/LoadingScreen.tsx`)
   ```tsx
   <Image src="/logo.svg" alt="WinScan Logo" width={96} height={96} />
   ```

2. **Homepage Header** (`app/page.tsx`)
   ```tsx
   <Image src="/logo.svg" alt="WinScan" width={40} height={40} />
   ```

3. **Browser Tab** (favicon)
   - Defined in `app/layout.tsx` metadata

### Logo Customization Tips

#### Adjust Logo Size

**In Loading Screen:**
```tsx
{/* Change width and height */}
<div className="relative w-24 h-24">  {/* Change w-24 h-24 */}
  <Image src="/logo.svg" alt="Logo" width={96} height={96} />
</div>
```

**In Homepage:**
```tsx
{/* Change width and height */}
<Image src="/logo.svg" alt="Logo" width={40} height={40} />  {/* Change values */}
```

#### Add Logo Glow Effect

```tsx
<div className="relative w-24 h-24">
  {/* Add glow */}
  <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-2xl blur-xl"></div>
  <Image src="/logo.svg" alt="Logo" width={96} height={96} className="relative" />
</div>
```

---

## 🔧 Environment Variables

### Complete Configuration

Create or edit `.env` file:

```env
# API Configuration
NEXT_PUBLIC_API_URL=https://ssl.winsnip.xyz
NEXT_PUBLIC_API_TIMEOUT=8000
NEXT_PUBLIC_CACHE_TTL=30000

# Homepage Configuration
NEXT_PUBLIC_ENABLE_HOMEPAGE=1          # 1 = enable, 0 = disable
NEXT_PUBLIC_DEFAULT_CHAIN=paxi-mainnet # Default chain when homepage disabled

# Domain Whitelist (comma-separated)
# Only these domains can access the explorer
# Leave empty to allow all domains
NEXT_PUBLIC_ALLOWED_DOMAINS=winscan.org,winscan.winsnip.xyz,localhost

# Polling Intervals (milliseconds)
NEXT_PUBLIC_POLL_VALIDATOR_DETAIL=30000
NEXT_PUBLIC_POLL_VALIDATORS=30000
NEXT_PUBLIC_POLL_OVERVIEW=20000
NEXT_PUBLIC_POLL_BLOCKS=15000
NEXT_PUBLIC_POLL_TRANSACTIONS=15000
NEXT_PUBLIC_POLL_UPTIME=30000
```

### Production Environment

For production deployment (Vercel, etc.), set these in your hosting platform's environment variables:

```env
NEXT_PUBLIC_ENABLE_HOMEPAGE=1
NEXT_PUBLIC_DEFAULT_CHAIN=your-chain-name
```

---

## 📝 Quick Start Checklist

### For Multi-Chain Explorer

- [ ] Set `NEXT_PUBLIC_ENABLE_HOMEPAGE=1`
- [ ] Configure domain whitelist in `NEXT_PUBLIC_ALLOWED_DOMAINS` (optional)
- [ ] Replace `public/logo.svg` with your logo
- [ ] Replace `public/favicon.svg` with your favicon
- [ ] Update homepage text in `app/page.tsx`
- [ ] Update loading screen text in `components/LoadingScreen.tsx`
- [ ] Test locally: `npm run dev`

### For Single-Chain Explorer

- [ ] Set `NEXT_PUBLIC_ENABLE_HOMEPAGE=0`
- [ ] Set `NEXT_PUBLIC_DEFAULT_CHAIN=your-chain`
- [ ] Configure domain whitelist in `NEXT_PUBLIC_ALLOWED_DOMAINS` (optional)
- [ ] Replace `public/logo.svg` with your logo
- [ ] Replace `public/favicon.svg` with your favicon
- [ ] Update loading screen text in `components/LoadingScreen.tsx`
- [ ] Test locally: `npm run dev`

---

## 🚀 Deployment

After making changes:

1. **Test locally:**
   ```bash
   npm run dev
   ```

2. **Build for production:**
   ```bash
   npm run build
   ```

3. **Deploy:**
   ```bash
   git add .
   git commit -m "chore: update homepage and branding configuration"
   git push origin main
   ```

---

## 💡 Tips & Best Practices

1. **Logo Format:** Use SVG for best quality and scalability
2. **File Size:** Keep logo files under 50KB for fast loading
3. **Testing:** Always test changes locally before deploying
4. **Backup:** Keep backup of original logo files
5. **Consistency:** Use same logo across all locations
6. **Colors:** Match logo colors with your brand theme
7. **Accessibility:** Ensure logo has good contrast with background

---

## 🆘 Troubleshooting

### Logo Not Showing

1. Check file path is correct: `/public/logo.svg`
2. Clear browser cache: `Ctrl + Shift + R`
3. Rebuild project: `npm run build`
4. Check file permissions

### Homepage Not Showing

1. Verify `.env` has `NEXT_PUBLIC_ENABLE_HOMEPAGE=1`
2. Restart dev server after changing `.env`
3. Check browser console for errors

### Loading Screen Too Long/Short

1. Adjust timeout values in `components/LoadingScreen.tsx`
2. Recommended: 2-3 seconds for good UX

---

## 📞 Support

For more help:
- Check main README.md
- Review CHAIN-GUIDELINES.md for adding chains
- Open an issue on GitHub

---

**Last Updated:** January 2026
**Version:** 1.0.0
