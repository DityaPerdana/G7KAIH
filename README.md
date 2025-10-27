This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## ⚠️ Security Notice

**Before deploying to production, please read:**
- [SECURITY_WARNING.md](./SECURITY_WARNING.md) - Critical security issues
- [SECURITY_IMPLEMENTATION.md](./SECURITY_IMPLEMENTATION.md) - Implementation guide
- [AUDIT_SUMMARY.md](./AUDIT_SUMMARY.md) - Complete security audit

## Getting Started

### 1. Environment Setup

Copy the example environment file and fill in your credentials:

```bash
cp .env.example .env.local
```

Edit `.env.local` with your actual values:
- Get Supabase credentials from your [Supabase dashboard](https://supabase.com/dashboard)
- Get reCAPTCHA keys from [Google reCAPTCHA](https://www.google.com/recaptcha/admin)

**Important:** Never commit `.env.local` to git! It contains sensitive credentials.

### 2. Install Dependencies

```bash
npm install
```

### 3. Database Setup

**For Development:**
```bash
# The dev policies allow broad access for testing
# These are already in the database_migrations folder
```

**For Production:**
```bash
# CRITICAL: Replace dev policies with production policies
# See SECURITY_IMPLEMENTATION.md for detailed instructions
```

### 4. Run Development Server

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Project Structure

```
G7KAIH/
├── src/
│   ├── app/              # Next.js app router pages and API routes
│   ├── components/       # React components
│   ├── utils/           # Utility functions (validation, supabase clients)
│   └── middleware.ts    # Security headers middleware (see middleware.security.ts)
├── database_migrations/ # SQL migration files
│   ├── dev_*.sql       # Development policies (⚠️ NOT for production)
│   └── prod_*.sql      # Production policies (✅ Use these)
├── scripts/            # Utility scripts
├── public/             # Static assets
└── docs/              # Documentation
    ├── SECURITY_WARNING.md
    ├── SECURITY_IMPLEMENTATION.md
    ├── PERFORMANCE_GUIDE.md
    └── AUDIT_SUMMARY.md
```

## Security Features

This project includes comprehensive security measures:

- ✅ **Row Level Security (RLS)** - Database-level access control
- ✅ **Authentication** - Admin routes require proper authentication
- ✅ **Input Validation** - Utilities to validate and sanitize user input
- ✅ **Rate Limiting** - Prevent abuse and DoS attacks
- ✅ **Security Headers** - Protection against common web vulnerabilities
- ✅ **Environment Variable Management** - Secure credential handling

See [SECURITY_IMPLEMENTATION.md](./SECURITY_IMPLEMENTATION.md) for implementation details.

## Performance Optimizations

- ✅ Database indexes on frequently queried columns
- ✅ Optimized API routes with reduced query counts
- ✅ Per-user caching to improve response times
- ✅ Efficient data aggregation strategies

See [PERFORMANCE_GUIDE.md](./PERFORMANCE_GUIDE.md) for details.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Testing

This project ships with [Vitest](https://vitest.dev) and [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/) for fast, component-focused tests.

Install dependencies (only required once):

```bash
bun install
```

Run the full test suite:

```bash
bun run test
```

For an interactive watch mode during development:

```bash
bun run test:watch
```

Coverage reports are emitted to the console (`text`) and `coverage/` (`lcov`) by default.

### API route tests

- `src/app/api/__tests__/route-exports.test.ts` loads every `route.ts` module under `src/app/api` to ensure each exports at least one HTTP method handler.
- `src/app/api/submission-window/__tests__/submission-window.test.ts` demonstrates mocking Supabase and exercising the route logic for different authorization and validation branches. Use it as a template when adding behavioral tests for other endpoints.

### Feature UI tests

- `src/app/login/__tests__/login.test.tsx` covers rendering, password visibility toggling, and reCAPTCHA validation flows for the login experience.
- `src/app/(user)/siswa/__tests__/page.test.tsx` simulates submission window states and data loading for the student dashboard, including error and empty scenarios.
- `src/app/tos/__tests__/tos.test.tsx` and `src/app/error/__tests__/error.test.tsx` provide content smoke tests ensuring static pages remain stable.
