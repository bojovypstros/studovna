export type Sm2State = {
  easeFactor: number;
  repetitions: number;
  intervalDays: number;
  dueAt: string;
  lapses: number;
};

export type CardRating = "nevim" | "znovu" | "vim";
export type Sm2Grade = 0 | 3 | 4;

export const NEVIM_DELAY_MS = 10 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export function initialSm2(now: Date): Sm2State {
  return {
    easeFactor: 2.5,
    repetitions: 0,
    intervalDays: 0,
    dueAt: now.toISOString(),
    lapses: 0,
  };
}

export function gradeForRating(rating: CardRating): Sm2Grade {
  if (rating === "nevim") return 0;
  if (rating === "znovu") return 3;
  return 4;
}

/** Standardní krok ze zdrojáku SuperMemo 2. Nevím má odstup 0 a termín za 10 minut. */
export function applySm2(state: Sm2State, grade: Sm2Grade, now: Date): Sm2State {
  let easeFactor = state.easeFactor;
  let repetitions = state.repetitions;
  let intervalDays = state.intervalDays;
  let lapses = state.lapses;

  if (grade >= 3) {
    if (repetitions === 0) {
      intervalDays = 1;
      repetitions = 1;
    } else if (repetitions === 1) {
      intervalDays = 6;
      repetitions = 2;
    } else {
      intervalDays = Math.max(1, Math.round(intervalDays * easeFactor));
      repetitions += 1;
    }
  } else {
    repetitions = 0;
    intervalDays = 0;
    lapses += 1;
  }

  easeFactor = easeFactor + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02));
  if (easeFactor < 1.3) easeFactor = 1.3;

  const dueAt = new Date(now.getTime() + (grade < 3 ? NEVIM_DELAY_MS : intervalDays * DAY_MS));
  return { easeFactor, repetitions, intervalDays, dueAt: dueAt.toISOString(), lapses };
}

export function intervalLabel(state: Sm2State, rating: CardRating, now: Date): string {
  const next = applySm2(state, gradeForRating(rating), now);
  return formatDelay(new Date(next.dueAt).getTime() - now.getTime());
}

export function formatDelay(ms: number): string {
  if (ms <= 10 * 60 * 1000) return "za 10 minut";
  const days = Math.round(ms / DAY_MS);
  if (days <= 1) return "za 1 den";
  if (days < 5) return `za ${days} dny`;
  return `za ${days} dní`;
}
