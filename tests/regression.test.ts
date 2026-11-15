import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseDocument, textDocument } from "../src/lib/document";
import { mailFrom, sendMail } from "../src/lib/mail";
import { emailError, passwordError } from "../src/lib/password";
import { draftsFromCards, answerMatches, questionError } from "../src/lib/quiz";
import { parentCreatesCycle, rankItems } from "../src/lib/recommend";
import { formatWhen } from "../src/lib/format";
import { applySm2, initialSm2 } from "../src/lib/sm2";

const now = new Date("2026-11-14T12:00:00.000Z");

describe("časy relací", () => {
  it("ukazuje Europe/Prague, včetně letního času", () => {
    expect(formatWhen(new Date("2026-01-15T23:30:00.000Z"))).toBe("16. 1. 2026 0:30");
    expect(formatWhen(new Date("2026-07-15T22:30:00.000Z"))).toBe("16. 7. 2026 0:30");
  });
});

describe("SM-2", () => {
  it("maps Nevím to an immediate reset and a lower ease", () => {
    const next = applySm2(initialSm2(now), 0, now);
    expect(next.repetitions).toBe(0);
    expect(next.intervalDays).toBe(0);
    expect(next.lapses).toBe(1);
    expect(new Date(next.dueAt).getTime() - now.getTime()).toBe(10 * 60 * 1000);
    expect(next.easeFactor).toBeCloseTo(1.7, 5);
  });

  it("floors ease at 1.3", () => {
    const once = applySm2(initialSm2(now), 0, now);
    const twice = applySm2(once, 0, now);
    expect(twice.easeFactor).toBe(1.3);
  });

  it("uses the standard success intervals for Znovu and Vím", () => {
    const again = applySm2(initialSm2(now), 3, now);
    expect(again.intervalDays).toBe(1);
    expect(again.repetitions).toBe(1);
    expect(again.easeFactor).toBeCloseTo(2.36, 5);
    const againSecond = applySm2(again, 3, now);
    expect(againSecond.intervalDays).toBe(6);

    const known = applySm2(initialSm2(now), 4, now);
    expect(known.easeFactor).toBeCloseTo(2.5, 5);
    expect(known.intervalDays).toBe(1);
    const second = applySm2(known, 4, now);
    expect(second.intervalDays).toBe(6);
    const third = applySm2(second, 4, now);
    expect(third.intervalDays).toBe(15);
    expect(new Date(known.dueAt).getTime() - now.getTime()).toBe(24 * 60 * 60 * 1000);
  });
});

describe("pořadí úloh", () => {
  const items = [
    { id: "a", dueAt: "2026-11-13T12:00:00.000Z", lapses: 0, createdAt: "2026-11-01T00:00:00.000Z" },
    { id: "b", dueAt: "2026-11-10T12:00:00.000Z", lapses: 2, createdAt: "2026-11-02T00:00:00.000Z" },
    { id: "c", dueAt: "2026-11-20T12:00:00.000Z", lapses: 5, createdAt: "2026-11-03T00:00:00.000Z" },
    { id: "d", dueAt: "2026-11-12T12:00:00.000Z", lapses: 2, createdAt: "2026-11-04T00:00:00.000Z" },
  ];

  it("ranks failures first and then older due dates, skipping the future", () => {
    expect(rankItems(items, now, false).map((item) => item.id)).toEqual(["b", "d", "a"]);
  });

  it("keeps future items after due ones when a whole set is practiced", () => {
    expect(rankItems(items, now, true).map((item) => item.id)).toEqual(["b", "d", "a", "c"]);
  });
});

describe("složky", () => {
  const folders = [
    { id: "root", parentId: null },
    { id: "child", parentId: "root" },
    { id: "leaf", parentId: "child" },
  ];

  it("rejects a move into itself or a descendant", () => {
    expect(parentCreatesCycle(folders, "root", "leaf")).toBe(true);
    expect(parentCreatesCycle(folders, "child", "child")).toBe(true);
    expect(parentCreatesCycle(folders, "leaf", "root")).toBe(false);
    expect(parentCreatesCycle(folders, "leaf", null)).toBe(false);
  });
});

describe("kvíz", () => {
  const cards = [
    { front: textDocument("mitochondrie"), back: textDocument("energie") },
    { front: textDocument("jádro"), back: textDocument("DNA") },
  ];

  it("turns a front into the prompt and other backs into distractors", () => {
    const result = draftsFromCards(cards, "single");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.drafts[0]?.stem).toEqual(cards[0]?.front);
    expect(result.drafts[0]?.options.filter((option) => option.correct)).toEqual([{ content: cards[0]?.back, correct: true }]);
    expect(result.drafts[0]?.options.some((option) => option.content.blocks[0] && JSON.stringify(option.content).includes("DNA"))).toBe(true);
  });

  it("builds true and false statements", () => {
    const result = draftsFromCards(cards, "boolean");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.drafts.map((draft) => draft.options.find((option) => option.correct)?.content.blocks[0])).toEqual([
      textDocument("Pravda").blocks[0],
      textDocument("Nepravda").blocks[0],
      textDocument("Pravda").blocks[0],
      textDocument("Nepravda").blocks[0],
    ]);
  });

  it("scores multiple answers only on an exact match", () => {
    const options = [
      { id: "a", correct: true },
      { id: "b", correct: true },
      { id: "c", correct: false },
    ];
    expect(answerMatches(options, ["a", "b"])).toBe(true);
    expect(answerMatches(options, ["b", "a"])).toBe(true);
    expect(answerMatches(options, ["a"])).toBe(false);
    expect(answerMatches(options, ["a", "b", "c"])).toBe(false);
    expect(questionError({ type: "multi", stem: textDocument("x"), options: [{ content: textDocument("a"), correct: true }, { content: textDocument("b"), correct: false }] })).toMatch(/dvě správné/);
  });
});

describe("dokument", () => {
  it("accepts the structured document and rejects arbitrary markup", () => {
    expect(parseDocument(textDocument("ahoj")).ok).toBe(true);
    expect(parseDocument({ version: 1, blocks: [{ type: "html", html: "<script>" }] }).ok).toBe(false);
    expect(parseDocument({ version: 2, blocks: [] }).ok).toBe(false);
  });
});

describe("heslo a pošta", () => {
  it("asks only for length", () => {
    expect(passwordError("kratke")).toMatch(/8 až 128/);
    expect(passwordError("a".repeat(8))).toBeNull();
    expect(passwordError("a".repeat(129))).toMatch(/8 až 128/);
    expect(emailError("ne")).toBeTruthy();
    expect(emailError("a@b.cz")).toBeNull();
  });

  it("sends from the Studovna address, not the SMTP login", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "studovna-mail-"));
    const previousHost = process.env.SMTP_HOST;
    const previousFrom = process.env.MAIL_FROM;
    const previousUser = process.env.SMTP_USER;
    process.env.SMTP_HOST = "capture";
    process.env.MAIL_FROM = "Studovna <edu@combatostrich.dev>";
    process.env.SMTP_USER = "smtp-login@combatostrich.dev";
    const cwd = process.cwd();
    process.chdir(directory);
    try {
      await sendMail({ to: "student@example.com", subject: "Zkouška", text: "Text" });
      const names = await readdir(path.join(directory, "tmp", "mail"));
      const file = await readFile(path.join(directory, "tmp", "mail", names[0] ?? ""), "utf8");
      const message = JSON.parse(file) as { from: string; to: string };
      expect(message.from).toBe(mailFrom());
      expect(message.from).not.toContain("smtp-login");
      expect(message.to).toBe("student@example.com");
    } finally {
      process.chdir(cwd);
      process.env.SMTP_HOST = previousHost;
      process.env.MAIL_FROM = previousFrom;
      process.env.SMTP_USER = previousUser;
      await rm(directory, { recursive: true, force: true });
    }
  });
});
