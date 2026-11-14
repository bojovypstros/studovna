import { notFound } from "next/navigation";
import { CardForm } from "@/components/card-form";
import { ConfirmForm } from "@/components/confirm-form";
import { DocumentView } from "@/components/document-view";
import { deleteCardAction, deleteMaterialAction, renameMaterialAction, setShareAction } from "@/lib/actions/library";
import { startTargetedAction } from "@/lib/actions/study";
import { prisma } from "@/lib/db";
import { parseDocument, plainText } from "@/lib/document";
import { appUrl } from "@/lib/mail";
import { requireUser } from "@/lib/session";

export default async function DeckPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ chyba?: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const query = await searchParams;
  const material = await prisma.material.findFirst({
    where: { id, ownerId: user.id, type: "deck" },
    include: { deck: { include: { cards: { orderBy: { position: "asc" } } } } },
  });
  if (!material?.deck) notFound();
  const shareUrl = material.shareToken ? `${appUrl()}/sdileni/${material.shareToken}` : "";
  return (
    <section className="stack">
      <p>
        <a href={material.folderId ? `/studovna?slozka=${material.folderId}` : "/studovna"}>Zpět do složky</a>
      </p>
      <h1>{material.title}</h1>
      {query.chyba ? <p role="alert" className="notice">{query.chyba}</p> : null}
      <form action={renameMaterialAction} className="inline-actions">
        <input type="hidden" name="material" value={material.id} />
        <div className="field">
          <label htmlFor="nazev-sady">Název sady</label>
          <input id="nazev-sady" name="nazev" defaultValue={material.title} required maxLength={120} />
        </div>
        <button type="submit">Přejmenovat</button>
      </form>
      <form action={startTargetedAction}>
        <input type="hidden" name="material" value={material.id} />
        <button type="submit">Procvičovat</button>
      </form>
      <form action={setShareAction} className="stack">
        <input type="hidden" name="material" value={material.id} />
        <input type="hidden" name="sdileni" value={material.shareEnabled ? "ne" : "ano"} />
        <button type="submit">{material.shareEnabled ? "Vypnout sdílení" : "Sdílet odkazem"}</button>
        {material.shareEnabled && shareUrl ? (
          <p>
            Odkaz: <a href={shareUrl}>{shareUrl}</a>
          </p>
        ) : (
          <p className="muted">Sada je soukromá.</p>
        )}
      </form>
      <p>
        <a href={`/kvizy/z-karticek?sada=${material.id}`}>Sestavit kvíz z kartiček</a>
      </p>
      <h2>Kartičky</h2>
      {material.deck.cards.length === 0 ? <p className="muted">Sada je prázdná.</p> : null}
      <ul className="materials">
        {material.deck.cards.map((card) => {
          const front = parseDocument(card.front);
          const back = parseDocument(card.back);
          return (
            <li key={card.id} className="panel">
              <details>
                <summary>
                  {front.ok ? plainText(front.document) || "(prázdný líc)" : "Poškozená kartička"}
                </summary>
                {front.ok && back.ok ? (
                  <>
                    <DocumentView document={front.document} />
                    <DocumentView document={back.document} />
                    <CardForm materialId={material.id} cardId={card.id} front={front.document} back={back.document} />
                  </>
                ) : null}
                <ConfirmForm action={deleteCardAction} label="Smazat kartičku" message="Smazat tuhle kartičku?" fields={{ karta: card.id }} />
              </details>
            </li>
          );
        })}
      </ul>
      <h2>Nová kartička</h2>
      <CardForm materialId={material.id} />
      <ConfirmForm action={deleteMaterialAction} label="Smazat sadu" message="Smazat celou sadu?" fields={{ material: material.id }} />
    </section>
  );
}
