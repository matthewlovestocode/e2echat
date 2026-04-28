# Architecture

The repository is an npm workspaces monorepo. The root owns shared scripts and dependency installation, while each app owns its runtime code and package metadata.

```mermaid
flowchart TD
  repo["e2e-chat repository"]
  rootPkg["Root package.json\nworkspace scripts"]
  lockfile["package-lock.json\nresolved dependency graph"]
  docs["docs/\nproject documentation"]
  web["apps/web\nNext.js + Material UI client"]
  ws["apps/ws-server\nWebSocket relay"]

  repo --> rootPkg
  repo --> lockfile
  repo --> docs
  repo --> web
  repo --> ws
```

## Runtime Apps

`apps/web` is the user-facing chat client. It runs in the browser through Next.js and uses Material UI for layout, forms, buttons, alerts, chips, and message surfaces. It is responsible for all encryption and decryption.

`apps/ws-server` is the relay. It accepts WebSocket connections, records which room a socket joined, exchanges public keys between clients in the same room, and broadcasts ciphertext messages. It does not decrypt messages.

## Runtime Communication

```mermaid
flowchart LR
  alice["Browser A\napps/web"]
  relay["WebSocket relay\napps/ws-server"]
  bob["Browser B\napps/web"]

  alice -- "join room + public key" --> relay
  bob -- "join room + public key" --> relay
  relay -- "peer public key" --> alice
  relay -- "peer public key" --> bob
  alice -- "ciphertext only" --> relay
  relay -- "ciphertext only" --> bob
  bob -- "ciphertext only" --> relay
  relay -- "ciphertext only" --> alice
```

The important boundary is between the browser and the relay. The browser can see plaintext because it owns the user's input and local cryptographic keys. The relay only sees room IDs, client IDs, public keys, initialization vectors, ciphertext payloads, and timestamps.

## Root Scripts

The root [package.json](../package.json) exposes the common workflow:

| Script | Purpose |
| --- | --- |
| `npm run dev` | Runs the web app and WebSocket relay at the same time with `concurrently`. |
| `npm run dev:web` | Runs only the Next.js app. |
| `npm run dev:ws` | Runs only the WebSocket relay. |
| `npm run build` | Builds every workspace that has a `build` script. |
| `npm run lint` | Runs linting in workspaces that define linting. |
| `npm run typecheck` | Runs TypeScript checks across workspaces. |

## Data Boundaries

The app uses four important categories of data:

| Data | Created In | Sent To Relay | Purpose |
| --- | --- | --- | --- |
| Client ID | Browser | Yes | Identifies which socket sent a message. |
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
  A->>S: Join room with public key
  B->>B: Generate ECDH key pair
  B->>S: Join same room with public key
  S->>A: Send Browser B public key
  S->>B: Send Browser A public key
  A->>A: Derive shared AES-GCM key
  B->>B: Derive shared AES-GCM key
  A->>A: Encrypt plaintext
  A->>S: Send ciphertext
  S->>B: Forward ciphertext
  B->>B: Decrypt and render plaintext
```
