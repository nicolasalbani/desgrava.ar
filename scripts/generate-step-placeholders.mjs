import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const OUT_DIR = path.join(process.cwd(), "public", "images", "landing", "steps");

const STEPS = [
  { num: 1, slug: "step-1-credenciales", label: "Crea tu cuenta" },
  { num: 2, slug: "step-2-comprobantes", label: "Carga tus gastos" },
  { num: 3, slug: "step-3-presentaciones", label: "Desgravá" },
];

const THEMES = {
  light: { bg: "#f5f5f5", text: "#666666", subtext: "#aaaaaa" },
  dark: { bg: "#1c1c1c", text: "#bbbbbb", subtext: "#666666" },
};

await mkdir(OUT_DIR, { recursive: true });

for (const step of STEPS) {
  for (const [themeName, theme] of Object.entries(THEMES)) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000">
      <rect width="1600" height="1000" fill="${theme.bg}"/>
      <text x="800" y="480" text-anchor="middle" font-family="-apple-system, system-ui, sans-serif" font-size="56" fill="${theme.text}" font-weight="600">
        Captura paso ${step.num} — ${step.label}
      </text>
      <text x="800" y="560" text-anchor="middle" font-family="-apple-system, system-ui, sans-serif" font-size="32" fill="${theme.subtext}">
        ${themeName} · reemplazar con captura real (${step.slug}-${themeName}.png)
      </text>
    </svg>`;
    const outPath = path.join(OUT_DIR, `${step.slug}-${themeName}.png`);
    await sharp(Buffer.from(svg)).png().toFile(outPath);
    console.log(`✓ ${outPath}`);
  }
}
