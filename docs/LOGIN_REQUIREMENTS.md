# Login requirements — PreOink Cinematic Edition

## Owner decision

The website must open to a mandatory **username/email and password** sign-in screen whenever the player starts a new visit. Only after valid authentication and tester approval may the browser receive the actual PreOink Cinematic Edition game files.

- Use **individual tester accounts**, not one shared password.
- No guest access, public self-registration, or "remember me" option.
- Do not silently restore a login when the tester reopens the browser/site. Prefer a session-only cookie and require fresh credentials on a new browser session. Reauthentication on every new navigation, rather than every full browser session, is a stricter requirement and should be confirmed before implementation if that distinction matters.
- Use secure server-side password validation (salted hashing, rate limits, TLS); never put passwords in GitHub, source, localStorage or browser JavaScript.
- Server must enforce both a valid session and owner-approved status for each game HTML/JS/image/audio/font request. Revoked accounts are denied immediately on the next check.
- The real game comes from the private Cinematic Edition repository and stays in a private server-side asset store. The public repository must hold only gateway/application code.
- Admin must be able to invite/approve/deactivate accounts securely.
- Follow free-first budget policy; no paid services without user approval.

## Important architectural note

The initial `src/index.js` Worker is a **Cloudflare Access signed-token gateway**, not a complete email/password login application. Cloudflare Access email One-Time PIN by itself does **not** satisfy the explicit PASSWORD requirement; configure an actual password-capable identity provider OR replace the gateway with a secure password-auth backend. Existing Worker token validation must never be bypassed with a client-side popup.

No live website, login, account service, private game assets or deployment has been verified through this repository. Do not claim any of these are ready merely because this specification is committed.

## Definition of done

- A non-authorized user gets no game files, even by direct URL.
- A valid approved tester enters username/email and password at the start of a new visit and gets the actual game.
- No account signup without admin action.
- Tester logout/expiration and revocation work.
- Reopening in a new browser session requires credentials.
- iPhone Safari gameplay works after authentication.
- Deployment and security are tested before sharing a playtest URL as protected.
