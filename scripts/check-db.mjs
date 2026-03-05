import { readFileSync } from "fs";
import { createConnection } from "net";
import { URL } from "url";

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
  console.error("❌  DATABASE_URL is not set");
  process.exit(1);
}

let host, port;
try {
  const parsed = new URL(url);
  host = parsed.hostname;
  port = parseInt(parsed.port || "5432", 10);
} catch {
  console.error("❌  DATABASE_URL is not a valid URL");
  process.exit(1);
}

const socket = createConnection({ host, port });
const timeout = setTimeout(() => {
  socket.destroy();
  console.error(`❌  Cannot reach database at ${host}:${port} (timeout)`);
  process.exit(1);
}, 5000);

socket.on("connect", () => {
  clearTimeout(timeout);
  socket.destroy();
  console.log(`✅  Database reachable at ${host}:${port}`);
});

socket.on("error", (err) => {
  clearTimeout(timeout);
  console.error(`❌  Cannot reach database at ${host}:${port} — ${err.message}`);
  process.exit(1);
});
