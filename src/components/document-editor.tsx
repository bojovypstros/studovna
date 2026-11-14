"use client";

import { useEffect, useRef, useState } from "react";
import { emptyDocument, type Block, type Inline, type Mark, type StudyDocument } from "@/lib/document";

export function DocumentEditor({
  label,
  value,
  onChange,
}: {
  label: string;
  value: StudyDocument;
  onChange: (document: StudyDocument) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = useState("");

  function updateBlock(index: number, block: Block) {
    const blocks = value.blocks.map((item, itemIndex) => (itemIndex === index ? block : item));
    onChange({ version: 1, blocks });
  }

  function removeBlock(index: number) {
    const blocks = value.blocks.filter((_, itemIndex) => itemIndex !== index);
    onChange({ version: 1, blocks: blocks.length ? blocks : emptyDocument().blocks });
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    setUploadError("");
    const body = new FormData();
    body.set("soubor", file);
    const response = await fetch("/api/obrazky", { method: "POST", body });
    if (!response.ok) {
      setUploadError(await response.text());
      return;
    }
    const data = (await response.json()) as { id: string; width?: number; height?: number };
    onChange({
      version: 1,
      blocks: [
        ...value.blocks,
        {
          type: "image",
          imageId: data.id,
          alt: file.name.slice(0, 200),
          ...(data.width ? { width: data.width } : {}),
          ...(data.height ? { height: data.height } : {}),
        },
      ],
    });
  }

  return (
    <fieldset className="editor">
      <legend>{label}</legend>
      {value.blocks.map((block, index) => (
        <BlockEditor
          key={`${label}-${index}`}
          block={block}
          label={label}
          onChange={(next) => updateBlock(index, next)}
          onRemove={() => removeBlock(index)}
        />
      ))}
      <div className="toolbar">
        <button type="button" onClick={() => onChange({ version: 1, blocks: [...value.blocks, { type: "paragraph", inlines: [] }] })}>
          Přidat odstavec
        </button>
        <button type="button" onClick={() => fileRef.current?.click()}>
          Vložit obrázek
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          hidden
          onChange={(event) => {
            void onFile(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
      </div>
      {uploadError ? (
        <p role="alert" className="notice">
          {uploadError}
        </p>
      ) : null}
    </fieldset>
  );
}

function BlockEditor({
  block,
  label,
  onChange,
  onRemove,
}: {
  block: Block;
  label: string;
  onChange: (block: Block) => void;
  onRemove: () => void;
}) {
  if (block.type === "image") {
    return (
      <div className="block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/api/obrazky/${block.imageId}`} alt={block.alt} width={block.width} height={block.height} />
        <div className="field">
          <label>
            Popis obrázku
            <input
              value={block.alt}
              maxLength={200}
              onChange={(event) => onChange({ ...block, alt: event.target.value })}
            />
          </label>
        </div>
        <button type="button" onClick={onRemove}>
          Odebrat obrázek
        </button>
      </div>
    );
  }

  const inlines = block.type === "bulletList" || block.type === "orderedList" ? block.items[0] ?? [] : block.inlines;
  return (
    <div className="block">
      <div className="toolbar" role="toolbar" aria-label={`Nástroje bloku: ${label}`}>
        <button type="button" onClick={() => onChange(asParagraph(block))}>
          Odstavec
        </button>
        <button type="button" onClick={() => onChange(asHeading(block, 1))}>
          Nadpis
        </button>
        <button type="button" onClick={() => onChange(asHeading(block, 2))}>
          Podnadpis
        </button>
        <button type="button" onClick={() => onChange(asList(block, "bulletList"))}>
          Odrážky
        </button>
        <button type="button" onClick={() => onChange(asList(block, "orderedList"))}>
          Číslování
        </button>
        <button type="button" onClick={onRemove}>
          Odebrat blok
        </button>
      </div>
      {block.type === "bulletList" || block.type === "orderedList" ? (
        <div className="list-items">
          {block.items.map((item, index) => (
            <InlineEditor
              key={index}
              label={`${label}, položka ${index + 1}`}
              value={item}
              onChange={(next) => {
                const items = block.items.map((current, itemIndex) => (itemIndex === index ? next : current));
                onChange({ ...block, items });
              }}
            />
          ))}
          <button type="button" onClick={() => onChange({ ...block, items: [...block.items, []] })}>
            Přidat položku
          </button>
        </div>
      ) : (
        <InlineEditor label={label} value={inlines} onChange={(next) => onChange({ ...block, inlines: next })} />
      )}
    </div>
  );
}

function InlineEditor({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Inline[];
  onChange: (inlines: Inline[]) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const last = useRef("");
  const [latex, setLatex] = useState("");

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const serialized = JSON.stringify(value);
    if (serialized === last.current || document.activeElement === element) return;
    paintInlines(element, value);
    last.current = serialized;
  }, [value]);

  function emit() {
    const element = ref.current;
    if (!element) return;
    const next = domToInlines(element);
    last.current = JSON.stringify(next);
    onChange(next);
  }

  function insertMath() {
    const element = ref.current;
    const formula = latex.trim();
    if (!element || !formula) return;
    const span = document.createElement("span");
    span.dataset.math = formula;
    span.contentEditable = "false";
    span.textContent = formula;
    element.append(span);
    setLatex("");
    emit();
  }

  return (
    <div className="inline-wrap">
      <div className="toolbar">
        <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => applyMark(ref.current, "bold", emit)}>
          Tučné
        </button>
        <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => applyMark(ref.current, "italic", emit)}>
          Kurzíva
        </button>
        <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => applyMark(ref.current, "highlight", emit)}>
          Zvýraznění
        </button>
        <label>
          Vzorec
          <input
            value={latex}
            onChange={(event) => setLatex(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                insertMath();
              }
            }}
            aria-label={`Vzorec v poli ${label}`}
          />
        </label>
        <button type="button" onClick={insertMath}>
          Vložit vzorec
        </button>
      </div>
      <div
        ref={ref}
        role="textbox"
        aria-multiline="true"
        aria-label={label}
        contentEditable
        className="inline-editor"
        onInput={emit}
        suppressContentEditableWarning
      />
    </div>
  );
}

function asParagraph(block: Block): Block {
  return { type: "paragraph", inlines: firstInlines(block) };
}

function asHeading(block: Block, level: 1 | 2): Block {
  return { type: "heading", level, inlines: firstInlines(block) };
}

function asList(block: Block, type: "bulletList" | "orderedList"): Block {
  if (block.type === "bulletList" || block.type === "orderedList") return { type, items: block.items };
  return { type, items: [firstInlines(block)] };
}

function firstInlines(block: Block): Inline[] {
  if (block.type === "image") return [];
  if (block.type === "bulletList" || block.type === "orderedList") return block.items[0] ?? [];
  return block.inlines;
}

function applyMark(editor: HTMLDivElement | null, mark: Mark, emit: () => void) {
  if (!editor) return;
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return;
  const range = selection.getRangeAt(0);
  if (!editor.contains(range.commonAncestorContainer)) return;
  const tag = mark === "bold" ? "strong" : mark === "italic" ? "em" : "mark";
  const element = document.createElement(tag);
  try {
    range.surroundContents(element);
  } catch {
    element.append(range.extractContents());
    range.insertNode(element);
  }
  selection.removeAllRanges();
  emit();
}

function paintInlines(parent: HTMLElement, inlines: Inline[]) {
  parent.replaceChildren();
  for (const inline of inlines) {
    if (inline.type === "math") {
      const span = document.createElement("span");
      span.dataset.math = inline.latex;
      span.contentEditable = "false";
      span.textContent = inline.latex;
      parent.append(span);
      continue;
    }
    let node: Node = document.createTextNode(inline.text);
    for (const mark of [...(inline.marks ?? [])].reverse()) {
      const element = document.createElement(mark === "bold" ? "strong" : mark === "italic" ? "em" : "mark");
      element.append(node);
      node = element;
    }
    parent.append(node);
  }
}

function domToInlines(root: HTMLElement): Inline[] {
  const inlines: Inline[] = [];
  const walk = (node: Node, marks: Mark[]) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent ?? "";
      if (text) inlines.push(marks.length ? { type: "text", text, marks: [...marks] } : { type: "text", text });
      return;
    }
    if (!(node instanceof HTMLElement)) return;
    if (node.dataset.math) {
      inlines.push({ type: "math", latex: node.dataset.math });
      return;
    }
    const next = [...marks];
    const name = node.tagName;
    if ((name === "STRONG" || name === "B") && !next.includes("bold")) next.push("bold");
    if ((name === "EM" || name === "I") && !next.includes("italic")) next.push("italic");
    if (name === "MARK" && !next.includes("highlight")) next.push("highlight");
    for (const child of node.childNodes) walk(child, next);
  };
  for (const child of root.childNodes) walk(child, []);
  return inlines;
}
