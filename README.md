This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Documentation

- **[API Documentation](./API.md)** - Comprehensive API endpoint reference and usage guide
- **[Backend Architecture](./BACKEND.md)** - Detailed backend architecture, database schema, and development guide
- **[Teacher Dashboard Refactor](./TEACHER_DASHBOARD_REFACTOR.md)** - Teacher dashboard structure and refactoring details
- **[Parent Features](./PARENT_FEATURES_README.md)** - Parent dashboard features and implementation

## Getting Started

First, run the development server:

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
