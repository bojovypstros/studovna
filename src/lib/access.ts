import { prisma } from "@/lib/db";
import { imageIds, type StudyDocument } from "@/lib/document";

export async function grantOwner(resourceType: "FOLDER" | "MATERIAL", resourceId: string, userId: string) {
  await prisma.accessGrant.create({
    data: {
      principalType: "USER",
      principalId: userId,
      resourceType,
      resourceId,
      role: "OWNER",
    },
  });
}

export async function ownedFolder(userId: string, folderId: string) {
  return prisma.folder.findFirst({ where: { id: folderId, ownerId: userId } });
}

export async function ownedMaterial(userId: string, materialId: string) {
  return prisma.material.findFirst({ where: { id: materialId, ownerId: userId } });
}

export async function imagesBelongToUser(userId: string, documents: StudyDocument[]): Promise<boolean> {
  const ids = [...new Set(documents.flatMap(imageIds))];
  if (ids.length === 0) return true;
  const found = await prisma.imageAsset.count({ where: { ownerId: userId, id: { in: ids } } });
  return found === ids.length;
}

export function safeNextPath(value: string | null | undefined): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\") || value.includes("://")) {
    return null;
  }
  return value;
}

export function titleError(value: string, label: string): string | null {
  const title = value.trim();
  if (title.length < 1 || title.length > 120) return `${label} musí mít 1 až 120 znaků.`;
  return null;
}
