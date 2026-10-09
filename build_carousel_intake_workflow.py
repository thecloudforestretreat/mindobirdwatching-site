import json
import uuid
from pathlib import Path


OUT = Path("MBW - Carousel Intake - IMPORT.json")
WORKFLOW_ID = "wjq5Bgy5a6hIOnay"
DOC_URL = "https://docs.google.com/spreadsheets/d/1TCwGEscdKFVBH1C-2tnozoFrNS-rQiTgHA4M7iPX3-8/edit?usp=sharing"
SHEET_NAME = "ai_carousels"
CLOUD_NAME = "dd25hpdx3"
CLOUDINARY_UPLOAD_PRESET = "mbw_carousel_intake"

GS_CRED = {"googleSheetsOAuth2Api": {"id": "sJdVMmql2IyZ94ti", "name": "Google Sheets - MBW"}}
TG_CRED = {"telegramApi": {"id": "fvhEZEI6Ksxrj9DD", "name": "MBW - Notifications"}}
FORM_AUTH_CRED = {"httpBasicAuth": {"id": "16JJ05oTOEDzL2Ll", "name": "MBW Carousel Intake - Basic Auth"}}

HEADERS = [
    "carousel_id", *[f"image_{i}_url" for i in range(1, 11)],
    "images_json", "carousel_description", "slide_notes", "featured_birds", "scientific_name", "activity_name", "location",
    "verified_details", "input_status", "scheduled_date", "scheduled_time", "status", "media_type",
    "post_to_instagram", "post_to_facebook", "local_brief", "copy_review_status",
    "caption_generation_status", "caption", "instagram_hashtags", "facebook_caption",
    "copy_generated_at", "ai_model", "gemini_input_tokens", "gemini_output_tokens",
    "gemini_total_tokens", "posting_defaults_applied_at", "publishing_lock",
    "instagram_container_id", "instagram_published_date", "instagram_post_id", "instagram_permalink",
    "facebook_photo_ids", "facebook_published_date", "facebook_post_id", "facebook_permalink",
    "error_message", "telegram_sent_date",
]


def uid(name):
    return str(uuid.uuid5(uuid.NAMESPACE_URL, "mbw-carousel-intake/" + name))


def node(name, typ, version, position, parameters=None, credentials=None, **extra):
    value = {
        "parameters": parameters or {}, "type": typ, "typeVersion": version,
        "position": position, "id": uid(name), "name": name,
    }
    if credentials:
        value["credentials"] = credentials
    value.update(extra)
    return value


def code_node(name, position, js):
    return node(name, "n8n-nodes-base.code", 2, position, {"jsCode": js})


def schema():
    booleans = {"post_to_instagram", "post_to_facebook"}
    numbers = {"gemini_input_tokens", "gemini_output_tokens", "gemini_total_tokens"}
    result = []
    for header in HEADERS:
        result.append({
            "id": header, "displayName": header, "required": False,
            "defaultMatch": False, "display": True,
            "type": "boolean" if header in booleans else "number" if header in numbers else "string",
            "canBeUsedToMatch": True, "removed": False,
        })
    result.append({
        "id": "row_number", "displayName": "row_number", "required": False,
        "defaultMatch": False, "display": True, "type": "number",
        "canBeUsedToMatch": True, "readOnly": True, "removed": True,
    })
    return result


FORM_FIELDS = {"values": [
    {
        "fieldLabel": "Upload 2 to 10 carousel images",
        "fieldName": "carousel_images", "fieldType": "file",
        "multipleFiles": True, "acceptFileTypes": ".jpg,.jpeg,.png,.webp",
        "requiredField": True,
    },
    {
        "fieldLabel": "Overall carousel description",
        "fieldName": "carousel_description", "fieldType": "textarea",
        "placeholder": "What do these images show? Keep this factual.",
        "requiredField": True,
    },
    {
        "fieldLabel": "Known species (optional)",
        "fieldName": "known_species", "fieldType": "text",
        "placeholder": "Separate confirmed names with |", "requiredField": False,
    },
    {
        "fieldLabel": "Activity or tour",
        "fieldName": "activity_name", "fieldType": "text",
        "placeholder": "Birdwatching tour | Night walk", "requiredField": False,
    },
    {
        "fieldLabel": "Location",
        "fieldName": "location", "fieldType": "text",
        "defaultValue": "Mindo, Ecuador", "requiredField": True,
    },
    {
        "fieldLabel": "Verified details (optional)",
        "fieldName": "verified_details", "fieldType": "textarea",
        "placeholder": "Only facts you personally confirm may be entered here.",
        "requiredField": False,
    },
    {
        "fieldLabel": "Guest image permission confirmed",
        "fieldName": "guest_permission_confirmed", "fieldType": "checkbox",
        "fieldOptions": {"values": [{"option": "Yes — permission is confirmed for recognizable guests"}]},
        "limitSelection": "unlimited", "requiredField": False,
    },
]}


VALIDATE_AND_SPLIT_JS = r"""
const items = $input.all();
if (items.length !== 1) throw new Error('Expected one form submission.');
const src = items[0];
const binaryEntries = Object.entries(src.binary || {});
if (binaryEntries.length < 2 || binaryEntries.length > 10) throw new Error(`Between 2 and 10 images are required; received ${binaryEntries.length}.`);

const allowed = new Set(['image/jpeg','image/png','image/webp']);
const seen = new Set();
const output = [];
for (let i = 0; i < binaryEntries.length; i++) {
  const [key, file] = binaryEntries[i];
  if (!allowed.has(String(file.mimeType || '').toLowerCase())) {
    throw new Error(`Image ${i + 1} has unsupported type ${file.mimeType || 'unknown'}.`);
  }
  const buffer = await this.helpers.getBinaryDataBuffer(0, key);
  if (!buffer.length) throw new Error(`Image ${i + 1} is empty.`);
  if (buffer.length > 20 * 1024 * 1024) throw new Error(`Image ${i + 1} exceeds 20 MB.`);
  let hash = 2166136261;
  for (const byte of buffer) { hash ^= byte; hash = Math.imul(hash, 16777619); }
  const fingerprint = `${buffer.length}:${hash >>> 0}`;
  if (seen.has(fingerprint)) throw new Error(`Image ${i + 1} duplicates another uploaded image.`);
  seen.add(fingerprint);
  output.push({
    json: {
      image_index: i + 1,
      image_base64: buffer.toString('base64'),
      file_name: file.fileName || `image-${i + 1}`,
      mime_type: file.mimeType,
      file_size: buffer.length,
      carousel_description: String(src.json.carousel_description || '').trim(),
      known_species: String(src.json.known_species || '').trim(),
      activity_name: String(src.json.activity_name || '').trim(),
      location: String(src.json.location || 'Mindo, Ecuador').trim(),
      verified_details: String(src.json.verified_details || '').trim(),
      guest_permission_confirmed: Array.isArray(src.json.guest_permission_confirmed)
        ? src.json.guest_permission_confirmed.length > 0
        : Boolean(src.json.guest_permission_confirmed),
    },
    binary: { data: file },
  });
}
return output;
""".strip()


VISION_BODY = r"""={{ {
  model: 'qwen3.5:27b',
  prompt: `Analyze image ${$json.image_index} for a Mindo Bird Watching carousel intake.
User-supplied context: ${$json.carousel_description}
Known species supplied by user: ${$json.known_species || 'None'}
Return JSON only with: content_type (bird|wildlife|guest|landscape|activity|promotional|infographic|xray|other), neutral_visual_description, possible_species (array), species_confidence (low|medium|high), people_visible (boolean), promotional_asset (boolean), suggested_position (1-10), verification_flags (array).
Do not infer location, tour participation, ownership, guest status, permission, rarity, or guaranteed sightings. Treat species names as suggestions unless supplied by the user.`,
  images: [$json.image_base64], stream: false, think: false, format: 'json', keep_alive: '5m',
  options: { temperature: 0.1, num_predict: 350 }
} }}"""


PARSE_VISION_JS = r"""
return $input.all().map(item => {
  const base = item.json;
  let parsed = {};
  try { parsed = JSON.parse(String(base.response || '{}').replace(/^```json\s*|\s*```$/g, '')); } catch (_) {}
  const allowed = new Set(['bird','wildlife','guest','landscape','activity','promotional','infographic','xray','other']);
  return { json: {
    ...base,
    vision_content_type: allowed.has(parsed.content_type) ? parsed.content_type : 'other',
    vision_description: String(parsed.neutral_visual_description || `Image ${base.image_index}`).trim(),
    possible_species: Array.isArray(parsed.possible_species) ? parsed.possible_species.map(String).slice(0,5) : [],
    species_confidence: ['low','medium','high'].includes(parsed.species_confidence) ? parsed.species_confidence : 'low',
    people_visible: parsed.people_visible === true,
    promotional_asset: parsed.promotional_asset === true,
    suggested_position: Number(parsed.suggested_position) || base.image_index,
    verification_flags: Array.isArray(parsed.verification_flags) ? parsed.verification_flags.map(String).slice(0,8) : ['vision_json_parse_failed'],
  }, binary: item.binary };
});
""".strip()


CHECK_UPLOAD_CONFIG_JS = r"""
return $input.all().map(item => {
  if (!$json.cloudinary_upload_preset || String($json.cloudinary_upload_preset).startsWith('REPLACE_')) {
    throw new Error('SETUP REQUIRED: replace the Cloudinary unsigned upload preset in [SETUP] Validate Cloudinary Configuration before testing.');
  }
  return item;
});
""".strip()


AGGREGATE_JS = r"""
const uploaded = $input.all();
if (uploaded.length < 2 || uploaded.length > 10) throw new Error(`Expected 2–10 completed uploads; received ${uploaded.length}.`);
const rows = uploaded.map((item, i) => {
  const r = item.json;
  const original = r._intake || {};
  const secure = String(r.secure_url || '');
  if (!/^https:\/\//.test(secure)) throw new Error(`Cloudinary upload ${i + 1} did not return secure_url.`);
  return {
    index: Number(original.image_index || i + 1),
    url: secure.replace('/upload/', `/upload/${['promotional','infographic','xray'].includes(original.vision_content_type) ? 'c_pad,b_rgb:f7f4e8' : 'c_fill,g_auto'},h_1350,w_1080,q_auto,f_auto/`),
    original_url: secure,
    content_type: original.vision_content_type,
    description: original.vision_description,
    possible_species: original.possible_species || [],
    species_confidence: original.species_confidence || 'low',
    people_visible: original.people_visible === true,
    promotional_asset: original.promotional_asset === true,
    suggested_position: original.suggested_position,
    flags: original.verification_flags || [],
    context: original,
  };
}).sort((a,b) => a.index - b.index);
const first = rows[0].context;
return [{ json: {
  submitted_order: rows,
  carousel_description: first.carousel_description,
  known_species: first.known_species,
  activity_name: first.activity_name,
  location: first.location,
  verified_details: first.verified_details,
  guest_permission_confirmed: first.guest_permission_confirmed,
} }];
""".strip()


EDITOR_BODY = r"""={{ {
  model: 'qwen3.5:27b', think: false, stream: false, format: 'json', keep_alive: 0,
  prompt: `Prepare a REVIEW-ONLY carousel intake record from this JSON:\n${JSON.stringify($json)}\n
Return JSON only with: proposed_order (array containing every supplied image index exactly once), carousel_description, slide_notes (one numbered sentence for each image in proposed order), suggested_featured_birds (array), review_flags (array), ordering_reason.
Rules: preserve user facts; visual species are suggestions only; do not invent locations, tours, guest identities, emotions, permission, dates, rarity, abundance, or sightings. Flag every recognizable person if permission was not confirmed. Keep promotional images clearly labeled.`,
  options: { temperature: 0.1, num_predict: 900 }
} }}"""


BUILD_ROW_JS = r"""
const source = $('Aggregate Uploaded Images').first().json;
let edit = {};
try { edit = JSON.parse(String($json.response || '{}').replace(/^```json\s*|\s*```$/g, '')); } catch (_) {}
const expected = source.submitted_order.map(v => Number(v.index));
const proposed = Array.isArray(edit.proposed_order) ? edit.proposed_order.map(Number) : [];
const validOrder = proposed.length === expected.length && new Set(proposed).size === expected.length &&
  proposed.every(v => expected.includes(v));
const order = validOrder ? proposed : expected;
const byIndex = new Map(source.submitted_order.map(v => [v.index, v]));
const arranged = order.map(v => byIndex.get(v));
const now = DateTime.now().setZone('America/New_York');
const carouselId = `CAR-${now.toFormat('yyyyLLdd-HHmmss')}`;
const peopleNeedPermission = arranged.some(v => v.people_visible) && !source.guest_permission_confirmed;
const modelFlags = Array.isArray(edit.review_flags) ? edit.review_flags.map(String) : [];
if (peopleNeedPermission) modelFlags.unshift('BLOCK: recognizable people detected; guest permission not confirmed');
if (!validOrder) modelFlags.push('AI order invalid; submitted order preserved');
const species = source.known_species
  ? source.known_species
  : (Array.isArray(edit.suggested_featured_birds) ? edit.suggested_featured_birds.join(' | ') : '');
const row = {
  carousel_id: carouselId,
  carousel_description: String(source.carousel_description || edit.carousel_description || '').trim(),
  slide_notes: String(edit.slide_notes || arranged.map((v,i) => `${i+1}: ${v.description}`).join('\n')).trim(),
  featured_birds: species,
  activity_name: source.activity_name,
  location: source.location || 'Mindo, Ecuador',
  verified_details: source.verified_details,
  input_status: 'REVIEW', scheduled_date: '', scheduled_time: '', status: 'Draft', media_type: 'CAROUSEL',
  post_to_instagram: true, post_to_facebook: true,
  local_brief: JSON.stringify({ submitted_order: source.submitted_order.map(v => ({index:v.index,description:v.description,possible_species:v.possible_species,species_confidence:v.species_confidence,content_type:v.content_type,people_visible:v.people_visible,promotional_asset:v.promotional_asset,flags:v.flags})), proposed_order: order, ordering_reason: edit.ordering_reason || '', review_flags: modelFlags }),
  copy_review_status: peopleNeedPermission ? 'BLOCKED_PERMISSION_REVIEW' : 'PENDING_HUMAN_REVIEW',
  caption_generation_status: 'NOT_STARTED', caption: '', instagram_hashtags: '', facebook_caption: '',
  copy_generated_at: '', ai_model: 'qwen3.5:27b local vision intake',
  gemini_input_tokens: 0, gemini_output_tokens: 0, gemini_total_tokens: 0,
  error_message: modelFlags.join(' | '), telegram_sent_date: '',
};
arranged.forEach((v,i) => { row[`image_${i+1}_url`] = v.url; });
for (let i = arranged.length; i < 10; i++) row[`image_${i+1}_url`] = '';
row.images_json = JSON.stringify(arranged.map((v,i) => ({order:i+1,delivery_url:v.url,original_url:v.original_url,content_type:v.content_type,fit_mode:['promotional','infographic','xray'].includes(v.content_type)?'fit':'fill'})));
row._review_flags = modelFlags;
row._order = order;
row._people_need_permission = peopleNeedPermission;
return [{json: row}];
""".strip()


TG_JS = r"""
function esc(v){return String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
const r={...$('[SHEET] Build Review-Only Row').item.json};
const images=Array.from({length:10},(_,i)=>r[`image_${i+1}_url`]).filter(Boolean);
const links=images.map((url,i)=>`${i+1}. <a href="${esc(url)}">Open image</a>`).join('\n');
const flags=(r._review_flags||[]).length ? (r._review_flags||[]).map(v=>`• ${esc(v)}`).join('\n') : 'None detected — human review still required.';
r.telegram_text=`<b>Carousel Intake Ready for Review</b>\n\n<b>ID:</b> ${esc(r.carousel_id)}\n<b>Status:</b> Draft / REVIEW\n<b>Proposed order:</b> ${esc((r._order||[]).join(' → '))}\n\n${links}\n\n<b>Description:</b>\n${esc(r.carousel_description)}\n\n<b>Slide notes:</b>\n<pre>${esc(r.slide_notes)}</pre>\n\n<b>Suggested birds:</b> ${esc(r.featured_birds||'None')}\n<b>Review flags:</b>\n${flags}\n\nReview the row in <b>ai_carousels</b>. Confirm species, facts, image order, and guest permission. Then set input_status to VERIFIED and status to Testing. Nothing has been scheduled or published.`;
return [{json:r}];
""".strip()


nodes = []
nodes.append(node("[INTAKE] Upload Carousel Images", "n8n-nodes-base.formTrigger", 2.5, [-1320, 120], {
    "authentication": "basicAuth",
    "formTitle": "MBW Carousel Intake",
    "formDescription": "Upload 2–10 images. The Mac mini will prepare a review-only draft; nothing is published automatically.",
    "formFields": FORM_FIELDS,
    "responseMode": "onReceived",
    "options": {
        "path": "mbw-carousel-intake",
        "buttonLabel": "Create review draft",
        "ignoreBots": True,
        "useWorkflowTimezone": True,
        "respondWithOptions": {"values": {"formSubmittedText": "Upload received. Local analysis may take several minutes; Telegram will notify you when the review draft is ready."}},
        "appendAttribution": False,
    },
}, FORM_AUTH_CRED, webhookId=uid("form-webhook")))
nodes.append(code_node("[INTAKE] Validate and Split Images", [-1080, 120], VALIDATE_AND_SPLIT_JS))
nodes.append(node("[VISION] Analyze Each Image Locally", "n8n-nodes-base.httpRequest", 4.2, [-840, 120], {
    "method": "POST", "url": "http://127.0.0.1:11434/api/generate",
    "sendHeaders": True, "headerParameters": {"parameters": [{"name": "Content-Type", "value": "application/json"}]},
    "sendBody": True, "specifyBody": "json", "jsonBody": VISION_BODY,
    "options": {"timeout": 300000, "response": {"response": {"responseFormat": "json"}}},
}, retryOnFail=True, maxTries=2, waitBetweenTries=5000))
nodes.append(node("[VISION] Merge Image and Analysis", "n8n-nodes-base.merge", 3.2, [-600, 120], {
    "mode": "combine", "combineBy": "combineByPosition", "options": {},
}))
nodes.append(code_node("[VISION] Parse Safe Metadata", [-360, 120], PARSE_VISION_JS))
nodes.append(node("[SETUP] Cloudinary Upload Configuration", "n8n-nodes-base.set", 3.4, [-120, 120], {
    "assignments": {"assignments": [
        {"id": uid("cloud-name"), "name": "cloudinary_cloud_name", "value": CLOUD_NAME, "type": "string"},
        {"id": uid("upload-preset"), "name": "cloudinary_upload_preset", "value": CLOUDINARY_UPLOAD_PRESET, "type": "string"},
    ]},
    "includeOtherFields": True, "options": {},
}))
nodes.append(code_node("[SETUP] Validate Cloudinary Configuration", [120, 120], CHECK_UPLOAD_CONFIG_JS))
nodes.append(node("[UPLOAD] Send Images to Cloudinary", "n8n-nodes-base.httpRequest", 4.2, [360, 120], {
    "method": "POST",
    "url": "={{ 'https://api.cloudinary.com/v1_1/' + $json.cloudinary_cloud_name + '/image/upload' }}",
    "sendBody": True, "contentType": "multipart-form-data",
    "bodyParameters": {"parameters": [
        {"parameterType": "formBinaryData", "name": "file", "inputDataFieldName": "data"},
        {"name": "upload_preset", "value": "={{ $json.cloudinary_upload_preset }}"},
        {"name": "folder", "value": "mbw/carousel-intake"},
        {"name": "context", "value": "={{ 'carousel_intake_index=' + $json.image_index }}"},
    ]},
    "options": {"timeout": 180000, "response": {"response": {"responseFormat": "json"}}},
}, retryOnFail=True, maxTries=2, waitBetweenTries=5000))
nodes.append(code_node("[UPLOAD] Attach Intake Metadata", [600, 120],
    "return $input.all().map((item,i)=>({json:{...item.json,_intake:$('[VISION] Parse Safe Metadata').all()[i].json}}));"))
nodes.append(code_node("Aggregate Uploaded Images", [840, 120], AGGREGATE_JS))
nodes.append(node("[EDITOR] Propose Order and Notes Locally", "n8n-nodes-base.httpRequest", 4.2, [1080, 120], {
    "method": "POST", "url": "http://127.0.0.1:11434/api/generate",
    "sendHeaders": True, "headerParameters": {"parameters": [{"name": "Content-Type", "value": "application/json"}]},
    "sendBody": True, "specifyBody": "json", "jsonBody": EDITOR_BODY,
    "options": {"timeout": 300000, "response": {"response": {"responseFormat": "json"}}},
}, retryOnFail=True, maxTries=2, waitBetweenTries=5000))
nodes.append(code_node("[SHEET] Build Review-Only Row", [1320, 120], BUILD_ROW_JS))

append_values = {header: "={{ $json." + header + " }}" for header in HEADERS}
nodes.append(node("[SHEET] Append Draft to ai_carousels", "n8n-nodes-base.googleSheets", 4.6, [1560, 120], {
    "operation": "append", "documentId": {"__rl": True, "value": DOC_URL, "mode": "url"},
    "sheetName": {"__rl": True, "value": SHEET_NAME, "mode": "name"},
    "columns": {"mappingMode": "defineBelow", "value": append_values, "matchingColumns": [], "schema": schema(),
                "attemptToConvertTypes": False, "convertFieldsToString": False},
    "options": {},
}, GS_CRED, retryOnFail=True, maxTries=2, waitBetweenTries=5000))
nodes.append(code_node("[TG] Build Review Message", [1800, 120], TG_JS))
nodes.append(node("[TG] Send Intake Review", "n8n-nodes-base.telegram", 1.2, [2040, 120], {
    "chatId": "-1003067570080", "text": "={{ $json.telegram_text }}",
    "additionalFields": {"appendAttribution": False, "parse_mode": "HTML", "disable_web_page_preview": True},
}, TG_CRED, retryOnFail=True, maxTries=2, waitBetweenTries=5000))
nodes.append(node("[README] Setup, Security, and Review Gate", "n8n-nodes-base.stickyNote", 1, [-1320, -360], {
    "content": "## MBW Carousel Intake — INACTIVE BY DESIGN\n\n1. Create a dedicated unsigned Cloudinary upload preset restricted to images, folder `mbw/carousel-intake`, and appropriate size limits. Replace the placeholder in `[SETUP] Cloudinary Upload Configuration`.\n2. Protect the form with Cloudflare Access or select Basic Auth with a new dedicated credential before activation. Never expose an unauthenticated upload form publicly.\n3. Refresh Google Sheets columns after import.\n4. Test with 2–10 disposable image copies first.\n5. Output is always `Draft` + `REVIEW`; this workflow cannot schedule or publish.\n6. Species, factual context, guest permission, and promotional classification require human review.\n7. Cloudinary receives copies; originals are never deleted or modified.\n8. The publisher remains a separate workflow and requires `VERIFIED` plus `Testing` or `Scheduled`.",
    "height": 430, "width": 660, "color": 5,
}))

connections = {}


def connect(src, dst, src_index=0, dst_index=0):
    main = connections.setdefault(src, {}).setdefault("main", [])
    while len(main) <= src_index:
        main.append([])
    main[src_index].append({"node": dst, "type": "main", "index": dst_index})


connect("[INTAKE] Upload Carousel Images", "[INTAKE] Validate and Split Images")
connect("[INTAKE] Validate and Split Images", "[VISION] Analyze Each Image Locally")
connect("[INTAKE] Validate and Split Images", "[VISION] Merge Image and Analysis", 0, 0)
connect("[VISION] Analyze Each Image Locally", "[VISION] Merge Image and Analysis", 0, 1)
connect("[VISION] Merge Image and Analysis", "[VISION] Parse Safe Metadata")
connect("[VISION] Parse Safe Metadata", "[SETUP] Cloudinary Upload Configuration")
connect("[SETUP] Cloudinary Upload Configuration", "[SETUP] Validate Cloudinary Configuration")
connect("[SETUP] Validate Cloudinary Configuration", "[UPLOAD] Send Images to Cloudinary")
connect("[UPLOAD] Send Images to Cloudinary", "[UPLOAD] Attach Intake Metadata")
connect("[UPLOAD] Attach Intake Metadata", "Aggregate Uploaded Images")
connect("Aggregate Uploaded Images", "[EDITOR] Propose Order and Notes Locally")
connect("[EDITOR] Propose Order and Notes Locally", "[SHEET] Build Review-Only Row")
connect("[SHEET] Build Review-Only Row", "[SHEET] Append Draft to ai_carousels")
connect("[SHEET] Append Draft to ai_carousels", "[TG] Build Review Message")
connect("[TG] Build Review Message", "[TG] Send Intake Review")

workflow = {
    "id": WORKFLOW_ID,
    "name": "MBW - Carousel Intake",
    "nodes": nodes, "pinData": {}, "connections": connections, "active": False,
    "settings": {"executionOrder": "v1", "timezone": "America/New_York", "saveDataErrorExecution": "all"},
    "versionId": uid("workflow-version"),
    "meta": {"templateCredsSetupCompleted": True}, "tags": [],
}

OUT.write_text(json.dumps(workflow, indent=2) + "\n")
print(OUT.resolve())
print(f"nodes={len(nodes)} headers={len(HEADERS)} active={workflow['active']}")
