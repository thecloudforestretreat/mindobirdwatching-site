# Homepage performance update — October 9, 2026

English and Spanish homepages render the shared header in the initial HTML. After editing assets/includes/header.html, run `python3 scripts/sync-homepage-headers.py` to refresh the homepage snapshots. includes.js recognizes the existing header and still localizes and initializes it. The legacy site.js menu controller now skips modern headers, avoiding duplicate toggles.

New WebP delivery assets retain original images. The shared header uses a 256px, 21 KB logo instead of a 1.3 MB PNG. Homepage images have intrinsic dimensions; below-fold images load lazily. The mobile hero retains eager/high-priority loading. Homepage font discovery starts in HTML. head.js no longer refetches the existing header stylesheet under a different URL. Floating WhatsApp image aspect ratios reserve its space.

Local mobile Lighthouse comparison (one run each, same localhost server implementation): performance 54 → 63; LCP 18.7s → 7.1s; CLS 0.158 → 0.039. These local results are not directly comparable to the earlier production score of 44. Production must be tested after deployment. Further loading optimization remains warranted.

Chrome checks at 390px and 1440px: exactly one header; no horizontal overflow on homepage, Spanish homepage, booking and contact pages; mobile menu opens; mobile WhatsApp directs to its external URL, desktop opens the panel. Booking/contact forms remain present; no real submission or payment was made. Analytics/consent code and form submission handlers are retained.
