import { copyFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export function storageDir(): string {
  return process.env.STORAGE_DIR || path.join(process.cwd(), "storage");
}

export function imagePath(id: string): string {
  return path.join(/*turbopackIgnore: true*/ storageDir(), id);
}

export async function saveImageFile(id: string, bytes: Buffer): Promise<void> {
  await mkdir(storageDir(), { recursive: true });
  await writeFile(imagePath(id), bytes);
}

export async function copyImageFile(fromId: string, toId: string): Promise<void> {
  await mkdir(storageDir(), { recursive: true });
  await copyFile(imagePath(fromId), imagePath(toId));
}

const allowed = new Map([
  ["image/jpeg", "jpeg"],
  ["image/png", "png"],
  ["image/gif", "gif"],
  ["image/webp", "webp"],
]);

export function allowedImageMime(mime: string): boolean {
  return allowed.has(mime);
}
