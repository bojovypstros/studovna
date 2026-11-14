import type { Metadata } from "next";
import type { ReactNode } from "react";
import "katex/dist/katex.min.css";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { resendVerificationAction } from "@/lib/actions/auth";
import { getCurrentUser } from "@/lib/session";

export const metadata: Metadata = {
  title: { default: "Studovna", template: "%s · Studovna" },
  description: "Osobní studovna pro střední a vysoké školy.",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  const links = user
    ? [
        { href: "/studovna", label: "Studovna" },
        { href: "/studijni-rezim", label: "Studijní režim" },
        { href: "/statistiky", label: "Statistiky" },
        { href: "/relace", label: "Relace" },
      ]
    : [
        { href: "/prihlaseni", label: "Přihlášení" },
        { href: "/registrace", label: "Registrace" },
      ];
  return (
    <html lang="cs">
      <body>
        <a className="skip" href="#obsah">
          Přeskočit na obsah
        </a>
        <SiteHeader links={links} signedIn={Boolean(user)} />
        <main id="obsah">
          {user && !user.emailVerifiedAt ? (
            <form action={resendVerificationAction} className="banner">
              <p>E-mail ještě není ověřený.</p>
              <button type="submit" className="quiet">
                Poslat odkaz znovu
              </button>
            </form>
          ) : null}
          {children}
        </main>
      </body>
    </html>
  );
}
