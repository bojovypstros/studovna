import { notFound } from "next/navigation";
import { DocumentView } from "@/components/document-view";
import { copyShareAction } from "@/lib/actions/library";
import { prisma } from "@/lib/db";
import { parseDocument } from "@/lib/document";
import { getCurrentUser } from "@/lib/session";

export default async function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const user = await getCurrentUser();
  const material = await prisma.material.findFirst({
    where: { shareToken: token, shareEnabled: true },
    include: {
      deck: { include: { cards: { orderBy: { position: "asc" } } } },
      quiz: { include: { questions: { orderBy: { position: "asc" }, include: { options: { orderBy: { position: "asc" } } } } } },
      note: true,
    },
  });
  if (!material) notFound();
  const own = user?.id === material.ownerId;
  return (
    <article className="stack">
      <h1>{material.title}</h1>
      <p className="muted">Sdílený materiál. Odkaz neukazuje ostatní věci autora.</p>
      {material.deck?.cards.map((card) => {
        const front = parseDocument(card.front);
        const back = parseDocument(card.back);
        if (!front.ok || !back.ok) return null;
        return (
          <section key={card.id} className="panel">
            <DocumentView document={front.document} shareToken={token} />
            <DocumentView document={back.document} shareToken={token} />
          </section>
        );
      })}
      {material.quiz?.questions.map((question) => {
        const stem = parseDocument(question.stem);
        if (!stem.ok) return null;
        return (
          <section key={question.id} className="panel">
            <DocumentView document={stem.document} shareToken={token} />
            <ul>
              {question.options.map((option) => {
                const content = parseDocument(option.content);
                if (!content.ok) return null;
                return (
                  <li key={option.id}>
                    <DocumentView document={content.document} shareToken={token} />
                    {option.correct ? <span className="tag">Správná odpověď</span> : null}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
      {material.note ? <NoteBody document={material.note.document} token={token} /> : null}
      {own ? (
        <p>
          <a href={material.type === "deck" ? `/sady/${material.id}` : material.type === "quiz" ? `/kvizy/${material.id}` : `/poznamky/${material.id}`}>
            Otevřít vlastní materiál
          </a>
        </p>
      ) : user ? (
        <form action={copyShareAction}>
          <input type="hidden" name="token" value={token} />
          <button type="submit">Zkopírovat do mého účtu</button>
        </form>
      ) : (
        <p>
          <a href={`/prihlaseni?dal=${encodeURIComponent(`/sdileni/${token}`)}`}>Přihlaste se a zkopírujte si materiál</a>
        </p>
      )}
    </article>
  );
}

function NoteBody({ document, token }: { document: unknown; token: string }) {
  const parsed = parseDocument(document);
  if (!parsed.ok) return null;
  return <DocumentView document={parsed.document} shareToken={token} />;
}
