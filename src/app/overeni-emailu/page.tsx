export default async function VerifyPage({ searchParams }: { searchParams: Promise<{ stav?: string }> }) {
  const query = await searchParams;
  const done = query.stav === "hotovo";
  return (
    <section className="stack">
      <h1>{done ? "E-mail je ověřený" : "Odkaz neplatí"}</h1>
      <p>{done ? "Můžete pokračovat do studovny." : "Požádejte o nový ověřovací odkaz ve studovně."}</p>
      <p>
        <a href={done ? "/studovna" : "/prihlaseni"}>Pokračovat</a>
      </p>
    </section>
  );
}
