# Architecture

The repository is an npm workspaces monorepo. The root owns shared scripts and dependency installation. The current runtime is a single Next.js app so it can deploy to Vercel without a separate WebSocket process.

```mermaid
flowchart TD
  repo["e2e-chat repository"]
  rootPkg["Root package.json\nworkspace scripts"]
  lockfile["package-lock.json\nresolved dependency graph"]
  docs["docs/\nproject documentation"]
  web["apps/web\nNext.js + Material UI client"]
  api["apps/web/app/api\nSSE + HTTP relay routes"]

  repo --> rootPkg
  repo --> lockfile
  repo --> docs
  repo --> web
  web --> api
```

## Runtime App

`apps/web` is the user-facing chat client and the relay host. It runs through Next.js, uses Material UI for layout, and exposes route handlers under `app/api`.

The browser is responsible for all encryption and decryption. The route handlers keep room membership in memory, stream peer events with Server-Sent Events, and accept encrypted messages through HTTP POST.

## Runtime Communication

```mermaid
flowchart LR
  alice["Browser A\napps/web"]
  relay["Next route handlers\nSSE + POST"]
  bob["Browser B\napps/web"]

  alice -- "EventSource: room + public key" --> relay
  bob -- "EventSource: room + public key" --> relay
  relay -- "peer public key" --> alice
  relay -- "peer public key" --> bob
  alice -- "POST ciphertext only" --> relay
  relay -- "SSE ciphertext only" --> bob
  bob -- "POST ciphertext only" --> relay
  relay -- "SSE ciphertext only" --> alice
```

The important boundary is between the browser and the relay route handlers. The browser can see plaintext because it owns the user's input and local cryptographic keys. The route handlers only see room IDs, client IDs, public keys, initialization vectors, ciphertext payloads, and timestamps.

## Root Scripts

The root [package.json](../package.json) exposes the common workflow:

| Script | Purpose |
| --- | --- |
| `npm run dev` | Runs the Next.js app. |
| `npm run dev:web` | Runs only the Next.js app. |
| `npm run build` | Builds every workspace that has a `build` script. |
| `npm run lint` | Runs linting in workspaces that define linting. |
| `npm run typecheck` | Runs TypeScript checks across workspaces. |

## Data Boundaries

The app uses four important categories of data:

| Data | Created In | Sent To Route Handlers | Purpose |
| --- | --- | --- | --- |
| Client ID | Browser | Yes | Identifies which browser client sent a message. |
| Room ID | Browser | Yes | Groups peers into a chat room. |
| Public key | Browser | Yes | Allows peers to derive a shared key. |
| Private key | Browser | No | Used locally to derive the shared key. |
| Shared AES key | Browser | No | Encrypts and decrypts message text. |
| Plaintext message | Browser | No | The user's readable chat message. |
| Ciphertext payload | Browser | Yes | Encrypted message body relayed to peers. |

## High-Level Lifecycle

```mermaid
sequenceDiagram
  participant A as Browser A
  participant S as Relay
  participant B as Browser B

  A->>A: Generate ECDH key pair
  A->>S: Open SSE stream with public key
  B->>B: Generate ECDH key pair
  B->>S: Open SSE stream with public key
  S->>A: Send Browser B public key
  S->>B: Send Browser A public key
  A->>A: Derive shared AES-GCM key
  B->>B: Derive shared AES-GCM key
  A->>A: Encrypt plaintext
  A->>S: POST ciphertext
  S->>B: Stream ciphertext over SSE
  B->>B: Decrypt and render plaintext
```
