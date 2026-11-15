import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import nodemailer from "nodemailer";

export type OutgoingMail = {
  to: string;
  subject: string;
  text: string;
};

export function mailFrom(): string {
  return process.env.MAIL_FROM || "Studovna <edu@combatostrich.dev>";
}

export async function sendMail(message: OutgoingMail): Promise<void> {
  const from = mailFrom();
  const host = process.env.SMTP_HOST ?? "";
  if (host === "capture") {
    const directory = path.join(process.cwd(), "tmp", "mail");
    await mkdir(directory, { recursive: true });
    await writeFile(
      path.join(directory, `${Date.now()}-${Math.random().toString(16).slice(2)}.json`),
      JSON.stringify({ from, ...message }),
    );
    return;
  }
  if (!host) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("SMTP není nastavené.");
    }
    console.info(`Pošta bez SMTP pro ${message.to}: ${message.subject}\n${message.text}`);
    return;
  }
  const port = Number(process.env.SMTP_PORT || 587);
  const authenticate = process.env.SMTP_AUTH !== "false" && Boolean(process.env.SMTP_USER);
  const transport = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: authenticate
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD ?? "" }
      : undefined,
  });
  await transport.sendMail({
    from,
    to: message.to,
    subject: message.subject,
    text: message.text,
  });
}

export function appUrl(): string {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
}
