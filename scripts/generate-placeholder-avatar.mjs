// Generates the placeholder team-member avatar PNG and seeds per-person copies.
// Run once to (re)create public/images/team/{placeholder-avatar.png,
// nicolas-albani.jpg, nicolas-barbolla.jpg}. Real photos overwrite the
// per-person .jpg files; this script doesn't need to be re-run unless the
// placeholder design itself changes.

import sharp from "sharp";
import { writeFileSync, copyFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

const TEAM_DIR = resolve("public/images/team");
mkdirSync(TEAM_DIR, { recursive: true });

// Neutral grayscale silhouette so it reads OK in both light and dark modes
// without per-theme variants. Background gray-200, silhouette gray-400.
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
  <rect width="400" height="400" fill="#e5e7eb"/>
  <circle cx="200" cy="160" r="60" fill="#9ca3af"/>
  <path d="M 100 360 Q 100 240, 200 240 Q 300 240, 300 360 Z" fill="#9ca3af"/>
</svg>`;

const buffer = await sharp(Buffer.from(svg)).png().toBuffer();

const placeholderPath = resolve(TEAM_DIR, "placeholder-avatar.png");
writeFileSync(placeholderPath, buffer);
console.log(`Wrote ${placeholderPath}`);

// Initial per-person copies — user overwrites these with real square photos
// (≥ 400×400) when available. Page src points at these files directly, so
// no code change is needed when the photo is replaced.
for (const slug of ["nicolas-albani", "nicolas-barbolla"]) {
  const target = resolve(TEAM_DIR, `${slug}.jpg`);
  copyFileSync(placeholderPath, target);
  console.log(`Copied placeholder → ${target}`);
}
