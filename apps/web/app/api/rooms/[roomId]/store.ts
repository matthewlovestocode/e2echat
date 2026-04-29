type SseClient = {
  id: string;
  publicKey: JsonWebKey;
  controller: ReadableStreamDefaultController<Uint8Array>;
};

type Room = {
  clients: Map<string, SseClient>;
};

type OutboundMessage =
  | { type: "peer"; senderId: string; publicKey: JsonWebKey }
  | { type: "ciphertext"; senderId: string; iv: string; payload: string; sentAt: string }
  | { type: "system"; message: string };

const encoder = new TextEncoder();

declare global {
  var __e2eChatRooms: Map<string, Room> | undefined;
}

function rooms() {
  globalThis.__e2eChatRooms ??= new Map<string, Room>();
  return globalThis.__e2eChatRooms;
}

export function getRoom(roomId: string) {
  const currentRooms = rooms();
  let room = currentRooms.get(roomId);

  if (!room) {
    room = { clients: new Map<string, SseClient>() };
    currentRooms.set(roomId, room);
  }

  return room;
}

export function sendEvent(client: SseClient, message: OutboundMessage) {
  try {
    client.controller.enqueue(encoder.encode(`data: ${JSON.stringify(message)}\n\n`));
  } catch {
    // The request may have closed between room lookup and write.
  }
}

export function sendComment(client: SseClient, comment: string) {
  try {
    client.controller.enqueue(encoder.encode(`: ${comment}\n\n`));
  } catch {
    // The request may have closed between room lookup and write.
  }
}

export function broadcast(roomId: string, message: OutboundMessage, excludeClientId?: string) {
  const room = getRoom(roomId);

  room.clients.forEach((client) => {
    if (client.id !== excludeClientId) {
      sendEvent(client, message);
    }
  });
}

export function removeClient(
  roomId: string,
  clientId: string,
  controller?: ReadableStreamDefaultController<Uint8Array>
) {
  const room = getRoom(roomId);
  const client = room.clients.get(clientId);

  if (controller && client?.controller !== controller) {
    return;
  }

  room.clients.delete(clientId);

  if (room.clients.size === 0) {
    rooms().delete(roomId);
  }
}

export type { SseClient };
