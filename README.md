# PreOink Cinematic Edition — Private Playtest Website

This **public GitHub repository holds the password-gated hosting code only**. It does not publish the game. The actual PreOink game remains in the private `-PreOink-Cinematic-Edition-` repository until its files are uploaded to an authenticated private R2 bucket.

## Intended website behavior

- Visit the website's main URL → the server ends any prior sign-in and displays a mandatory email/password login.
- Correct credentials for an authorized owner/tester → the **actual game** opens at `/play`.
- Nobody can view game HTML, images, audio, scripts, and fonts without a valid server-side session.
- Owner-only `/admin` lets the owner create tester accounts, deactivate or reactivate them.
- No public account signup or guests. No client-side password-only overlay.
- Session cookies have no persistent Max-Age, expire server-side after three hours, and can be revoked. Opening the site root forces fresh sign-in; an existing browser tab on `/play` can remain signed in until expiry, logout, or revocation.

## Source files

- `src/index.js` — Cloudflare Worker with login, admin and private R2 game delivery
- `migrations/0001_auth.sql` — D1 users/sessions/rate-limit schema
- `tools/bootstrap-owner.mjs` — trusted local owner password seed generator
- `wrangler.toml` — Cloudflare R2/D1 bindings; needs actual D1 ID
- `tests/security.test.mjs` — Node security tests
- `.github/workflows/security.yml` — CI tests on push
- `docs/DEPLOY_PRIVATE_PLAYTEST.md` — deployment and security requirements

Run `npm run check` locally with Node 22+ for syntax and security tests.

## Current status

**Implemented and saved to GitHub, but NOT deployed or security-verified in a live hosting environment.** The game files have not been moved to R2. The owner account and database have not been initialized in Cloudflare. No working login URL exists yet.

See [deployment instructions](docs/DEPLOY_PRIVATE_PLAYTEST.md) before deploying. The cloud setup, private game upload, and Safari end-to-end tests are required before inviting testers.

## Policy

Keep the game source and assets PRIVATE. Do not add `public/game`, `preoink/dist`, `owner-seed.sql`, passwords, database IDs containing secrets, or service tokens to this repo. No paid infrastructure without owner approval.

## PreOink cross-repository update — November 15, 2026

**Canonical current game source:** [private PreOink Cinematic Edition](https://github.com/markallanfigueroa-svg/-PreOink-Cinematic-Edition-/tree/main/preoink/dist). Do not treat older Chapter One deployments or this repository as automatically synchronized with that build.

**Actual updated game package:** [successful GitHub Actions package run #2](https://github.com/markallanfigueroa-svg/-PreOink-Cinematic-Edition-/actions/runs/43760444103) (private login required). The downloadable artifact is a local game bundle, **not a hosted iPhone URL**.

**Existing Chapter One website:** https://preoink-chapter-one-playtest.markallanfigueroa.chatgpt.site — older live build; not confirmed to include latest Cinematic Edition updates. Do not label it updated without verifying its build ID against current `preoink/dist/index.html`.

**New password-gated website:** [preoink-new-website](https://github.com/markallanfigueroa-svg/preoink-new-website) — deployment blocked by nonexistent Cloudflare R2 bucket; free Worker Static Assets migration is still pending. Never publish private game files in the public website repository or bypass authentication.

**Update rule:** A source commit or a passing package workflow does not deploy any website. Only call a game **live and updated** after a successful deployment and actual browser verification of the latest build and assets. Keep the approved PreOink canon and character artwork intact; never replace the real game with a placeholder prototype.
