import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { hashToken, newToken } from "@/lib/tokens";

export const SESSION_COOKIE = "studovna_session";
const SEEN_GAP_MS = 5 * 60 * 1000;

export type CurrentUser = {
  id: string;
  email: string;
  emailVerifiedAt: Date | null;
  sessionId: string;
};

export async function createSession(userId: string): Promise<void> {
  const token = newToken();
  const headerStore = await headers();
  await prisma.session.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      userAgent: (headerStore.get("user-agent") ?? "").slice(0, 400),
    },
  });
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });
  if (!session) return null;
  if (Date.now() - session.lastSeenAt.getTime() > SEEN_GAP_MS) {
    await prisma.session.update({
      where: { id: session.id },
      data: { lastSeenAt: new Date() },
    });
  }
  return {
    id: session.user.id,
    email: session.user.email,
    emailVerifiedAt: session.user.emailVerifiedAt,
    sessionId: session.id,
  };
}

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/prihlaseni");
  return user;
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export function browserLabel(userAgent: string): string {
  const agent = userAgent.toLowerCase();
  let browser = "Prohlížeč";
  if (agent.includes("edg/")) browser = "Edge";
  else if (agent.includes("chrome/")) browser = "Chrome";
  else if (agent.includes("firefox/")) browser = "Firefox";
  else if (agent.includes("safari/")) browser = "Safari";
  const device = agent.includes("mobile") ? "mobil" : agent.includes("tablet") ? "tablet" : "počítač";
  return `${browser}, ${device}`;
}
