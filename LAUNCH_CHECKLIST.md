# Vortali — Pre-Launch Checklist

> Everything that needs to land before the public announcement. Items are grouped by category and ordered by priority within each group.

---

## 1. Rebrand Cleanup

These are quick config / DNS tasks left over from the BillByDab → Vortali rebrand.

- [x] **DMARC record** — Added `TXT` record `_dmarc` → `v=DMARC1; p=none;` in Cloudflare for `vortali.com`. ✓ Done 2026-07-04.
- [x] **Primary domain in Vercel** — `vortali.com` now serves directly, `www.vortali.com` 308 redirects to apex. ✓ Done 2026-07-04.
- [x] **Codebase www→apex migration** — All 26 files updated from `https://www.vortali.com` to `https://vortali.com` (SEO metadata, API routes, email links, components, RebrandBanner lint fix). Committed `bee3af3`. ✓ Done 2026-07-04.
- [x] **Unsubscribe mailbox** — `unsubscribe@vortali.com` group created in Zoho Mail, forwarding to `dab@vortali.com`. ✓ Done 2026-07-04.
- [x] **Supabase SMTP sender** — Updated sender from `hello@billbydab.com` / "Billbydab" to `hello@vortali.com` / "Vortali". All auth emails (password reset, magic link, signup confirmation) now send from vortali.com. ✓ Done 2026-07-04.
- [x] **Supabase URL Configuration** — Site URL updated to `https://vortali.com` (was www), `https://www.vortali.com/**` removed from redirect allowlist. `billbydab.com` entries intentionally kept until billbydab.com is removed from Vercel. ✓ Done 2026-07-04.
- [x] **Let `qorenti.com` expire** — Never linked to the product, no action needed. ✓ N/A

---

## 2. Dashboard & Analytics Charts

Core product work — a dashboard with missing charts looks unfinished to new users.

**Setup**
- [x] Install Recharts (`npm install recharts`) ✓ Done 2026-07-08.

**Analytics page (`AnalyticsClient.tsx`)**
- [x] Replace hand-rolled SVG bar chart with Recharts `AreaChart` — last 12 months, Invoiced vs Paid, hover tooltips, currency formatting. Done.
- [x] Add invoice status `PieChart` (donut) — Paid / Partial / Unpaid / Overdue with count + amount labels. Done.
- [x] Convert Top Clients text list into horizontal `BarChart` (top 5 by revenue paid). Done.

**Dashboard (`DashboardClient.tsx`)**
- [x] Add 30-day sparklines to the 3 stat cards (mini trend line under each number) ✓ Done 2026-07-12 (commit 409c6fb).
- [x] Fix missing currency symbol on the "Paid" stat card ✓ Done 2026-07-08.

**Reports page (`ReportsClient.tsx`)**
- [ ] Add monthly breakdown bar chart within the selected date range

---

## 3. Content Security Policy — Phase 2

CSP is currently in report-only mode. Enforce it before launch so the app is hardened against XSS.

- [x] **Add `https://vortali.com` to `connect-src`** — www→apex 308 redirects cause RSC prefetch requests to cross origins, triggering CSP violations. Fix: add `https://vortali.com` explicitly to the `connect-src` directive in `next.config.ts` alongside `'self'`. One-line change. Must be done before enforcing CSP. ✓ Done 2026-07-12 (commit 544c4eb).
- [x] **Fix PostHog eval violation** — Added `disable_external_dependency_loading: true` to `posthog.init()` in `PostHogProvider.tsx`. Prevents runtime script injection from assets CDN (source of the `eval()` call). `us-assets.i.posthog.com` added to `connect-src` for remote config fetches. Done 2026-07-12 (commit 3b2bce0).
- [x] **Add `wasm-unsafe-eval`** to `script-src` for Next.js/Turbopack on production. ✓ Done 2026-07-12 (commit 544c4eb).
- [ ] **Add `https://vercel.live`** to `script-src` conditionally for preview environments only.
- [x] **Flip header** from `Content-Security-Policy-Report-Only` → `Content-Security-Policy` in `next.config.ts`. Do this last, after violations above are resolved. ✓ Done 2026-07-12 (commit 544c4eb). Smoke-tested clean.

---

## 4. Presentation & Social

What first-time visitors and potential users will see.

- [x] **Landing page** — Live at `vortali.com`. Hero, invoice mockup preview, 6-feature grid, how-it-works, CTA banner, and full footer with Company/Support/Legal columns. Publicly accessible (no auth required). ✓ Done.
- [ ] **Twitter/X account** — Create the official Vortali Twitter/X account. Logo assets are ready.
- [ ] **Add Twitter/X link to footer** — Update `src/app/page.tsx` footer once the account is live. The link block was intentionally removed during the rebrand pending account creation.

---

## 5. UX Improvements

- [x] **Turnstile failure UX** — When Cloudflare Turnstile fails to load (ad blocker, network issue), the Sign In button is disabled with no recovery path. Add a "Retry security check" button and a direct support email link (`support@vortali.com`) so users aren't stuck. File: `src/app/auth/login/page.tsx` (captchaError block, line ~294).

---

## 6. Deferred (Post-Launch)

These are real improvements but not blockers for the announcement.

- [ ] **Portal link validity period** — Add per-client setting to choose how long portal links stay valid (30 / 60 / 90 / 180 days or custom). Currently hardcoded to 90 days. Requires: `validity_period` column on clients table, UI selector in client form, regenerate-portal route update.
- [ ] **Credit feature — atomic RPC upgrade** — Move invoice save + credit apply into a single Postgres RPC transaction (Option A). Currently shipped as Option B (separate post-save action). Needed when serving finance teams who need guaranteed consistency.

---

## Security Status ✓

All critical and medium security items from the Codex audit are shipped:

- Math.random → crypto.randomBytes for MFA backup codes ✓
- Upstash Redis rate limiting ✓
- RLS policy tightened ✓
- Password minimum raised to 12 characters ✓
- CAPTCHA on auth ✓
- Cron endpoint fail-open fixed ✓
- Next.js upgraded ✓
- Admin role check via DB (10 routes) ✓
- HTTP security headers (grade A on securityheaders.com) ✓
- Server-side auth refactor ✓
