import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { startCombinedAction } from "@/lib/actions/study";

export default async function StudyModePage({ searchParams }: { searchParams: Promise<{ chyba?: string }> }) {
  const user = await requireUser();
  const query = await searchParams;
  const [folders, materials] = await Promise.all([
    prisma.folder.findMany({ where: { ownerId: user.id }, orderBy: { name: "asc" } }),
    prisma.material.findMany({
      where: { ownerId: user.id, type: { in: ["deck", "quiz"] } },
      orderBy: { title: "asc" },
    }),
  ]);
  return (
    <section className="stack">
      <h1>Studijní režim</h1>
      <p>
        Cílené procvičování spustíte u konkrétní sady nebo kvízu. Tady skládáte kombinovaný blok. Pořadí je průhledné: víc neúspěchů je výš, při shodě je výš úloha déle po termínu. Berou se jen splatné a nové kartičky a otázky. Poznámka úlohu netvoří.
      </p>
      {query.chyba ? <p role="alert" className="notice">{query.chyba}</p> : null}
      <form action={startCombinedAction} className="stack">
        <fieldset>
          <legend>Složky</legend>
          {folders.length === 0 ? <p className="muted">Žádná složka.</p> : null}
          {folders.map((folder) => (
            <label key={folder.id} className="choice">
              <input type="checkbox" name="slozka" value={folder.id} />
              {folder.name} včetně podsložek
            </label>
          ))}
        </fieldset>
        <fieldset>
          <legend>Materiály</legend>
          {materials.length === 0 ? <p className="muted">Žádná sada ani kvíz.</p> : null}
          {materials.map((material) => (
            <label key={material.id} className="choice">
              <input type="checkbox" name="material" value={material.id} />
              {material.type === "deck" ? "Sada" : "Kvíz"}: {material.title}
            </label>
          ))}
        </fieldset>
        <fieldset>
          <legend>Typy úloh</legend>
          <label className="choice">
            <input type="checkbox" name="druh" value="karta" defaultChecked /> Kartičky
          </label>
          <label className="choice">
            <input type="checkbox" name="druh" value="otazka" defaultChecked /> Otázky
          </label>
        </fieldset>
        <div className="field">
          <label htmlFor="pocet">Počet úloh</label>
          <input id="pocet" name="pocet" type="number" min={1} max={100} defaultValue={20} required inputMode="numeric" />
        </div>
        <button type="submit">Spustit blok</button>
      </form>
    </section>
  );
}
