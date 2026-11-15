import Link from "next/link";

export default function NotFound() {
  return (
    <section className="stack">
      <h1>Tahle stránka ve Studovně není</h1>
      <p>
        <Link href="/">Zpět na začátek</Link>
      </p>
    </section>
  );
}
