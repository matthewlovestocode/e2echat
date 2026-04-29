import { broadcast, getRoom, removeClient, sendComment, sendEvent, type SseClient } from "../store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

type RouteContext = {
  params: Promise<{
    roomId: string;
  }>;
};

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

function parsePublicKey(value: string | null) {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as JsonWebKey;
  } catch {
    return null;
  }
}

export async function GET(request: Request, { params }: RouteContext) {
  const { roomId } = await params;
  const url = new URL(request.url);
  const clientId = url.searchParams.get("clientId");
  const publicKey = parsePublicKey(url.searchParams.get("publicKey"));

  if (!clientId || !publicKey) {
    return jsonError("clientId and publicKey are required", 400);
  }

  const room = getRoom(roomId);

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const existingClient = room.clients.get(clientId);
      try {
        existingClient?.controller.close();
      } catch {
        // The existing stream may already be closed.
      }

      const client: SseClient = {
        id: clientId,
        publicKey,
        controller
      };

      room.clients.forEach((peer) => {
        sendEvent(client, {
          type: "peer",
          senderId: peer.id,
          publicKey: peer.publicKey
        });
      });

      room.clients.set(clientId, client);

      broadcast(
        roomId,
        {
          type: "peer",
          senderId: client.id,
          publicKey: client.publicKey
        },
        client.id
      );
      broadcast(roomId, { type: "system", message: "A peer joined the room" }, client.id);

      sendComment(client, "connected");
      const heartbeat = setInterval(() => sendComment(client, "heartbeat"), 15000);

      request.signal.addEventListener("abort", () => {
        clearInterval(heartbeat);
        removeClient(roomId, client.id, controller);
        broadcast(roomId, { type: "system", message: "A peer left the room" });
      });
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no"
    }
  });
}
