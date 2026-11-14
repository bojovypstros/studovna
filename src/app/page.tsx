import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";

export default async function HomePage() {
  const user = await getCurrentUser();
  if (user) redirect("/studovna");
  return (
    <section className="stack">
      <h1>Studovna</h1>
      <p>Osobní studovna pro střední a vysoké školy. Účet, vlastní materiály a procvičování.</p>
      <p className="choices">
        <a className="button" href="/registrace">
          Vytvořit účet
        </a>
        <a className="button quiet" href="/prihlaseni">
          Přihlásit se
        </a>
      </p>
    </section>
  );
}
