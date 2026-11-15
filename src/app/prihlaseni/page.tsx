import { LoginForm } from "@/components/auth-forms";
import { safeNextPath } from "@/lib/access";
import { getCurrentUser } from "@/lib/session";
import { redirect } from "next/navigation";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ dal?: string; obnoveno?: string }>;
}) {
  if (await getCurrentUser()) redirect("/studovna");
  const query = await searchParams;
  const next = safeNextPath(query.dal) ?? undefined;
  return (
    <section className="stack">
      <h1 id="prihlaseni-nadpis">Přihlášení</h1>
      {query.obnoveno ? <p role="status">Heslo je změněné. Přihlaste se znovu.</p> : null}
      <LoginForm next={next} />
      <p>
        <a href="/zapomenute-heslo">Zapomněli jste heslo?</a>
      </p>
      <p>
        Nemáte účet? <a href="/registrace">Registrujte se</a>.
      </p>
    </section>
  );
}
