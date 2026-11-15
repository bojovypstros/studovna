import { ResetForm } from "@/components/auth-forms";

export default async function ResetPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const query = await searchParams;
  if (!query.token) {
    return (
      <section>
        <h1>Odkaz neplatí</h1>
        <p>
          <a href="/zapomenute-heslo">Požádat o nový odkaz</a>
        </p>
      </section>
    );
  }
  return (
    <section className="stack">
      <h1 id="obnoveni-nadpis">Nové heslo</h1>
      <ResetForm token={query.token} />
    </section>
  );
}
