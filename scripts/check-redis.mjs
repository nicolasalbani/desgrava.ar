import { readFileSync, existsSync, mkdirSync } from "fs";
import { spawnSync } from "child_process";
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

const url = process.env.REDIS_URL;
if (!url) {
  console.error(
    "REDIS_URL is not set. Add REDIS_URL=redis://localhost:6379 to .env for local dev.",
  );
  process.exit(1);
}

let host, port;
try {
  const parsed = new URL(url);
  host = parsed.hostname;
  port = parseInt(parsed.port || "6379", 10);
} catch {
  console.error("REDIS_URL is not a valid URL");
  process.exit(1);
}

// Only manage local redis — skip for remote (Upstash, Fly Redis, …).
if (host !== "localhost" && host !== "127.0.0.1") {
  await checkReachable(host, port);
  process.exit(0);
}

// --- Find redis-server ---
const REDIS_SEARCH_PATHS = [
  "/opt/homebrew/opt/redis/bin",
  "/usr/local/opt/redis/bin",
  "/opt/homebrew/bin",
  "/usr/local/bin",
  "/usr/bin",
];

function findBin(name) {
  for (const dir of REDIS_SEARCH_PATHS) {
    const p = `${dir}/${name}`;
    if (existsSync(p)) return p;
  }
  return null;
}

const redisServer = findBin("redis-server");

if (!redisServer) {
  console.error("Redis not found. Install it with: brew install redis");
  process.exit(1);
}

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const REDISDATA = resolve(REPO_ROOT, ".redisdata");
const REDISLOG = resolve(REPO_ROOT, ".redisdata.log");
const REDISPID = resolve(REDISDATA, "redis.pid");

// --- Init data directory if needed ---
if (!existsSync(REDISDATA)) {
  mkdirSync(REDISDATA, { recursive: true });
}

// --- Start redis if not already running ---
const isRunning = await checkReachable(host, port, { silent: true });
if (!isRunning) {
  console.log(`Starting local Redis on port ${port} ...`);
  // `--daemonize yes` forks redis into the background; `--save ""` and
  // `--appendonly no` keep dev startup fast and disk-light. Data lives in
  // .redisdata so resetting state is just `rm -rf .redisdata`.
  const result = spawnSync(
    redisServer,
    [
      "--port",
      String(port),
      "--bind",
      "127.0.0.1",
      "--daemonize",
      "yes",
      "--dir",
      REDISDATA,
      "--logfile",
      REDISLOG,
      "--pidfile",
      REDISPID,
      "--save",
      "",
      "--appendonly",
      "no",
    ],
    { stdio: "inherit" },
  );
  if (result.status !== 0) {
    console.error(`Failed to start Redis. Check ${REDISLOG} for details.`);
    process.exit(1);
  }
  await waitForRedis(host, port);
}

console.log(`Redis ready at ${host}:${port}`);

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
      if (!silent) console.log(`Redis reachable at ${h}:${p}`);
      resolve(true);
    });
    socket.on("error", () => {
      clearTimeout(timeout);
      resolve(false);
    });
  });
}

function waitForRedis(h, p, retries = 20, delay = 300) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const try_ = () => {
      checkReachable(h, p, { silent: true }).then((ok) => {
        if (ok) return resolve();
        if (++attempts >= retries) return reject(new Error("Redis did not start in time"));
        setTimeout(try_, delay);
      });
    };
    try_();
  });
}
