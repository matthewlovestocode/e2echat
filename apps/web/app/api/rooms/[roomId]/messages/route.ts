import { broadcast } from "../store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    roomId: string;
  }>;
};

type CiphertextMessage = {
  type: "ciphertext";
  senderId: string;
  iv: string;
  payload: string;
  sentAt: string;
};

function isCiphertextMessage(value: unknown): value is CiphertextMessage {
  if (!value || typeof value !== "object") {
    return false;
  }

  const message = value as Partial<CiphertextMessage>;
  return (
    message.type === "ciphertext" &&
    typeof message.senderId === "string" &&
    typeof message.iv === "string" &&
    typeof message.payload === "string" &&
    typeof message.sentAt === "string"
  );
}

export async function POST(request: Request, { params }: RouteContext) {
  const { roomId } = await params;
  const body = (await request.json()) as unknown;

  if (!isCiphertextMessage(body)) {
    return Response.json({ error: "Invalid ciphertext message" }, { status: 400 });
  }

  broadcast(roomId, body, body.senderId);
  return Response.json({ ok: true });
}
