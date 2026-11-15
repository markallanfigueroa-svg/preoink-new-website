# PreOink free Worker Static Assets migration — implementation contract

Status: **not implemented or deployed**. The current Worker still binds an absent R2 bucket; Cloudflare deploy fails with error 10085. The real game remains in the private `-PreOink-Cinematic-Edition-` repository.

## Verified baseline
- The private game's GitHub Actions `PreOink free Worker asset size audit` passed on 2026-11-15.
- The Cloudflare connected build is named `preoink-new-website`, but `wrangler.toml` currently names `preoink-secure-playtest`.
- Cloudflare's existing deploy command is `npx wrangler deploy`; the repository's checked command is `npm run deploy`.
- Current R2 binding `GAME_FILES` references missing bucket `preoink-private-game`.
- D1 binding `DB` is configured, but successful migrations, owner bootstrap, and login are not yet verified.

## Non-negotiable security properties
1. **Do not** copy private game files into this public GitHub repository, including generated files, GitHub Actions artifacts, commits, or PRs.
2. Fetch/build the game only inside an authorized CI job with read-only credentials to the private game repo. Keep tokens in Cloudflare build secrets; do not log or expose them.
3. Configure Cloudflare Workers Static Assets to run the Worker **before** serving *all* asset requests, including HTML, JS, images, audio, fonts, and unknown paths. The Worker must check D1 session authentication for each asset request and return 401/redirect otherwise.
4. Ensure there is **no public static-asset bypass**, direct public bucket URL, alternate Pages deployment, or exposed artifact.
5. Ensure Worker assets are served through the authenticated asset binding only. Do not assume assets are protected merely because `/play` requires login.
6. Preserve the existing login, logout, tester revocation, and root reauthentication behavior. Avoid caching private responses in shared caches.
7. Keep on the Cloudflare free plan; never activate R2 or enable paid overages. Confirm the free-plan asset and request limits before deployment.

## Implementation steps
1. Modify `wrangler.toml` to use the actual Cloudflare connected Worker name and `[assets]` configuration, removing the R2 binding **in the same tested change**. Configure `run_worker_first` appropriately for all game asset requests.
2. Update the Worker to read game objects from the Static Assets binding after authorization, preserving MIME and private cache controls as needed.
3. Build a Cloudflare build command that checks out the **private** game repository securely and stages only `preoink/dist` into an ignored local output folder. The source repository must remain private. Confirm Cloudflare's build environment supports the chosen authentication method before committing it.
4. Expand automated tests to assert anonymous requests to `/play`, `/game/story.js`, `/game/*.webp`, and `/game/fonts/*` cannot receive asset bytes, while valid users can.
5. Confirm the owner D1 migration/bootstrap has been applied through a trusted channel. Do not put credentials in repository files or chat.
6. Deploy only after the security tests and private checkout work. Verify the actual deployed game build label and iPhone Safari functionality.

## Stop conditions
- If the private repository cannot be fetched safely in Cloudflare's connected build, **stop** rather than commit game assets publicly.
- If any game asset can be fetched anonymously, **stop** and do not publish the URL.
- If deployment requires paid Cloudflare services or billing activation, **stop** and request explicit approval.
- Do not report this as deployed until the authenticated live game has been tested.
