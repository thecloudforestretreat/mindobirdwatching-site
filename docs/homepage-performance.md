# Homepage performance update — October 9, 2026

English and Spanish homepages render the shared header in the initial HTML. After editing assets/includes/header.html, run `python3 scripts/sync-homepage-headers.py` to refresh the homepage snapshots. includes.js recognizes the existing header and still localizes and initializes it. The legacy site.js menu controller now skips modern headers, avoiding duplicate toggles.

New WebP delivery assets retain original images. The shared header uses a 256px, 21 KB logo instead of a 1.3 MB PNG. Homepage images have intrinsic dimensions; below-fold images load lazily. The mobile hero retains eager/high-priority loading. Homepage font discovery starts in HTML. head.js no longer refetches the existing header stylesheet under a different URL. Floating WhatsApp image aspect ratios reserve its space.

Local mobile Lighthouse comparison (one run each, same localhost server implementation): performance 54 → 63; LCP 18.7s → 7.1s; CLS 0.158 → 0.039. These local results are not directly comparable to the earlier production score of 44. Production must be tested after deployment. Further loading optimization remains warranted.

Chrome checks at 390px and 1440px: exactly one header; no horizontal overflow on homepage, Spanish homepage, booking and contact pages; mobile menu opens; mobile WhatsApp directs to its external URL, desktop opens the panel. Booking/contact forms remain present; no real submission or payment was made. Analytics/consent code and form submission handlers are retained.

## Homepage CSS bundle

The two homepages now use assets/css/homepage.css (about 64 KB) instead of the 704 KB site-wide stylesheet. Internal pages retain site.css. Build with `npm install --prefix scripts` then `npm run --prefix scripts build:homepage` after changing styles, shared includes, homepage markup or homepage JavaScript. The generator conservatively retains generic rules, keyframes, dynamic classes found in JS, and functional selectors. It preserves rule order. Homepage fonts remain loaded in HTML; the bundle omits the redundant CSS import.

Computed-style comparisons (main, header and footer elements) against the full stylesheet found zero differences at 390px and 1440px for EN and ES after correction of negated selector handling. The interaction checks still cover mobile menus, desktop/mobile WhatsApp, booking and contact pages. This extraction is specific to the current homepage inventory; new components require regeneration and visual checks.

Final local audits: mobile performance 91, LCP 3.2s, FCP 2.0s, CLS 0.039; desktop performance 95. Mobile baseline before either optimization was 54. These remain local lab results, not a production guarantee.
