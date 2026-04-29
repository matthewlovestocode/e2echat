# E2E Chat

Monorepo for a browser-based end-to-end encrypted chat demo that can run as a single
Next.js app on Vercel with Supabase Realtime room transport.

## Apps

- `apps/web`: Next.js + Material UI client using Supabase Realtime broadcast channels.

## Documentation

If you just want to run the app, start with [`docs/how-to-run.md`](docs/how-to-run.md).

For a broader newcomer-friendly explanation, start with [`docs/index.md`](docs/index.md) for the codebase,
architecture, encryption flow, Supabase Realtime, Vercel deployment, and local development workflow.

## Development

```bash
npm install
npm run dev
```

The web app runs on `http://localhost:3000`. No separate WebSocket server is required.
