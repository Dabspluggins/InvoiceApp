# BillByDab Email Deliverability Report
**Prepared:** April 19, 2026  
**Domain:** billbydab.com  
**Email service:** Resend  
**Route analysed:** `src/app/api/admin/send-announcement/route.ts`

---

## Executive Summary

Founder announcement emails from BillByDab are landing in Gmail's Promotions tab and occasionally spam because of **three compounding problem layers**: missing or incomplete DNS authentication records (the hard floor Gmail checks first), a missing machine-readable `List-Unsubscribe` header (required for bulk mail), and an HTML email structure that Gmail's machine-learning classifier reads as a marketing campaign rather than a personal founder message. Every issue is fixable without replacing Resend or changing the send flow significantly.

---

## Part 1 — DNS Authentication Records

### What was confirmed

- **SPF** — Recently fixed to include `zohomail.com` and `_spf.resend.com`. This is correct for Resend sending.
- **DKIM** — Status **unknown / likely not configured.** Resend requires a domain to be fully verified in its dashboard, which generates a CNAME record at `resend._domainkey.billbydab.com`. The user has not mentioned completing this step. Without it, emails leave Resend's infrastructure unsigned and Gmail has no cryptographic proof the message is genuine.
- **DMARC** — Status **likely absent.** A DMARC record lives at `_dmarc.billbydab.com` as a TXT record. It was not mentioned among recent DNS changes. Without DMARC, Gmail cannot verify that SPF and DKIM are aligned to the same domain, and the Google Postmaster Tools compliance check returns a fail.

### Why this causes spam

Gmail's 2024 bulk sender policy (still enforced in 2026, now under the binary Pass/Fail compliance model that replaced the old High/Medium/Low score in October 2025) requires all bulk senders to pass SPF, have DKIM signing active, and publish a DMARC record. A missing or misaligned DKIM is the single most reliable way to get routed to spam. A missing DMARC record means Gmail cannot enforce alignment between the envelope sender and the From header, which triggers extra scrutiny.

### Fixes

**Fix 1A — Verify billbydab.com in Resend's dashboard (CRITICAL)**  
Go to Resend → Domains → Add Domain → enter `billbydab.com`. Resend will provide a CNAME record like:

```
Name:   resend._domainkey.billbydab.com
Type:   CNAME
Value:  p.resend.com
```

Add this to your DNS provider (Cloudflare, Namecheap, etc.) and wait for Resend to confirm the domain is "Verified." Until this is done, emails are not DKIM-signed regardless of what else you fix.

**Fix 1B — Add a DMARC record (CRITICAL)**  
Add this TXT record to your DNS:

```
Name:   _dmarc.billbydab.com
Type:   TXT
Value:  v=DMARC1; p=none; rua=mailto:dmarc-reports@billbydab.com; aspf=r; adkim=r;
```

Start with `p=none` (monitor-only mode) so you can see alignment reports without rejecting legitimate mail. After 2–4 weeks of clean reports, upgrade to `p=quarantine`, then eventually `p=reject`.

**Fix 1C — Confirm SPF alignment**  
The current SPF record should look like:

```
v=spf1 include:_spf.zohomail.com include:_spf.resend.com ~all
```

Verify this is exactly what is published. The `~all` (softfail) is acceptable; `?all` (neutral) is too permissive.

---

## Part 2 — Missing List-Unsubscribe Header

### What the code shows

In `route.ts`, the `resend.emails.send()` call passes only `from`, `to`, `subject`, and `html`. There is **no `headers` field** and therefore no `List-Unsubscribe` or `List-Unsubscribe-Post` header in the outgoing message.

```typescript
// Current code — missing required headers
const { error: sendError } = await resend.emails.send({
  from: 'Dab from BillByDab <onboarding@billbydab.com>',
  to: u.email,
  subject: title.trim(),
  html,
  // ← No headers here
})
```

The HTML footer contains an unsubscribe link (`/api/unsubscribe?token=...`), but this is a human-visible link inside the body. Gmail additionally looks for a **machine-readable email header** called `List-Unsubscribe`. When that header is absent, Gmail's filter treats the message as non-compliant bulk mail and is more likely to route it to spam or Promotions.

### Why this matters

Gmail requires one-click `List-Unsubscribe` compliance for any sender who exceeds 5,000 messages per day, and strongly recommends it for all bulk mail. Yahoo Mail also enforces this. The absence of this header is a primary spam signal for bulk messages that nonetheless have unsubscribe links in the body (which signals marketing intent without giving Gmail the machine-readable hook it needs).

### Fix

Add a `headers` block to the Resend send call:

```typescript
const { error: sendError } = await resend.emails.send({
  from: 'Dab from BillByDab <onboarding@billbydab.com>',
  to: u.email,
  subject: title.trim(),
  html,
  text: buildPlainTextEmail({ firstName, title: title.trim(), body: announcementBody.trim(), userId: u.id }),
  headers: {
    'List-Unsubscribe': `<https://billbydab.com/api/unsubscribe?token=${u.id}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  },
})
```

The `List-Unsubscribe-Post` value is a fixed string that signals Gmail can unsubscribe the user with a single POST request, enabling the one-click unsubscribe button in Gmail's UI. This also prevents users from hitting the spam button instead of the unsubscribe link (high spam complaint rates destroy sender reputation).

---

## Part 3 — Gmail Promotions Tab Triggers

### What the email HTML looks like to Gmail's classifier

The `buildAnnouncementEmail()` function produces an email that hits almost every Promotions tab signal Gmail's ML model looks for:

| Signal | What the code does | Promotions risk |
|--------|-------------------|-----------------|
| Branded header block | Dark `#111827` header with logo + tagline | High |
| Box shadow container | `box-shadow: 0 1px 4px rgba(0,0,0,0.10)` | Medium |
| CTA button | Inline-styled `<a>` button with `display:inline-block` and background color | Very High |
| Footer with legal links | Privacy policy + unsubscribe in grey footer | High |
| Background color on `<body>` | `background:#f3f4f6` on the whole body | Medium |
| 4+ links | Dashboard CTA + privacy policy + unsubscribe + any links in body text | High |
| HTML-only email | No plain-text `text` alternative | High |
| Subject line | Passed as raw title — if it contains "New!", "Announcing", "Update", etc. it's a direct Promotions signal | High |

Gmail's classifier is ML-driven and was trained on millions of marketing emails. The email as currently structured is indistinguishable from a SaaS drip campaign.

### Fixes

**Fix 3A — Add a plain-text alternative (HIGH IMPACT)**  
Every personal email has a text part. Marketing emails often don't. Add a `buildPlainTextEmail()` function and pass it as the `text` field to Resend. This alone significantly improves inbox placement.

```typescript
function buildPlainTextEmail(opts: { firstName: string; title: string; body: string; userId: string }): string {
  const { firstName, title, body, userId } = opts
  return `Hey ${firstName},

${title}

${body}

See what's new: https://billbydab.com/dashboard

With love from Lagos,
Dab

---
To unsubscribe: https://billbydab.com/api/unsubscribe?token=${userId}`
}
```

**Fix 3B — Strip the promotional structure from the HTML (HIGH IMPACT)**  
Remove the dark branded header bar, the outer box-shadow container, and the background body color. Replace with a plain white email that looks like it was written in a mail client. Keep the personal greeting, keep your name in the signature — just lose the marketing template wrapper.

Concretely, change the HTML to something like:

```html
<body style="margin:0;padding:24px;font-family:Arial,Helvetica,sans-serif;background:#ffffff;">
  <div style="max-width:560px;margin:0 auto;">
    <p>Hey ${firstName},</p>
    <!-- body paragraphs -->
    <p>With love from Lagos,<br><strong>Dab</strong><br>Founder, BillByDab</p>
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">
    <p style="font-size:12px;color:#9ca3af;">
      <a href="https://billbydab.com/api/unsubscribe?token=${userId}">Unsubscribe</a>
    </p>
  </div>
</body>
```

No header bar. No CTA button. No background color. No box shadow. No footer with multiple links. The privacy policy link can go — it's a Promotions signal and unneeded in a founder update email.

**Fix 3C — Reduce link count to 1–2 (MEDIUM IMPACT)**  
Remove the "See What's New" CTA button link and the Privacy Policy link from the footer. Keep only the unsubscribe link. If you want to reference the dashboard, do it as inline text like "you can check your dashboard at billbydab.com" rather than a styled button. Fewer links = lower Promotions probability.

**Fix 3D — Change the From address (MEDIUM IMPACT)**  
The current from address is `onboarding@billbydab.com`. The word "onboarding" is strongly associated with automated SaaS email sequences. For a founder personal update, use `dab@billbydab.com` or `hello@billbydab.com`. The display name "Dab from BillByDab" is already good — the local-part of the email address reinforces the signal.

Change this line:
```typescript
from: 'Dab from BillByDab <onboarding@billbydab.com>',
// Change to:
from: 'Dab from BillByDab <dab@billbydab.com>',
```

Make sure this address is also covered by Resend's domain verification and that replies to it can be received (even if just forwarded to your Gmail).

**Fix 3E — Watch subject line language (LOW EFFORT, HIGH REWARD)**  
Subject lines that trigger Promotions classification include words like: "Announcing", "New Feature", "Exciting Update", "Now Available", "Introducing", "Check out", "Don't miss". Write subject lines that sound like they came from a person, not a product team: "Something I've been building", "Quick update from me", "Wanted to share this with you".

---

## Part 4 — Spam Filter Triggers

### New domain reputation

billbydab.com appears to be a relatively new, low-volume sending domain. Gmail's new binary compliance model evaluates domains on a Pass/Fail basis. A brand-new domain with no sending history starts with zero trust. Sending a burst of emails to a large list from a cold domain triggers volume-spike detection.

**Fix:** Before your next large announcement, send a smaller batch (20–50 emails) a week before, then another 100–200, then your full list. This "warm-up" pattern establishes a sending history that Gmail recognises as legitimate. Check Google Postmaster Tools (postmaster.google.com) — add and verify billbydab.com there to see your domain reputation and spam rate in Google's own dashboard.

### Spam complaint rate

Gmail's 2026 enforcement threshold is: spam complaint rate must stay below 0.1% (1 in 1,000 recipients marking as spam). Above 0.3% triggers active filtering. Since BillByDab uses an opt-in (`email_updates = true`) flag — which is correct — complaint rates should be manageable, but watch for users who opted in long ago and have forgotten. If your complaint rate climbs, tighten the opt-in recency.

---

## Summary: Fixes Ranked by Impact

| Rank | Fix | Impact | Effort |
|------|-----|--------|--------|
| 1 | Verify billbydab.com domain in Resend dashboard (enables DKIM signing) | Spam → Primary | 10 min |
| 2 | Add DMARC TXT record at `_dmarc.billbydab.com` | Spam → Primary | 5 min |
| 3 | Add `List-Unsubscribe` and `List-Unsubscribe-Post` headers to Resend send call | Spam/Promo → Primary | 10 min code |
| 4 | Add plain-text `text` alternative to every email send | Promo → Primary | 30 min code |
| 5 | Strip marketing HTML structure (remove branded header, CTA button, body background, box shadow) | Promo → Primary | 1–2 hrs |
| 6 | Change From address to `dab@billbydab.com` | Promo → Primary | 5 min |
| 7 | Remove Privacy Policy link, reduce to 1 link (unsubscribe only) | Promo → Primary | 15 min |
| 8 | Write subject lines that sound personal, not promotional | Promo → Primary | Ongoing habit |
| 9 | Warm up domain before large blasts; monitor via Google Postmaster Tools | Spam → Primary | 1–2 weeks |

---

## Verification Checklist

After applying fixes, use these free tools to confirm everything is working before your next send:

- **mail-tester.com** — Send a test email to their throwaway address and get a score out of 10. Target 9+.
- **Google Postmaster Tools** (postmaster.google.com) — Verify billbydab.com and monitor domain reputation and spam rate over time.
- **Resend Dashboard → Domains** — Confirm billbydab.com shows "Verified" status (green checkmark) for DKIM.
- **MXToolbox** (mxtoolbox.com/SuperTool) — Check SPF, DKIM (`resend._domainkey.billbydab.com`), and DMARC (`_dmarc.billbydab.com`) all resolve correctly.
- **Send a test to yourself** via the announcement UI and check Gmail's "Show original" → look for `dkim=pass` and `spf=pass` in the Authentication-Results header.

---

*Report based on code analysis of `route.ts` and research into Gmail's 2026 bulk sender requirements, Resend's domain verification process, and Gmail's Promotions tab ML classification signals.*
