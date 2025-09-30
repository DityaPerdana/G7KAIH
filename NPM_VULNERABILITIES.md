# NPM Dependency Vulnerabilities Report

## Summary

5 moderate severity vulnerabilities found in development dependencies (vitest, esbuild).

## Vulnerabilities

### 1. esbuild (<=0.24.2)
- **Severity:** Moderate
- **GHSA:** GHSA-67mh-4wv8-2f99
- **Description:** esbuild enables any website to send any requests to the development server and read the response
- **Impact:** Development server only (not production)
- **Affected Packages:**
  - esbuild
  - vite
  - @vitest/mocker
  - vitest
  - vite-node

## Risk Assessment

### Production Impact: LOW
- These vulnerabilities only affect the development server (`npm run dev`)
- They do NOT affect the production build (`npm run build`)
- The production build bundles and optimizes code, removing these tools

### Development Impact: MODERATE
- When running `npm run dev`, any website can potentially:
  - Send requests to your local development server
  - Read responses from your development server
- **Risk Mitigation:**
  - Development servers should never be exposed to the internet
  - Always run development servers on localhost only
  - Never use development servers for production

## Recommended Actions

### Option 1: Accept Risk (Recommended for Now)
Since these are dev-only vulnerabilities:
1. ✅ Keep current versions to avoid breaking changes
2. ✅ Ensure dev servers are never exposed publicly
3. ✅ Document the issue for future updates
4. ✅ Monitor for security updates to vitest/esbuild

**Rationale:**
- No production impact
- Upgrading requires vitest 3.x (breaking changes)
- Risk is minimal with proper development practices

### Option 2: Force Update (Use with Caution)
```bash
npm audit fix --force
```

**Warning:** This will upgrade vitest to 3.x which includes:
- Breaking API changes
- Potential test failures
- Need to update test configurations

**If you choose this option:**
1. Run on a separate branch
2. Update vitest.config.ts for v3 compatibility
3. Update test files as needed
4. Verify all tests pass
5. Merge after thorough testing

### Option 3: Alternative Testing Framework
Consider switching from vitest to jest or another testing framework:
- Jest is more stable and widely used
- No current security vulnerabilities
- Better ecosystem support

## Immediate Security Measures

### 1. Restrict Development Server Access

Add to your development documentation:

```bash
# Always bind to localhost only
npm run dev -- --host 127.0.0.1

# Or use environment variable
HOST=127.0.0.1 npm run dev
```

### 2. Firewall Rules

Ensure your firewall blocks external access to dev ports (3000, 5173, etc.):

```bash
# Linux (ufw)
sudo ufw deny from any to any port 3000
sudo ufw allow from 127.0.0.1 to any port 3000

# macOS (pf)
# Add to /etc/pf.conf:
# block in proto tcp from any to any port 3000
# pass in proto tcp from 127.0.0.1 to any port 3000
```

### 3. Network Configuration

In `next.config.ts`:
```typescript
const nextConfig: NextConfig = {
  // Ensure dev server only listens on localhost
  ...(process.env.NODE_ENV === 'development' && {
    serverOptions: {
      hostname: 'localhost'
    }
  })
};
```

## Long-term Plan

1. **Monitor Updates** (Monthly)
   - Check for vitest updates that fix the vulnerability
   - Review release notes for breaking changes

2. **Scheduled Upgrade** (Quarterly)
   - Plan time to upgrade testing dependencies
   - Update tests for new API versions
   - Run full test suite before deploying

3. **Security Scanning** (Continuous)
   - Add `npm audit` to CI/CD pipeline
   - Fail builds on high/critical vulnerabilities
   - Warn on moderate vulnerabilities

## CI/CD Integration

Add to `.github/workflows/security.yml`:

```yaml
name: Security Audit

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]
  schedule:
    - cron: '0 0 * * 0'  # Weekly on Sundays

jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm ci
      - run: npm audit --audit-level=high
      # Note: This will fail on high/critical, warn on moderate
```

## Current Status

- ✅ Issue documented
- ✅ Risk assessed (LOW for production)
- ✅ Mitigation strategies defined
- ⏳ Waiting for upstream fixes
- ⏳ Planning upgrade to vitest 3.x

## References

- [GHSA-67mh-4wv8-2f99](https://github.com/advisories/GHSA-67mh-4wv8-2f99)
- [esbuild Security Advisories](https://github.com/evanw/esbuild/security/advisories)
- [Vitest v3 Migration Guide](https://vitest.dev/guide/migration.html)

## Decision Log

| Date | Decision | Reason |
|------|----------|--------|
| 2024-01-XX | Accept risk, document issue | Dev-only impact, avoid breaking changes |
| TBD | Plan upgrade to vitest 3.x | When team has capacity for testing updates |

## Questions?

Contact the security team or create an issue in the repository.
