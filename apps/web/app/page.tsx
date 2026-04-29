"use client";

import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import KeyIcon from "@mui/icons-material/Key";
import LockIcon from "@mui/icons-material/Lock";
import SendIcon from "@mui/icons-material/Send";
import SyncIcon from "@mui/icons-material/Sync";
import {
  Alert,
  AppBar,
  Box,
  Button,
  Chip,
  Container,
  Divider,
  IconButton,
  Paper,
  Stack,
  TextField,
  Toolbar,
  Tooltip,
  Typography
} from "@mui/material";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

type WireMessage =
  | { type: "peer"; senderId: string; publicKey: JsonWebKey }
  | { type: "ciphertext"; senderId: string; iv: string; payload: string; sentAt: string }
  | { type: "system"; message: string };

type ChatMessage = {
  id: string;
  author: "me" | "peer" | "system";
  text: string;
  sentAt: string;
};

function bytesToBase64(bytes: ArrayBuffer | Uint8Array) {
  const values = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";
  values.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

async function createIdentity() {
  const pair = await crypto.subtle.generateKey(
    {
      name: "ECDH",
      namedCurve: "P-256"
    },
    true,
    ["deriveKey"]
  );
  const publicKey = await crypto.subtle.exportKey("jwk", pair.publicKey);
  return { pair, publicKey };
}

async function deriveSharedKey(privateKey: CryptoKey, peerPublicJwk: JsonWebKey) {
  const peerPublicKey = await crypto.subtle.importKey(
    "jwk",
    peerPublicJwk,
    {
      name: "ECDH",
      namedCurve: "P-256"
    },
    false,
    []
  );

  return crypto.subtle.deriveKey(
    {
      name: "ECDH",
      public: peerPublicKey
    },
    privateKey,
    {
      name: "AES-GCM",
      length: 256
    },
    false,
    ["encrypt", "decrypt"]
  );
}

async function encryptText(key: CryptoKey, text: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(text);
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);
  return {
    iv: bytesToBase64(iv),
    payload: bytesToBase64(encrypted)
  };
}

async function decryptText(key: CryptoKey, iv: string, payload: string) {
  const decrypted = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: base64ToBytes(iv)
    },
    key,
    base64ToBytes(payload)
  );
  return new TextDecoder().decode(decrypted);
}

export default function Home() {
  const [roomId, setRoomId] = useState("demo-room");
  const [draftRoomId, setDraftRoomId] = useState("demo-room");
  const [text, setText] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState("Generating local key pair");
  const [peerReady, setPeerReady] = useState(false);
  const [clientId, setClientId] = useState("");
  const privateKeyRef = useRef<CryptoKey | null>(null);
  const sharedKeyRef = useRef<CryptoKey | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const shortClientId = useMemo(() => clientId.slice(0, 8) || "pending", [clientId]);

  useEffect(() => {
    queueMicrotask(() => setClientId(crypto.randomUUID()));
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    let isMounted = true;
    let eventSource: EventSource;

    async function connect() {
      if (!clientId) {
        return;
      }

      setPeerReady(false);
      sharedKeyRef.current = null;
      setStatus("Generating local key pair");
      const identity = await createIdentity();
      if (!isMounted) {
        return;
      }

      privateKeyRef.current = identity.pair.privateKey;
      const eventsUrl = `/api/rooms/${encodeURIComponent(roomId)}/events?clientId=${encodeURIComponent(
        clientId
      )}&publicKey=${encodeURIComponent(JSON.stringify(identity.publicKey))}`;
      eventSource = new EventSource(eventsUrl);

      eventSource.addEventListener("open", () => {
        setStatus(`Connected to ${roomId}`);
      });

      eventSource.addEventListener("message", async (event) => {
        const message = JSON.parse(event.data) as WireMessage;
        if ("senderId" in message && message.senderId === clientId) {
          return;
        }

        if (message.type === "peer") {
          sharedKeyRef.current = await deriveSharedKey(identity.pair.privateKey, message.publicKey);
          setPeerReady(true);
          setStatus("Secure session established");
          return;
        }

        if (message.type === "ciphertext") {
          if (!sharedKeyRef.current) {
            return;
          }

          const plainText = await decryptText(sharedKeyRef.current, message.iv, message.payload);
          setMessages((current) => [
            ...current,
            {
              id: crypto.randomUUID(),
              author: "peer",
              text: plainText,
              sentAt: message.sentAt
            }
          ]);
        }

        if (message.type === "system") {
          setMessages((current) => [
            ...current,
            {
              id: crypto.randomUUID(),
              author: "system",
              text: message.message,
              sentAt: new Date().toISOString()
            }
          ]);
        }
      });

      eventSource.addEventListener("error", () => {
        setStatus("Disconnected");
        setPeerReady(false);
      });
    }

    connect();

    return () => {
      isMounted = false;
      eventSource?.close();
    };
  }, [clientId, roomId]);

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = text.trim();
    const sharedKey = sharedKeyRef.current;

    if (!trimmed || !sharedKey || !clientId) {
      return;
    }

    const sentAt = new Date().toISOString();
    const encrypted = await encryptText(sharedKey, trimmed);
    const response = await fetch(`/api/rooms/${encodeURIComponent(roomId)}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        type: "ciphertext",
        senderId: clientId,
        sentAt,
        ...encrypted
      })
    });

    if (!response.ok) {
      setStatus("Message send failed");
      return;
    }

    setMessages((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        author: "me",
        text: trimmed,
        sentAt
      }
    ]);
    setText("");
  }

  function changeRoom() {
    const nextRoom = draftRoomId.trim();
    if (nextRoom) {
      setMessages([]);
      setRoomId(nextRoom);
    }
  }

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      <AppBar position="static" color="inherit" elevation={0}>
        <Toolbar sx={{ borderBottom: 1, borderColor: "divider", gap: 2 }}>
          <LockIcon color="primary" />
          <Typography variant="h6" component="h1" sx={{ flexGrow: 1, fontWeight: 700 }}>
            E2E Chat
          </Typography>
          <Chip
            color={peerReady ? "success" : "warning"}
            label={peerReady ? "Encrypted" : "Waiting for peer"}
            variant="outlined"
          />
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "320px 1fr" },
            gap: 3,
            alignItems: "start"
          }}
        >
          <Paper variant="outlined" sx={{ p: 2.5 }}>
            <Stack spacing={2.5}>
              <Stack spacing={1}>
                <Typography variant="overline" color="text.secondary">
                  Session
                </Typography>
                <Typography variant="body2">{status}</Typography>
              </Stack>

              <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                <TextField
                  label="Room"
                  size="small"
                  value={draftRoomId}
                  onChange={(event) => setDraftRoomId(event.target.value)}
                  fullWidth
                />
                <Tooltip title="Join room">
                  <IconButton color="primary" onClick={changeRoom} aria-label="Join room">
                    <SyncIcon />
                  </IconButton>
                </Tooltip>
              </Stack>

              <Divider />

              <Stack spacing={1}>
                <Typography variant="overline" color="text.secondary">
                  Identity
                </Typography>
                <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                  <KeyIcon fontSize="small" color="primary" />
                  <Typography variant="body2" sx={{ fontFamily: "monospace" }}>
                    {shortClientId}
                  </Typography>
                  <Tooltip title="Copy client id">
                    <span>
                      <IconButton
                        size="small"
                        disabled={!clientId}
                        onClick={() => navigator.clipboard.writeText(clientId)}
                      >
                        <ContentCopyIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                </Stack>
              </Stack>

              <Alert severity="info">
                Open this app in another browser window with the same room name to exchange encrypted
                messages through the relay.
              </Alert>
            </Stack>
          </Paper>

          <Paper
            variant="outlined"
            sx={{
              minHeight: { xs: "65vh", md: "72vh" },
              display: "grid",
              gridTemplateRows: "1fr auto"
            }}
          >
            <Stack spacing={1.5} sx={{ p: 2, overflowY: "auto" }}>
              {messages.length === 0 ? (
                <Box
                  sx={{
                    minHeight: 320,
                    display: "grid",
                    placeItems: "center",
                    color: "text.secondary",
                    textAlign: "center"
                  }}
                >
                  <Typography>Messages will appear here after a peer joins.</Typography>
                </Box>
              ) : (
                messages.map((message) => (
                  <Box
                    key={message.id}
                    sx={{
                      alignSelf:
                        message.author === "me"
                          ? "flex-end"
                          : message.author === "system"
                            ? "center"
                            : "flex-start",
                      maxWidth: "min(72ch, 85%)"
                    }}
                  >
                    <Paper
                      elevation={0}
                      sx={{
                        px: 1.5,
                        py: 1,
                        bgcolor:
                          message.author === "me"
                            ? "primary.main"
                            : message.author === "system"
                              ? "grey.100"
                              : "common.white",
                        color: message.author === "me" ? "primary.contrastText" : "text.primary",
                        border: 1,
                        borderColor: message.author === "me" ? "primary.main" : "divider"
                      }}
                    >
                      <Typography variant="body1">{message.text}</Typography>
                      <Typography
                        variant="caption"
                        sx={{ opacity: 0.7, display: "block", mt: 0.5 }}
                      >
                        {new Date(message.sentAt).toLocaleTimeString()}
                      </Typography>
                    </Paper>
                  </Box>
                ))
              )}
              <div ref={messagesEndRef} />
            </Stack>

            <Box component="form" onSubmit={sendMessage} sx={{ p: 2, borderTop: 1, borderColor: "divider" }}>
              <Stack direction="row" spacing={1}>
                <TextField
                  placeholder={peerReady ? "Write an encrypted message" : "Waiting for a peer"}
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  fullWidth
                  disabled={!peerReady}
                />
                <Button
                  type="submit"
                  variant="contained"
                  endIcon={<SendIcon />}
                  disabled={!peerReady || !text.trim()}
                  sx={{ minWidth: 120 }}
                >
                  Send
                </Button>
              </Stack>
            </Box>
          </Paper>
        </Box>
      </Container>
    </Box>
  );
}
