import { notFound } from "next/navigation";
import { DraftQuizEditor } from "@/components/question-form";
import { discardDraftAction } from "@/lib/actions/library";
import { prisma } from "@/lib/db";
import { parseDocument } from "@/lib/document";
import type { QuestionDraft } from "@/lib/quiz";
import { requireUser } from "@/lib/session";

export default async function DraftPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const draft = await prisma.quizDraft.findFirst({ where: { id, userId: user.id } });
  if (!draft || !Array.isArray(draft.payload)) notFound();
  const questions: QuestionDraft[] = [];
  for (const item of draft.payload) {
    if (!item || typeof item !== "object") continue;
    const record = item as { type?: unknown; stem?: unknown; options?: unknown };
    const stem = parseDocument(record.stem);
    if (!stem.ok || !Array.isArray(record.options)) continue;
    if (record.type !== "single" && record.type !== "multi" && record.type !== "boolean") continue;
    const options = [];
    let valid = true;
    for (const option of record.options) {
      if (!option || typeof option !== "object") {
        valid = false;
        break;
      }
      const content = parseDocument((option as { content?: unknown }).content);
      if (!content.ok) {
        valid = false;
        break;
      }
      options.push({ content: content.document, correct: (option as { correct?: unknown }).correct === true });
    }
    if (!valid) continue;
    questions.push({ type: record.type, stem: stem.document, options });
  }
  if (questions.length === 0) notFound();
  return (
    <section className="stack">
      <h1 id="navrh-nadpis">Upravit kvíz před uložením</h1>
      <p>Kvíz se uloží, až potvrdíte. Do té doby je to jen návrh.</p>
      <DraftQuizEditor draftId={draft.id} title={draft.title} questions={questions} />
      <form action={discardDraftAction}>
        <input type="hidden" name="navrh" value={draft.id} />
        <button type="submit" className="quiet">
          Zahodit návrh
        </button>
      </form>
    </section>
  );
}
