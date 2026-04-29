# Architecture

The repository is an npm workspaces monorepo. The root owns shared scripts and dependency installation. The current runtime is a single Next.js app with Supabase Realtime for shared room transport.

```mermaid
flowchart TD
  repo["e2e-chat repository"]
  rootPkg["Root package.json\nworkspace scripts"]
  lockfile["package-lock.json\nresolved dependency graph"]
  docs["docs/\nproject documentation"]
  web["apps/web\nNext.js + Material UI client"]
  realtime["Supabase Realtime\nroom broadcast transport"]

  repo --> rootPkg
  repo --> lockfile
  repo --> docs
  repo --> web
  web --> realtime
```

## Runtime App

`apps/web` is the user-facing chat client. It runs through Next.js and uses Material UI for layout.

The browser is responsible for all encryption and decryption. Supabase Realtime carries public keys and ciphertext between clients in the same room.

## Runtime Communication

```mermaid
flowchart LR
  alice["Browser A\napps/web"]
  relay["Supabase Realtime\nbroadcast channel"]
  bob["Browser B\napps/web"]

  alice -- "subscribe + public key broadcast" --> relay
  bob -- "subscribe + public key broadcast" --> relay
  relay -- "peer public key" --> alice
  relay -- "peer public key" --> bob
  alice -- "ciphertext broadcast" --> relay
  relay -- "ciphertext broadcast" --> bob
  bob -- "ciphertext broadcast" --> relay
  relay -- "ciphertext broadcast" --> alice
```

The important boundary is between the browser and Supabase Realtime. The browser can see plaintext because it owns the user's input and local cryptographic keys. Supabase only sees room IDs, client IDs, public keys, initialization vectors, ciphertext payloads, and timestamps.

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

| Data | Created In | Sent To Supabase | Purpose |
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
  A->>S: Subscribe and broadcast public key
  B->>B: Generate ECDH key pair
  B->>S: Subscribe and broadcast public key
  S->>A: Send Browser B public key
  S->>B: Send Browser A public key
  A->>A: Derive shared AES-GCM key
  B->>B: Derive shared AES-GCM key
  A->>A: Encrypt plaintext
  A->>S: Broadcast ciphertext
  S->>B: Deliver ciphertext broadcast
  B->>B: Decrypt and render plaintext
```
