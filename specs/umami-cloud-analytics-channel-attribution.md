---
title: Umami Cloud Analytics for Channel Attribution
status: implemented
priority: medium
---

## Summary

With the app going GA, we need to understand which marketing channels (Twitter, LinkedIn, WhatsApp, etc.) drive traffic and signups. This adds Umami Cloud (free tier) as a lightweight, privacy-friendly analytics solution that tracks pageviews, referrers, and UTM parameters out of the box — no cookie consent banner needed.

## Acceptance Criteria

- [ ] Umami tracking script is loaded on all pages (public, auth, and dashboard)
- [ ] Script uses `defer` and `data-website-id` attributes per Umami docs
- [ ] `NEXT_PUBLIC_UMAMI_WEBSITE_ID` env var controls the website ID (script is not rendered when env var is absent, e.g., in local dev)
- [ ] `NEXT_PUBLIC_UMAMI_URL` env var controls the Umami instance URL (defaults to `https://cloud.umami.is` if not set)
- [ ] Pageviews are automatically tracked on client-side navigation (Umami's script handles this for SPAs)
- [ ] UTM parameters (`utm_source`, `utm_medium`, `utm_campaign`) are captured automatically by Umami on page load
- [ ] Referrer data is captured automatically by Umami
- [ ] The script does not affect Lighthouse performance score (async/defer loading, <2KB)
- [ ] No cookies are set by the analytics script
- [ ] CI passes: `npm run lint && npm run format:check && npm run build && npm run test`

## Technical Notes

- **Single file change**: Add the Umami `<Script>` to `src/app/layout.tsx` (root layout) using Next.js `next/script` with `strategy="afterInteractive"`. Conditionally render only when `process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID` is set.
- **No npm dependencies needed** — Umami is a single external script tag.
- **Umami Cloud setup** (manual, outside of code): Create a free account at `cloud.umami.is`, add the `desgrava.ar` website, and copy the website ID into the `NEXT_PUBLIC_UMAMI_WEBSITE_ID` env var on Fly.io.
- **UTM usage**: When sharing links on different platforms, append UTM params (e.g., `https://desgrava.ar?utm_source=twitter&utm_medium=social&utm_campaign=ga-launch`). Umami's dashboard will break down traffic by source/medium/campaign automatically.
- **Environment variables**: Add `NEXT_PUBLIC_UMAMI_WEBSITE_ID` and optionally `NEXT_PUBLIC_UMAMI_URL` to Fly.io secrets. No changes to `.env.example` needed since these are optional.
- Update `CLAUDE.md` environment variables section to document the new env vars.

## Out of Scope

- Self-hosting Umami (using cloud free tier for now)
- Custom event tracking (e.g., tracking signups, invoice uploads as events) — can be added later
- Server-side analytics or API request tracking
- A/B testing or feature flags
- Building a custom analytics dashboard in the app
- UTM link builder UI — links are composed manually when sharing
