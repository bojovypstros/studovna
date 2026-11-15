import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { allowedImageMime, saveImageFile } from "@/lib/storage";
import { newImageId } from "@/lib/tokens";

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host || new URL(origin).host !== host) {
    return new NextResponse("Požadavek nemá platný původ.", { status: 403 });
  }
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Nejste přihlášeni.", { status: 401 });
  const form = await request.formData();
  const file = form.get("soubor");
  if (!(file instanceof File)) return new NextResponse("Chybí obrázek.", { status: 400 });
  if (file.size > 2_000_000) return new NextResponse("Obrázek je větší než 2 MB.", { status: 400 });
  const bytes = Buffer.from(await file.arrayBuffer());
  const mime = sniff(bytes);
  if (!mime || !allowedImageMime(mime)) return new NextResponse("Povolené jsou jen JPEG, PNG, GIF a WebP.", { status: 400 });
  const id = newImageId();
  const size = imageSize(bytes, mime);
  await saveImageFile(id, bytes);
  await prisma.imageAsset.create({ data: { id, ownerId: user.id, mime } });
  return NextResponse.json({ id, ...size });
}

function sniff(bytes: Buffer): string | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return "image/png";
  }
  const gif = bytes.subarray(0, 6).toString("ascii");
  if (gif === "GIF87a" || gif === "GIF89a") return "image/gif";
  if (bytes.length >= 12 && bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP") {
    return "image/webp";
  }
  return null;
}

function imageSize(bytes: Buffer, mime: string): { width?: number; height?: number } {
  if (mime === "image/png" && bytes.length >= 24) {
    return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  }
  if (mime === "image/gif" && bytes.length >= 10) {
    return { width: bytes.readUInt16LE(6), height: bytes.readUInt16LE(8) };
  }
  return {};
}
