import { notFound } from "next/navigation";
import { ConfirmForm } from "@/components/confirm-form";
import { QuestionForm } from "@/components/question-form";
import { deleteMaterialAction, deleteQuestionAction, renameMaterialAction, setShareAction } from "@/lib/actions/library";
import { startTargetedAction } from "@/lib/actions/study";
import { prisma } from "@/lib/db";
import { parseDocument, plainText } from "@/lib/document";
import { appUrl } from "@/lib/mail";
import type { QuestionType } from "@/lib/quiz";
import { requireUser } from "@/lib/session";

export default async function QuizPage({
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
    where: { id, ownerId: user.id, type: "quiz" },
    include: {
      quiz: { include: { questions: { orderBy: { position: "asc" }, include: { options: { orderBy: { position: "asc" } } } } } },
    },
  });
  if (!material?.quiz) notFound();
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
          <label htmlFor="nazev-kvizu">Název kvízu</label>
          <input id="nazev-kvizu" name="nazev" defaultValue={material.title} required maxLength={120} />
        </div>
        <button type="submit">Přejmenovat</button>
      </form>
      <form action={startTargetedAction}>
        <input type="hidden" name="material" value={material.id} />
        <button type="submit">Spustit kvíz</button>
      </form>
      <form action={setShareAction}>
        <input type="hidden" name="material" value={material.id} />
        <input type="hidden" name="sdileni" value={material.shareEnabled ? "ne" : "ano"} />
        <button type="submit">{material.shareEnabled ? "Vypnout sdílení" : "Sdílet odkazem"}</button>
      </form>
      {material.shareEnabled && shareUrl ? <p>Odkaz: <a href={shareUrl}>{shareUrl}</a></p> : <p className="muted">Kvíz je soukromý.</p>}
      <h2>Otázky</h2>
      <ul className="materials">
        {material.quiz.questions.map((question) => {
          const stem = parseDocument(question.stem);
          const options = question.options.flatMap((option) => {
            const content = parseDocument(option.content);
            return content.ok ? [{ content: content.document, correct: option.correct }] : [];
          });
          const ready = stem.ok && options.length === question.options.length;
          return (
            <li key={question.id} className="panel">
              <details>
                <summary>{stem.ok ? plainText(stem.document) || "(prázdné zadání)" : "Poškozená otázka"}</summary>
                {ready && stem.ok ? (
                  <QuestionForm
                    materialId={material.id}
                    questionId={question.id}
                    initialType={question.type as QuestionType}
                    stem={stem.document}
                    options={options}
                  />
                ) : null}
                <ConfirmForm action={deleteQuestionAction} label="Smazat otázku" message="Smazat tuhle otázku?" fields={{ otazka: question.id }} />
              </details>
            </li>
          );
        })}
      </ul>
      <h2>Nová otázka</h2>
      <QuestionForm materialId={material.id} />
      <ConfirmForm action={deleteMaterialAction} label="Smazat kvíz" message="Smazat celý kvíz?" fields={{ material: material.id }} />
    </section>
  );
}
