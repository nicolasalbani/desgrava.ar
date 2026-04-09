import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAttentionCounts } from "@/lib/attention/counts";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return new Response("No autorizado", { status: 401 });
  }

  const fiscalYear = req.nextUrl.searchParams.get("fiscalYear");
  const userId = session.user.id;
  const encoder = new TextEncoder();
  let closed = false;
  let lastFacturas = -1;
  let lastRecibos = -1;
  let lastPerfil = -1;

  const stream = new ReadableStream({
    async start(controller) {
      const enqueue = (data: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        } catch {
          closed = true;
        }
      };

      const closeStream = () => {
        if (closed) return;
        closed = true;
        try {
          controller.close();
        } catch {
          // already closed
        }
      };

      req.signal.addEventListener("abort", () => {
        clearInterval(interval);
        closeStream();
      });

      const poll = async () => {
        if (closed) {
          clearInterval(interval);
          return;
        }

        try {
          const counts = await getAttentionCounts(
            userId,
            fiscalYear ? parseInt(fiscalYear) : undefined,
          );

          if (
            counts.facturas !== lastFacturas ||
            counts.recibos !== lastRecibos ||
            counts.perfil !== lastPerfil
          ) {
            lastFacturas = counts.facturas;
            lastRecibos = counts.recibos;
            lastPerfil = counts.perfil;
            enqueue(JSON.stringify(counts));
          }
        } catch {
          // DB query failed, will retry next interval
        }
      };

      // Initial send
      await poll();

      // Poll every 5 seconds
      const interval = setInterval(poll, 5000);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
