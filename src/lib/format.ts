export function formatWhen(date: Date): string {
  return new Intl.DateTimeFormat("cs-CZ", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export function percent(rate: number): string {
  return `${Math.round(rate * 100)} %`;
}
