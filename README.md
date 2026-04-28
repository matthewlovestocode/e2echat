# E2E Chat

Monorepo for a browser-based end-to-end encrypted chat demo.

## Apps

- `apps/web`: Next.js + Material UI client.
- `apps/ws-server`: WebSocket relay that forwards room messages without decrypting them.

## Development

```bash
npm install
npm run dev
```

The web app runs on `http://localhost:3000` and expects the WebSocket relay at `ws://localhost:3001`.
