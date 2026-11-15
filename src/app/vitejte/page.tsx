import { safeNextPath } from "@/lib/access";
import { requireUser } from "@/lib/session";

export default async function WelcomePage({ searchParams }: { searchParams: Promise<{ dal?: string }> }) {
  await requireUser();
  const query = await searchParams;
  const next = safeNextPath(query.dal) ?? "/studovna";
  return (
    <section className="stack">
      <h1>Vítejte ve Studovně</h1>
      <p>Tady si budete ukládat vlastní materiály a procvičovat.</p>
      <p>Ověřovací odkaz je na vašem e-mailu.</p>
      <p>
        <a className="button" href={next}>
          Pokračovat do studovny
        </a>
      </p>
    </section>
  );
}
