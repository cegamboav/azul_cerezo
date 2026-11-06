import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "../../..");

const result = spawnSync("npx", ["prisma", "generate"], {
  cwd: repoRoot,
  stdio: "inherit",
  shell: true,
});

process.exit(result.status ?? 1);
