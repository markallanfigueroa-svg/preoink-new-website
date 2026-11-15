# PreOink — password-protected actual game (GitHub project)

**Status:** Application source implemented, deployment NOT performed, no active login yet.

The website address may be publicly reachable but the real PreOink game HTML, JavaScript, images, and audio must be held only in **private R2 storage**. The Cloudflare Worker verifies every request against a D1-backed password session before serving any game file.

## What the source implements

- Username/email plus password login (no signup and no guest mode).
- Server-side PBKDF2-SHA256 password verification and attempted-login throttling per email.
- Server-side session lookup on every game HTML or asset request; session token stored in Secure, HttpOnly, SameSite=Strict cookie and only its SHA-256 hash stored in D1.
- Browser-session cookie (no persistent `Max-Age`) with absolute three-hour server expiry. **Important**: Safari can restore session cookies when resuming; this is not guaranteed to ask for a password on *every* tab opening. To insist on every entry through the site root, the root page can be made a reauthentication trigger. Current version requires login after cookie expiry/signout or a new session without a cookie.
- Owner-only tester account creation and revoke/reactivate at `/admin`. Temporary password displays once; send it securely and request the tester change it in a future password-management update.
- Server-enforced authorization on actual game routes. All game assets served out of private R2, not public GitHub Pages.
- No first-caller admin bootstrap: owner is created only by trusted manual D1 seed executed by the owner.

## Setup (requires Cloudflare account access)

1. Confirm free-tier quotas, billing implications, R2 and D1 eligibility before enabling paid features.
2. In Cloudflare Workers, create the private R2 bucket `preoink-private-game`. Do not enable any public bucket URL, r2.dev URL, or custom domain for that bucket.
3. Run `npx wrangler d1 create preoink-auth` and paste the actual database ID into `wrangler.toml`. **Do not commit secrets.**
4. Run `npx wrangler d1 migrations apply preoink-auth --remote`.
5. Create the owner account on a trusted computer with `node tools/bootstrap-owner.mjs OWNER_EMAIL > owner-seed.sql`. **Do not put passwords in command arguments.** Use a strong unique password. Then run `npx wrangler d1 execute preoink-auth --remote --file=owner-seed.sql` and delete `owner-seed.sql`. Verify the admin row in D1.
6. Export approved `preoink/dist` game files from the private `-PreOink-Cinematic-Edition-` GitHub repository and upload all files to the R2 bucket as keys relative to the dist root: `index.html`, `story.js`, fonts, art, sounds, etc. **Do not upload files into a public site or repository.**
7. Inspect the actual game's asset references, confirm relative URLs and required external origins; adjust CSP only as needed. Verify `/play` serves the actual game rather than a mockup.
8. Deploy from a trusted terminal via `npx wrangler deploy`. Link the intended Cloudflare Worker public URL/domain.
9. In Safari and desktop browser verify: anonymous login screen; invalid password denied; authorized owner can play; invite tester from `/admin`; tester access works; revoked tester denied; no direct file URL works without session; all images/audio load; save and mobile orientation work.
10. Only distribute the URL after those checks actually pass.

## Safety / limitation

This approach is not digital rights management: approved testers can view game files their browsers download. It does, however, block unauthenticated requests when properly deployed with a private bucket and server-side sessions.

The public `preoink-new-website` repository intentionally contains **no game assets**. The existing PreOink Cinematic Edition repository remains the gameplay source of truth. Source code commits alone do not deploy or update the game.

## Still needed before production

- Run the Worker and its end-to-end security tests under Cloudflare local development.
- Owner performs database and private R2 provisioning.
- Import and verify the exact current game build.
- Add password change/reset flow, stronger brute-force controls and auditing if broader testing is planned.
- Verify the deployed private domain and final iPhone Safari functionality.

Do not call the public repo itself a private deployment. Do not put game files under GitHub Pages.
