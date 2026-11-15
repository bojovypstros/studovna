import { notFound } from "next/navigation";
import { ConfirmForm } from "@/components/confirm-form";
import { NoteForm } from "@/components/note-form";
import { deleteMaterialAction, renameMaterialAction, setShareAction } from "@/lib/actions/library";
import { prisma } from "@/lib/db";
import { emptyDocument, parseDocument } from "@/lib/document";
import { appUrl } from "@/lib/mail";
import { requireUser } from "@/lib/session";

export default async function NotePage({
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
    where: { id, ownerId: user.id, type: "note" },
    include: { note: true },
  });
  if (!material?.note) notFound();
  const document = parseDocument(material.note.document);
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
          <label htmlFor="nazev-poznamky">Název poznámky</label>
          <input id="nazev-poznamky" name="nazev" defaultValue={material.title} required maxLength={120} />
        </div>
        <button type="submit">Přejmenovat</button>
      </form>
      <form action={setShareAction}>
        <input type="hidden" name="material" value={material.id} />
        <input type="hidden" name="sdileni" value={material.shareEnabled ? "ne" : "ano"} />
        <button type="submit">{material.shareEnabled ? "Vypnout sdílení" : "Sdílet odkazem"}</button>
      </form>
      {material.shareEnabled && shareUrl ? <p>Odkaz: <a href={shareUrl}>{shareUrl}</a></p> : <p className="muted">Poznámka je soukromá.</p>}
      <NoteForm materialId={material.id} document={document.ok ? document.document : emptyDocument()} />
      <ConfirmForm action={deleteMaterialAction} label="Smazat poznámku" message="Smazat tuhle poznámku?" fields={{ material: material.id }} />
    </section>
  );
}
