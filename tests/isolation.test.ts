import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, expect, it } from "vitest";
import { ownedMaterial } from "../src/lib/access";
import { copySharedMaterial, createMaterialShell } from "../src/lib/materials";
import { hashPassword } from "../src/lib/password";
import { textDocument } from "../src/lib/document";
import { prisma } from "../src/lib/db";

const database = new PrismaClient();

beforeAll(async () => {
  await database.$executeRawUnsafe(`
    TRUNCATE TABLE
      "Attempt", "StudySession", "Option", "Question", "Card", "Quiz", "Deck", "Note",
      "QuizDraft", "Material", "Folder", "ImageAsset", "AccessGrant", "EmailToken", "Session", "User"
    RESTART IDENTITY CASCADE
  `);
});

afterAll(async () => {
  await database.$disconnect();
  await prisma.$disconnect();
});

it("keeps a copy independent and hides another user's material", async () => {
  const owner = await database.user.create({
    data: { email: "owner@example.com", passwordHash: await hashPassword("hesloheslo") },
  });
  const reader = await database.user.create({
    data: { email: "reader@example.com", passwordHash: await hashPassword("hesloheslo") },
  });
  const material = await createMaterialShell({ userId: owner.id, folderId: null, type: "deck", title: "Buňka" });
  const deck = await database.deck.findUniqueOrThrow({ where: { materialId: material.id } });
  await database.card.create({
    data: { deckId: deck.id, front: textDocument("líc"), back: textDocument("rub"), position: 0 },
  });
  await database.material.update({
    where: { id: material.id },
    data: { shareToken: "token-test", shareEnabled: true },
  });

  expect(await ownedMaterial(reader.id, material.id)).toBeNull();
  const copy = await copySharedMaterial(reader.id, "token-test");
  expect(copy?.ownerId).toBe(reader.id);
  expect(copy?.shareEnabled).toBe(false);

  await database.card.updateMany({ where: { deckId: deck.id }, data: { front: textDocument("změna") } });
  const copiedCard = await database.card.findFirstOrThrow({ where: { deck: { materialId: copy?.id } } });
  expect(JSON.stringify(copiedCard.front)).toContain("líc");
  expect(JSON.stringify(copiedCard.front)).not.toContain("změna");

  await database.material.update({ where: { id: material.id }, data: { shareEnabled: false } });
  expect(await copySharedMaterial(reader.id, "token-test")).toBeNull();

  const grant = await database.accessGrant.findFirst({
    where: { resourceType: "MATERIAL", resourceId: material.id, principalType: "USER", role: "OWNER" },
  });
  expect(grant?.principalId).toBe(owner.id);
  expect(material.listedInLibrary).toBe(false);
});
