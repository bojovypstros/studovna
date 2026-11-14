import { textDocument, type StudyDocument } from "@/lib/document";

export type QuestionType = "single" | "multi" | "boolean";

export type QuestionDraft = {
  type: QuestionType;
  stem: StudyDocument;
  options: { content: StudyDocument; correct: boolean }[];
};

export function draftsFromCards(
  cards: { front: StudyDocument; back: StudyDocument }[],
  type: "single" | "boolean",
): { ok: true; drafts: QuestionDraft[] } | { ok: false; error: string } {
  if (cards.length === 0) return { ok: false, error: "Vyberte aspoň jednu kartičku." };
  if (type === "boolean" && cards.length < 2) {
    return { ok: false, error: "Pravda a nepravda potřebuje aspoň dvě kartičky." };
  }
  if (type === "single") {
    return {
      ok: true,
      drafts: cards.map((card, index) => {
        const distractors = cards
          .filter((_, other) => other !== index)
          .slice(0, 3)
          .map((other) => ({ content: other.back, correct: false }));
        return {
          type: "single" as const,
          stem: card.front,
          options: [{ content: card.back, correct: true }, ...distractors],
        };
      }),
    };
  }
  const drafts: QuestionDraft[] = [];
  cards.forEach((card, index) => {
    drafts.push({
      type: "boolean",
      stem: statement(card.front, card.back),
      options: truthOptions(true),
    });
    const other = cards[(index + 1) % cards.length];
    if (!other) return;
    drafts.push({
      type: "boolean",
      stem: statement(card.front, other.back),
      options: truthOptions(false),
    });
  });
  return { ok: true, drafts };
}

export function questionError(draft: QuestionDraft): string | null {
  if (draft.type === "boolean") {
    const correct = draft.options.filter((option) => option.correct);
    if (draft.options.length !== 2 || correct.length !== 1) {
      return "Pravda a nepravda potřebuje právě jednu správnou možnost.";
    }
    return null;
  }
  if (draft.options.length < 2) return "Otázka potřebuje aspoň dvě možnosti.";
  const correctCount = draft.options.filter((option) => option.correct).length;
  if (draft.type === "single" && correctCount !== 1) {
    return "Otázka s jednou správnou odpovědí potřebuje právě jednu správnou možnost.";
  }
  if (draft.type === "multi" && correctCount < 2) {
    return "Otázka s více správnými odpověďmi potřebuje aspoň dvě správné možnosti.";
  }
  return null;
}

export function answerMatches(
  options: { id: string; correct: boolean }[],
  selectedIds: string[],
): boolean {
  const known = new Set(options.map((option) => option.id));
  if (selectedIds.some((id) => !known.has(id))) return false;
  const correct = options.filter((option) => option.correct).map((option) => option.id);
  const selected = new Set(selectedIds);
  if (selected.size !== correct.length) return false;
  return correct.every((id) => selected.has(id));
}

function statement(front: StudyDocument, back: StudyDocument): StudyDocument {
  return {
    version: 1,
    blocks: [
      ...front.blocks,
      { type: "paragraph", inlines: [{ type: "text", text: "Uvedený rub:" }] },
      ...back.blocks,
    ],
  };
}

function truthOptions(truth: boolean): QuestionDraft["options"] {
  return [
    { content: textDocument("Pravda"), correct: truth },
    { content: textDocument("Nepravda"), correct: !truth },
  ];
}
