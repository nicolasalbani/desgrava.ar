import { readFileSync, existsSync } from "fs";
import { execFileSync, spawnSync } from "child_process";
import { createConnection } from "net";
import { URL } from "url";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

// Load .env manually (dotenv not guaranteed available as a bin)
try {
  const env = readFileSync(".env", "utf8");
  for (const line of env.split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) process.env[match[1].trim()] ??= match[2].trim().replace(/^["']|["']$/g, "");
  }
} catch {
  // .env not present — rely on environment variables already set
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

let host, port, dbName;
try {
  const parsed = new URL(url);
  host = parsed.hostname;
  port = parseInt(parsed.port || "5432", 10);
  dbName = parsed.pathname.replace(/^\//, "");
} catch {
  console.error("DATABASE_URL is not a valid URL");
  process.exit(1);
}

// Only manage local postgres
if (host !== "localhost" && host !== "127.0.0.1") {
  await checkReachable(host, port);
  process.exit(0);
}

// --- Find pg_ctl ---
const BREW_POSTGRES_VERSIONS = ["17", "16", "15", "14"];
const PG_SEARCH_PATHS = [
  ...BREW_POSTGRES_VERSIONS.flatMap((v) => [
    `/opt/homebrew/opt/postgresql@${v}/bin`,
    `/usr/local/opt/postgresql@${v}/bin`,
  ]),
  "/opt/homebrew/bin",
  "/usr/local/bin",
  "/usr/bin",
];

function findBin(name) {
  for (const dir of PG_SEARCH_PATHS) {
    const p = `${dir}/${name}`;
    if (existsSync(p)) return p;
  }
  return null;
}

const pgCtl = findBin("pg_ctl");
const initdb = findBin("initdb");
const createdb = findBin("createdb");
const psql = findBin("psql");

if (!pgCtl || !initdb) {
  console.error("PostgreSQL not found. Install it with: brew install postgresql@17");
  process.exit(1);
}

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PGDATA = resolve(REPO_ROOT, ".pgdata");
const PGLOG = resolve(REPO_ROOT, ".pgdata.log");

// --- Init data directory if needed ---
if (!existsSync(PGDATA)) {
  console.log("Initializing local PostgreSQL data directory at .pgdata ...");
  const result = spawnSync(initdb, ["-D", PGDATA, "--auth=trust", "--username=postgres"], {
    stdio: "inherit",
  });
  if (result.status !== 0) {
    console.error("initdb failed");
    process.exit(1);
  }
}

// --- Start postgres if not already running ---
const isRunning = await checkReachable(host, port, { silent: true });
if (!isRunning) {
  console.log(`Starting local PostgreSQL on port ${port} ...`);
  const result = spawnSync(pgCtl, ["-D", PGDATA, "-l", PGLOG, "-o", `-p ${port}`, "start"], {
    stdio: "inherit",
  });
  if (result.status !== 0) {
    console.error(`Failed to start PostgreSQL. Check ${PGLOG} for details.`);
    process.exit(1);
  }
  // Wait for it to be ready
  await waitForPostgres(host, port);
}

// --- Create database if it doesn't exist ---
if (psql && createdb && dbName) {
  try {
    const out = execFileSync(
      psql,
      [
        "-U",
        "postgres",
        "-p",
        String(port),
        "-tAc",
        `SELECT 1 FROM pg_database WHERE datname='${dbName}'`,
      ],
      { stdio: "pipe" },
    )
      .toString()
      .trim();
    if (out !== "1") {
      execFileSync(createdb, ["-U", "postgres", "-p", String(port), dbName], { stdio: "inherit" });
      console.log(`Created database: ${dbName}`);
    }
  } catch {
    // ignore — db likely already exists
  }
}

console.log(`PostgreSQL ready at ${host}:${port}/${dbName}`);

// --- Helpers ---

function checkReachable(h, p, { silent = false } = {}) {
  return new Promise((resolve) => {
    const socket = createConnection({ host: h, port: p });
    const timeout = setTimeout(() => {
      socket.destroy();
      resolve(false);
    }, 3000);
    socket.on("connect", () => {
      clearTimeout(timeout);
      socket.destroy();
      if (!silent) console.log(`Database reachable at ${h}:${p}`);
      resolve(true);
    });
    socket.on("error", () => {
      clearTimeout(timeout);
      resolve(false);
    });
  });
}

function waitForPostgres(h, p, retries = 20, delay = 300) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const try_ = () => {
      checkReachable(h, p, { silent: true }).then((ok) => {
        if (ok) return resolve();
        if (++attempts >= retries) return reject(new Error("PostgreSQL did not start in time"));
        setTimeout(try_, delay);
      });
    };
    try_();
  });
}
