export type Rankable = {
  id: string;
  dueAt: string;
  lapses: number;
  createdAt: string;
};

export function rankItems(items: Rankable[], now: Date, includeFuture: boolean): Rankable[] {
  const due: Rankable[] = [];
  const future: Rankable[] = [];
  const nowMs = now.getTime();
  for (const item of items) {
    if (new Date(item.dueAt).getTime() <= nowMs) due.push(item);
    else future.push(item);
  }
  due.sort((a, b) => compareDue(a, b, nowMs));
  future.sort(compareFuture);
  return includeFuture ? [...due, ...future] : due;
}

function compareDue(a: Rankable, b: Rankable, nowMs: number): number {
  if (b.lapses !== a.lapses) return b.lapses - a.lapses;
  const ageA = nowMs - new Date(a.dueAt).getTime();
  const ageB = nowMs - new Date(b.dueAt).getTime();
  if (ageB !== ageA) return ageB - ageA;
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

function compareFuture(a: Rankable, b: Rankable): number {
  if (b.lapses !== a.lapses) return b.lapses - a.lapses;
  if (a.dueAt !== b.dueAt) return a.dueAt < b.dueAt ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export function parentCreatesCycle(
  folders: { id: string; parentId: string | null }[],
  folderId: string,
  nextParentId: string | null,
): boolean {
  if (nextParentId === null) return false;
  if (nextParentId === folderId) return true;
  const byId = new Map(folders.map((folder) => [folder.id, folder]));
  let current: string | null = nextParentId;
  const seen = new Set<string>();
  while (current) {
    if (current === folderId || seen.has(current)) return true;
    seen.add(current);
    current = byId.get(current)?.parentId ?? null;
  }
  return false;
}

export function descendantIds(folders: { id: string; parentId: string | null }[], rootId: string): string[] {
  const result = [rootId];
  const queue = [rootId];
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;
    for (const folder of folders) {
      if (folder.parentId === current && !result.includes(folder.id)) {
        result.push(folder.id);
        queue.push(folder.id);
      }
    }
  }
  return result;
}
