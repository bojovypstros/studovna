export type Mark = "bold" | "italic" | "highlight";

export type Inline =
  | { type: "text"; text: string; marks?: Mark[] }
  | { type: "math"; latex: string };

export type Block =
  | { type: "paragraph"; inlines: Inline[] }
  | { type: "heading"; level: 1 | 2; inlines: Inline[] }
  | { type: "bulletList"; items: Inline[][] }
  | { type: "orderedList"; items: Inline[][] }
  | { type: "image"; imageId: string; alt: string; width?: number; height?: number };

export type StudyDocument = { version: 1; blocks: Block[] };

const marks = new Set<Mark>(["bold", "italic", "highlight"]);
const imageIdPattern = /^[a-f0-9]{32}$/;

export function emptyDocument(): StudyDocument {
  return { version: 1, blocks: [{ type: "paragraph", inlines: [] }] };
}

export function textDocument(text: string): StudyDocument {
  return {
    version: 1,
    blocks: [{ type: "paragraph", inlines: text ? [{ type: "text", text }] : [] }],
  };
}

export function parseDocument(input: unknown): { ok: true; document: StudyDocument } | { ok: false; error: string } {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, error: "Obsah má nepovolenou podobu." };
  }
  const record = input as Record<string, unknown>;
  if (record.version !== 1 || !Array.isArray(record.blocks)) {
    return { ok: false, error: "Obsah má nepovolenou podobu." };
  }
  if (record.blocks.length > 200) {
    return { ok: false, error: "Obsah je příliš dlouhý." };
  }
  const blocks: Block[] = [];
  for (const block of record.blocks) {
    const parsed = parseBlock(block);
    if (!parsed.ok) return parsed;
    blocks.push(parsed.block);
  }
  if (blocks.length === 0) blocks.push({ type: "paragraph", inlines: [] });
  return { ok: true, document: { version: 1, blocks } };
}

export function documentFromJson(raw: string): { ok: true; document: StudyDocument } | { ok: false; error: string } {
  try {
    return parseDocument(JSON.parse(raw));
  } catch {
    return { ok: false, error: "Obsah má nepovolenou podobu." };
  }
}

export function plainText(document: StudyDocument): string {
  const parts: string[] = [];
  for (const block of document.blocks) {
    if (block.type === "image") {
      if (block.alt) parts.push(block.alt);
      continue;
    }
    if (block.type === "bulletList" || block.type === "orderedList") {
      for (const item of block.items) parts.push(inlineText(item));
      continue;
    }
    parts.push(inlineText(block.inlines));
  }
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

export function imageIds(document: StudyDocument): string[] {
  const ids: string[] = [];
  for (const block of document.blocks) {
    if (block.type === "image") ids.push(block.imageId);
  }
  return ids;
}

export function mapImageIds(document: StudyDocument, map: (id: string) => string): StudyDocument {
  return {
    version: 1,
    blocks: document.blocks.map((block) =>
      block.type === "image" ? { ...block, imageId: map(block.imageId) } : block,
    ),
  };
}

function inlineText(inlines: Inline[]): string {
  return inlines
    .map((inline) => (inline.type === "text" ? inline.text : inline.latex))
    .join("");
}

function parseBlock(input: unknown): { ok: true; block: Block } | { ok: false; error: string } {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, error: "Obsah má nepovolenou podobu." };
  }
  const block = input as Record<string, unknown>;
  if (block.type === "paragraph" || block.type === "heading") {
    const inlines = parseInlines(block.inlines);
    if (!inlines.ok) return inlines;
    if (block.type === "heading") {
      if (block.level !== 1 && block.level !== 2) {
        return { ok: false, error: "Obsah má nepovolenou podobu." };
      }
      return { ok: true, block: { type: "heading", level: block.level, inlines: inlines.inlines } };
    }
    return { ok: true, block: { type: "paragraph", inlines: inlines.inlines } };
  }
  if (block.type === "bulletList" || block.type === "orderedList") {
    if (!Array.isArray(block.items) || block.items.length > 100) {
      return { ok: false, error: "Obsah má nepovolenou podobu." };
    }
    const items: Inline[][] = [];
    for (const item of block.items) {
      const inlines = parseInlines(item);
      if (!inlines.ok) return inlines;
      items.push(inlines.inlines);
    }
    return { ok: true, block: { type: block.type, items } };
  }
  if (block.type === "image") {
    if (typeof block.imageId !== "string" || !imageIdPattern.test(block.imageId)) {
      return { ok: false, error: "Obrázek má nepovolenou podobu." };
    }
    if (typeof block.alt !== "string" || block.alt.length > 200) {
      return { ok: false, error: "Popis obrázku je příliš dlouhý." };
    }
    const width = optionalSize(block.width);
    const height = optionalSize(block.height);
    if (width === "bad" || height === "bad") {
      return { ok: false, error: "Obrázek má nepovolenou podobu." };
    }
    return {
      ok: true,
      block: {
        type: "image",
        imageId: block.imageId,
        alt: block.alt,
        ...(width ? { width } : {}),
        ...(height ? { height } : {}),
      },
    };
  }
  return { ok: false, error: "Obsah má nepovolenou podobu." };
}

function optionalSize(value: unknown): number | undefined | "bad" {
  if (value === undefined) return undefined;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 8000) return "bad";
  return value;
}

function parseInlines(input: unknown): { ok: true; inlines: Inline[] } | { ok: false; error: string } {
  if (!Array.isArray(input) || input.length > 500) {
    return { ok: false, error: "Obsah má nepovolenou podobu." };
  }
  const inlines: Inline[] = [];
  for (const item of input) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return { ok: false, error: "Obsah má nepovolenou podobu." };
    }
    const inline = item as Record<string, unknown>;
    if (inline.type === "text") {
      if (typeof inline.text !== "string" || inline.text.length > 20000) {
        return { ok: false, error: "Obsah je příliš dlouhý." };
      }
      const parsedMarks = parseMarks(inline.marks);
      if (!parsedMarks.ok) return parsedMarks;
      if (inline.text.length === 0) continue;
      inlines.push(parsedMarks.marks.length ? { type: "text", text: inline.text, marks: parsedMarks.marks } : { type: "text", text: inline.text });
      continue;
    }
    if (inline.type === "math") {
      if (typeof inline.latex !== "string" || inline.latex.length === 0 || inline.latex.length > 2000) {
        return { ok: false, error: "Vzorec má nepovolenou podobu." };
      }
      inlines.push({ type: "math", latex: inline.latex });
      continue;
    }
    return { ok: false, error: "Obsah má nepovolenou podobu." };
  }
  return { ok: true, inlines };
}

function parseMarks(input: unknown): { ok: true; marks: Mark[] } | { ok: false; error: string } {
  if (input === undefined) return { ok: true, marks: [] };
  if (!Array.isArray(input)) return { ok: false, error: "Obsah má nepovolenou podobu." };
  const result: Mark[] = [];
  for (const mark of input) {
    if (typeof mark !== "string" || !marks.has(mark as Mark) || result.includes(mark as Mark)) {
      return { ok: false, error: "Obsah má nepovolenou podobu." };
    }
    result.push(mark as Mark);
  }
  return { ok: true, marks: result };
}
