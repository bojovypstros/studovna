import { percent } from "@/lib/format";
import { requireUser } from "@/lib/session";
import { studyStats } from "@/lib/stats";

export default async function StatsPage() {
  const user = await requireUser();
  const stats = await studyStats(user.id);
  const rows = [
    ["Složky", stats.folders],
    ["Sady", stats.decks],
    ["Kartičky", stats.cards],
    ["Kvízy", stats.quizzes],
    ["Otázky", stats.questions],
    ["Poznámky", stats.notes],
    ["Pokusy", stats.attempts],
  ] as const;
  return (
    <section className="stack">
      <h1>Statistiky</h1>
      <p className="hint">Počty, úspěšnost a kartičky k zopakování. Úspěch je hodnocení Vím nebo správná odpověď.</p>
      <ul className="summary">
        {rows.map(([label, value]) => (
          <li key={label}>
            {label}: {value}
          </li>
        ))}
        <li>Úspěšnost: {stats.successRate === null ? "zatím žádné pokusy" : percent(stats.successRate)}</li>
        <li>Kartičky k zopakování: {stats.dueCards}</li>
      </ul>
    </section>
  );
}
