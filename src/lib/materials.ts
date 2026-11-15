import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { grantOwner } from "@/lib/access";
import { imageIds, mapImageIds, parseDocument, type StudyDocument } from "@/lib/document";
import { copyImageFile } from "@/lib/storage";
import { newImageId } from "@/lib/tokens";
import { questionError, type QuestionDraft } from "@/lib/quiz";

const materialInclude = {
  deck: { include: { cards: { orderBy: { position: "asc" as const } } } },
  quiz: {
    include: {
      questions: { orderBy: { position: "asc" as const }, include: { options: { orderBy: { position: "asc" as const } } } },
    },
  },
  note: true,
} satisfies Prisma.MaterialInclude;

export async function createMaterialShell(input: {
  userId: string;
  folderId: string | null;
  type: "deck" | "quiz" | "note";
  title: string;
}) {
  const material = await prisma.material.create({
    data: {
      ownerId: input.userId,
      folderId: input.folderId,
      type: input.type,
      title: input.title,
      deck: input.type === "deck" ? { create: {} } : undefined,
      quiz: input.type === "quiz" ? { create: {} } : undefined,
      note: input.type === "note" ? { create: { document: { version: 1, blocks: [{ type: "paragraph", inlines: [] }] } } } : undefined,
    },
  });
  await grantOwner("MATERIAL", material.id, input.userId);
  return material;
}

export async function copySharedMaterial(userId: string, token: string) {
  const source = await prisma.material.findFirst({
    where: { shareToken: token, shareEnabled: true },
    include: materialInclude,
  });
  if (!source || source.ownerId === userId) return null;
  const documents = collectDocuments(source);
  const imageMap = new Map<string, string>();
  for (const id of new Set(documents.flatMap(imageIds))) {
    const asset = await prisma.imageAsset.findUnique({ where: { id } });
    if (!asset) continue;
    const nextId = newImageId();
    await copyImageFile(id, nextId);
    await prisma.imageAsset.create({ data: { id: nextId, ownerId: userId, mime: asset.mime } });
    imageMap.set(id, nextId);
  }
  const rewrite = (value: unknown) => {
    const parsed = parseDocument(value);
    if (!parsed.ok) return value;
    return mapImageIds(parsed.document, (id) => imageMap.get(id) ?? id);
  };
  const copy = await prisma.$transaction(async (tx) => {
    const created = await tx.material.create({
      data: {
        ownerId: userId,
        type: source.type,
        title: `${source.title} (kopie)`.slice(0, 120),
        deck: source.deck ? { create: {} } : undefined,
        quiz: source.quiz ? { create: {} } : undefined,
        note: source.note ? { create: { document: rewrite(source.note.document) as object } } : undefined,
      },
      include: materialInclude,
    });
    if (source.deck && created.deck) {
      for (const card of source.deck.cards) {
        await tx.card.create({
          data: {
            deckId: created.deck.id,
            front: rewrite(card.front) as object,
            back: rewrite(card.back) as object,
            position: card.position,
          },
        });
      }
    }
    if (source.quiz && created.quiz) {
      for (const question of source.quiz.questions) {
        await tx.question.create({
          data: {
            quizId: created.quiz.id,
            type: question.type,
            stem: rewrite(question.stem) as object,
            position: question.position,
            options: {
              create: question.options.map((option) => ({
                content: rewrite(option.content) as object,
                correct: option.correct,
                position: option.position,
              })),
            },
          },
        });
      }
    }
    return created;
  });
  await grantOwner("MATERIAL", copy.id, userId);
  return copy;
}

function collectDocuments(source: {
  deck: { cards: { front: unknown; back: unknown }[] } | null;
  quiz: { questions: { stem: unknown; options: { content: unknown }[] }[] } | null;
  note: { document: unknown } | null;
}): StudyDocument[] {
  const documents: StudyDocument[] = [];
  for (const card of source.deck?.cards ?? []) {
    for (const side of [card.front, card.back]) {
      const parsed = parseDocument(side);
      if (parsed.ok) documents.push(parsed.document);
    }
  }
  for (const question of source.quiz?.questions ?? []) {
    const stem = parseDocument(question.stem);
    if (stem.ok) documents.push(stem.document);
    for (const option of question.options) {
      const parsed = parseDocument(option.content);
      if (parsed.ok) documents.push(parsed.document);
    }
  }
  if (source.note) {
    const parsed = parseDocument(source.note.document);
    if (parsed.ok) documents.push(parsed.document);
  }
  return documents;
}

export async function replaceQuestions(quizId: string, drafts: QuestionDraft[]) {
  for (const draft of drafts) {
    const error = questionError(draft);
    if (error) return error;
  }
  await prisma.$transaction(async (tx) => {
    await tx.question.deleteMany({ where: { quizId } });
    for (const [index, draft] of drafts.entries()) {
      await tx.question.create({
        data: {
          quizId,
          type: draft.type,
          stem: draft.stem,
          position: index,
          options: {
            create: draft.options.map((option, optionIndex) => ({
              content: option.content,
              correct: option.correct,
              position: optionIndex,
            })),
          },
        },
      });
    }
  });
  return null;
}
