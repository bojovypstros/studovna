import { prisma } from "@/lib/db";
import { descendantIds } from "@/lib/recommend";
import { applySm2, gradeForRating, type CardRating, type Sm2State } from "@/lib/sm2";
import { answerMatches } from "@/lib/quiz";

export type PlanItem = { kind: "card" | "question"; id: string };

export function toSm2(row: {
  easeFactor: number;
  repetitions: number;
  intervalDays: number;
  dueAt: Date;
  lapses: number;
}): Sm2State {
  return {
    easeFactor: row.easeFactor,
    repetitions: row.repetitions,
    intervalDays: row.intervalDays,
    dueAt: row.dueAt.toISOString(),
    lapses: row.lapses,
  };
}

export async function folderScopeIds(userId: string, folderIds: string[]): Promise<string[]> {
  if (folderIds.length === 0) return [];
  const folders = await prisma.folder.findMany({
    where: { ownerId: userId },
    select: { id: true, parentId: true },
  });
  const ids = new Set<string>();
  for (const folderId of folderIds) {
    if (!folders.some((folder) => folder.id === folderId)) continue;
    for (const id of descendantIds(folders, folderId)) ids.add(id);
  }
  return [...ids];
}

export async function rateOwnedCard(input: {
  userId: string;
  sessionId: string;
  cardId: string;
  rating: CardRating;
  now?: Date;
}) {
  const card = await prisma.card.findFirst({
    where: { id: input.cardId, deck: { material: { ownerId: input.userId } } },
  });
  const session = await prisma.studySession.findFirst({
    where: { id: input.sessionId, userId: input.userId },
  });
  if (!card || !session) return null;
  const now = input.now ?? new Date();
  const next = applySm2(toSm2(card), gradeForRating(input.rating), now);
  await prisma.$transaction([
    prisma.card.update({
      where: { id: card.id },
      data: {
        easeFactor: next.easeFactor,
        repetitions: next.repetitions,
        intervalDays: next.intervalDays,
        dueAt: new Date(next.dueAt),
        lapses: next.lapses,
      },
    }),
    prisma.attempt.create({
      data: {
        userId: input.userId,
        studySessionId: session.id,
        cardId: card.id,
        outcome: input.rating,
      },
    }),
  ]);
  return next;
}

export async function rateOwnedQuestion(input: {
  userId: string;
  sessionId: string;
  questionId: string;
  selectedIds: string[];
  now?: Date;
}) {
  const question = await prisma.question.findFirst({
    where: { id: input.questionId, quiz: { material: { ownerId: input.userId } } },
    include: { options: true },
  });
  const session = await prisma.studySession.findFirst({
    where: { id: input.sessionId, userId: input.userId },
  });
  if (!question || !session) return null;
  const correct = answerMatches(question.options, input.selectedIds);
  const now = input.now ?? new Date();
  const next = applySm2(toSm2(question), correct ? 4 : 0, now);
  await prisma.$transaction([
    prisma.question.update({
      where: { id: question.id },
      data: {
        easeFactor: next.easeFactor,
        repetitions: next.repetitions,
        intervalDays: next.intervalDays,
        dueAt: new Date(next.dueAt),
        lapses: next.lapses,
      },
    }),
    prisma.attempt.create({
      data: {
        userId: input.userId,
        studySessionId: session.id,
        questionId: question.id,
        outcome: correct ? "spravne" : "spatne",
      },
    }),
  ]);
  return {
    correct,
    correctIds: question.options.filter((option) => option.correct).map((option) => option.id),
    state: next,
  };
}
