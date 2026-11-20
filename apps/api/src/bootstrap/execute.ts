import type { PrismaClient } from "@azul/database";
import { parseBootstrapArgs } from "./args.js";
import {
  ALREADY_INITIALIZED,
  CONFIRMATION_REQUIRED,
  runBootstrap,
  type BootstrapRunOptions,
} from "./identity.js";

const SAFE_MESSAGES = new Set([
  "Falta DATABASE_URL.",
  "DATABASE_URL debe usar PostgreSQL.",
]);

export interface BootstrapIO {
  openDatabase?: () => PrismaClient;
  stdout?: (message: string) => void;
  stderr?: (message: string) => void;
  run?: BootstrapRunOptions;
}

export function formatBootstrapSuccess(input: {
  company: string;
  owner: string;
  temporaryPassword: string;
}): string {
  return [
    "Bootstrap completed successfully.",
    "",
    `Company: ${input.company}`,
    `Owner: ${input.owner}`,
    "Role: OWNER",
    "",
    "Temporary password:",
    input.temporaryPassword,
    "",
    "You must change this password on first login.",
    "",
  ].join("\n");
}

export async function executeBootstrap(
  argv: readonly string[],
  io: BootstrapIO = {},
): Promise<number> {
  const parsed = parseBootstrapArgs(argv);
  if (!parsed.ok) {
    io.stderr?.(`${parsed.message}\n`);
    return 1;
  }
  if (!parsed.value.confirm) {
    io.stderr?.(`${CONFIRMATION_REQUIRED}\n`);
    return 1;
  }
  if (!io.openDatabase) {
    io.stderr?.("Bootstrap failed.\n");
    return 1;
  }

  let prisma: PrismaClient;
  try {
    prisma = io.openDatabase();
  } catch (error) {
    io.stderr?.(`${publicFailure(error)}\n`);
    return 1;
  }

  try {
    const result = await runBootstrap(parsed.value, prisma, io.run);
    if (result.status === "aborted") {
      io.stderr?.(`${ALREADY_INITIALIZED}\n`);
      return 1;
    }
    io.stdout?.(
      formatBootstrapSuccess({
        company: `${result.tradeName} (${result.slug})`,
        owner: result.ownerEmail,
        temporaryPassword: result.temporaryPassword,
      }),
    );
    return 0;
  } catch (error) {
    io.stderr?.(`${publicFailure(error)}\n`);
    return 1;
  } finally {
    await prisma.$disconnect();
  }
}

function publicFailure(error: unknown): string {
  if (error instanceof Error && SAFE_MESSAGES.has(error.message)) {
    return error.message;
  }
  return "Bootstrap failed.";
}
