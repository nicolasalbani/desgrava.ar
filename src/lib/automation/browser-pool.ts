import { chromium, Browser, BrowserContext } from "playwright";
import PQueue from "p-queue";

const BROWSER_TIMEOUT = 60_000;
const CONTEXT_IDLE_TIMEOUT = 2 * 60_000; // 2 minutes — keep context alive for session reuse

let browser: Browser | null = null;
const contextMap = new Map<string, BrowserContext>();
const contextTimers = new Map<string, ReturnType<typeof setTimeout>>();

// Per-user queues with concurrency 1: jobs for the same user run sequentially
// to avoid sharing/destroying each other's browser context. Different users
// run in parallel naturally (each gets their own queue).
const userQueues = new Map<string, PQueue>();

function getUserQueue(userId: string): PQueue {
  let q = userQueues.get(userId);
  if (!q) {
    q = new PQueue({ concurrency: 1 });
    userQueues.set(userId, q);
  }
  return q;
}

async function ensureBrowser(): Promise<Browser> {
  if (!browser || !browser.isConnected()) {
    browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
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

/**
 * Schedule context for deferred release. The context stays alive for
 * CONTEXT_IDLE_TIMEOUT so the next job for the same user can reuse the
 * ARCA session (cookies, login state) without re-authenticating.
 * If a new job starts before the timeout, getContext() returns the
 * existing context and cancelContextRelease() cancels the pending close.
 */
export function scheduleContextRelease(userId: string): void {
  // Cancel any existing timer first
  const existing = contextTimers.get(userId);
  if (existing) clearTimeout(existing);

  const timer = setTimeout(async () => {
    contextTimers.delete(userId);
    const context = contextMap.get(userId);
    if (context) {
      await context.close().catch(() => {});
      contextMap.delete(userId);
    }
  }, CONTEXT_IDLE_TIMEOUT);

  contextTimers.set(userId, timer);
}

/** Cancel a pending deferred release (called when a new job starts). */
export function cancelContextRelease(userId: string): void {
  const timer = contextTimers.get(userId);
  if (timer) {
    clearTimeout(timer);
    contextTimers.delete(userId);
  }
}

/** Immediately close and remove the context (used for error cleanup). */
export async function releaseContext(userId: string): Promise<void> {
  cancelContextRelease(userId);
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

export function enqueueJob<T>(userId: string, fn: () => Promise<T>): Promise<T> {
  return getUserQueue(userId).add(fn) as Promise<T>;
}
