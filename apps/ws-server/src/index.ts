import { WebSocketServer, type WebSocket } from "ws";

type Client = {
  id: string;
  roomId: string;
  socket: WebSocket;
  publicKey: unknown;
};

type IncomingMessage =
  | { type: "join"; roomId: string; senderId: string; publicKey: unknown }
  | { type: "ciphertext"; senderId: string; iv: string; payload: string; sentAt: string };

const port = Number(process.env.PORT ?? 3001);
const server = new WebSocketServer({ port });
const clients = new Map<WebSocket, Client>();

function roomPeers(roomId: string, exclude?: WebSocket) {
  return [...clients.values()].filter((client) => client.roomId === roomId && client.socket !== exclude);
}

function send(socket: WebSocket, payload: unknown) {
  if (socket.readyState === socket.OPEN) {
    socket.send(JSON.stringify(payload));
  }
}

function broadcast(roomId: string, payload: unknown, exclude?: WebSocket) {
  roomPeers(roomId, exclude).forEach((client) => send(client.socket, payload));
}

server.on("connection", (socket) => {
  socket.on("message", (rawMessage) => {
    let message: IncomingMessage;

    try {
      message = JSON.parse(rawMessage.toString()) as IncomingMessage;
    } catch {
      send(socket, { type: "system", message: "Ignored malformed message" });
      return;
    }

    if (message.type === "join") {
      const client: Client = {
        id: message.senderId,
        roomId: message.roomId,
        socket,
        publicKey: message.publicKey
      };
      clients.set(socket, client);

      roomPeers(message.roomId, socket).forEach((peer) => {
        send(socket, {
          type: "peer",
          senderId: peer.id,
          publicKey: peer.publicKey
        });
        send(peer.socket, {
          type: "peer",
          senderId: client.id,
          publicKey: client.publicKey
        });
      });

      broadcast(
        message.roomId,
        { type: "system", message: "A peer joined the room" },
        socket
      );
      return;
    }

    const client = clients.get(socket);
    if (!client) {
      send(socket, { type: "system", message: "Join a room before sending messages" });
      return;
    }

    if (message.type === "ciphertext") {
      broadcast(client.roomId, message, socket);
    }
  });

  socket.on("close", () => {
    const client = clients.get(socket);
    clients.delete(socket);

    if (client) {
      broadcast(client.roomId, { type: "system", message: "A peer left the room" });
    }
  });
});

console.log(`WebSocket relay listening on ws://localhost:${port}`);
