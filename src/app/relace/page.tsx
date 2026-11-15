import { logoutAction, revokeSessionAction } from "@/lib/actions/auth";
import { prisma } from "@/lib/db";
import { formatWhen } from "@/lib/format";
import { browserLabel, requireUser } from "@/lib/session";

export default async function SessionsPage() {
  const user = await requireUser();
  const sessions = await prisma.session.findMany({
    where: { userId: user.id },
    orderBy: { lastSeenAt: "desc" },
  });
  return (
    <section className="stack">
      <h1>Relace</h1>
      <p className="hint">Účet {user.email}. Tady vidíte, odkud jste přihlášeni, a můžete cizí relaci zrušit.</p>
      <ul className="materials">
        {sessions.map((session) => {
          const current = session.id === user.sessionId;
          return (
            <li key={session.id} className="panel stack">
              <p>
                {browserLabel(session.userAgent)}
                {current ? " · Tohle je aktuální relace" : ""}
              </p>
              <p>Vznik: {formatWhen(session.createdAt)}</p>
              <p>Poslední aktivita: {formatWhen(session.lastSeenAt)}</p>
              {current ? (
                <form action={logoutAction}>
                  <button type="submit">Odhlásit</button>
                </form>
              ) : (
                <form action={revokeSessionAction}>
                  <input type="hidden" name="relace" value={session.id} />
                  <button type="submit">Zrušit relaci</button>
                </form>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
