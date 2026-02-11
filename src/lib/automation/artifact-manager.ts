import { mkdir, writeFile, readFile, readdir, rename } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

const ARTIFACTS_ROOT = path.join(process.cwd(), ".automation-data");

export interface ScreenshotMeta {
  step: number;
  name: string;
  label: string;
  timestamp: string;
}

const jobScreenshots = new Map<string, ScreenshotMeta[]>();
const jobVideoPaths = new Map<string, string>();

export function getJobDir(jobId: string): string {
  return path.join(ARTIFACTS_ROOT, jobId);
}

export function getVideoDir(jobId: string): string {
  return path.join(getJobDir(jobId), "video");
}

export async function ensureJobDir(jobId: string): Promise<string> {
  const dir = getJobDir(jobId);
  await mkdir(dir, { recursive: true });
  return dir;
}

export async function ensureVideoDir(jobId: string): Promise<string> {
  const dir = getVideoDir(jobId);
  await mkdir(dir, { recursive: true });
  return dir;
}

export async function saveScreenshot(
  jobId: string,
  step: number,
  slug: string,
  label: string,
  buffer: Buffer
): Promise<ScreenshotMeta> {
  const dir = await ensureJobDir(jobId);
  const name = `step-${String(step).padStart(2, "0")}-${slug}.png`;
  await writeFile(path.join(dir, name), buffer);

  const meta: ScreenshotMeta = {
    step,
    name,
    label,
    timestamp: new Date().toISOString(),
  };

  const existing = jobScreenshots.get(jobId) ?? [];
  existing.push(meta);
  jobScreenshots.set(jobId, existing);

  return meta;
}

export function getJobScreenshots(jobId: string): ScreenshotMeta[] {
  return jobScreenshots.get(jobId) ?? [];
}

export async function readScreenshotFile(
  jobId: string,
  filename: string
): Promise<Buffer | null> {
  if (!/^step-\d{2}-[\w-]+\.png$/.test(filename)) return null;
  const filePath = path.join(getJobDir(jobId), filename);
  if (!existsSync(filePath)) return null;
  return readFile(filePath);
}

export async function finalizeVideo(jobId: string): Promise<string | null> {
  const videoDir = getVideoDir(jobId);
  if (!existsSync(videoDir)) return null;

  const files = await readdir(videoDir);
  const webm = files.find((f) => f.endsWith(".webm"));
  if (!webm) return null;

  const finalName = "recording.webm";
  const src = path.join(videoDir, webm);
  const dest = path.join(videoDir, finalName);
  if (webm !== finalName) await rename(src, dest);

  jobVideoPaths.set(jobId, dest);
  return finalName;
}

export async function readVideoFile(jobId: string): Promise<Buffer | null> {
  const filePath =
    jobVideoPaths.get(jobId) ??
    path.join(getVideoDir(jobId), "recording.webm");
  if (!existsSync(filePath)) return null;
  return readFile(filePath);
}

export function getJobVideoPath(jobId: string): string | null {
  return jobVideoPaths.get(jobId) ?? null;
}

export function clearJobArtifacts(jobId: string): void {
  jobScreenshots.delete(jobId);
  jobVideoPaths.delete(jobId);
}
