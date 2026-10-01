# Inquiry Studio remote access — September 28, 2026

User-facing URL: https://admin.mindobirdwatching.com/inquiry-studio/

The existing MBW Admin Cloudflare Access application controls the authorized emails. Pages Functions proxies only this path from the exact admin origin to the existing n8n.mindobirdwatching.com tunnel hostname. The remotely managed path rule precedes the regular n8n route, forwards to 127.0.0.1:8098, and sets HTTP Host Header to admin.mindobirdwatching.com.

The local studio verifies the Cloudflare Access JWT RSA signature, issuer, audience, expiry and user identity. It denies remote requests without a valid MBW Admin token. No new API secret or shared secret was created. The original local config.yml was restored because remote tunnel configuration takes precedence.

Automatic startup: /Users/jpg/Library/LaunchAgents/com.mbw.inquiry-studio.plist, RunAtLoad and KeepAlive. Runs with the existing AI-OS Python environment for cryptography support. The application binds only to loopback. Logs and drafts remain in private/. The launch agent runs when the Mac user logs in; the Mac must be awake and online.

Verified through the production admin URL in the authenticated browser: inquiries load, saved test draft restores, editor assets load, unchanged synthetic test draft saves, Kathy draft generates locally, and export remains disabled pending pricing review. Kathy's test generation was not saved over any existing draft. Unauthenticated external requests and a forged-token origin request returned 403. This verifies the remote HTTPS route from this browser, not a physical second-device test.

Card/menu change: commit 813c9b6c. Proxy commits: f4941836 and 19556c89. Pilot continues using the existing 20-inquiry snapshot and has no sending endpoint.
