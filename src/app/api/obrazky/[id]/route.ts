import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { imagePath } from "@/lib/storage";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!/^[a-f0-9]{32}$/.test(id)) return new NextResponse("Obrázek není.", { status: 404 });
  const user = await getCurrentUser();
  const token = new URL(request.url).searchParams.get("sdileni");
  const asset = await prisma.imageAsset.findUnique({ where: { id } });
  if (!asset) return new NextResponse("Obrázek není.", { status: 404 });
  const ownsFile = user?.id === asset.ownerId;
  const visible = ownsFile || (await referencedBy(id, user?.id ?? null, token));
  if (!visible) return new NextResponse("Obrázek není.", { status: 404 });
  const bytes = await readFile(imagePath(id)).catch(() => null);
  if (!bytes) return new NextResponse("Obrázek není.", { status: 404 });
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": asset.mime,
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

async function referencedBy(id: string, userId: string | null, token: string | null) {
  if (!userId && !token) return false;
  const materials = await prisma.material.findMany({
    where: {
      OR: [
        ...(userId ? [{ ownerId: userId }] : []),
        ...(token ? [{ shareToken: token, shareEnabled: true }] : []),
      ],
    },
    include: {
      deck: { include: { cards: true } },
      quiz: { include: { questions: { include: { options: true } } } },
      note: true,
    },
  });
  return JSON.stringify(materials).includes(id);
}
