import { RegisterForm } from "@/components/auth-forms";
import { safeNextPath } from "@/lib/access";
import { getCurrentUser } from "@/lib/session";
import { redirect } from "next/navigation";

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ dal?: string }> }) {
  if (await getCurrentUser()) redirect("/studovna");
  const query = await searchParams;
  const next = safeNextPath(query.dal) ?? undefined;
  return (
    <section className="stack">
      <h1 id="registrace-nadpis">Registrace</h1>
      <RegisterForm next={next} />
      <p>
        Už účet máte? <a href="/prihlaseni">Přihlaste se</a>.
      </p>
    </section>
  );
}
