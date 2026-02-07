import { chromium, Browser, BrowserContext } from "playwright";
import PQueue from "p-queue";

const MAX_CONCURRENT = 3;
const BROWSER_TIMEOUT = 60_000;

let browser: Browser | null = null;
const contextMap = new Map<string, BrowserContext>();

const queue = new PQueue({ concurrency: MAX_CONCURRENT });

async function ensureBrowser(): Promise<Browser> {
  if (!browser || !browser.isConnected()) {
    browser = await chromium.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
      ],
    });
  }
  return browser;
}

export async function getContext(userId: string): Promise<BrowserContext> {
  const existing = contextMap.get(userId);
  if (existing) return existing;

  const b = await ensureBrowser();
  const context = await b.newContext({
    locale: "es-AR",
    timezoneId: "America/Buenos_Aires",
    viewport: { width: 1280, height: 720 },
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  });

  context.setDefaultTimeout(BROWSER_TIMEOUT);
  contextMap.set(userId, context);

  return context;
}

export async function releaseContext(userId: string): Promise<void> {
  const context = contextMap.get(userId);
  if (context) {
    await context.close().catch(() => {});
    contextMap.delete(userId);
  }
}

export async function shutdownPool(): Promise<void> {
  for (const [userId] of contextMap) {
    await releaseContext(userId);
  }
  if (browser) {
    await browser.close().catch(() => {});
    browser = null;
  }
}

export function enqueueJob<T>(fn: () => Promise<T>): Promise<T> {
  return queue.add(fn) as Promise<T>;
}

export { queue };
