import type { ReactNode } from "react";
import katex from "katex";
import type { Block, Inline, StudyDocument } from "@/lib/document";

export function DocumentView({
  document,
  shareToken,
}: {
  document: StudyDocument;
  shareToken?: string;
}) {
  return (
    <div className="document">
      {document.blocks.map((block, index) => (
        <BlockView key={index} block={block} shareToken={shareToken} />
      ))}
    </div>
  );
}

function BlockView({ block, shareToken }: { block: Block; shareToken?: string }) {
  if (block.type === "heading") {
    const Tag = block.level === 1 ? "h2" : "h3";
    return (
      <Tag>
        <Inlines inlines={block.inlines} />
      </Tag>
    );
  }
  if (block.type === "bulletList" || block.type === "orderedList") {
    const Tag = block.type === "bulletList" ? "ul" : "ol";
    return (
      <Tag>
        {block.items.map((item, index) => (
          <li key={index}>
            <Inlines inlines={item} />
          </li>
        ))}
      </Tag>
    );
  }
  if (block.type === "image") {
    const query = shareToken ? `?sdileni=${encodeURIComponent(shareToken)}` : "";
    return (
      <figure>
        {/* User images have no known display size until the editor stored one. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/api/obrazky/${block.imageId}${query}`}
          alt={block.alt}
          width={block.width}
          height={block.height}
          loading="lazy"
        />
      </figure>
    );
  }
  return (
    <p>
      <Inlines inlines={block.inlines} />
    </p>
  );
}

function Inlines({ inlines }: { inlines: Inline[] }) {
  return (
    <>
      {inlines.map((inline, index) => {
        if (inline.type === "math") {
          const html = katex.renderToString(inline.latex, {
            throwOnError: false,
            trust: false,
            strict: "ignore",
          });
          return <span key={index} dangerouslySetInnerHTML={{ __html: html }} />;
        }
        let node: ReactNode = inline.text;
        const marks = inline.marks ?? [];
        if (marks.includes("highlight")) node = <mark>{node}</mark>;
        if (marks.includes("italic")) node = <em>{node}</em>;
        if (marks.includes("bold")) node = <strong>{node}</strong>;
        return <span key={index}>{node}</span>;
      })}
    </>
  );
}
