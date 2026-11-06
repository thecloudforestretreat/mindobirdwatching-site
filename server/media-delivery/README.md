# Local carousel delivery

Carousel Studio uses its authenticated same-origin Pages Function. The function sends each selected image to the loopback Mac mini service through the existing tunnel using a server-only key. Public access can address only uploaded objects and their constrained image renditions; no filesystem path, Immich API or library browsing endpoint exists.

Storage: `/Volumes/JPG-Server-8TB/01-Projects/Mindo Bird Watching/Publishing/Media-Studio/Carousels`. Original bytes are preserved. Separate JPEG publishing renditions are 1080×1350, quality 95; fill uses the selected focus, default center, while fit uses padding. Repeated identical uploads use the same private-key-derived object identifier. Keep originals and renditions backed up; do not remove objects referenced by scheduled posts.

Runtime: `/Users/jpg/.config/mbw-media-delivery`, LaunchAgent `com.mbw.media-delivery`, loopback port8099. Image processing uses Pillow already installed in the existing Immich ML container; no new dependency download. Private key file mode0600; matching Pages secret `MBW_MEDIA_DELIVERY_KEY` in authenticated admin project only. Do not put the key in browser code, logs or publishing URLs.

Tunnel route: existing `n8n.mindobirdwatching.com`, path `^/media-delivery(/.*)?$`, origin `http://127.0.0.1:8099`, ordered before the catch-all n8n route. Tunnel is remotely managed: the dashboard configuration overrides local ingress. Existing application routes and Access policies must remain intact. No R2 storage and no Cloudinary uploads.

The mini, primary encrypted drive, Docker ML runtime (for new renders) and tunnel must be online. Existing cached renditions can be served without the ML process. Missing/locked/wrong primary drive fails closed; the service never writes into an unmounted `/Volumes` fallback directory. Uploads are limited to JPG/PNG/WebP12MiB and50MP. No auto-publication: existing review, approval, scheduled time, duplicate-publish claims and platform ID preservation remain enforced.

Validation gates: original SHA256 equality; 1080×1350 rendition; anonymous HTTPS GET/HEAD and Range; no redirect/login; missing key403; traversal404; trusted delivery-host/path validation; ordering/crop tests; one intended nine-slide draft, unapproved, followed by local-copy review. Migration of old Cloudinary URLs is separate: Cloudinary cloud dd25hpdx3 is disabled, so old scheduled items must not rely on it.

## Ready reels

`register_reel.py` registers one explicitly selected MP4 from `Mindo Bird Watching/Media/Publishing/Reels/Ready`, verifies H.264/AAC compatibility using existing ffprobe, creates an immutable APFS clone under `Publishing/Media-Studio/Reels`, and independently verifies source and publishing copies on the backup8TB. It does not transcode. The existing constrained HTTPS route serves only registered `original.mp4` objects with streamed GET/HEAD and normal/suffix byte ranges. No public filesystem browser or video-upload endpoint is added.

Reel Studio and the active Reels Admin Gateway accept only the owned opaque MP4 path plus legacy URLs. Normal scheduling, human review, per-platform publication claims and saved IDs remain unchanged. `Ready` placement alone does not submit or approve a reel. The baseline schedule is distinct from evidence-qualified timing recommendations.
