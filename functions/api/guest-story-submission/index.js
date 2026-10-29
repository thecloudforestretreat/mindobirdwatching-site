const ALLOWED_STORIES = new Set(["shannon-skalos", "guest-story-general"]);
const ALLOWED_TYPES = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);
const MAX_FILES = 10;
const MAX_FILE_BYTES = 15 * 1024 * 1024;
const MAX_TOTAL_BYTES = 75 * 1024 * 1024;

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

function clean(value, maxLength = 1000) {
  return String(value || "").trim().slice(0, maxLength);
}

function safeBaseName(name) {
  return String(name || "photo")
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/\.[^.]+$/, "")
    .slice(0, 80) || "photo";
}

function isFile(value) {
  return value && typeof value === "object" && typeof value.arrayBuffer === "function" && Number.isFinite(value.size);
}

async function hasValidImageSignature(file) {
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (file.type === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (file.type === "image/png") return [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((value, index) => bytes[index] === value);
  if (file.type === "image/webp") {
    return String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  }
  return false;
}

async function verifyTurnstile(request, token, secret) {
  if (!secret) return { success: false, configurationError: true };
  if (!token) return { success: false };
  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        secret,
        response: token,
        remoteip: request.headers.get("CF-Connecting-IP") || "",
      }),
    });
    return await response.json();
  } catch {
    return { success: false };
  }
}

export async function onRequestPost({ request, env }) {
  if (!env.N8N_GUEST_STORY_UPLOAD_WEBHOOK_URL) {
    return json({ ok: false, message: "The private upload destination is not configured yet." }, 503);
  }

  const contentType = request.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("multipart/form-data")) {
    return json({ ok: false, message: "Invalid submission format." }, 415);
  }

  let form;
  try {
    form = await request.formData();
  } catch {
    return json({ ok: false, message: "The form could not be read. Please try again." }, 400);
  }

  // Honeypot submissions are acknowledged without forwarding any data.
  if (clean(form.get("website"), 200)) return json({ ok: true, submission_id: "accepted" });

  const turnstile = await verifyTurnstile(
    request,
    clean(form.get("cf-turnstile-response"), 4096),
    env.TURNSTILE_SECRET_KEY
  );
  if (turnstile.configurationError) {
    return json({ ok: false, message: "The security check is not configured yet." }, 503);
  }
  if (!turnstile.success) {
    return json({ ok: false, message: "The security check was not completed. Please try again." }, 403);
  }

  const storyId = clean(form.get("story_id"), 80).toLowerCase();
  const guestName = clean(form.get("guest_name"), 120);
  const guestEmail = clean(form.get("guest_email"), 180).toLowerCase();
  const story = clean(form.get("story"), 6000);
  const creditLine = clean(form.get("credit_line"), 220);
  const rightsConfirmed = clean(form.get("rights_confirmed"), 20) === "yes";
  const publicationPermission = clean(form.get("publication_permission"), 20) === "yes";
  const finalReview = clean(form.get("final_review"), 40);

  if (!ALLOWED_STORIES.has(storyId)) return json({ ok: false, message: "This story invitation is not valid." }, 400);
  if (!guestName || !/^\S+@\S+\.\S+$/.test(guestEmail)) return json({ ok: false, message: "Your name and a valid email address are required." }, 400);
  if (story.length < 40) return json({ ok: false, message: "Please add a short trip reflection before submitting." }, 400);
  if (!creditLine) return json({ ok: false, message: "Please provide the photography credit you want us to use." }, 400);
  if (!rightsConfirmed || !publicationPermission) return json({ ok: false, message: "Both image-rights and publication permissions are required." }, 400);
  if (!new Set(["review_before_publishing", "approved_as_submitted"]).has(finalReview)) {
    return json({ ok: false, message: "Please choose a final-review preference." }, 400);
  }

  const photos = form.getAll("photos").filter(isFile).filter((file) => file.size > 0);
  if (!photos.length || photos.length > MAX_FILES) {
    return json({ ok: false, message: "Please upload between 1 and 10 images." }, 400);
  }

  let totalBytes = 0;
  for (const file of photos) {
    totalBytes += file.size;
    if (!ALLOWED_TYPES.has(file.type)) return json({ ok: false, message: "Photos must be JPEG, PNG, or WebP files." }, 400);
    if (file.size > MAX_FILE_BYTES) return json({ ok: false, message: "Each image must be 15 MB or smaller." }, 413);
    if (!(await hasValidImageSignature(file))) return json({ ok: false, message: "One of the selected files is not a valid image." }, 400);
  }
  if (totalBytes > MAX_TOTAL_BYTES) return json({ ok: false, message: "The combined upload must be 75 MB or smaller." }, 413);

  const submittedAt = new Date().toISOString();
  const submissionId = "gs_" + crypto.randomUUID();
  const storedFiles = photos.map((file, index) => ({
    drive_name: `${submissionId}-${String(index + 1).padStart(2, "0")}-${safeBaseName(file.name)}.${ALLOWED_TYPES.get(file.type)}`,
    original_name: clean(file.name, 180),
    content_type: file.type,
    bytes: file.size,
  }));

  const manifest = {
    schema_version: 2,
    submission_id: submissionId,
    story_id: storyId,
    submitted_at: submittedAt,
    page_language: clean(form.get("page_language"), 8) || "en",
    source_page: clean(form.get("source_page"), 500),
    destination: "google_drive_private_intake",
    guest: {
      name: guestName,
      email: guestEmail,
      professional_title: clean(form.get("professional_title"), 240),
      home_country: clean(form.get("home_country"), 120),
      instagram_url: clean(form.get("instagram_url"), 500),
      ebird_url: clean(form.get("ebird_url"), 500),
    },
    trip: {
      dates: clean(form.get("trip_dates"), 240),
      guide_names: clean(form.get("guide_names"), 240),
      tours_joined: clean(form.get("tours_joined"), 1200),
    },
    editorial: {
      story,
      favorite_bird: clean(form.get("favorite_bird"), 1200),
      favorite_photo: clean(form.get("favorite_photo"), 1200),
      favorite_guiding_moment: clean(form.get("favorite_guiding_moment"), 1200),
      corrections: clean(form.get("corrections"), 2400),
      guided_checklists: clean(form.get("guided_checklists"), 2000),
      captions: clean(form.get("captions"), 5000),
    },
    permissions: {
      credit_line: creditLine,
      rights_confirmed: rightsConfirmed,
      publication_permission: publicationPermission,
      final_review: finalReview,
    },
    upload: {
      file_count: storedFiles.length,
      total_bytes: totalBytes,
      limits: { max_files: MAX_FILES, max_file_bytes: MAX_FILE_BYTES, max_total_bytes: MAX_TOTAL_BYTES },
    },
    files: storedFiles,
  };

  const outbound = new FormData();
  outbound.append("manifest_json", JSON.stringify(manifest));
  photos.forEach((file, index) => outbound.append("photos", file, storedFiles[index].drive_name));

  try {
    const response = await fetch(env.N8N_GUEST_STORY_UPLOAD_WEBHOOK_URL, {
      method: "POST",
      body: outbound,
      signal: AbortSignal.timeout(90000),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || result.ok !== true) throw new Error("Private intake returned " + response.status);
    return json({ ok: true, submission_id: submissionId, file_count: storedFiles.length });
  } catch (error) {
    console.error("Guest-story Drive handoff failed", { submissionId, message: error?.message });
    return json({
      ok: false,
      message: "The upload could not be completed. No story will be published. Please try again.",
      submission_id: submissionId,
    }, 502);
  }
}

export async function onRequestGet() {
  return json({ ok: false, message: "Method Not Allowed" }, 405);
}
