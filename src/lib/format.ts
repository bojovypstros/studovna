export function formatWhen(date: Date): string {
  return new Intl.DateTimeFormat("cs-CZ", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Prague",
  }).format(date);
}

export function percent(rate: number): string {
  return `${Math.round(rate * 100)} %`;
}
