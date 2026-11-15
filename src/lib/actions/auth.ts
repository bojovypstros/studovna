"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { appUrl, sendMail } from "@/lib/mail";
import { emailError, hashPassword, normalizeEmail, passwordError, verifyPassword } from "@/lib/password";
import { clearSessionCookie, createSession, getCurrentUser } from "@/lib/session";
import { safeNextPath } from "@/lib/access";
import { hashToken, newToken } from "@/lib/tokens";

export type FormState = { error: string; sent?: boolean };

export async function registerAction(_state: FormState, formData: FormData): Promise<FormState> {
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const password = String(formData.get("heslo") ?? "");
  const again = String(formData.get("heslo-znovu") ?? "");
  const emailProblem = emailError(email);
  if (emailProblem) return { error: emailProblem };
  const passwordProblem = passwordError(password);
  if (passwordProblem) return { error: passwordProblem };
  if (password !== again) return { error: "Hesla se neshodují." };
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return { error: "Účet s tímto e-mailem už existuje." };
  const user = await prisma.user.create({
    data: { email, passwordHash: await hashPassword(password) },
  });
  await issueEmailToken(user.id, email, "verify");
  await createSession(user.id);
  const next = safeNextPath(String(formData.get("dal") ?? ""));
  redirect(next ? `/vitejte?dal=${encodeURIComponent(next)}` : "/vitejte");
}

export async function loginAction(_state: FormState, formData: FormData): Promise<FormState> {
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const password = String(formData.get("heslo") ?? "");
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return { error: "E-mail nebo heslo nesedí." };
  }
  await createSession(user.id);
  const next = safeNextPath(String(formData.get("dal") ?? ""));
  redirect(next ?? "/studovna");
}

export async function logoutAction(): Promise<void> {
  const user = await getCurrentUser();
  if (user) await prisma.session.delete({ where: { id: user.sessionId } }).catch(() => undefined);
  await clearSessionCookie();
  redirect("/");
}

export async function forgotAction(_state: FormState, formData: FormData): Promise<FormState> {
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const user = emailError(email) ? null : await prisma.user.findUnique({ where: { email } });
  if (user) await issueEmailToken(user.id, email, "reset");
  return { error: "", sent: true };
}

export async function resetAction(_state: FormState, formData: FormData): Promise<FormState> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("heslo") ?? "");
  const problem = passwordError(password);
  if (problem) return { error: problem };
  const row = await prisma.emailToken.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!row || row.purpose !== "reset" || row.usedAt || row.expiresAt.getTime() < Date.now()) {
    return { error: "Odkaz už neplatí. Požádejte o nový." };
  }
  await prisma.$transaction([
    prisma.user.update({ where: { id: row.userId }, data: { passwordHash: await hashPassword(password) } }),
    prisma.emailToken.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
    prisma.session.deleteMany({ where: { userId: row.userId } }),
  ]);
  redirect("/prihlaseni?obnoveno=1");
}

export async function resendVerificationAction(): Promise<void> {
  const user = await getCurrentUser();
  if (!user || user.emailVerifiedAt) return;
  await issueEmailToken(user.id, user.email, "verify");
  redirect("/studovna?posta=1");
}

export async function revokeSessionAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/prihlaseni");
  const sessionId = String(formData.get("relace") ?? "");
  if (sessionId === user.sessionId) return;
  await prisma.session.deleteMany({ where: { id: sessionId, userId: user.id } });
  redirect("/relace");
}

async function issueEmailToken(userId: string, email: string, purpose: "verify" | "reset") {
  const token = newToken();
  const hours = purpose === "verify" ? 24 : 1;
  await prisma.emailToken.create({
    data: {
      userId,
      purpose,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + hours * 60 * 60 * 1000),
    },
  });
  const path = purpose === "verify" ? `/api/overeni-emailu?token=${token}` : `/obnoveni-hesla?token=${token}`;
  const subject = purpose === "verify" ? "Ověření e-mailu ve Studovně" : "Obnovení hesla ve Studovně";
  const text =
    purpose === "verify"
      ? `Dobrý den,\n\notevřete odkaz a ověřte e-mail ke Studovně:\n${appUrl()}${path}\n\nOdkaz platí 24 hodin.`
      : `Dobrý den,\n\notevřete odkaz a nastavte si nové heslo:\n${appUrl()}${path}\n\nOdkaz platí 1 hodinu. Když jste o něj nežádali, e-mail ignorujte.`;
  try {
    await sendMail({ to: email, subject, text });
  } catch (error) {
    console.error("Odeslání pošty selhalo.", error instanceof Error ? error.message : "neznámá chyba");
  }
}
