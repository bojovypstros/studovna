import { notFound } from "next/navigation";
import { ConfirmForm } from "@/components/confirm-form";
import {
  createFolderAction,
  createMaterialAction,
  deleteFolderAction,
  moveFolderAction,
  moveMaterialAction,
  renameFolderAction,
} from "@/lib/actions/library";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ slozka?: string; chyba?: string; posta?: string }>;
}) {
  const user = await requireUser();
  const query = await searchParams;
  const folders = await prisma.folder.findMany({ where: { ownerId: user.id }, orderBy: { name: "asc" } });
  const current = query.slozka ? folders.find((folder) => folder.id === query.slozka) : null;
  if (query.slozka && !current) notFound();
  const materials = await prisma.material.findMany({
    where: { ownerId: user.id, folderId: current?.id ?? null },
    orderBy: { title: "asc" },
  });
  const children = folders.filter((folder) => folder.parentId === (current?.id ?? null));
  const crumbs = breadcrumb(folders, current?.id ?? null);
  return (
    <div className="library">
      <nav aria-label="Složky" className="panel">
        <p>
          <a href="/studovna" aria-current={current ? undefined : "page"}>
            Kořen
          </a>
        </p>
        <FolderTree folders={folders} currentId={current?.id ?? null} parentId={null} />
      </nav>
      <section className="stack">
        <h1>{current ? current.name : "Studovna"}</h1>
        {query.chyba ? <p role="alert" className="notice">{query.chyba}</p> : null}
        {query.posta ? <p role="status">Ověřovací odkaz je znovu na cestě.</p> : null}
        <nav aria-label="Umístění">
          <a href="/studovna">Kořen</a>
          {crumbs.map((crumb) => (
            <span key={crumb.id}>
              {" / "}
              <a href={`/studovna?slozka=${crumb.id}`}>{crumb.name}</a>
            </span>
          ))}
        </nav>
        {current ? (
          <div className="panel stack">
            <form action={renameFolderAction} className="inline-actions">
              <input type="hidden" name="slozka" value={current.id} />
              <div className="field">
                <label htmlFor="prejmenovat-slozku">Název složky</label>
                <input id="prejmenovat-slozku" name="nazev" defaultValue={current.name} required maxLength={120} />
              </div>
              <button type="submit">Přejmenovat</button>
            </form>
            <form action={moveFolderAction} className="inline-actions">
              <input type="hidden" name="slozka" value={current.id} />
              <div className="field">
                <label htmlFor="presun-slozky">Přesunout složku</label>
                <select id="presun-slozky" name="nadrazena" defaultValue={current.parentId ?? ""}>
                  <option value="">Kořen</option>
                  {folders
                    .filter((folder) => folder.id !== current.id)
                    .map((folder) => (
                      <option key={folder.id} value={folder.id}>
                        {folder.name}
                      </option>
                    ))}
                </select>
              </div>
              <button type="submit">Přesunout</button>
            </form>
            <ConfirmForm
              action={deleteFolderAction}
              label="Smazat složku"
              message="Smazat prázdnou složku?"
              fields={{ slozka: current.id }}
            />
          </div>
        ) : null}
        <h2>Složky</h2>
        {children.length === 0 ? <p className="muted">Tady žádná složka není.</p> : null}
        <ul className="materials">
          {children.map((folder) => (
            <li key={folder.id}>
              <a href={`/studovna?slozka=${folder.id}`}>{folder.name}</a>
            </li>
          ))}
        </ul>
        <form action={createFolderAction} className="inline-actions">
          {current ? <input type="hidden" name="nadrazena" value={current.id} /> : null}
          <div className="field">
            <label htmlFor="nova-slozka">Nová složka</label>
            <input id="nova-slozka" name="nazev" required maxLength={120} />
          </div>
          <button type="submit">Vytvořit složku</button>
        </form>
        <h2>Materiály</h2>
        {materials.length === 0 ? <p className="muted">Tady žádný materiál není.</p> : null}
        <ul className="materials">
          {materials.map((material) => (
            <li key={material.id} className="panel stack">
              <a href={hrefFor(material.type, material.id)}>
                {labelFor(material.type)}: {material.title}
              </a>
              <form action={moveMaterialAction} className="inline-actions">
                <input type="hidden" name="material" value={material.id} />
                <label htmlFor={`presun-${material.id}`}>
                  Přesunout
                  <select id={`presun-${material.id}`} name="slozka" defaultValue={material.folderId ?? ""}>
                    <option value="">Kořen</option>
                    {folders.map((folder) => (
                      <option key={folder.id} value={folder.id}>
                        {folder.name}
                      </option>
                    ))}
                  </select>
                </label>
                <button type="submit">Přesunout</button>
              </form>
            </li>
          ))}
        </ul>
        <form action={createMaterialAction} className="material-form">
          {current ? <input type="hidden" name="slozka" value={current.id} /> : null}
          <div className="field">
            <label htmlFor="novy-material">Nový materiál</label>
            <input id="novy-material" name="nazev" required maxLength={120} />
          </div>
          <fieldset>
            <legend>Typ</legend>
            <label className="choice">
              <input type="radio" name="typ" value="deck" defaultChecked required /> Sada kartiček
            </label>
            <label className="choice">
              <input type="radio" name="typ" value="quiz" /> Kvíz
            </label>
            <label className="choice">
              <input type="radio" name="typ" value="note" /> Poznámka
            </label>
          </fieldset>
          <button type="submit">Vytvořit materiál</button>
        </form>
      </section>
    </div>
  );
}

function FolderTree({
  folders,
  currentId,
  parentId,
}: {
  folders: { id: string; parentId: string | null; name: string }[];
  currentId: string | null;
  parentId: string | null;
}) {
  const children = folders.filter((folder) => folder.parentId === parentId);
  if (children.length === 0) return null;
  return (
    <ul className="tree">
      {children.map((folder) => (
        <li key={folder.id}>
          <a href={`/studovna?slozka=${folder.id}`} aria-current={folder.id === currentId ? "page" : undefined}>
            {folder.name}
          </a>
          <FolderTree folders={folders} currentId={currentId} parentId={folder.id} />
        </li>
      ))}
    </ul>
  );
}

function breadcrumb(
  folders: { id: string; parentId: string | null; name: string }[],
  id: string | null,
) {
  const crumbs: { id: string; name: string }[] = [];
  let current = id;
  const guard = new Set<string>();
  while (current && !guard.has(current)) {
    guard.add(current);
    const folder = folders.find((item) => item.id === current);
    if (!folder) break;
    crumbs.unshift(folder);
    current = folder.parentId;
  }
  return crumbs;
}

function hrefFor(type: string, id: string) {
  if (type === "deck") return `/sady/${id}`;
  if (type === "quiz") return `/kvizy/${id}`;
  return `/poznamky/${id}`;
}

function labelFor(type: string) {
  if (type === "deck") return "Sada";
  if (type === "quiz") return "Kvíz";
  return "Poznámka";
}
