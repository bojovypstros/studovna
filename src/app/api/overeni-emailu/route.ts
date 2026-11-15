import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashToken } from "@/lib/tokens";

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  const row = token
    ? await prisma.emailToken.findUnique({ where: { tokenHash: hashToken(token) } })
    : null;
  const destination = new URL("/overeni-emailu", request.url);
  if (!row || row.purpose !== "verify" || row.usedAt || row.expiresAt.getTime() < Date.now()) {
    destination.searchParams.set("stav", "neplatny");
    return NextResponse.redirect(destination);
  }
  await prisma.$transaction([
    prisma.user.update({ where: { id: row.userId }, data: { emailVerifiedAt: new Date() } }),
    prisma.emailToken.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
  ]);
  destination.searchParams.set("stav", "hotovo");
  return NextResponse.redirect(destination);
}
