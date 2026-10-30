const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
const statusLabels = { new: "New", extracted: "Extracted", needs_review: "Needs review", approved: "Approved" };
const state = { records: [], selectedId: "", draft: null, dirty: false, saving: false };

async function api(path = "", options = {}) {
  const response = await fetch(`/api/itinerary-lab${path}`, { credentials: "same-origin", ...options, headers: { "Content-Type": "application/json", ...(options.headers || {}) } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) { const error = new Error(body.error || "Request failed."); error.body = body; throw error; }
  return body;
}

function notice(message, error = false) { const node = $("#notice"); node.hidden = false; node.textContent = message; node.style.borderColor = error ? "#df9e98" : "#dbc780"; node.style.background = error ? "#fff0ed" : "#fff8da"; }
function csv(value) { return String(value || "").split(/\n|,/).map(item => item.trim()).filter(Boolean); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function statusClass(status) { return status === "approved" ? "approved" : status === "needs_review" ? "warn" : ""; }

function renderStats() {
  const counts = { all: state.records.length, new: 0, needs_review: 0, approved: 0 };
  state.records.forEach(item => { if (counts[item.status] !== undefined) counts[item.status] += 1; });
  $("#stats").innerHTML = [["all", "Sources"], ["new", "New"], ["needs_review", "Needs review"], ["approved", "Approved knowledge"]].map(([key, label]) => `<article class="stat"><strong>${counts[key]}</strong><small>${label}</small></article>`).join("");
}

function renderSources() {
  $("#sourceList").innerHTML = state.records.length ? state.records.map(item => `<button class="sourceCard" type="button" data-source="${esc(item.sourceId)}" aria-current="${item.sourceId === state.selectedId}"><strong>${esc(item.title)}</strong><small>${esc(item.sourceName || item.sourceUrl || item.sourceType)}</small><span class="sourceMeta"><span class="badge ${statusClass(item.status)}">${esc(statusLabels[item.status] || item.status)}</span><small>${item.blocks.length} block${item.blocks.length === 1 ? "" : "s"}</small></span></button>`).join("") : `<p class="empty">No sources yet.</p>`;
}

function input(name, label, value, wide = false, type = "text") { return `<label class="${wide ? "wide" : ""}">${esc(label)}<input type="${type}" name="${esc(name)}" value="${esc(value)}"></label>`; }
function textarea(name, label, value, wide = true) { return `<label class="${wide ? "wide" : ""}">${esc(label)}<textarea name="${esc(name)}" rows="3">${esc(value)}</textarea></label>`; }

function blockMarkup(item, index) {
  return `<details class="block" data-block="${index}" ${index === 0 ? "open" : ""}><summary><span>Days ${esc(item.dayStart || "?")}${item.dayEnd && item.dayEnd !== item.dayStart ? `-${esc(item.dayEnd)}` : ""} · ${esc(item.title || "Untitled block")}</span><small>${esc(item.confidence || "low")} confidence</small></summary><div class="blockFields"><div class="grid">
    ${input("dayStart", "Start day", item.dayStart)}${input("dayEnd", "End day", item.dayEnd)}${input("title", "Block title", item.title, true)}${input("route", "Route", item.route, true)}${textarea("details", "Activities and operational details", item.details)}${textarea("alternatives", "Alternatives (one per line)", (item.alternatives || []).join("\n"))}${textarea("requirements", "Requirements or constraints", (item.requirements || []).join("\n"))}${textarea("seasonality", "Seasonality", (item.seasonality || []).join("\n"))}${input("evidence", "Source reference", item.evidence)}
    <label>Confidence<select name="confidence"><option value="low" ${item.confidence === "low" ? "selected" : ""}>Low</option><option value="medium" ${item.confidence === "medium" ? "selected" : ""}>Medium</option><option value="high" ${item.confidence === "high" ? "selected" : ""}>High</option></select></label><label>Evidence review<select name="approved"><option value="false" ${!item.approved ? "selected" : ""}>Needs review</option><option value="true" ${item.approved ? "selected" : ""}>Approved fact</option></select></label>
  </div><div class="blockActions"><button class="removeBlock" type="button">Remove block</button></div></div></details>`;
}

function renderEditor() {
  const item = state.draft;
  if (!item) { $("#editor").innerHTML = `<div class="emptyState"><div><strong>Select a source</strong><p>Review its evidence, edit the structured blocks and save once when ready.</p></div></div>`; return; }
  $("#editor").innerHTML = `<form id="knowledgeForm"><div class="editorHead"><div><p class="eyebrow">${esc(item.sourceType)} source</p><h2>${esc(item.title)}</h2><p>${esc(item.sourceName || item.sourceUrl || "Source reference pending")}</p></div><label class="statusSelect">Workflow status<select name="status">${Object.entries(statusLabels).map(([value,label]) => `<option value="${value}" ${item.status === value ? "selected" : ""}>${label}</option>`).join("")}</select></label></div>
    <section class="formSection"><h3>Source and trip</h3><div class="grid">${input("title", "Source title", item.title, true)}${input("sourceName", "Document or source name", item.sourceName)}${input("sourceUrl", "Source URL", item.sourceUrl)}${input("linkedGuest", "Linked guest", item.linkedGuest)}${input("linkedInquiryId", "CRM inquiry ID", item.linkedInquiryId)}${input("country", "Country", item.country)}${input("durationDays", "Duration in days", item.durationDays, false, "number")}${input("travelStyle", "Travel style", item.travelStyle)}${input("lodgingStyle", "Lodging style", item.lodgingStyle)}${textarea("regions", "Regions (comma or line separated)", (item.regions || []).join(", "))}${textarea("sourceNotes", "Source handling notes", item.sourceNotes)}</div></section>
    <section class="formSection"><h3>Global knowledge</h3><div class="grid">${textarea("inclusions", "Inclusions", (item.inclusions || []).join("\n"), false)}${textarea("exclusions", "Exclusions", (item.exclusions || []).join("\n"), false)}${textarea("gaps", "Missing evidence or questions", (item.gaps || []).join("\n"))}</div><div class="chips gaps">${(item.gaps || []).map(value => `<span class="chip">${esc(value)}</span>`).join("")}</div></section>
    <section class="formSection"><h3>Itinerary blocks</h3><p class="helper">Approve individual facts only when the source reference is clear. Promotional wording should be rewritten later in MBW’s voice.</p><div id="blocks" class="blocks">${item.blocks.map(blockMarkup).join("")}</div><button id="addBlock" class="addBlock" type="button">+ Add itinerary block</button></section>
    <div class="saveBar"><small id="dirtyState">${state.dirty ? "Unsaved changes" : item.synthetic ? "Seed record - save to persist" : "All changes saved"}</small><div><button id="resetDraft" type="button">Reset</button><button class="primary" type="submit" ${state.saving ? "disabled" : ""}>${state.saving ? "Saving…" : "Save knowledge record"}</button></div></div>
  </form>`;
}

function selectSource(id) {
  const record = state.records.find(item => item.sourceId === id); if (!record) return;
  if (state.dirty && !confirm("Discard the unsaved changes to this source?")) return;
  state.selectedId = id; state.draft = clone(record); state.dirty = false; renderSources(); renderEditor();
}

function readDraft() {
  const form = $("#knowledgeForm"), data = Object.fromEntries(new FormData(form));
  const blocks = [...form.querySelectorAll("[data-block]")].map((node, index) => { const values = Object.fromEntries(new FormData(node.closest("form")).entries()); const get = name => node.querySelector(`[name="${name}"]`)?.value || ""; return { id: state.draft.blocks[index]?.id || `block-${crypto.randomUUID().slice(0,8)}`, dayStart: get("dayStart"), dayEnd: get("dayEnd"), title: get("title"), route: get("route"), details: get("details"), alternatives: csv(get("alternatives")), requirements: csv(get("requirements")), seasonality: csv(get("seasonality")), evidence: get("evidence"), confidence: get("confidence"), approved: get("approved") === "true" }; });
  return { ...state.draft, title: data.title, sourceName: data.sourceName, sourceUrl: data.sourceUrl, linkedGuest: data.linkedGuest, linkedInquiryId: data.linkedInquiryId, country: data.country, durationDays: Number(data.durationDays) || 0, travelStyle: data.travelStyle, lodgingStyle: data.lodgingStyle, regions: csv(data.regions), sourceNotes: data.sourceNotes, inclusions: csv(data.inclusions), exclusions: csv(data.exclusions), gaps: csv(data.gaps), status: data.status, blocks };
}

function parsedBlocks(raw) {
  const text = String(raw || "").trim(); if (!text) return [];
  const heading = /(?:^|\n)\s*d[ií]a\s+(\d+)(?:\s*[-–]\s*(\d+))?\s*[:.-]?\s*([^\n]*)/gi, found = [...text.matchAll(heading)];
  if (!found.length) return [{ id: `block-${crypto.randomUUID().slice(0,8)}`, dayStart: "1", dayEnd: "1", title: "Source itinerary block", route: "", details: text.slice(0, 2400), alternatives: [], requirements: [], seasonality: [], evidence: "Pasted source text", confidence: "low", approved: false }];
  return found.slice(0, 40).map((match, index) => ({ id: `block-${crypto.randomUUID().slice(0,8)}`, dayStart: match[1], dayEnd: match[2] || match[1], title: (match[3] || `Day ${match[1]}`).trim().slice(0,240), route: "", details: text.slice((match.index || 0) + match[0].length, found[index + 1]?.index || text.length).trim().slice(0,2400), alternatives: [], requirements: [], seasonality: [], evidence: `Pasted source, day ${match[1]}`, confidence: "low", approved: false }));
}

async function save() {
  state.draft = readDraft(); state.saving = true; renderEditor();
  try {
    const result = await api("/", { method: "POST", body: JSON.stringify({ expectedUpdatedAt: state.draft.updatedAt || "", record: state.draft }) });
    const index = state.records.findIndex(item => item.sourceId === result.record.sourceId); if (index >= 0) state.records[index] = result.record; else state.records.unshift(result.record);
    state.selectedId = result.record.sourceId; state.draft = clone(result.record); state.dirty = false; notice("Knowledge record saved once and verified in the CRM."); render();
  } catch (error) { state.saving = false; notice(error.body?.validationErrors?.join(" ") || error.message, true); renderEditor(); }
}

function render() { renderStats(); renderSources(); renderEditor(); }
async function load() { try { const result = await api("/"); state.records = result.records; if (state.selectedId) { const selected = state.records.find(item => item.sourceId === state.selectedId); state.draft = selected ? clone(selected) : null; } render(); } catch (error) { notice(error.message, true); $("#sourceList").innerHTML = `<p class="empty">Unable to load the private knowledge queue.</p>`; } }

$("#sourceList").addEventListener("click", event => { const button = event.target.closest("[data-source]"); if (button) selectSource(button.dataset.source); });
$("#editor").addEventListener("input", () => { state.dirty = true; const node = $("#dirtyState"); if (node) node.textContent = "Unsaved changes"; });
$("#editor").addEventListener("click", event => {
  if (event.target.id === "addBlock") { event.preventDefault(); state.draft = readDraft(); state.draft.blocks.push({ id:`block-${crypto.randomUUID().slice(0,8)}`,dayStart:"",dayEnd:"",title:"",route:"",details:"",alternatives:[],requirements:[],seasonality:[],evidence:"",confidence:"low",approved:false }); state.dirty = true; renderEditor(); }
  if (event.target.classList.contains("removeBlock")) { event.preventDefault(); const index = Number(event.target.closest("[data-block]").dataset.block); state.draft = readDraft(); state.draft.blocks.splice(index,1); state.dirty = true; renderEditor(); }
  if (event.target.id === "resetDraft") { event.preventDefault(); const saved = state.records.find(item => item.sourceId === state.selectedId); state.draft = clone(saved); state.dirty = false; renderEditor(); }
});
$("#editor").addEventListener("submit", event => { event.preventDefault(); save(); });
$("#addSource").addEventListener("click", () => { $("#sourceForm").reset(); $("#sourceDialog").showModal(); });
$("#cancelSource").addEventListener("click", () => $("#sourceDialog").close());
$("#sourceForm").addEventListener("submit", event => { event.preventDefault(); const data = Object.fromEntries(new FormData(event.currentTarget)); const reference = data.sourceReference || ""; const sourceUrl = data.sourceType === "url" && /^https:\/\//.test(reference) ? reference : ""; const blocks = parsedBlocks(data.rawText); const record = { sourceId:"",assignmentId:"",title:data.title,sourceType:data.sourceType,sourceName:sourceUrl ? "" : reference,sourceUrl,linkedGuest:data.linkedGuest,linkedInquiryId:data.linkedInquiryId,rights:data.rights,status:blocks.length ? "extracted" : "new",country:"Ecuador",regions:[],durationDays:0,travelStyle:"",lodgingStyle:"",inclusions:[],exclusions:[],gaps:blocks.length ? ["Review every extracted block before approval"] : ["Structured extraction is still required"],sourceNotes:"",rawText:data.rawText,blocks,createdAt:new Date().toISOString(),updatedAt:"",approvedAt:"",approvedBy:"",synthetic:true }; state.records.unshift(record); state.selectedId=""; state.draft=record; state.dirty=true; $("#sourceDialog").close(); render(); });
$("#refresh").addEventListener("click", () => { if (state.dirty && !confirm("Discard unsaved changes and refresh?")) return; state.dirty = false; load(); });
load();
