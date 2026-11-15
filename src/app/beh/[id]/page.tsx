import { notFound } from "next/navigation";
import { StudyRunner, type RunnerItem } from "@/components/study-runner";
import { prisma } from "@/lib/db";
import { parseDocument } from "@/lib/document";
import { requireUser } from "@/lib/session";
import { toSm2, type PlanItem } from "@/lib/study";

export default async function RunPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const session = await prisma.studySession.findFirst({ where: { id, userId: user.id } });
  if (!session) notFound();
  const plan = Array.isArray(session.plan) ? (session.plan as PlanItem[]) : [];
  const cardIds = plan.filter((item) => item.kind === "card").map((item) => item.id);
  const questionIds = plan.filter((item) => item.kind === "question").map((item) => item.id);
  const [cards, questions] = await Promise.all([
    prisma.card.findMany({ where: { id: { in: cardIds }, deck: { material: { ownerId: user.id } } } }),
    prisma.question.findMany({
      where: { id: { in: questionIds }, quiz: { material: { ownerId: user.id } } },
      include: { options: { orderBy: { position: "asc" } } },
    }),
  ]);
  const cardById = new Map(cards.map((card) => [card.id, card]));
  const questionById = new Map(questions.map((question) => [question.id, question]));
  const items: RunnerItem[] = [];
  for (const item of plan) {
    if (item.kind === "card") {
      const card = cardById.get(item.id);
      if (!card) continue;
      const front = parseDocument(card.front);
      const back = parseDocument(card.back);
      if (!front.ok || !back.ok) continue;
      items.push({ kind: "card", id: card.id, front: front.document, back: back.document, state: toSm2(card), repeats: 0 });
    } else {
      const question = questionById.get(item.id);
      if (!question) continue;
      const stem = parseDocument(question.stem);
      if (!stem.ok) continue;
      const options = question.options.flatMap((option) => {
        const content = parseDocument(option.content);
        return content.ok ? [{ id: option.id, content: content.document }] : [];
      });
      items.push({ kind: "question", id: question.id, stem: stem.document, type: question.type, options });
    }
  }
  return (
    <StudyRunner
      sessionId={session.id}
      items={items}
    />
  );
}
