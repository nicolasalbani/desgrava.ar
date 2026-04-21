---
title: Replace Calculator Favicon with Accountant Logo
status: implemented
priority: low
---

## Summary

The browser-tab favicon currently renders an inline calculator SVG (lucide `Calculator` icon on a black rounded background) via `src/app/icon.tsx`. Meanwhile, the rest of the app — navbar, login, onboarding, sidebar, OG image — uses the accountant character from `public/logo.png` as the brand logo. The favicon should match the brand identity: replace the calculator with the accountant logo so the tab icon is visually consistent with the rest of desgrava.ar.

## Acceptance Criteria

- [ ] Browser tab favicon shows the accountant character from `public/logo.png`, not the calculator SVG
- [ ] Favicon renders crisply at 32×32 (and scales acceptably for 16×16 small-tab rendering)
- [ ] The Apple touch icon (if served) also uses the accountant logo for consistency
- [ ] `src/app/opengraph-image.tsx` continues to use `public/logo.png` (no regression)
- [ ] The unused `public/logo.svg` (calculator asset) is deleted — it isn't referenced anywhere in `src/`
- [ ] No layout/bundle-size regression: verify `npm run build` succeeds and the favicon route (`/icon.png` or similar) returns the new image

## Technical Notes

- **File to change**: `src/app/icon.tsx` — Next.js App Router convention for generating the favicon. Currently uses `ImageResponse` with an inline SVG. Replace with a version that reads `public/logo.png` (mirroring the pattern in `src/app/opengraph-image.tsx:9`, which does `readFile(join(process.cwd(), "public", "logo.png"))`) and renders it inside the 32×32 `ImageResponse`.
- **Rendering approach**: Keep the black rounded-square background (`#000`, `borderRadius: 7`) so the white/black accountant logo sits on a consistent branded tile — the logo itself has a transparent background around black linework, so it needs contrast. Alternatively, drop the background and render the logo on transparent — confirm which looks better once implemented.
- **Apple touch icon**: Next.js App Router supports `src/app/apple-icon.tsx` as a 180×180 companion. Add it (or a static `apple-icon.png`) so iOS home-screen bookmarks get the same branded image.
- **Asset cleanup**: `public/logo.svg` is unreferenced (grep confirms zero usages in `src/`). Delete it in the same PR to avoid drift. `public/logo.png` (≈1MB) is large for a favicon source but `ImageResponse` resamples it to the requested size, so no pre-optimization needed for this change.
- **Cache busting**: Browsers aggressively cache favicons. The Next.js build fingerprints the generated icon route, so a fresh deploy should invalidate — but mention in the PR that users may need to hard-refresh to see the change locally.

## Out of Scope

- Redesigning the accountant logo itself
- Changing the brand logo used elsewhere (navbar, login, OG image) — those already use `logo.png`
- PWA manifest / installability icons beyond the Apple touch icon
- Generating multiple favicon sizes as static files (e.g., `favicon-16.png`, `favicon-32.png`) — the `ImageResponse` approach handles sizing
- Changing the OG image
