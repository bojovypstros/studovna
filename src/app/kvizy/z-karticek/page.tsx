import { prisma } from "@/lib/db";
import { plainText, parseDocument } from "@/lib/document";
import { requireUser } from "@/lib/session";
import { prepareQuizFromCardsAction } from "@/lib/actions/library";

export default async function FromCardsPage({
  searchParams,
}: {
  searchParams: Promise<{ sada?: string; chyba?: string }>;
}) {
  const user = await requireUser();
  const query = await searchParams;
  const decks = await prisma.material.findMany({
    where: { ownerId: user.id, type: "deck" },
    include: { deck: { include: { cards: { orderBy: { position: "asc" } } } } },
    orderBy: { title: "asc" },
  });
  const selected = decks.find((deck) => deck.id === query.sada) ?? decks[0];
  return (
    <section className="stack">
      <h1>Kvíz z kartiček</h1>
      <p>Líc se stane zadáním. U jedné správné odpovědi je rub správná možnost a další ruby jsou chybné. Pravda a nepravda srovnají líc s rubem. Než kvíz uložíte, můžete ho upravit.</p>
      {query.chyba ? <p role="alert" className="notice">{query.chyba}</p> : null}
      {decks.length === 0 ? <p>Nejdřív vytvořte sadu kartiček.</p> : null}
      {decks.length > 1 ? (
        <nav aria-label="Výběr sady">
          <ul className="materials">
            {decks.map((deck) => (
              <li key={deck.id}>
                <a href={`/kvizy/z-karticek?sada=${deck.id}`} aria-current={deck.id === selected?.id ? "page" : undefined}>
                  {deck.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
      {selected?.deck ? (
        <form action={prepareQuizFromCardsAction} className="stack">
          <input type="hidden" name="sada" value={selected.id} />
          <p>Sada: {selected.title}</p>
          <fieldset>
            <legend>Kartičky</legend>
            {selected.deck.cards.map((card) => {
              const front = parseDocument(card.front);
              return (
                <label key={card.id} className="choice">
                  <input type="checkbox" name="karta" value={card.id} defaultChecked />
                  {front.ok ? plainText(front.document) || "(prázdný líc)" : "Kartička"}
                </label>
              );
            })}
          </fieldset>
          <fieldset>
            <legend>Typ otázek</legend>
            <label className="choice">
              <input type="radio" name="typ" value="single" defaultChecked /> Jedna správná odpověď
            </label>
            <label className="choice">
              <input type="radio" name="typ" value="boolean" /> Pravda/nepravda
            </label>
          </fieldset>
          <button type="submit">Připravit k úpravě</button>
        </form>
      ) : null}
    </section>
  );
}
