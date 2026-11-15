"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { grantOwner, imagesBelongToUser, ownedFolder, ownedMaterial, titleError } from "@/lib/access";
import { documentFromJson, parseDocument, type StudyDocument } from "@/lib/document";
import { copySharedMaterial, createMaterialShell, replaceQuestions } from "@/lib/materials";
import { parentCreatesCycle } from "@/lib/recommend";
import { requireUser } from "@/lib/session";
import { draftsFromCards, questionError, type QuestionDraft, type QuestionType } from "@/lib/quiz";
import { newToken } from "@/lib/tokens";

export type FormState = { error: string };

function back(path: string, error: string): never {
  const glue = path.includes("?") ? "&" : "?";
  redirect(`${path}${glue}chyba=${encodeURIComponent(error)}`);
}

export async function createFolderAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const name = String(formData.get("nazev") ?? "");
  const problem = titleError(name, "Název složky");
  const parentRaw = String(formData.get("nadrazena") ?? "");
  const parentId = parentRaw || null;
  const here = parentId ? `/studovna?slozka=${parentId}` : "/studovna";
  if (problem) back(here, problem);
  if (parentId && !(await ownedFolder(user.id, parentId))) back(here, "Složka neexistuje.");
  const folder = await prisma.folder.create({
    data: { ownerId: user.id, parentId, name: name.trim() },
  });
  await grantOwner("FOLDER", folder.id, user.id);
  redirect(`/studovna?slozka=${folder.id}`);
}

export async function renameFolderAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const folderId = String(formData.get("slozka") ?? "");
  const folder = await ownedFolder(user.id, folderId);
  if (!folder) back("/studovna", "Složka neexistuje.");
  const name = String(formData.get("nazev") ?? "");
  const problem = titleError(name, "Název složky");
  if (problem) back(`/studovna?slozka=${folderId}`, problem);
  await prisma.folder.update({ where: { id: folderId }, data: { name: name.trim() } });
  redirect(`/studovna?slozka=${folderId}`);
}

export async function moveFolderAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const folderId = String(formData.get("slozka") ?? "");
  const nextParent = String(formData.get("nadrazena") ?? "") || null;
  const folders = await prisma.folder.findMany({ where: { ownerId: user.id }, select: { id: true, parentId: true } });
  if (!folders.some((folder) => folder.id === folderId)) back("/studovna", "Složka neexistuje.");
  if (nextParent && !folders.some((folder) => folder.id === nextParent)) {
    back(`/studovna?slozka=${folderId}`, "Cílová složka neexistuje.");
  }
  if (parentCreatesCycle(folders, folderId, nextParent)) {
    back(`/studovna?slozka=${folderId}`, "Složku nelze přesunout do sebe.");
  }
  await prisma.folder.update({ where: { id: folderId }, data: { parentId: nextParent } });
  redirect(`/studovna?slozka=${folderId}`);
}

export async function deleteFolderAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const folderId = String(formData.get("slozka") ?? "");
  const folder = await ownedFolder(user.id, folderId);
  if (!folder) back("/studovna", "Složka neexistuje.");
  const [children, materials] = await Promise.all([
    prisma.folder.count({ where: { parentId: folderId } }),
    prisma.material.count({ where: { folderId } }),
  ]);
  if (children > 0 || materials > 0) {
    back(`/studovna?slozka=${folderId}`, "Nejdřív přesuňte nebo smažte obsah složky.");
  }
  await prisma.folder.delete({ where: { id: folderId } });
  redirect(folder.parentId ? `/studovna?slozka=${folder.parentId}` : "/studovna");
}

export async function createMaterialAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const type = String(formData.get("typ") ?? "");
  if (type !== "deck" && type !== "quiz" && type !== "note") back("/studovna", "Neznámý typ materiálu.");
  const title = String(formData.get("nazev") ?? "");
  const folderRaw = String(formData.get("slozka") ?? "");
  const folderId = folderRaw || null;
  const here = folderId ? `/studovna?slozka=${folderId}` : "/studovna";
  const problem = titleError(title, "Název");
  if (problem) back(here, problem);
  if (folderId && !(await ownedFolder(user.id, folderId))) back("/studovna", "Složka neexistuje.");
  const material = await createMaterialShell({ userId: user.id, folderId, type, title: title.trim() });
  redirect(materialPath(material.type, material.id));
}

export async function renameMaterialAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const material = await ownedMaterial(user.id, String(formData.get("material") ?? ""));
  if (!material) back("/studovna", "Materiál neexistuje.");
  const title = String(formData.get("nazev") ?? "");
  const problem = titleError(title, "Název");
  const path = materialPath(material.type, material.id);
  if (problem) back(path, problem);
  await prisma.material.update({ where: { id: material.id }, data: { title: title.trim() } });
  redirect(path);
}

export async function moveMaterialAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const material = await ownedMaterial(user.id, String(formData.get("material") ?? ""));
  if (!material) back("/studovna", "Materiál neexistuje.");
  const folderRaw = String(formData.get("slozka") ?? "");
  const folderId = folderRaw || null;
  if (folderId && !(await ownedFolder(user.id, folderId))) {
    back(materialPath(material.type, material.id), "Cílová složka neexistuje.");
  }
  await prisma.material.update({ where: { id: material.id }, data: { folderId } });
  redirect(folderId ? `/studovna?slozka=${folderId}` : "/studovna");
}

export async function deleteMaterialAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const material = await ownedMaterial(user.id, String(formData.get("material") ?? ""));
  if (!material) back("/studovna", "Materiál neexistuje.");
  const folderId = material.folderId;
  await prisma.material.delete({ where: { id: material.id } });
  redirect(folderId ? `/studovna?slozka=${folderId}` : "/studovna");
}

export async function setShareAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const material = await ownedMaterial(user.id, String(formData.get("material") ?? ""));
  if (!material) back("/studovna", "Materiál neexistuje.");
  const enabled = String(formData.get("sdileni") ?? "") === "ano";
  await prisma.material.update({
    where: { id: material.id },
    data: {
      shareEnabled: enabled,
      shareToken: material.shareToken ?? newToken(),
    },
  });
  redirect(materialPath(material.type, material.id));
}

export async function copyShareAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const token = String(formData.get("token") ?? "");
  const copy = await copySharedMaterial(user.id, token);
  if (!copy) back(`/sdileni/${token}`, "Materiál nelze zkopírovat.");
  redirect(materialPath(copy.type, copy.id));
}

export async function saveCardAction(_state: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const deckMaterial = await prisma.material.findFirst({
    where: { id: String(formData.get("material") ?? ""), ownerId: user.id, type: "deck" },
    include: { deck: true },
  });
  if (!deckMaterial?.deck) return { error: "Sada neexistuje." };
  const front = documentFromJson(String(formData.get("lic") ?? ""));
  const back = documentFromJson(String(formData.get("rub") ?? ""));
  if (!front.ok) return { error: front.error };
  if (!back.ok) return { error: back.error };
  if (!(await imagesBelongToUser(user.id, [front.document, back.document]))) {
    return { error: "Obrázek do téhle sady nepatří." };
  }
  const cardId = String(formData.get("karta") ?? "");
  if (cardId) {
    const card = await prisma.card.findFirst({ where: { id: cardId, deckId: deckMaterial.deck.id } });
    if (!card) return { error: "Kartička neexistuje." };
    await prisma.card.update({
      where: { id: card.id },
      data: { front: front.document, back: back.document },
    });
  } else {
    const last = await prisma.card.aggregate({ where: { deckId: deckMaterial.deck.id }, _max: { position: true } });
    await prisma.card.create({
      data: {
        deckId: deckMaterial.deck.id,
        front: front.document,
        back: back.document,
        position: (last._max.position ?? -1) + 1,
      },
    });
  }
  redirect(`/sady/${deckMaterial.id}`);
}

export async function deleteCardAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const card = await prisma.card.findFirst({
    where: { id: String(formData.get("karta") ?? ""), deck: { material: { ownerId: user.id } } },
    include: { deck: true },
  });
  if (!card) back("/studovna", "Kartička neexistuje.");
  const material = await prisma.material.findFirst({ where: { deck: { id: card.deckId } } });
  await prisma.card.delete({ where: { id: card.id } });
  redirect(material ? `/sady/${material.id}` : "/studovna");
}

export async function saveNoteAction(_state: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const material = await prisma.material.findFirst({
    where: { id: String(formData.get("material") ?? ""), ownerId: user.id, type: "note" },
    include: { note: true },
  });
  if (!material?.note) return { error: "Poznámka neexistuje." };
  const document = documentFromJson(String(formData.get("dokument") ?? ""));
  if (!document.ok) return { error: document.error };
  if (!(await imagesBelongToUser(user.id, [document.document]))) {
    return { error: "Obrázek do téhle poznámky nepatří." };
  }
  await prisma.note.update({ where: { id: material.note.id }, data: { document: document.document } });
  redirect(`/poznamky/${material.id}`);
}

export async function saveQuestionAction(_state: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const material = await prisma.material.findFirst({
    where: { id: String(formData.get("material") ?? ""), ownerId: user.id, type: "quiz" },
    include: { quiz: true },
  });
  if (!material?.quiz) return { error: "Kvíz neexistuje." };
  const draft = parseDraft(formData);
  if (!draft.ok) return { error: draft.error };
  const problem = questionError(draft.draft);
  if (problem) return { error: problem };
  const documents = [draft.draft.stem, ...draft.draft.options.map((option) => option.content)];
  if (!(await imagesBelongToUser(user.id, documents))) return { error: "Obrázek do tohohle kvízu nepatří." };
  const questionId = String(formData.get("otazka") ?? "");
  if (questionId) {
    const existing = await prisma.question.findFirst({ where: { id: questionId, quizId: material.quiz.id } });
    if (!existing) return { error: "Otázka neexistuje." };
    await prisma.option.deleteMany({ where: { questionId } });
    await prisma.question.update({
      where: { id: questionId },
      data: {
        type: draft.draft.type,
        stem: draft.draft.stem,
        options: {
          create: draft.draft.options.map((option, index) => ({
            content: option.content,
            correct: option.correct,
            position: index,
          })),
        },
      },
    });
  } else {
    const last = await prisma.question.aggregate({ where: { quizId: material.quiz.id }, _max: { position: true } });
    await prisma.question.create({
      data: {
        quizId: material.quiz.id,
        type: draft.draft.type,
        stem: draft.draft.stem,
        position: (last._max.position ?? -1) + 1,
        options: {
          create: draft.draft.options.map((option, index) => ({
            content: option.content,
            correct: option.correct,
            position: index,
          })),
        },
      },
    });
  }
  redirect(`/kvizy/${material.id}`);
}

export async function deleteQuestionAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const question = await prisma.question.findFirst({
    where: { id: String(formData.get("otazka") ?? ""), quiz: { material: { ownerId: user.id } } },
    include: { quiz: { include: { material: true } } },
  });
  if (!question) back("/studovna", "Otázka neexistuje.");
  await prisma.question.delete({ where: { id: question.id } });
  redirect(`/kvizy/${question.quiz.material.id}`);
}

export async function prepareQuizFromCardsAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const deck = await prisma.material.findFirst({
    where: { id: String(formData.get("sada") ?? ""), ownerId: user.id, type: "deck" },
    include: { deck: { include: { cards: true } } },
  });
  if (!deck?.deck) back("/kvizy/z-karticek", "Sada neexistuje.");
  const type = String(formData.get("typ") ?? "");
  if (type !== "single" && type !== "boolean") back("/kvizy/z-karticek", "Vyberte typ otázek.");
  const selected = new Set(formData.getAll("karta").map(String));
  const cards = deck.deck.cards.filter((card) => selected.has(card.id));
  const fronts = cards.map((card) => {
    const front = parseDocument(card.front);
    const back = parseDocument(card.back);
    if (!front.ok || !back.ok) return null;
    return { front: front.document, back: back.document };
  });
  if (fronts.some((card) => card === null)) back("/kvizy/z-karticek", "Kartička má poškozený obsah.");
  const drafts = draftsFromCards(fronts.filter((card): card is { front: StudyDocument; back: StudyDocument } => card !== null), type);
  if (!drafts.ok) back(`/kvizy/z-karticek?sada=${deck.id}`, drafts.error);
  const draft = await prisma.quizDraft.create({
    data: {
      userId: user.id,
      folderId: deck.folderId,
      title: deck.title,
      payload: drafts.drafts,
    },
  });
  redirect(`/kvizy/navrh/${draft.id}`);
}

export async function saveQuizDraftAction(_state: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const draft = await prisma.quizDraft.findFirst({
    where: { id: String(formData.get("navrh") ?? ""), userId: user.id },
  });
  if (!draft) return { error: "Návrh už neexistuje." };
  const title = String(formData.get("nazev") ?? "");
  const problem = titleError(title, "Název");
  if (problem) return { error: problem };
  let payload: unknown;
  try {
    payload = JSON.parse(String(formData.get("otazky") ?? ""));
  } catch {
    return { error: "Kvíz má nepovolenou podobu." };
  }
  if (!Array.isArray(payload) || payload.length === 0) return { error: "Kvíz potřebuje aspoň jednu otázku." };
  const drafts: QuestionDraft[] = [];
  for (const item of payload) {
    const parsed = parseDraftObject(item);
    if (!parsed.ok) return { error: parsed.error };
    const questionProblem = questionError(parsed.draft);
    if (questionProblem) return { error: questionProblem };
    drafts.push(parsed.draft);
  }
  const documents = drafts.flatMap((item) => [item.stem, ...item.options.map((option) => option.content)]);
  if (!(await imagesBelongToUser(user.id, documents))) return { error: "Obrázek do tohohle kvízu nepatří." };
  if (draft.folderId && !(await ownedFolder(user.id, draft.folderId))) {
    return { error: "Složka už neexistuje." };
  }
  const material = await createMaterialShell({
    userId: user.id,
    folderId: draft.folderId,
    type: "quiz",
    title: title.trim(),
  });
  const quiz = await prisma.quiz.findUnique({ where: { materialId: material.id } });
  if (!quiz) return { error: "Kvíz se nepodařilo uložit." };
  const replaceError = await replaceQuestions(quiz.id, drafts);
  if (replaceError) return { error: replaceError };
  await prisma.quizDraft.delete({ where: { id: draft.id } });
  redirect(`/kvizy/${material.id}`);
}

export async function discardDraftAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  await prisma.quizDraft.deleteMany({ where: { id: String(formData.get("navrh") ?? ""), userId: user.id } });
  redirect("/studovna");
}

function materialPath(type: string, id: string): string {
  if (type === "deck") return `/sady/${id}`;
  if (type === "quiz") return `/kvizy/${id}`;
  return `/poznamky/${id}`;
}

function parseDraft(formData: FormData): { ok: true; draft: QuestionDraft } | { ok: false; error: string } {
  let stem: unknown;
  let options: unknown;
  try {
    stem = JSON.parse(String(formData.get("zadani") ?? ""));
    options = JSON.parse(String(formData.get("moznosti") ?? "[]"));
  } catch {
    return { ok: false, error: "Otázka má nepovolenou podobu." };
  }
  return parseDraftObject({
    type: String(formData.get("typ") ?? ""),
    stem,
    options,
  });
}

function parseDraftObject(input: unknown): { ok: true; draft: QuestionDraft } | { ok: false; error: string } {
  if (!input || typeof input !== "object") return { ok: false, error: "Otázka má nepovolenou podobu." };
  const record = input as { type?: unknown; stem?: unknown; options?: unknown };
  const type = record.type;
  if (type !== "single" && type !== "multi" && type !== "boolean") {
    return { ok: false, error: "Neznámý typ otázky." };
  }
  const stem = parseDocument(record.stem);
  if (!stem.ok) return stem;
  if (!Array.isArray(record.options)) return { ok: false, error: "Otázka má nepovolenou podobu." };
  const options: QuestionDraft["options"] = [];
  for (const option of record.options) {
    if (!option || typeof option !== "object") return { ok: false, error: "Možnost má nepovolenou podobu." };
    const item = option as { content?: unknown; correct?: unknown };
    const content = parseDocument(item.content);
    if (!content.ok) return content;
    options.push({ content: content.document, correct: item.correct === true });
  }
  return { ok: true, draft: { type: type as QuestionType, stem: stem.document, options } };
}
