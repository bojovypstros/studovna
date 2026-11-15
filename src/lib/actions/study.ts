"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { rankItems } from "@/lib/recommend";
import { requireUser } from "@/lib/session";
import { folderScopeIds, rateOwnedCard, rateOwnedQuestion, type PlanItem } from "@/lib/study";
import type { CardRating, Sm2State } from "@/lib/sm2";

export async function startTargetedAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const material = await prisma.material.findFirst({
    where: { id: String(formData.get("material") ?? ""), ownerId: user.id },
    include: {
      deck: { include: { cards: true } },
      quiz: { include: { questions: true } },
    },
  });
  if (!material || (material.type !== "deck" && material.type !== "quiz")) {
    redirect("/studovna?chyba=" + encodeURIComponent("Materiál nelze procvičovat."));
  }
  const now = new Date();
  const items =
    material.deck?.cards.map((card) => ({
      id: card.id,
      dueAt: card.dueAt.toISOString(),
      lapses: card.lapses,
      createdAt: card.createdAt.toISOString(),
      kind: "card" as const,
    })) ??
    material.quiz?.questions.map((question) => ({
      id: question.id,
      dueAt: question.dueAt.toISOString(),
      lapses: question.lapses,
      createdAt: question.createdAt.toISOString(),
      kind: "question" as const,
    })) ??
    [];
  if (items.length === 0) {
    const path = material.type === "deck" ? `/sady/${material.id}` : `/kvizy/${material.id}`;
    redirect(`${path}?chyba=` + encodeURIComponent("Není tu žádná úloha."));
  }
  const ranked = rankItems(items, now, true);
  const plan: PlanItem[] = ranked.map((item) => ({
    kind: items.find((candidate) => candidate.id === item.id)?.kind ?? "card",
    id: item.id,
  }));
  const session = await prisma.studySession.create({
    data: { userId: user.id, mode: "targeted", plan },
  });
  redirect(`/beh/${session.id}`);
}

export async function startCombinedAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const materialIds = formData.getAll("material").map(String);
  const folderIds = formData.getAll("slozka").map(String);
  const types = new Set(formData.getAll("druh").map(String));
  const limit = Number(formData.get("pocet") ?? 20);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    redirect("/studijni-rezim?chyba=" + encodeURIComponent("Počet úloh musí být 1 až 100."));
  }
  if (!types.has("karta") && !types.has("otazka")) {
    redirect("/studijni-rezim?chyba=" + encodeURIComponent("Vyberte aspoň jeden typ úloh."));
  }
  const scope = await folderScopeIds(user.id, folderIds);
  const materials = await prisma.material.findMany({
    where: {
      ownerId: user.id,
      OR: [{ id: { in: materialIds } }, { folderId: { in: scope } }],
    },
    include: { deck: { include: { cards: true } }, quiz: { include: { questions: true } } },
  });
  const now = new Date();
  const candidates: (PlanItem & { dueAt: string; lapses: number; createdAt: string })[] = [];
  for (const material of materials) {
    if (types.has("karta")) {
      for (const card of material.deck?.cards ?? []) {
        candidates.push({
          kind: "card",
          id: card.id,
          dueAt: card.dueAt.toISOString(),
          lapses: card.lapses,
          createdAt: card.createdAt.toISOString(),
        });
      }
    }
    if (types.has("otazka")) {
      for (const question of material.quiz?.questions ?? []) {
        candidates.push({
          kind: "question",
          id: question.id,
          dueAt: question.dueAt.toISOString(),
          lapses: question.lapses,
          createdAt: question.createdAt.toISOString(),
        });
      }
    }
  }
  const seen = new Set<string>();
  const unique = candidates.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
  const ranked = rankItems(unique, now, false).slice(0, limit);
  if (ranked.length === 0) {
    redirect("/studijni-rezim?chyba=" + encodeURIComponent("V tomhle výběru teď není žádná splatná úloha."));
  }
  const byId = new Map(candidates.map((item) => [item.id, item.kind]));
  const plan: PlanItem[] = ranked.map((item) => ({ kind: byId.get(item.id) ?? "card", id: item.id }));
  const session = await prisma.studySession.create({
    data: { userId: user.id, mode: "combined", plan },
  });
  redirect(`/beh/${session.id}`);
}

export async function rateCardAction(sessionId: string, cardId: string, rating: CardRating): Promise<{ state: Sm2State } | { error: string }> {
  const user = await requireUser();
  if (rating !== "nevim" && rating !== "znovu" && rating !== "vim") return { error: "Neznámé hodnocení." };
  const next = await rateOwnedCard({ userId: user.id, sessionId, cardId, rating });
  if (!next) return { error: "Kartičku nelze ohodnotit." };
  return { state: next };
}

export async function rateQuestionAction(
  sessionId: string,
  questionId: string,
  selectedIds: string[],
): Promise<{ correct: boolean; correctIds: string[] } | { error: string }> {
  const user = await requireUser();
  const result = await rateOwnedQuestion({ userId: user.id, sessionId, questionId, selectedIds });
  if (!result) return { error: "Otázku nelze vyhodnotit." };
  return { correct: result.correct, correctIds: result.correctIds };
}

export async function finishSessionAction(sessionId: string): Promise<void> {
  const user = await requireUser();
  await prisma.studySession.updateMany({
    where: { id: sessionId, userId: user.id, finishedAt: null },
    data: { finishedAt: new Date() },
  });
}
