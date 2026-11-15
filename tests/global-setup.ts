import { execSync } from "node:child_process";

export default function setup() {
  execSync("pnpm exec prisma migrate deploy", {
    stdio: "inherit",
    env: {
      ...process.env,
      DATABASE_URL: "postgresql://studovna:studovna@127.0.0.1:5432/studovna_e2e",
    },
  });
}
