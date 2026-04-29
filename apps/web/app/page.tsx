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
    queueMicrotask(() => {
      const nextClientId = crypto.randomUUID();
      const nextRoomId = `demo-${nextClientId.slice(0, 6)}`;
      setClientId(nextClientId);
      setRoomId(nextRoomId);
      setDraftRoomId(nextRoomId);
    });
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

  const glassPanelSx = {
    border: "1px solid rgba(115, 236, 255, 0.22)",
    background:
      "linear-gradient(145deg, rgba(10, 18, 33, 0.82), rgba(7, 10, 22, 0.58))",
    backdropFilter: "blur(22px)",
    boxShadow:
      "0 22px 70px rgba(0, 0, 0, 0.38), inset 0 1px 0 rgba(255, 255, 255, 0.08), 0 0 40px rgba(25, 211, 255, 0.08)"
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: "background.default",
        backgroundImage:
          "linear-gradient(135deg, rgba(5, 7, 15, 0.62) 0%, rgba(7, 17, 31, 0.38) 48%, rgba(5, 7, 15, 0.68) 100%), radial-gradient(circle at 18% 12%, rgba(25, 211, 255, 0.16), transparent 30%), radial-gradient(circle at 82% 18%, rgba(181, 108, 255, 0.13), transparent 32%), url('/images/matrix-background.png')",
        backgroundSize: "cover, auto, auto, cover",
        backgroundPosition: "center, center, center, center",
        backgroundAttachment: "fixed",
        position: "relative",
        overflow: "hidden",
        "&::before": {
          content: '""',
          position: "fixed",
          inset: 0,
          pointerEvents: "none",
          backgroundImage:
            "linear-gradient(rgba(115, 236, 255, 0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(115, 236, 255, 0.035) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
          maskImage: "linear-gradient(to bottom, rgba(0,0,0,0.72), transparent 82%)"
        },
        "&::after": {
          content: '""',
          position: "fixed",
          inset: 0,
          pointerEvents: "none",
          background:
            "linear-gradient(180deg, transparent 0%, rgba(25, 211, 255, 0.035) 50%, transparent 100%)",
          mixBlendMode: "screen"
        }
      }}
    >
      <AppBar
        position="static"
        elevation={0}
        sx={{
          bgcolor: "rgba(4, 9, 20, 0.62)",
          color: "text.primary",
          borderBottom: "1px solid rgba(115, 236, 255, 0.18)",
          backdropFilter: "blur(18px)",
          boxShadow: "0 0 40px rgba(25, 211, 255, 0.08)"
        }}
      >
        <Toolbar sx={{ gap: 2, minHeight: 72 }}>
          <Box
            sx={{
              width: 42,
              height: 42,
              display: "grid",
              placeItems: "center",
              borderRadius: 2,
              color: "primary.main",
              border: "1px solid rgba(115, 236, 255, 0.34)",
              background: "rgba(25, 211, 255, 0.08)",
              boxShadow: "0 0 24px rgba(25, 211, 255, 0.22)"
            }}
          >
            <LockIcon />
          </Box>
          <Typography
            variant="h5"
            component="h1"
            sx={{
              flexGrow: 1,
              fontWeight: 900,
              letterSpacing: 0,
              textShadow: "0 0 18px rgba(25, 211, 255, 0.34)"
            }}
          >
            E2E Chat
          </Typography>
          <Chip
            color={peerReady ? "success" : "warning"}
            label={peerReady ? "Encrypted" : "Waiting for peer"}
            variant="outlined"
            sx={{
              fontWeight: 800,
              bgcolor: peerReady ? "rgba(77, 255, 181, 0.08)" : "rgba(255, 209, 102, 0.08)",
              borderColor: peerReady ? "rgba(77, 255, 181, 0.58)" : "rgba(255, 209, 102, 0.58)",
              boxShadow: peerReady
                ? "0 0 22px rgba(77, 255, 181, 0.22)"
                : "0 0 22px rgba(255, 209, 102, 0.18)"
            }}
          />
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ py: { xs: 3, md: 5 }, position: "relative", zIndex: 1 }}>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "320px 1fr" },
            gap: 3,
            alignItems: "start"
          }}
        >
          <Paper variant="outlined" sx={{ ...glassPanelSx, p: 2.5 }}>
            <Stack spacing={2.5}>
              <Stack spacing={1}>
                <Typography
                  variant="overline"
                  color="primary.light"
                  sx={{ fontWeight: 900, textShadow: "0 0 12px rgba(25, 211, 255, 0.36)" }}
                >
                  Session
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {status}
                </Typography>
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

              <Divider sx={{ borderColor: "rgba(115, 236, 255, 0.14)" }} />

              <Stack spacing={1}>
                <Typography
                  variant="overline"
                  color="primary.light"
                  sx={{ fontWeight: 900, textShadow: "0 0 12px rgba(25, 211, 255, 0.36)" }}
                >
                  Identity
                </Typography>
                <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                  <KeyIcon fontSize="small" color="primary" />
                  <Typography
                    variant="body2"
                    sx={{
                      fontFamily: "monospace",
                      color: "primary.light",
                      textShadow: "0 0 12px rgba(25, 211, 255, 0.26)"
                    }}
                  >
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
              ...glassPanelSx,
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
                  <Typography sx={{ textShadow: "0 0 18px rgba(25, 211, 255, 0.16)" }}>
                    Messages will appear here after a peer joins.
                  </Typography>
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
                        backgroundImage: "none",
                        bgcolor:
                          message.author === "me"
                            ? "rgba(25, 211, 255, 0.16)"
                            : message.author === "system"
                              ? "rgba(181, 108, 255, 0.1)"
                              : "rgba(255, 255, 255, 0.07)",
                        color: "text.primary",
                        border: 1,
                        borderColor:
                          message.author === "me"
                            ? "rgba(115, 236, 255, 0.46)"
                            : message.author === "system"
                              ? "rgba(181, 108, 255, 0.38)"
                              : "rgba(255, 255, 255, 0.14)",
                        backdropFilter: "blur(12px)",
                        boxShadow:
                          message.author === "me"
                            ? "0 0 26px rgba(25, 211, 255, 0.18)"
                            : message.author === "system"
                              ? "0 0 20px rgba(181, 108, 255, 0.12)"
                              : "0 0 18px rgba(255, 255, 255, 0.06)"
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

            <Box
              component="form"
              onSubmit={sendMessage}
              sx={{
                p: 2,
                borderTop: "1px solid rgba(115, 236, 255, 0.16)",
                background: "rgba(3, 8, 18, 0.34)"
              }}
            >
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
