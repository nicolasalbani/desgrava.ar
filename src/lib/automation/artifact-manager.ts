import { mkdir, writeFile, readFile, readdir } from "fs/promises";
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
const jobVideoFiles = new Map<string, string[]>();

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

export async function finalizeVideo(jobId: string): Promise<string[]> {
  const videoDir = getVideoDir(jobId);
  if (!existsSync(videoDir)) return [];

  const files = await readdir(videoDir);
  const webmFiles = files.filter((f) => f.endsWith(".webm")).sort();
  if (webmFiles.length === 0) return [];

  jobVideoFiles.set(jobId, webmFiles);
  return webmFiles;
}

export async function readVideoFile(
  jobId: string,
  filename?: string
): Promise<Buffer | null> {
  const videoDir = getVideoDir(jobId);

  if (filename) {
    if (!filename.endsWith(".webm")) return null;
    const filePath = path.join(videoDir, filename);
    if (!existsSync(filePath)) return null;
    return readFile(filePath);
  }

  // Legacy fallback: first tracked file or recording.webm
  const knownFiles = jobVideoFiles.get(jobId);
  if (knownFiles && knownFiles.length > 0) {
    const filePath = path.join(videoDir, knownFiles[0]);
    if (existsSync(filePath)) return readFile(filePath);
  }

  const filePath = path.join(videoDir, "recording.webm");
  if (!existsSync(filePath)) return null;
  return readFile(filePath);
}

export function getJobVideoFiles(jobId: string): string[] {
  return jobVideoFiles.get(jobId) ?? [];
}

export async function listVideosFromDisk(jobId: string): Promise<string[]> {
  const videoDir = getVideoDir(jobId);
  if (!existsSync(videoDir)) return [];
  const files = await readdir(videoDir);
  return files.filter((f) => f.endsWith(".webm")).sort();
}

export async function listScreenshotsFromDisk(
  jobId: string
): Promise<ScreenshotMeta[]> {
  const dir = getJobDir(jobId);
  if (!existsSync(dir)) return [];

  const files = await readdir(dir);
  const pattern = /^step-(\d{2})-([\w-]+)\.png$/;

  return files
    .map((f) => {
      const match = f.match(pattern);
      if (!match) return null;
      const step = parseInt(match[1], 10);
      const slug = match[2];
      return {
        step,
        name: f,
        label: slug.replace(/-/g, " "),
        timestamp: "",
      } satisfies ScreenshotMeta;
    })
    .filter((m): m is ScreenshotMeta => m !== null)
    .sort((a, b) => a.step - b.step);
}

export function clearJobArtifacts(jobId: string): void {
  jobScreenshots.delete(jobId);
  jobVideoFiles.delete(jobId);
}
