# Studovna

Osobní studovna: účet, složky, kartičky, kvízy, poznámky, opakování SM-2, studijní režim a statistiky.

Nginx a SSL nejsou součástí aplikace. Na `/var/webserver/edu.combatostrich.dev` se odsud nic nenahrává.

## Spuštění

```bash
pnpm install
cp .env.example .env
docker compose up --build
```

Bez Dockeru stačí PostgreSQL a:

```bash
pnpm exec prisma migrate deploy
pnpm dev
```

## Pošta

`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` a `SMTP_AUTH` jsou přihlášení k poštovnímu serveru. `MAIL_FROM` je odesílatel `Studovna <edu@combatostrich.dev>` a není to účet, kterým se uživatel hlásí do Studovny. `SMTP_AUTH=false` pošle zprávu bez autentizace. Hesla patří jen do `.env`, ne do gitu.

## Testy

```bash
pnpm test
pnpm test:ui
```
