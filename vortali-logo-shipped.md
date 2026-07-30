# Vortali logo — shipped

Commit `3ca6cf8` is on master. TSC clean, all Codex findings resolved.

## To deploy

```
git push origin master
```

Vercel deploys automatically on push.

## What was committed (10 files)

| File | Change |
|------|--------|
| public/icon.svg | New — badge SVG |
| public/logo.svg | New — full lockup SVG |
| public/apple-icon.png | New — 180×180 PNG for iOS |
| public/og-image.png | Replaced — BillByDab branding removed |
| src/app/icon.svg | New — SVG favicon |
| src/app/opengraph-image.tsx | New — dynamic OG image, font hardened |
| src/app/twitter-image.tsx | New — X/Twitter large card |
| src/app/layout.tsx | Updated — Pacifico font + icon metadata |
| src/components/VortaliLogo.tsx | New — inline SVG React component |
| src/components/DashboardShell.tsx | Updated — logo in dashboard header |
