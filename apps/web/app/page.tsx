"use client";

import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import KeyIcon from "@mui/icons-material/Key";
import LinkIcon from "@mui/icons-material/Link";
import PauseIcon from "@mui/icons-material/Pause";
import RadioIcon from "@mui/icons-material/Radio";
import SendIcon from "@mui/icons-material/Send";
import SyncIcon from "@mui/icons-material/Sync";
import {
  AppBar,
  Box,
  Button,
  Chip,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Paper,
  Stack,
  TextField,
  Toolbar,
  Tooltip,
  Typography
} from "@mui/material";
import type { SxProps, Theme } from "@mui/material/styles";
import type { FormEvent, ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

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

const DEFCON_RADIO_STREAM_URL = "https://ice2.somafm.com/defcon-128-mp3";

const ui = {
  pageShell: {
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
  },
  appBar: {
    bgcolor: "rgba(4, 9, 20, 0.46)",
    color: "text.primary",
    borderBottom: "1px solid rgba(185, 230, 255, 0.12)",
    backdropFilter: "blur(16px) saturate(120%)",
    WebkitBackdropFilter: "blur(16px) saturate(120%)",
    boxShadow: "0 18px 60px rgba(0, 0, 0, 0.22)"
  },
  glassPanel: {
    position: "relative",
    overflow: "hidden",
    border: "1px solid rgba(210, 236, 255, 0.14)",
    backgroundColor: "rgba(3, 8, 18, 0.34)",
    backgroundImage:
      "linear-gradient(180deg, rgba(255, 255, 255, 0.045), rgba(255, 255, 255, 0.012))",
    backdropFilter: "blur(18px) saturate(120%)",
    WebkitBackdropFilter: "blur(18px) saturate(120%)",
    boxShadow:
      "0 24px 72px rgba(0, 0, 0, 0.42), 0 8px 24px rgba(0, 0, 0, 0.22), inset 0 1px 0 rgba(255, 255, 255, 0.08)",
    "&::before": {
      content: '""',
      position: "absolute",
      inset: 0,
      pointerEvents: "none",
      background:
        "linear-gradient(180deg, rgba(255,255,255,0.045), transparent 24%), linear-gradient(90deg, rgba(255,255,255,0.035), transparent 22%, transparent 78%, rgba(255,255,255,0.025))"
    },
    "& > *": {
      position: "relative",
      zIndex: 1
    }
  },
  iconTile: {
    width: 46,
    height: 46,
    display: "grid",
    placeItems: "center",
    borderRadius: 2.25,
    color: "primary.main",
    border: "1px solid rgba(210, 236, 255, 0.14)",
    background: "rgba(255, 255, 255, 0.035)",
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
    boxShadow: "0 12px 32px rgba(0, 0, 0, 0.28)",
    "& img": {
      width: 38,
      height: 38,
      borderRadius: 1.75,
      display: "block",
      objectFit: "cover"
    }
  },
  sectionLabel: {
    color: "primary.light",
    fontWeight: 900,
    textShadow: "0 0 10px rgba(25, 211, 255, 0.22)"
  },
  divider: {
    borderColor: "rgba(210, 236, 255, 0.1)"
  },
  composerBar: {
    p: 2,
    borderTop: "1px solid rgba(210, 236, 255, 0.1)",
    background: "rgba(3, 8, 18, 0.22)",
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)"
  }
} satisfies Record<string, SxProps<Theme>>;

function GlassPanel({ children, sx }: { children: ReactNode; sx?: SxProps<Theme> }) {
  return (
    <Paper
      variant="outlined"
      sx={{ ...(ui.glassPanel as object), ...(sx as object) } as SxProps<Theme>}
    >
      {children}
    </Paper>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <Typography variant="overline" sx={ui.sectionLabel}>
      {children}
    </Typography>
  );
}

function IconTile({ children }: { children: ReactNode }) {
  return <Box sx={ui.iconTile}>{children}</Box>;
}

function BrandIcon() {
  return (
    <Box
      component="img"
      src="/images/agent-brand-icon.png"
      alt="E2E Chat brand icon"
      loading="eager"
    />
  );
}

function messageBubbleSx(author: ChatMessage["author"]): SxProps<Theme> {
  const isMine = author === "me";
  const isSystem = author === "system";

  return {
    px: 1.5,
    py: 1,
    backgroundImage: "none",
    bgcolor: isMine
      ? "rgba(25, 211, 255, 0.14)"
      : isSystem
        ? "rgba(181, 108, 255, 0.09)"
        : "rgba(255, 255, 255, 0.065)",
    color: "text.primary",
    border: 1,
    borderColor: isMine
      ? "rgba(115, 236, 255, 0.28)"
      : isSystem
        ? "rgba(181, 108, 255, 0.22)"
        : "rgba(255, 255, 255, 0.12)",
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
    boxShadow: "0 14px 34px rgba(0, 0, 0, 0.24)"
  };
}

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
  const [radioPlaying, setRadioPlaying] = useState(false);
  const [radioStatus, setRadioStatus] = useState("Idle");
  const [instructionsOpen, setInstructionsOpen] = useState(false);
  const [roomActionStatus, setRoomActionStatus] = useState("Create a room, then share its link.");
  const privateKeyRef = useRef<CryptoKey | null>(null);
  const sharedKeyRef = useRef<CryptoKey | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const radioRef = useRef<HTMLAudioElement | null>(null);

  const shortClientId = useMemo(() => clientId.slice(0, 8) || "pending", [clientId]);

  useEffect(() => {
    queueMicrotask(() => {
      const nextClientId = crypto.randomUUID();
      const requestedRoom = new URLSearchParams(window.location.search).get("room")?.trim();
      const nextRoomId = requestedRoom || `demo-${nextClientId.slice(0, 6)}`;
      setClientId(nextClientId);
      setRoomId(nextRoomId);
      setDraftRoomId(nextRoomId);
      setRoomActionStatus(
        requestedRoom ? `Joined shared room ${nextRoomId}.` : "Created a private room for this tab."
      );
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
      setRoomActionStatus(`Opening room ${roomId}.`);
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
        setRoomActionStatus(`Room ${roomId} is ready. Share the link with another client.`);
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
          setRoomActionStatus("Peer connected. Encrypted session established.");
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
        setRoomActionStatus("Room connection interrupted. Rejoin or create a new room.");
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
      setPeerReady(false);
      setRoomActionStatus(`Joining room ${nextRoom}.`);
      window.history.replaceState(null, "", `?room=${encodeURIComponent(nextRoom)}`);
    }
  }

  function createNewRoom() {
    const nextRoom = `matrix-${crypto.randomUUID().slice(0, 8)}`;
    setMessages([]);
    setDraftRoomId(nextRoom);
    setRoomId(nextRoom);
    setPeerReady(false);
    setRoomActionStatus(`Created room ${nextRoom}. Share its link with another client.`);
    window.history.replaceState(null, "", `?room=${encodeURIComponent(nextRoom)}`);
  }

  async function copyRoomLink() {
    const roomUrl = `${window.location.origin}${window.location.pathname}?room=${encodeURIComponent(roomId)}`;
    await navigator.clipboard.writeText(roomUrl);
    setRoomActionStatus("Room link copied. Open it in another browser or send it to a peer.");
  }

  async function toggleRadio() {
    const radio = radioRef.current;
    if (!radio) {
      return;
    }

    if (radioPlaying) {
      radio.pause();
      radio.currentTime = 0;
      setRadioPlaying(false);
      setRadioStatus("Idle");
      return;
    }

    try {
      setRadioStatus("Connecting");
      await radio.play();
      setRadioPlaying(true);
      setRadioStatus("Streaming");
    } catch {
      setRadioPlaying(false);
      setRadioStatus("Blocked");
    }
  }

  return (
    <Box sx={ui.pageShell}>
      <audio
        ref={radioRef}
        src={DEFCON_RADIO_STREAM_URL}
        preload="none"
        onPlaying={() => {
          setRadioPlaying(true);
          setRadioStatus("Streaming");
        }}
        onPause={() => {
          setRadioPlaying(false);
          setRadioStatus("Idle");
        }}
        onError={() => {
          setRadioPlaying(false);
          setRadioStatus("Unavailable");
        }}
      />
      <AppBar
        position="static"
        elevation={0}
        sx={ui.appBar}
      >
        <Toolbar sx={{ gap: 2, minHeight: 72 }}>
          <IconTile>
            <BrandIcon />
          </IconTile>
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
            Mr. Anderson Chat
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
          <GlassPanel sx={{ p: 2.5 }}>
            <Stack spacing={2.5}>
              <Stack spacing={1}>
                <SectionLabel>Session</SectionLabel>
                <Typography variant="body2" color="text.secondary">
                  {status}
                </Typography>
              </Stack>

              <Box
                sx={{
                  p: 1.25,
                  borderRadius: 2,
                  border: "1px solid rgba(210, 236, 255, 0.1)",
                  background: "rgba(255, 255, 255, 0.035)"
                }}
              >
                <Stack spacing={1.25}>
                  <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between" }}>
                    <Typography variant="caption" color="text.secondary">
                      Active room
                    </Typography>
                    <Chip
                      size="small"
                      label={peerReady ? "Peer online" : "Solo"}
                      color={peerReady ? "success" : "warning"}
                      variant="outlined"
                      sx={{ fontWeight: 800 }}
                    />
                  </Stack>
                  <Typography
                    variant="body2"
                    sx={{
                      color: "primary.light",
                      fontFamily: "monospace",
                      overflowWrap: "anywhere"
                    }}
                  >
                    {roomId}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {roomActionStatus}
                  </Typography>
                </Stack>
              </Box>

              <Stack spacing={1}>
                <TextField
                  label="Room"
                  size="small"
                  value={draftRoomId}
                  onChange={(event) => setDraftRoomId(event.target.value)}
                  fullWidth
                />
                <Stack direction="row" spacing={1}>
                  <Button
                    variant="outlined"
                    startIcon={<SyncIcon />}
                    onClick={changeRoom}
                    disabled={!draftRoomId.trim() || draftRoomId.trim() === roomId}
                    fullWidth
                  >
                    Join
                  </Button>
                  <Button variant="outlined" onClick={createNewRoom} fullWidth>
                    New
                  </Button>
                  <Tooltip title="Copy room link">
                    <span>
                      <IconButton
                        color="primary"
                        onClick={copyRoomLink}
                        aria-label="Copy room link"
                        disabled={!roomId}
                      >
                        <LinkIcon />
                      </IconButton>
                    </span>
                  </Tooltip>
                </Stack>
              </Stack>

              <Divider sx={ui.divider} />

              <Stack spacing={1.25}>
                <SectionLabel>DEF CON Radio</SectionLabel>
                <Box
                  sx={{
                    p: 1.25,
                    borderRadius: 2,
                    border: "1px solid rgba(210, 236, 255, 0.1)",
                    background: "rgba(255, 255, 255, 0.035)"
                  }}
                >
                  <Stack direction="row" spacing={1.25} sx={{ alignItems: "center" }}>
                    <RadioIcon color="primary" fontSize="small" />
                    <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 800 }}>
                        SomaFM DEF CON
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {radioStatus}
                      </Typography>
                    </Box>
                    <Tooltip title={radioPlaying ? "Stop stream" : "Start stream"}>
                      <IconButton
                        color="primary"
                        onClick={toggleRadio}
                        aria-label={radioPlaying ? "Stop DEF CON Radio" : "Start DEF CON Radio"}
                      >
                        {radioPlaying ? <PauseIcon /> : <RadioIcon />}
                      </IconButton>
                    </Tooltip>
                  </Stack>
                </Box>
              </Stack>

              <Divider sx={ui.divider} />

              <Stack spacing={1}>
                <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between" }}>
                  <SectionLabel>Identity</SectionLabel>
                  <Tooltip title="Connection instructions">
                    <IconButton
                      size="small"
                      color="primary"
                      onClick={() => setInstructionsOpen(true)}
                      aria-label="Open connection instructions"
                    >
                      <InfoOutlinedIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Stack>
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
            </Stack>
          </GlassPanel>

          <GlassPanel
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
                    <Paper elevation={0} sx={messageBubbleSx(message.author)}>
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

            <Box component="form" onSubmit={sendMessage} sx={ui.composerBar}>
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
          </GlassPanel>
        </Box>
      </Container>

      <Dialog
        open={instructionsOpen}
        onClose={() => setInstructionsOpen(false)}
        slotProps={{
          paper: {
            sx: {
              border: "1px solid rgba(210, 236, 255, 0.14)",
              backgroundColor: "rgba(3, 8, 18, 0.78)",
              backgroundImage:
                "linear-gradient(180deg, rgba(255, 255, 255, 0.06), rgba(255, 255, 255, 0.018))",
              backdropFilter: "blur(20px) saturate(120%)",
              WebkitBackdropFilter: "blur(20px) saturate(120%)",
              boxShadow: "0 24px 72px rgba(0, 0, 0, 0.46)"
            }
          }
        }}
      >
        <DialogTitle>Connection instructions</DialogTitle>
        <DialogContent>
          <Typography color="text.secondary">
            Create a room, copy its room link, and open that link in another browser window or send it
            to another client. Both clients must be in the same room before encrypted messages can move
            through the relay.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setInstructionsOpen(false)} autoFocus>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
