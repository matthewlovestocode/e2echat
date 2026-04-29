# E2E Chat Documentation

This directory explains how the project works for someone who is new to the codebase. The app is a monorepo with one Next.js app. The browser client encrypts messages before they leave the device, and Next.js route handlers relay public keys and ciphertext between clients in the same room.

## Reading Order

1. [How to Run the App](./how-to-run.md): Step-by-step instructions for cloning, installing, starting, and testing the app locally.
2. [Architecture](./architecture.md): The shape of the monorepo and how the apps fit together.
3. [Encryption Flow](./encryption-flow.md): How browser key exchange, encryption, and decryption work.
4. [Web App](./web-app.md): How the Next.js and Material UI client is organized.
5. [SSE Relay](./sse-relay.md): How room membership and message forwarding work without a separate server.
6. [Vercel Deployment](./vercel.md): How to deploy the single Next.js app to Vercel for testing.
7. [Development Guide](./development.md): How to validate and extend the project.

## What This Project Demonstrates

The project demonstrates the core mechanics of an end-to-end encrypted chat:

- Each browser tab creates its own ECDH key pair.
- Clients exchange public keys through Next.js route handlers.
- Each client derives the same shared AES-GCM key locally.
- Plaintext messages are encrypted in the browser before being sent.
- The route-handler relay forwards ciphertext but never receives the plaintext message body.
- The receiving browser decrypts ciphertext locally and renders the plaintext.

## What This Project Does Not Yet Provide

This is a demonstration, not a production secure messenger. It intentionally keeps the code small enough to study. Important production features are not implemented yet:

- User authentication.
- Long-term identity keys.
- Message persistence.
- Key verification or safety numbers.
- Replay protection.
- Multi-device synchronization.
- Forward secrecy through ratcheted session keys.
- Server authorization for rooms.
- Strong schema validation on relay messages.

Those gaps are documented because they are important. The current project teaches the basic client-side encryption path and the minimal route-handler behavior needed to relay encrypted chat messages.
