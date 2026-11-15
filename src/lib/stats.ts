import { prisma } from "@/lib/db";

export async function studyStats(userId: string, now = new Date()) {
  const [folders, decks, cards, quizzes, questions, notes, attempts, dueCards] = await Promise.all([
    prisma.folder.count({ where: { ownerId: userId } }),
    prisma.material.count({ where: { ownerId: userId, type: "deck" } }),
    prisma.card.count({ where: { deck: { material: { ownerId: userId } } } }),
    prisma.material.count({ where: { ownerId: userId, type: "quiz" } }),
    prisma.question.count({ where: { quiz: { material: { ownerId: userId } } } }),
    prisma.material.count({ where: { ownerId: userId, type: "note" } }),
    prisma.attempt.findMany({ where: { userId }, select: { outcome: true } }),
    prisma.card.count({ where: { deck: { material: { ownerId: userId } }, dueAt: { lte: now } } }),
  ]);
  const successes = attempts.filter((attempt) => attempt.outcome === "vim" || attempt.outcome === "spravne").length;
  return {
    folders,
    decks,
    cards,
    quizzes,
    questions,
    notes,
    attempts: attempts.length,
    successes,
    successRate: attempts.length === 0 ? null : successes / attempts.length,
    dueCards,
  };
}
