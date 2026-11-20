import { spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import net from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import EmbeddedPostgres from "embedded-postgres";

const CLUSTER_USER = "postgres";
const CLUSTER_PASSWORD = "postgres";
const START_ATTEMPTS = 3;
const STOP_TIMEOUT_MS = 8000;
const REMOVE_DELAYS_MS = [50, 100, 200, 400, 800, 1000, 1000, 1000];

export interface EmbeddedCluster {
  postgres: EmbeddedPostgres;
  dataDir: string;
  port: number;
  connectionString: string;
}

const cleanups = new WeakMap<EmbeddedCluster, Promise<void>>();

export async function createEmbeddedCluster(input: {
  databaseName: string;
  dataDirPrefix: string;
}): Promise<EmbeddedCluster> {
  let lastError: unknown;
  let lastLogs = "";
  for (let attempt = 0; attempt < START_ATTEMPTS; attempt += 1) {
    const started = await startOnce(input);
    if (started.ok) {
      return started.cluster;
    }
    lastError = started.error;
    lastLogs = started.logs;
  }
  throw new Error(
    `No se pudo iniciar PostgreSQL de prueba.\n${lastLogs}`,
    { cause: lastError },
  );
}

export function destroyEmbeddedCluster(
  cluster: EmbeddedCluster | undefined,
): Promise<void> {
  if (!cluster) {
    return Promise.resolve();
  }
  const existing = cleanups.get(cluster);
  if (existing) {
    return existing;
  }
  const pending = destroyOnce(cluster);
  cleanups.set(cluster, pending);
  return pending;
}

async function startOnce(input: {
  databaseName: string;
  dataDirPrefix: string;
}): Promise<
  | { ok: true; cluster: EmbeddedCluster }
  | { ok: false; error: unknown; logs: string }
> {
  const logs: string[] = [];
  const dataDir = await mkdtemp(path.join(tmpdir(), input.dataDirPrefix));
  const port = await reservePort();
  const postgres = new EmbeddedPostgres({
    databaseDir: dataDir,
    port,
    user: CLUSTER_USER,
    password: CLUSTER_PASSWORD,
    persistent: false,
    onLog(message) {
      logs.push(message);
    },
    onError(messageOrError) {
      logs.push(errorText(messageOrError));
    },
  });
  const cluster: EmbeddedCluster = {
    postgres,
    dataDir,
    port,
    connectionString: `postgresql://${CLUSTER_USER}:${CLUSTER_PASSWORD}@127.0.0.1:${port}/${input.databaseName}`,
  };
  try {
    await postgres.initialise();
    await postgres.start();
    const pid = readChild(postgres)?.pid;
    if (pid === undefined) {
      throw new Error("No se pudo identificar el PID de PostgreSQL de prueba.");
    }
    await postgres.createDatabase(input.databaseName);
    return { ok: true, cluster };
  } catch (error) {
    await destroyEmbeddedCluster(cluster).catch(() => undefined);
    return { ok: false, error, logs: logs.join("") };
  }
}

async function destroyOnce(cluster: EmbeddedCluster): Promise<void> {
  const child = readChild(cluster.postgres);
  const pid = child?.pid;
  let stopError: unknown;
  try {
    await stopWithin(cluster.postgres, STOP_TIMEOUT_MS);
  } catch (error) {
    if (!isBusy(error)) {
      stopError = error;
    }
  }
  if (pid !== undefined) {
    await taskkillTree(pid);
  }
  child?.stdout?.destroy();
  child?.stderr?.destroy();
  child?.stdin?.destroy();
  child?.unref();
  await removeDataDir(cluster.dataDir);
  if (stopError !== undefined) {
    throw stopError;
  }
}

function readChild(postgres: EmbeddedPostgres): ChildProcess | undefined {
  return (postgres as unknown as { process?: ChildProcess }).process;
}

async function reservePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (address === null || typeof address === "string") {
        server.close();
        reject(new Error("No se pudo reservar un puerto de prueba."));
        return;
      }
      const { port } = address;
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(port);
      });
    });
  });
}

async function stopWithin(
  postgres: EmbeddedPostgres,
  timeoutMs: number,
): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let timedOut = false;
  const stopping = postgres.stop();
  const timeout = new Promise<void>((resolve) => {
    timer = setTimeout(() => {
      timedOut = true;
      resolve();
    }, timeoutMs);
  });
  try {
    await Promise.race([stopping, timeout]);
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
  }
  if (timedOut) {
    stopping.catch(() => undefined);
  }
}

function taskkillTree(pid: number): Promise<void> {
  if (process.platform !== "win32") {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const killer = spawn("taskkill", ["/pid", String(pid), "/f", "/t"], {
      windowsHide: true,
    });
    killer.once("error", () => resolve());
    killer.once("close", () => resolve());
  });
}

async function removeDataDir(dataDir: string): Promise<void> {
  for (let attempt = 0; attempt < REMOVE_DELAYS_MS.length; attempt += 1) {
    try {
      await rm(dataDir, { recursive: true, force: true });
      return;
    } catch (error) {
      if (!isBusy(error)) {
        throw error;
      }
      await delay(REMOVE_DELAYS_MS[attempt] ?? 1000);
    }
  }
  await rm(dataDir, { recursive: true, force: true });
}

function isBusy(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error.code === "EBUSY" || error.code === "EPERM")
  );
}

function errorText(value: unknown): string {
  if (value instanceof Error) {
    return value.message;
  }
  return String(value);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
