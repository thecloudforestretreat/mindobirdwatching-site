'use strict';

const APP_BASE = location.pathname.startsWith('/inquiry-studio/') ? '/inquiry-studio' : '';
const $ = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);

let rows = [];
let token = '';
let current = null;
let pending = null;
let generation = 0;
let busy = false;
let dirty = false;
let currentDraft = null;
let studioAnalysis = null;
let studioManifest = [];
let studioRecord = null;
let guideProviders = [];
let interactionRecords = [];
let knowledgeItems = [];

const text = (id, value) => {
  $(id).textContent = value || '';
};

async function api(path, body) {
  const response = await fetch(
    APP_BASE + path,
    body
      ? {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Pilot-Token': token,
          },
          body: JSON.stringify(body),
        }
      : {},
  );
  const data = await response.json();
  if (!response.ok) throw Error(data.error || 'Request failed');
  return data;
}

async function adminApi(path) {
  const response = await fetch(path, { credentials: 'same-origin', cache: 'no-store' });
  const data = await response.json();
  if (!response.ok) throw Error(data.error || 'Admin review queue unavailable');
  return data;
}

function planStatusLabel(status) {
  return ({ guide_drafting: 'Guide drafting', admin_review: 'Ready for admin review', changes_requested: 'Changes requested', approved: 'Approved' })[status] || 'In progress';
}

async function loadPlanReviews() {
  try {
    const data = await adminApi('/api/mobile/plans');
    const priority = { admin_review: 0, changes_requested: 1, guide_drafting: 2, approved: 3 };
    const plans = [...(data.plans || [])].sort((left, right) =>
      (priority[left.status] ?? 9) - (priority[right.status] ?? 9) || String(right.updatedAt || '').localeCompare(String(left.updatedAt || ''))).slice(0, 6);
    $('planReviews').hidden = !plans.length;
    text('planReviewCount', String(plans.filter(plan => plan.status === 'admin_review').length));
    $('planReviewList').replaceChildren(...plans.map(plan => {
      const article = document.createElement('article');
      article.className = 'planReviewCard';
      const title = document.createElement('strong');
      title.textContent = plan.guestName || plan.title?.en || plan.title?.es || 'Custom itinerary';
      const details = document.createElement('small');
      details.textContent = [planStatusLabel(plan.status), plan.providerName && 'Guide: ' + plan.providerName, plan.startDate && plan.endDate && `${plan.startDate} – ${plan.endDate}`].filter(Boolean).join(' · ');
      const link = document.createElement('a');
      const query = plan.status === 'approved'
        ? new URLSearchParams({ source: 'guide_plan', plan: plan.planId })
        : new URLSearchParams({ view: 'plans', provider: plan.providerId || plan.providerName || '', plan: plan.planId, mode: 'admin' });
      link.href = plan.status === 'approved' ? '/itinerary-generator/?' + query.toString() : '/guide/?' + query.toString();
      link.textContent = plan.status === 'approved' ? 'Prepare Guest Itinerary' : 'Review itinerary';
      article.append(title, details, link);
      return article;
    }));
  } catch {
    $('planReviews').hidden = true;
  }
}

function renderList() {
  const query = $('search').value.toLowerCase();
  $('inquiries').replaceChildren();
  const filtered = rows.filter(row =>
    [
      row.full_name,
      row.tour_type,
      row.status,
      row.message_questions,
      row.requested_date_text,
    ]
      .join(' ')
      .toLowerCase()
      .includes(query),
  );
  for (const row of filtered) {
    const button = document.createElement('button');
    button.className = 'card' + (current?.inquiry_id === row.inquiry_id ? ' selected' : '');
    const name = document.createElement('strong');
    name.textContent = row.full_name || 'Unnamed guest';
    const facts = document.createElement('span');
    facts.textContent = [
      row.status,
      row.requested_date_text || 'Dates missing',
      row.guest_count ? row.guest_count + ' guests' : 'Party size missing',
      row.inquiry_studio_status ? 'Studio: ' + row.inquiry_studio_status : '',
    ]
      .filter(Boolean)
      .join(' · ');
    button.append(name, facts);
    button.onclick = () => select(row);
    $('inquiries').append(button);
  }
}

function showChecks(draft) {
  const plan = draft?.plan;
  const facts = plan?.facts;
  const summary = facts
    ? [
        'Draft plan: ' +
          [
            facts.pickup && 'pickup ' + facts.pickup,
            facts.return_destination && 'return to ' + facts.return_destination,
            facts.deadline && 'by ' + facts.deadline,
            facts.short_only && 'morning only',
            facts.full_day_requested && 'full-day requested',
          ]
            .filter(Boolean)
            .join(' · '),
      ].filter(value => value !== 'Draft plan: ')
    : [];
  const checks = [
    ...summary,
    ...(draft?.review_notes || []),
    ...(draft?.missing_details || []).map(value => 'Confirm: ' + value),
    'Review catalog prices and inclusions before export. Availability is not verified by this tool.',
  ];
  if (current?.status !== 'new') {
    checks.unshift('CRM status: ' + current.status + '. Review prior correspondence before preparing another reply.');
  }
  $('checks').replaceChildren(
    ...checks.map(value => {
      const item = document.createElement('li');
      item.textContent = value;
      return item;
    }),
  );
  $('review').hidden = false;
}

function editor(draft, saved) {
  pending = { type: 'pilot-load', inquiry: current, draft, saved };
  currentDraft = draft;
  $('editorWrap').hidden = false;
  $('editor').src = APP_BASE + '/editor.html?load=' + Date.now();
  dirty = true;
}

async function select(row) {
  if (busy) return text('status', 'Wait for the current draft to finish.');
  if (dirty && !confirm('Switch inquiry? Save this draft first if you want to keep edits.')) return;
  current = row;
  generation += 1;
  const stamp = generation;
  dirty = false;
  pending = null;
  $('empty').hidden = true;
  $('studio').hidden = true;
  $('detail').hidden = false;
  $('editorWrap').hidden = true;
  $('editor').src = 'about:blank';
  $('supplemental').value = '';
  text('name', row.full_name || 'Guest');
  text('state', row.status + ' · ' + row.inquiry_id);
  text(
    'facts',
    [
      row.guest_count ? row.guest_count + ' guests' : 'Party size missing',
      row.requested_date_text || 'Dates missing',
      row.tour_type,
    ]
      .filter(Boolean)
      .join(' · '),
  );
  text(
    'request',
    row.message_questions ||
      'No original question text is saved on this row. Paste the guest’s message before preparing a specific answer.',
  );
  text(
    'interests',
    [
      row.special_interests,
      row.pickup_location && 'Pickup: ' + row.pickup_location,
      row.transportation_needed && 'Transport: ' + row.transportation_needed,
    ]
      .filter(Boolean)
      .join(' · '),
  );
  text('status', 'Ready. Drafting is local; nothing will be sent.');
  showChecks();
  renderList();
  try {
    const saved = await api('/api/saved/' + encodeURIComponent(row.inquiry_id));
    if (stamp !== generation) return;
    if (saved.draft) {
      $('supplemental').value = saved.draft.supplemental || '';
      editor(saved.draft.aiDraft, saved.draft.editor);
      showChecks(saved.draft.aiDraft);
      text('status', 'Restored local draft. Pricing review must be renewed.');
      dirty = false;
    }
  } catch (error) {
    text('status', error.message);
  }
}

$('search').oninput = renderList;

$('generate').onclick = async () => {
  if (!current || busy) return;
  if (dirty && !confirm('Replace current editor contents with a new AI draft?')) return;
  const inquiryId = current.inquiry_id;
  busy = true;
  $('generate').disabled = true;
  $('manual').disabled = true;
  text('status', 'Preparing a quick reply with qwen3.5:27b on the Mac mini…');
  try {
    const draft = await api('/api/draft', {
      inquiry_id: inquiryId,
      supplemental: $('supplemental').value,
    });
    if (current?.inquiry_id !== inquiryId) return;
    editor(draft, null);
    showChecks(draft);
    text('status', 'Local AI draft ready. Review the reply, items, and prices below.');
  } catch (error) {
    text('status', error.message);
  } finally {
    busy = false;
    $('generate').disabled = false;
    $('manual').disabled = false;
  }
};

$('manual').onclick = () => {
  if (dirty && !confirm('Replace current editor contents with a blank manual draft?')) return;
  editor(
    {
      title: 'Your Mindo tour options',
      direct_answer: '',
      language: 'en',
      block_ids: [],
    },
    null,
  );
  text('status', 'Manual editor ready. Add the reply and select tour or activity blocks.');
};

$('save').onclick = () => {
  if (!pending) return;
  $('editor').contentWindow.postMessage({ type: 'pilot-save-request' }, location.origin);
};

window.addEventListener('message', async event => {
  if (event.origin !== location.origin || event.source !== $('editor').contentWindow) return;
  const message = event.data || {};
  if (message.type === 'pilot-ready' && pending) {
    $('editor').contentWindow.postMessage(pending, location.origin);
    return;
  }
  if (message.type === 'pilot-changed') dirty = true;
  if (message.type === 'pilot-save' && current?.inquiry_id === message.inquiry_id) {
    try {
      await api('/api/save', {
        inquiry_id: message.inquiry_id,
        draft: {
          editor: message.draft,
          aiDraft: currentDraft,
          supplemental: $('supplemental').value,
        },
      });
      dirty = false;
      text('status', 'Saved on the Mac mini. This quick draft did not change the CRM.');
    } catch (error) {
      text('status', error.message);
    }
  }
});

window.addEventListener('beforeunload', event => {
  if (dirty) {
    event.preventDefault();
    event.returnValue = '';
  }
});

function sourceStatus(data) {
  const age = Date.now() - new Date(data.source.imported_at).getTime();
  const stale = !data.sync?.ok || age > 15 * 60 * 1000;
  return (
    rows.length +
    ' inquiries · last synced ' +
    new Date(data.source.imported_at).toLocaleString() +
    (stale ? ' · Sync delayed; showing saved data.' : ' · Updates every 5 minutes.')
  );
}

async function loadInquiries() {
  const data = await api('/api/inquiries');
  rows = data.records;
  text('source', sourceStatus(data));
  renderList();
}

$('reload').onclick = async () => {
  if (busy) return text('source', 'Wait for analysis to finish.');
  if (dirty && !confirm('Reload inquiries? Save your current draft first to keep edits.')) return;
  const inquiryId = current?.inquiry_id;
  $('reload').disabled = true;
  try {
    await Promise.all([loadInquiries(), loadPlanReviews()]);
    dirty = false;
    const updated = rows.find(row => row.inquiry_id === inquiryId);
    if (updated) await select(updated);
    else if (current) {
      current = null;
      pending = null;
      currentDraft = null;
      $('detail').hidden = true;
      $('empty').hidden = false;
      $('editor').src = 'about:blank';
      text('source', $('source').textContent + ' Selected inquiry is no longer in the active CRM list.');
    }
  } catch (error) {
    text('source', 'Could not reload inquiries. ' + error.message);
  } finally {
    $('reload').disabled = false;
  }
};

function resetStudio() {
  studioAnalysis = null;
  studioManifest = [];
  studioRecord = null;
  interactionRecords = [];
  knowledgeItems = [];
  $('studioResults').hidden = true;
  $('caseContinuity').hidden = true;
  $('communicationTimeline').hidden = true;
  $('studioSubject').value = '';
  $('studioMessage').value = '';
  $('studioGuestEmail').value = '';
  $('studioGuestPhone').value = '';
  $('studioFiles').value = '';
  $('studioLanguage').value = 'auto';
  $('guideResponse').value = '';
  $('guideSender').value = '';
  text('studioStatus', 'Nothing is sent to the guest or guides.');
}

async function openStudio(row = null) {
  current = row;
  resetStudio();
  $('empty').hidden = true;
  $('detail').hidden = true;
  $('studio').hidden = false;
  $('studioGuestName').value = row?.full_name || '';
  $('studioGuestEmail').value = row?.email || '';
  $('studioGuestPhone').value = row?.phone_normalized || row?.phone_number || '';
  $('studioMessage').value = row?.message_questions || '';
  text('studioTitle', row ? 'Analyze ' + (row.full_name || 'this inquiry') : 'Analyze a new guest request');
  renderList();
  if (row?.inquiry_studio_id) {
    try {
      const record = await api('/api/studio/' + encodeURIComponent(row.inquiry_id));
      if (record?.inquiry_studio_id) {
        studioRecord = record;
        renderStudio(analysisFromRecord(record));
        await Promise.all([loadInteractions(), loadKnowledge()]);
        text('studioStatus', 'Loaded saved Studio record · revision ' + (record.revision || '1'));
      }
    } catch (error) {
      text('studioStatus', error.message);
    }
  }
}

$('newIntake').onclick = () => openStudio();
$('emptyNewIntake').onclick = () => openStudio();
$('openStudio').onclick = () => openStudio(current);
$('closeStudio').onclick = () => {
  $('studio').hidden = true;
  if (current) $('detail').hidden = false;
  else $('empty').hidden = false;
};

function toBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  const chunks = [];
  for (let start = 0; start < bytes.length; start += 0x8000) {
    chunks.push(String.fromCharCode(...bytes.subarray(start, start + 0x8000)));
  }
  return btoa(chunks.join(''));
}

async function readFiles() {
  const files = [...$('studioFiles').files];
  if (files.length > 5) throw Error('Upload at most 5 files.');
  const attachments = [];
  for (const file of files) {
    if (file.size > 8 * 1024 * 1024) throw Error(file.name + ' is larger than 8 MB.');
    attachments.push({
      name: file.name,
      type: file.type,
      data: toBase64(await file.arrayBuffer()),
    });
  }
  return attachments;
}

function sleep(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

async function waitForJob(jobId) {
  for (let attempt = 0; attempt < 240; attempt += 1) {
    await sleep(2000);
    const job = await api('/api/jobs/' + encodeURIComponent(jobId));
    if (job.status === 'complete') return job;
    if (job.status === 'error') throw Error(job.error || 'Local analysis failed.');
  }
  throw Error('The local analysis is taking longer than expected. Try again after the current model task finishes.');
}

$('analyzeStudio').onclick = async () => {
  if (busy) return;
  busy = true;
  $('analyzeStudio').disabled = true;
  text('studioStatus', 'Preparing attachments and starting the local analysis…');
  try {
    const attachments = await readFiles();
    const request = await api('/api/analyze', {
      inquiry_id: current?.inquiry_id || '',
      guest_name: $('studioGuestName').value,
      guest_email: $('studioGuestEmail').value,
      guest_phone: $('studioGuestPhone').value,
      subject: $('studioSubject').value,
      message: $('studioMessage').value,
      output_language: $('studioLanguage').value,
      attachments,
    });
    text('studioStatus', 'qwen3.5:27b is structuring the request on the Mac mini…');
    const job = await waitForJob(request.job_id);
    studioManifest = job.attachment_manifest || [];
    studioRecord = null;
    renderStudio(job.result);
    text('studioStatus', 'Analysis ready. Review and edit both drafts before saving.');
  } catch (error) {
    text('studioStatus', error.message);
  } finally {
    busy = false;
    $('analyzeStudio').disabled = false;
  }
};

function parseJson(value, fallback) {
  if (value && typeof value === 'object') return value;
  try {
    const parsed = JSON.parse(value || '');
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function analysisFromRecord(record) {
  return {
    inquiry_complexity: record.inquiry_complexity || 'custom_tour',
    input_language: record.input_language || '',
    output_language: record.output_language || 'en',
    request_summary: record.request_summary || '',
    guest_profile: parseJson(record.guest_profile_json, {}),
    requested_dates: parseJson(record.requested_dates_json, []),
    target_species: parseJson(record.target_species_json, []),
    requirements: parseJson(record.requirements_json, []),
    unknowns: parseJson(record.unknowns_json, []),
    assumptions: parseJson(record.assumptions_json, []),
    validation_flags: parseJson(record.validation_flags_json, []),
    proposed_days: parseJson(record.proposed_days_json, []),
    guest_reply_draft: record.guest_reply_draft || '',
    guide_brief_draft: record.guide_brief_draft || '',
    internal_summary: record.internal_summary || '',
    ai_model: record.ai_model || '',
    prompt_version: record.prompt_version || '',
    validation_status: record.validation_status || 'needs_review',
    last_analyzed_at: record.last_analyzed_at || '',
  };
}

function renderStudio(analysis) {
  studioAnalysis = analysis;
  $('studioResults').hidden = false;
  text('complexity', (analysis.inquiry_complexity || '').replaceAll('_', ' '));
  text('validationStatus', analysis.validation_status || 'needs review');
  text('requestSummary', analysis.request_summary);
  const checks = [
    ...(analysis.unknowns || []).map(value => 'Missing: ' + value),
    ...(analysis.validation_flags || []).map(value => 'Check: ' + value),
    ...(analysis.assumptions || []).map(value => 'Assumption: ' + value),
  ];
  $('studioChecks').replaceChildren(
    ...(checks.length ? checks : ['No missing details were identified.']).map(value => {
      const item = document.createElement('li');
      item.textContent = value;
      return item;
    }),
  );
  $('proposedDays').replaceChildren(
    ...(analysis.proposed_days || []).map(day => {
      const article = document.createElement('article');
      article.className = 'dayRow';
      const title = document.createElement('strong');
      title.textContent = [day.date || 'Day ' + day.day_number, day.location].filter(Boolean).join(' · ');
      const activity = document.createElement('p');
      activity.textContent = day.activity || '';
      const pricing = document.createElement('small');
      pricing.textContent = (day.pricing_needed || []).length
        ? 'Price: ' + day.pricing_needed.join(', ')
        : 'No pricing item identified';
      article.append(title, activity, pricing);
      return article;
    }),
  );
  $('guestReply').value = analysis.guest_reply_draft || '';
  $('guideBrief').value = analysis.guide_brief_draft || '';
  $('guideResponse').value = '';
  text('saveNote', studioRecord ? 'Loaded revision ' + studioRecord.revision + '. Saving creates a new revision.' : 'Review both drafts before saving.');
  renderGuideHandoffStatus();
  renderGuideQuotes();
  renderAdminProposal();
  renderCaseContext();
}

function renderGuideHandoffStatus() {
  if (!studioRecord?.inquiry_studio_id) {
    text('guideTripStatus', 'Save the Studio record before creating a Guide Nest request.');
    return;
  }
  const handoff = parseJson(studioRecord.handoff_json, {});
  const requests = Array.isArray(handoff.guide_quote_requests) ? handoff.guide_quote_requests : [];
  text(
    'guideTripStatus',
    requests.length
      ? requests.map(item => [item.provider_name, item.status, item.sent_at ? new Date(item.sent_at).toLocaleString() : ''].filter(Boolean).join(' · ')).join('\n')
      : 'Ready to send a private quote request to Guide Nest.',
  );
}

function listLines(value) {
  return String(value || '').split(/\r?\n/).map(item => item.trim()).filter(Boolean);
}

function accommodationRow(item = {}) {
  const row = document.createElement('div');
  row.className = 'accommodationRow';
  row.innerHTML = `
    <label>Location<input data-lodging="location" value="${esc(item.location || '')}"></label>
    <label>Property<input data-lodging="property" value="${esc(item.property || '')}"></label>
    <label>Check-in<input data-lodging="check_in" type="date" value="${esc(item.check_in || '')}"></label>
    <label>Check-out<input data-lodging="check_out" type="date" value="${esc(item.check_out || '')}"></label>
    <label>Net total<input data-lodging="net_total" type="number" min="0" step="0.01" value="${Number(item.net_total || 0)}"></label>
    <label>Deposit %<input data-lodging="deposit_percent" type="number" min="0" max="100" step="1" value="${Number(item.deposit_percent || 0)}"></label>
    <label>Status<select data-lodging="status"><option value="researching">Researching</option><option value="availability_requested">Availability requested</option><option value="available">Available</option><option value="held">Held</option><option value="deposit_due">Deposit due</option><option value="booked">Booked</option><option value="unavailable">Unavailable</option></select></label>
    <button type="button" data-remove-lodging>Remove</button>
    <label>Hold expires<input data-lodging="hold_expires_at" type="datetime-local" value="${esc(item.hold_expires_at || '')}"></label>
    <label>Booking owner<input data-lodging="booking_owner" value="${esc(item.booking_owner || '')}"></label>
    <label>Confirmation code<input data-lodging="confirmation_code" value="${esc(item.confirmation_code || '')}"></label>
    <label class="notesField">Notes<input data-lodging="notes" value="${esc(item.notes || '')}"></label>
    <span class="depositPreview"></span>`;
  row.querySelector('[data-lodging="status"]').value = item.status || 'researching';
  updateDepositPreview(row);
  return row;
}

function updateDepositPreview(row) {
  const total = Number(row.querySelector('[data-lodging="net_total"]')?.value || 0);
  const percent = Number(row.querySelector('[data-lodging="deposit_percent"]')?.value || 0);
  row.querySelector('.depositPreview').textContent = `Deposit ${formatMoney(total * percent / 100)}`;
}

function supplierRow(item = {}) {
  const row = document.createElement('div');
  row.className = 'supplierRow';
  row.dataset.supplierId = item.supplier_id || `SUP-${Date.now()}-${Math.random().toString(16).slice(2, 7)}`;
  row.innerHTML = `
    <label>Name<input data-supplier="name" value="${esc(item.name || '')}"></label>
    <label>Role<select data-supplier="role"><option value="guide">Guide</option><option value="driver">Driver</option><option value="accommodation">Accommodation</option><option value="reserve">Reserve</option><option value="activity_provider">Activity</option><option value="other">Other</option></select></label>
    <label>Service<input data-supplier="service" value="${esc(item.service || '')}"></label>
    <label>Service date<input data-supplier="service_date" type="date" value="${esc(item.service_date || '')}"></label>
    <label>Net cost<input data-supplier="net_cost" type="number" min="0" step="0.01" value="${Number(item.net_cost || 0)}"></label>
    <label>Availability<select data-supplier="availability"><option value="unverified">Unverified</option><option value="requested">Requested</option><option value="available">Available</option><option value="unavailable">Unavailable</option></select></label>
    <label>Status<select data-supplier="status"><option value="researching">Researching</option><option value="quoted">Quoted</option><option value="held">Held</option><option value="deposit_due">Deposit due</option><option value="booked">Booked</option><option value="paid">Paid</option></select></label>
    <button type="button" data-remove-supplier>Remove</button>
    <label>Start<input data-supplier="start_time" type="time" value="${esc(item.start_time || '')}"></label>
    <label>End<input data-supplier="end_time" type="time" value="${esc(item.end_time || '')}"></label>
    <label>Pickup<input data-supplier="pickup_location" value="${esc(item.pickup_location || '')}"></label>
    <label>Drop-off<input data-supplier="dropoff_location" value="${esc(item.dropoff_location || '')}"></label>
    <label>Deposit %<input data-supplier="deposit_percent" type="number" min="0" max="100" value="${Number(item.deposit_percent || 0)}"></label>
    <label>Verified at<input data-supplier="verified_at" type="date" value="${esc(String(item.verified_at || '').slice(0, 10))}"></label>
    <label>Price valid until<input data-supplier="valid_until" type="date" value="${esc(item.valid_until || '')}"></label>
    <label>Hold expires<input data-supplier="hold_expires_at" type="datetime-local" value="${esc(item.hold_expires_at || '')}"></label>
    <label class="supplierEvidence">Evidence source<input data-supplier="evidence_source" value="${esc(item.evidence_source || '')}" placeholder="WhatsApp date, email ID, URL, or confirmation reference"></label>
    <label class="supplierNotes">Notes<input data-supplier="notes" value="${esc(item.notes || '')}"></label>`;
  row.querySelector('[data-supplier="role"]').value = item.role || 'other';
  row.querySelector('[data-supplier="availability"]').value = item.availability || 'unverified';
  row.querySelector('[data-supplier="status"]').value = item.status || 'researching';
  return row;
}

function collectSupplierRow(row) {
  return {
    supplier_id: row.dataset.supplierId,
    ...Object.fromEntries([...row.querySelectorAll('[data-supplier]')].map(input => [input.dataset.supplier, ['net_cost', 'deposit_percent'].includes(input.dataset.supplier) ? Number(input.value || 0) : input.value.trim()])),
  };
}

function renderKnowledge() {
  $('knowledgeItems').innerHTML = knowledgeItems.length ? knowledgeItems.map(item => `<article class="knowledgeItem"><strong>${esc(item.name)} · ${esc(item.service || item.role)}</strong><p>${formatMoney(item.net_cost)} net · verified ${esc(item.verified_at || 'unknown')} · valid until ${esc(item.valid_until || 'reverify now')}</p><small>${esc(item.reuse_rule || 'Reverify before reuse')}</small></article>`).join('') : '<p class="muted">No verified supplier facts have been published yet.</p>';
}

async function loadKnowledge() {
  const result = await api('/api/knowledge');
  knowledgeItems = result.items || [];
  renderKnowledge();
}

function renderInteractions() {
  const section = $('communicationTimeline');
  section.hidden = !studioRecord?.inquiry_studio_id;
  if (section.hidden) return;
  $('interactionRows').innerHTML = interactionRecords.length ? interactionRecords.map(item => `<article class="timelineItem"><div class="timelineHead"><strong>${esc(item.direction || 'internal')} · ${esc(item.channel || 'other')} · ${esc(item.interaction_type || 'note')}</strong><time>${esc(new Date(item.occurred_at || item.created_at || Date.now()).toLocaleString())}</time></div><p>${esc(item.note || '')}</p>${item.external_message_id ? `<small>Message ID: ${esc(item.external_message_id)}</small>` : ''}</article>`).join('') : '<p class="muted">No CRM interactions recorded for this inquiry yet.</p>';
  const artifacts = parseJson(studioRecord.handoff_json, {}).sent_artifacts || [];
  $('sentArtifacts').innerHTML = artifacts.length ? `<h4>Immutable sent snapshots</h4>${[...artifacts].reverse().map(item => `<article class="artifactItem"><div class="artifactHead"><strong>${esc(String(item.action || '').replaceAll('_', ' '))}</strong><time>${esc(new Date(item.created_at).toLocaleString())}</time></div><p>${formatMoney(item.sell_total)} · quote ${esc(item.quote_id || '')} v${esc(item.quote_version || '')}</p><small>SHA-256 ${esc(item.sha256 || '')}</small></article>`).join('')}` : '<p class="muted">No proposal, final approval, or invoice snapshot has been recorded yet.</p>';
}

async function loadInteractions() {
  if (!studioRecord?.inquiry_studio_id) return;
  const result = await api('/api/interactions', { inquiry_id: studioRecord.inquiry_id, inquiry_studio_id: studioRecord.inquiry_studio_id });
  interactionRecords = result.records || [];
  renderInteractions();
}

function renderCaseContext() {
  const section = $('caseContinuity');
  section.hidden = !studioRecord?.inquiry_studio_id;
  if (section.hidden) return;
  const handoff = parseJson(studioRecord.handoff_json, {});
  const context = handoff.case_context || {};
  $('caseOwnerName').value = context.case_owner?.name || 'Juan';
  $('caseOwnerPhone').value = context.case_owner?.phone || '';
  $('caseOwnerEmail').value = context.case_owner?.email || '';
  $('guestTimezone').value = context.guest_timezone || '';
  $('preferredContact').value = context.preferred_contact || '';
  $('contactWindow').value = context.contact_window || '';
  $('budgetCeiling').value = Number(context.budget_ceiling || 0) || '';
  $('nextAction').value = context.next_action || '';
  $('nextActionDue').value = context.next_action_due || '';
  $('confirmedFacts').value = (context.confirmed_facts || []).join('\n');
  $('openDecisions').value = (context.open_decisions || []).join('\n');
  $('caseCommitments').value = (context.commitments || []).join('\n');
  $('accommodationRows').replaceChildren(...(context.accommodations || []).map(accommodationRow));
  $('supplierRows').replaceChildren(...(context.suppliers || []).map(supplierRow));
  const due = context.next_action_due;
  const overdue = due && due < new Date().toISOString().slice(0, 10);
  $('nextActionDue').classList.toggle('overdueFlag', Boolean(overdue));
  text('caseContextStatus', context.updated_at ? `Case memory updated ${new Date(context.updated_at).toLocaleString()} by ${context.updated_by || 'MBW Admin'}.` : 'Add the facts the next person must know before replying.');
  renderInteractions();
}

function collectCaseContext() {
  return {
    case_owner: { name: $('caseOwnerName').value, phone: $('caseOwnerPhone').value, email: $('caseOwnerEmail').value },
    guest_timezone: $('guestTimezone').value,
    preferred_contact: $('preferredContact').value,
    contact_window: $('contactWindow').value,
    budget_ceiling: Number($('budgetCeiling').value || 0),
    next_action: $('nextAction').value,
    next_action_due: $('nextActionDue').value,
    confirmed_facts: listLines($('confirmedFacts').value),
    open_decisions: listLines($('openDecisions').value),
    commitments: listLines($('caseCommitments').value),
    accommodations: [...document.querySelectorAll('.accommodationRow')].map(row => Object.fromEntries(
      [...row.querySelectorAll('[data-lodging]')].map(input => [input.dataset.lodging, ['net_total', 'deposit_percent'].includes(input.dataset.lodging) ? Number(input.value || 0) : input.value.trim()]),
    )),
    suppliers: [...document.querySelectorAll('.supplierRow')].map(collectSupplierRow),
  };
}

function formatMoney(value) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value || 0));
}

function renderGuideQuotes() {
  const section = $('guideQuoteReview');
  const quotes = parseJson(studioRecord?.guide_quotes_json, []);
  section.hidden = !Array.isArray(quotes) || !quotes.length;
  if (section.hidden) {
    $('guideQuotes').replaceChildren();
    return;
  }
  $('guideQuotes').innerHTML = [...quotes].reverse().map(quote => {
    if (quote.archived_summary) {
      return `<article class="guideQuoteCard"><div class="guideQuoteHead"><h4>${esc(quote.provider_name || 'Guide')} · version ${esc(quote.version)}</h4><span>archived summary</span></div><p class="muted">${(quote.option_totals || []).map(option => `${esc(option.name)} · ${formatMoney(option.net_total)}`).join(' · ')}</p></article>`;
    }
    const options = (quote.options || []).map(option => `<section class="guideQuoteOption"><div class="guideQuoteOptionHead"><h5>${esc(option.name)}</h5><strong>${formatMoney(option.net_total)} net</strong></div>${option.summary ? `<p>${esc(option.summary)}</p>` : ''}${(option.days || []).map(day => `<div class="guideQuoteDay"><strong>Day ${esc(day.day_number)} · ${esc(day.title)}</strong><span>${esc(day.agenda)}</span><span>Walking: ${esc(day.walking_minutes || 0)} min · Longest: ${esc(day.longest_walk_minutes || 0)} min · Suitability: ${esc(day.suitability)}</span>${day.accessibility_notes ? `<span>Accessibility: ${esc(day.accessibility_notes)}</span>` : ''}<ul class="guideQuoteCosts">${(day.costs || []).map(cost => `<li>${esc(cost.description)} · ${formatMoney(Number(cost.amount || 0) * Number(cost.quantity || 0))} · ${esc(cost.status)}</li>`).join('')}</ul></div>`).join('')}</section>`).join('');
    const status = quote.admin_status || quote.status || 'draft';
    const actions = quote.status === 'submitted' && !['approved', 'revision_requested'].includes(status) ? `<div class="guideQuoteActions"><label>Revision instructions<input data-revision-note="${esc(quote.quote_id)}" placeholder="Required when requesting a revision"></label><button type="button" class="primary" data-review-quote="approve" data-quote-id="${esc(quote.quote_id)}">Approve route & net costs</button><button type="button" data-review-quote="request_revision" data-quote-id="${esc(quote.quote_id)}">Request revision</button></div>` : '';
    return `<article class="guideQuoteCard"><div class="guideQuoteHead"><h4>${esc(quote.provider_name || 'Guide')} · version ${esc(quote.version || 1)}</h4><span>${esc(status.replaceAll('_', ' '))}</span></div>${quote.guide_summary ? `<p>${esc(quote.guide_summary)}</p>` : ''}${options}${quote.revision_note ? `<p><strong>Revision note:</strong> ${esc(quote.revision_note)}</p>` : ''}${actions}</article>`;
  }).join('');
}

const WORKFLOW_STAGES = [
  ['intake', '1', 'Tourist inquiry'],
  ['guest_details', '2', 'Guest details'],
  ['guide_preliminary', '3', 'Guide preliminary'],
  ['admin_proposal', '4', 'Admin pricing'],
  ['guest_review', '5', 'Guest review'],
  ['guide_final_confirmation', '6', 'Guide final'],
  ['guest_final_confirmation', '7', 'Guest final'],
  ['invoice_ready', '8', 'Invoice'],
  ['invoice_sent', '9', 'Invoice sent'],
  ['deposit_received', '10', 'Deposit'],
  ['supplier_holds', '11', 'Supplier holds'],
  ['reservations_confirmed', '12', 'Reservations'],
  ['operations_ready', '13', 'Operations'],
  ['completed', '14', 'Completed'],
];

function approvedGuideQuote() {
  const quotes = parseJson(studioRecord?.guide_quotes_json, []);
  const plan = parseJson(studioRecord?.final_plan_json, {});
  return quotes
    .filter(quote => quote.admin_status === 'approved' || (plan.quote_id && quote.quote_id === plan.quote_id))
    .sort((left, right) => Number(right.version || 0) - Number(left.version || 0))[0] || null;
}

function workflowIndex(stage) {
  if (stage === 'guest_changes_received') return 4;
  if (stage === 'cancelled') return WORKFLOW_STAGES.length;
  const index = WORKFLOW_STAGES.findIndex(item => item[0] === stage);
  return index < 0 ? 3 : index;
}

function renderAdminProposal(preferredOption = '') {
  const section = $('adminProposal');
  const quote = approvedGuideQuote();
  if (!quote) {
    section.hidden = true;
    return;
  }
  section.hidden = false;
  const plan = parseJson(studioRecord?.final_plan_json, {});
  const options = quote.options || [];
  const selectedId = preferredOption || plan.selected_option_id || options[0]?.option_id || '';
  const option = options.find(item => item.option_id === selectedId) || options[0];
  if (!option) return;
  $('adminPlanOption').replaceChildren(...options.map(item => new Option(`${item.name} · ${formatMoney(item.net_total)} net`, item.option_id, false, item.option_id === option.option_id)));
  $('adminMarkup').value = Number(plan.default_markup_percent ?? 30);
  const stage = plan.workflow?.stage || 'admin_proposal';
  const activeIndex = workflowIndex(stage);
  text('proposalStage', stage.replaceAll('_', ' '));
  $('tourWorkflow').innerHTML = WORKFLOW_STAGES.map((item, index) => `<li class="${index < activeIndex ? 'done' : index === activeIndex ? 'current' : ''}"><span>${item[1]}</span>${esc(item[2])}</li>`).join('');
  const dayEdits = new Map((plan.admin_days || []).map(day => [day.day_id, day]));
  const markup = Number($('adminMarkup').value || 0);
  $('adminPlanDays').innerHTML = (option.days || []).map(day => {
    const edit = dayEdits.get(day.day_id) || day;
    const costs = (day.costs || []).map(cost => {
      const net = Number(cost.amount || 0) * Number(cost.quantity || 0);
      const fallback = cost.category === 'accommodation' ? net : net * (1 + markup / 100);
      const sell = Number(plan.sell_prices?.[cost.cost_id] ?? fallback).toFixed(2);
      return `<div class="adminCostRow" data-cost-id="${esc(cost.cost_id)}" data-category="${esc(cost.category)}" data-net="${net}"><span><strong>${esc(cost.description)}</strong><br><small>${esc(cost.category)} · ${esc(cost.basis)} · ${esc(cost.status)}</small></span><span>Net ${formatMoney(net)}</span><label>Guest price<input data-sell-price type="number" min="0" step="0.01" value="${sell}"></label><span class="costState">${cost.status === 'confirmed' ? 'confirmed' : 'verify before final'}</span></div>`;
    }).join('');
    return `<article class="adminPlanDay" data-day-id="${esc(day.day_id)}"><div class="adminDayFields"><label>Date<input data-admin-day="date" type="date" value="${esc(edit.date || '')}"></label><label>Day title<input data-admin-day="title" value="${esc(edit.title || '')}"></label><label class="wideField">Guest-facing agenda<textarea data-admin-day="agenda">${esc(edit.agenda || '')}</textarea></label><label>Start / pickup<input data-admin-day="start_location" value="${esc(edit.start_location || day.start_location || '')}"></label><label>End / drop-off<input data-admin-day="end_location" value="${esc(edit.end_location || day.end_location || '')}"></label></div>${costs}</article>`;
  }).join('');
  const allowedActions = {
    admin_proposal: ['mark_preliminary_sent'],
    guest_review: ['record_guest_changes', 'mark_guest_preliminary_approved', 'mark_cancelled'],
    guest_changes_received: ['mark_cancelled'],
    guide_final_confirmation: ['mark_guide_final_confirmed', 'mark_cancelled'],
    guest_final_confirmation: ['mark_guest_final_confirmed', 'mark_cancelled'],
    invoice_ready: ['mark_invoice_sent', 'mark_cancelled'],
    invoice_sent: ['record_deposit_received', 'mark_cancelled'],
    deposit_received: ['mark_supplier_holds', 'mark_cancelled'],
    supplier_holds: ['mark_reservations_confirmed', 'mark_cancelled'],
    reservations_confirmed: ['mark_operations_ready', 'mark_cancelled'],
    operations_ready: ['mark_completed', 'mark_cancelled'],
    completed: [],
    cancelled: [],
  }[stage] || [];
  document.querySelectorAll('#adminProposal [data-tour-action]').forEach(button => {
    button.disabled = !allowedActions.includes(button.dataset.tourAction);
  });
  $('requestGuideReconfirmation').disabled = stage !== 'guest_changes_received';
  $('createOperationsAssignments').disabled = !['reservations_confirmed', 'operations_ready'].includes(stage);
  recalculateAdminProposal();
}

function recalculateAdminProposal() {
  let net = 0;
  let sell = 0;
  document.querySelectorAll('#adminPlanDays .adminCostRow').forEach(row => {
    net += Number(row.dataset.net || 0);
    sell += Number(row.querySelector('[data-sell-price]')?.value || 0);
  });
  text('adminNetTotal', formatMoney(net));
  text('adminSellTotal', formatMoney(sell));
  text('adminProfit', formatMoney(sell - net));
  text('adminMargin', sell ? `${((sell - net) / sell * 100).toFixed(1)}%` : '0%');
}

function collectAdminPlan() {
  const sellPrices = {};
  document.querySelectorAll('#adminPlanDays .adminCostRow').forEach(row => {
    sellPrices[row.dataset.costId] = Number(row.querySelector('[data-sell-price]').value || 0);
  });
  const adminDays = [...document.querySelectorAll('#adminPlanDays .adminPlanDay')].map(day => ({
    day_id: day.dataset.dayId,
    ...Object.fromEntries([...day.querySelectorAll('[data-admin-day]')].map(input => [input.dataset.adminDay, input.value.trim()])),
  }));
  const plan = parseJson(studioRecord?.final_plan_json, {});
  return {
    quote_id: plan.quote_id || approvedGuideQuote()?.quote_id,
    selected_option_id: $('adminPlanOption').value,
    default_markup_percent: Number($('adminMarkup').value || 0),
    sell_prices: sellPrices,
    admin_days: adminDays,
  };
}

async function loadGuideProviders() {
  const result = await api('/api/providers');
  guideProviders = result.providers || [];
  $('tripGuide').replaceChildren(
    new Option('Choose an active guide', ''),
    ...guideProviders.map(provider => new Option(provider.provider_name, provider.provider_id)),
  );
}

function currentAnalysis() {
  return {
    ...studioAnalysis,
    guest_reply_draft: $('guestReply').value.trim(),
    guide_brief_draft: $('guideBrief').value.trim(),
    validation_status: 'needs_review',
  };
}

async function copyFrom(id, buttonId) {
  await navigator.clipboard.writeText($(id).value);
  const original = $(buttonId).textContent;
  $(buttonId).textContent = 'Copied';
  setTimeout(() => {
    $(buttonId).textContent = original;
  }, 1200);
}

$('copyGuestReply').onclick = () => copyFrom('guestReply', 'copyGuestReply');
$('copyGuideBrief').onclick = () => copyFrom('guideBrief', 'copyGuideBrief');

$('saveStudio').onclick = async () => {
  if (!studioAnalysis || busy) return;
  const isNewGuest = !current?.inquiry_id;
  busy = true;
  $('saveStudio').disabled = true;
  text('studioStatus', 'Saving the reviewed Studio record and CRM link…');
  try {
    const result = await api('/api/save-studio', {
      inquiry_id: current?.inquiry_id || '',
      guest_name: $('studioGuestName').value,
      guest_email: $('studioGuestEmail').value,
      guest_phone: $('studioGuestPhone').value,
      subject: $('studioSubject').value,
      message: $('studioMessage').value,
      source_type: studioManifest.length ? 'text_with_attachments' : 'manual_text',
      attachment_manifest: studioManifest,
      analysis: currentAnalysis(),
      existing: studioRecord || {},
    });
    studioRecord = result.record;
    if (isNewGuest && result.crm_record?.inquiry_id) current = result.crm_record;
    text(
      'studioStatus',
      isNewGuest
        ? 'New guest and inquiry created in the CRM, then linked to this Studio record.'
        : 'Saved to crm_inquiry_studio and linked to the CRM inquiry.',
    );
    text('saveNote', 'Saved as ' + studioRecord.inquiry_studio_id + ' · revision ' + studioRecord.revision);
    renderGuideHandoffStatus();
    renderCaseContext();
  } catch (error) {
    text('studioStatus', error.message);
  } finally {
    busy = false;
    $('saveStudio').disabled = false;
  }
};

$('sendGuideTrip').onclick = async () => {
  if (!studioRecord?.inquiry_studio_id) return text('guideTripStatus', 'Save the Studio record before sending it to Guide Nest.');
  if (!$('tripGuide').value) return text('guideTripStatus', 'Choose an active guide.');
  if (busy) return;
  busy = true;
  $('sendGuideTrip').disabled = true;
  text('guideTripStatus', 'Creating the private Guide Nest quote request…');
  try {
    const result = await api('/api/send-guide-quote', {
      inquiry_id: studioRecord.inquiry_id,
      inquiry_studio_id: studioRecord.inquiry_studio_id,
      provider_id: $('tripGuide').value,
      brand_id: $('tripBrand').value,
      response_due_at: $('tripResponseDue').value,
    });
    studioRecord = result.record;
    renderGuideHandoffStatus();
  } catch (error) {
    text('guideTripStatus', error.message);
  } finally {
    busy = false;
    $('sendGuideTrip').disabled = false;
  }
};

$('refreshGuideQuotes').onclick = async () => {
  if (!studioRecord?.inquiry_id || busy) return;
  busy = true;
  $('refreshGuideQuotes').disabled = true;
  try {
    studioRecord = await api('/api/studio/' + encodeURIComponent(studioRecord.inquiry_id));
    renderGuideHandoffStatus();
    renderGuideQuotes();
    renderAdminProposal();
    renderCaseContext();
    text('studioStatus', 'Guide quote records refreshed.');
  } catch (error) {
    text('studioStatus', error.message);
  } finally {
    busy = false;
    $('refreshGuideQuotes').disabled = false;
  }
};

$('guideQuotes').addEventListener('click', async event => {
  const button = event.target.closest('[data-review-quote]');
  if (!button || busy) return;
  const decision = button.dataset.reviewQuote;
  const note = document.querySelector(`[data-revision-note="${CSS.escape(button.dataset.quoteId)}"]`)?.value.trim() || '';
  if (decision === 'request_revision' && !note) return text('studioStatus', 'Enter revision instructions for the guide.');
  busy = true;
  button.disabled = true;
  try {
    const result = await api('/api/review-guide-quote', {
      inquiry_id: studioRecord.inquiry_id,
      inquiry_studio_id: studioRecord.inquiry_studio_id,
      quote_id: button.dataset.quoteId,
      decision,
      note,
    });
    studioRecord = result.record;
    renderGuideHandoffStatus();
    renderGuideQuotes();
    renderAdminProposal();
    text('studioStatus', decision === 'approve' ? 'Guide route approved. Markup is still required before a guest proposal.' : 'Revision request saved for the guide.');
  } catch (error) {
    text('studioStatus', error.message);
    button.disabled = false;
  } finally {
    busy = false;
  }
});

$('adminPlanOption').addEventListener('change', event => renderAdminProposal(event.target.value));
$('adminPlanDays').addEventListener('input', event => {
  if (event.target.matches('[data-sell-price]')) recalculateAdminProposal();
});

$('applyAdminMarkup').onclick = () => {
  const markup = Number($('adminMarkup').value || 0);
  document.querySelectorAll('#adminPlanDays .adminCostRow').forEach(row => {
    const net = Number(row.dataset.net || 0);
    row.querySelector('[data-sell-price]').value = (row.dataset.category === 'accommodation' ? net : net * (1 + markup / 100)).toFixed(2);
  });
  recalculateAdminProposal();
  text('adminPlanStatus', 'Markup applied locally. Save private pricing to keep it. Accommodation remains at net unless you edit it.');
};

$('saveAdminPlan').onclick = async () => {
  if (!studioRecord || busy) return;
  busy = true;
  $('saveAdminPlan').disabled = true;
  text('adminPlanStatus', 'Saving private admin pricing…');
  try {
    const result = await api('/api/save-admin-plan', {
      inquiry_id: studioRecord.inquiry_id,
      inquiry_studio_id: studioRecord.inquiry_studio_id,
      expected_revision: studioRecord.revision,
      plan: collectAdminPlan(),
    });
    studioRecord = result.record;
    renderAdminProposal();
    text('adminPlanStatus', 'Private pricing saved. The guide cannot see guest prices, markup, margin, or profit.');
  } catch (error) {
    text('adminPlanStatus', error.message);
  } finally {
    busy = false;
    $('saveAdminPlan').disabled = false;
  }
};

$('addAccommodation').onclick = () => $('accommodationRows').append(accommodationRow());
$('accommodationRows').addEventListener('click', event => {
  const button = event.target.closest('[data-remove-lodging]');
  if (button) button.closest('.accommodationRow').remove();
});
$('accommodationRows').addEventListener('input', event => {
  const row = event.target.closest('.accommodationRow');
  if (row) updateDepositPreview(row);
});
$('addSupplier').onclick = () => $('supplierRows').append(supplierRow());
$('supplierRows').addEventListener('click', event => {
  const button = event.target.closest('[data-remove-supplier]');
  if (button) button.closest('.supplierRow').remove();
});

$('publishKnowledge').onclick = async () => {
  if (!studioRecord?.inquiry_studio_id || busy) return;
  const items = [...document.querySelectorAll('.supplierRow')].map(collectSupplierRow).filter(item => item.verified_at && item.evidence_source);
  if (!items.length) return text('caseContextStatus', 'Add a verification date and evidence source before publishing a supplier fact.');
  busy = true;
  $('publishKnowledge').disabled = true;
  try {
    await api('/api/publish-knowledge', { inquiry_id: studioRecord.inquiry_id, inquiry_studio_id: studioRecord.inquiry_studio_id, items });
    await loadKnowledge();
    text('caseContextStatus', `${items.length} verified supplier fact${items.length === 1 ? '' : 's'} published. Reverification remains required before reuse.`);
  } catch (error) {
    text('caseContextStatus', error.message);
  } finally {
    busy = false;
    $('publishKnowledge').disabled = false;
  }
};

$('saveCaseContext').onclick = async () => {
  if (!studioRecord?.inquiry_studio_id || busy) return;
  busy = true;
  $('saveCaseContext').disabled = true;
  text('caseContextStatus', 'Saving shared case memory…');
  try {
    const result = await api('/api/save-case-context', {
      inquiry_id: studioRecord.inquiry_id,
      inquiry_studio_id: studioRecord.inquiry_studio_id,
      expected_revision: studioRecord.revision,
      context: collectCaseContext(),
    });
    studioRecord = result.record;
    renderCaseContext();
  } catch (error) {
    text('caseContextStatus', error.message);
  } finally {
    busy = false;
    $('saveCaseContext').disabled = false;
  }
};

$('refreshInteractions').onclick = () => loadInteractions().catch(error => text('interactionStatus', error.message));
$('addInteraction').onclick = async () => {
  const note = $('interactionNote').value.trim();
  if (!note || busy) return text('interactionStatus', 'Enter a communication note first.');
  busy = true;
  $('addInteraction').disabled = true;
  try {
    await api('/api/add-interaction', {
      inquiry_id: studioRecord.inquiry_id, inquiry_studio_id: studioRecord.inquiry_studio_id,
      interaction: {
        direction: $('interactionDirection').value, channel: $('interactionChannel').value,
        interaction_type: $('interactionType').value, external_message_id: $('externalMessageId').value,
        note, followup_at: $('interactionFollowup').value ? new Date($('interactionFollowup').value).toISOString() : '',
      },
    });
    $('interactionNote').value = '';
    $('externalMessageId').value = '';
    $('interactionFollowup').value = '';
    await loadInteractions();
    text('interactionStatus', 'Communication saved to the CRM timeline.');
  } catch (error) {
    text('interactionStatus', error.message);
  } finally {
    busy = false;
    $('addInteraction').disabled = false;
  }
};

function itineraryDraftFromPlan() {
  const plan = parseJson(studioRecord?.final_plan_json, {});
  const quote = approvedGuideQuote();
  const option = (quote?.options || []).find(item => item.option_id === plan.selected_option_id);
  if (!option || !plan.selected_option_id) throw Error('Save an approved admin proposal before creating the itinerary.');
  const edits = new Map((plan.admin_days || []).map(day => [day.day_id, day]));
  const context = parseJson(studioRecord.handoff_json, {}).case_context || {};
  const trackedLodging = context.accommodations || [];
  const items = [];
  for (const day of option.days || []) {
    const edit = edits.get(day.day_id) || day;
    const nonLodging = (day.costs || []).filter(cost => cost.category !== 'accommodation');
    const dailySell = nonLodging.reduce((sum, cost) => sum + Number(plan.sell_prices?.[cost.cost_id] || 0), 0);
    if (dailySell || nonLodging.length) items.push({
      date: edit.date || '', type: 'Custom', productPreset: 'Other',
      name: edit.title || day.title || `Day ${day.day_number}`,
      note: edit.agenda || day.agenda || '', quantity: 1, unitPrice: dailySell,
    });
    if (!trackedLodging.length) {
      for (const cost of (day.costs || []).filter(item => item.category === 'accommodation')) {
        items.push({ date: edit.date || '', type: 'Accommodation', productPreset: 'Other', name: cost.description || 'Accommodation', note: `${cost.status || 'pending verification'} · ${cost.basis || ''}`, quantity: 1, unitPrice: Number(plan.sell_prices?.[cost.cost_id] || 0) });
      }
    }
  }
  for (const stay of trackedLodging) {
    items.push({
      date: stay.check_in || '', type: 'Accommodation', productPreset: 'Other',
      name: [stay.property, stay.location].filter(Boolean).join(' · ') || 'Accommodation',
      note: [`${stay.check_in || '?'} to ${stay.check_out || '?'}`, stay.status, stay.deposit_percent ? `${stay.deposit_percent}% room deposit` : '', stay.notes].filter(Boolean).join(' · '),
      quantity: 1, unitPrice: Number(stay.net_total || 0),
    });
  }
  const dates = items.map(item => item.date).filter(Boolean).sort();
  const profile = parseJson(studioRecord.guest_profile_json, {});
  return {
    source: 'guest_crm', inquiryId: studioRecord.inquiry_id,
    guestName: $('studioGuestName').value || current?.full_name || '',
    guestEmail: $('studioGuestEmail').value || current?.email || '',
    whatsappNumber: $('studioGuestPhone').value || current?.phone_number || '',
    guestCount: Number(profile.party_size || current?.guest_count || 1),
    tripTitle: studioRecord.source_subject || 'Custom Ecuador tour',
    brandId: plan.brand_id || 'mbw', language: studioRecord.output_language || 'en',
    startDate: dates[0] || '', endDate: dates.at(-1) || dates[0] || '',
    itineraryStage: plan.workflow?.stage === 'guest_final_confirmation' ? 'approved_pending' : 'preliminary',
    pricingNote: 'Daily tour services and accommodation are shown separately. Availability and supplier holds remain subject to confirmation.',
    items,
  };
}

$('openItineraryGenerator').onclick = () => {
  try {
    const draft = itineraryDraftFromPlan();
    localStorage.setItem('mbwItineraryGeneratorDraft', JSON.stringify(draft));
    localStorage.setItem('mbwSelectedCrmRecord', JSON.stringify({ ...(current || {}), inquiry_id: studioRecord.inquiry_id, guest_id: studioRecord.guest_id, ...draft }));
    const url = new URL('/itinerary-generator/', location.origin);
    url.searchParams.set('source', 'guest_crm');
    url.searchParams.set('inquiry_id', studioRecord.inquiry_id);
    window.open(url.toString(), '_blank', 'noopener');
    text('adminPlanStatus', 'Itinerary handoff prepared with daily services and lodging as separate items.');
  } catch (error) {
    text('adminPlanStatus', error.message);
  }
};

$('requestGuideReconfirmation').onclick = async () => {
  const note = $('tourWorkflowNote').value.trim();
  const quote = approvedGuideQuote();
  if (!note) return text('adminPlanStatus', 'Describe the guest’s requested changes before sending them to the guide.');
  if (!quote || busy) return;
  busy = true;
  $('requestGuideReconfirmation').disabled = true;
  try {
    const result = await api('/api/review-guide-quote', {
      inquiry_id: studioRecord.inquiry_id,
      inquiry_studio_id: studioRecord.inquiry_studio_id,
      quote_id: quote.quote_id,
      decision: 'request_revision',
      note,
    });
    studioRecord = result.record;
    $('tourWorkflowNote').value = '';
    renderGuideQuotes();
    renderAdminProposal();
    text('adminPlanStatus', 'The guide can now revise the itinerary and net costs. Private admin pricing was not shared.');
  } catch (error) {
    text('adminPlanStatus', error.message);
  } finally {
    busy = false;
    $('requestGuideReconfirmation').disabled = false;
  }
};

$('adminProposal').addEventListener('click', async event => {
  const button = event.target.closest('[data-tour-action]');
  if (!button || busy) return;
  busy = true;
  button.disabled = true;
  try {
    const result = await api('/api/advance-tour-workflow', {
      inquiry_id: studioRecord.inquiry_id,
      inquiry_studio_id: studioRecord.inquiry_studio_id,
      expected_revision: studioRecord.revision,
      action: button.dataset.tourAction,
      note: $('tourWorkflowNote').value.trim(),
      artifact: {
        source: 'inquiry_studio',
        subject: $('studioSubject').value.trim(),
        guest_reply: $('guestReply').value.trim(),
        studio_revision: studioRecord.revision,
      },
    });
    studioRecord = result.record;
    $('tourWorkflowNote').value = '';
    renderAdminProposal();
    renderInteractions();
    text('adminPlanStatus', 'Workflow updated. No message was sent automatically.');
  } catch (error) {
    text('adminPlanStatus', error.message);
    button.disabled = false;
  } finally {
    busy = false;
  }
});

$('createOperationsAssignments').onclick = async () => {
  if (!studioRecord?.inquiry_studio_id || busy) return;
  busy = true;
  $('createOperationsAssignments').disabled = true;
  text('adminPlanStatus', 'Creating idempotent final Guide Nest and supplier assignments…');
  try {
    const result = await api('/api/create-operations-assignments', {
      inquiry_id: studioRecord.inquiry_id, inquiry_studio_id: studioRecord.inquiry_studio_id,
      expected_revision: studioRecord.revision,
      guest_name: $('studioGuestName').value, guest_phone: $('studioGuestPhone').value,
    });
    studioRecord = result.record;
    renderAdminProposal();
    text('adminPlanStatus', `${result.assignments.length} final assignment${result.assignments.length === 1 ? '' : 's'} verified in Guide Nest. Providers are not marked informed until you contact them.`);
  } catch (error) {
    text('adminPlanStatus', error.message);
  } finally {
    busy = false;
    $('createOperationsAssignments').disabled = false;
  }
};

$('saveGuideResponse').onclick = async () => {
  if (!studioRecord) return text('studioStatus', 'Save the Studio record before adding a guide response.');
  if (busy) return;
  busy = true;
  $('saveGuideResponse').disabled = true;
  try {
    const result = await api('/api/guide-response', {
      record: studioRecord,
      sender: $('guideSender').value,
      response: $('guideResponse').value,
    });
    studioRecord = result.record;
    $('guideResponse').value = '';
    text('studioStatus', 'Guide response added to the saved conversation JSON.');
    text('saveNote', 'Saved as ' + studioRecord.inquiry_studio_id + ' · revision ' + studioRecord.revision);
  } catch (error) {
    text('studioStatus', error.message);
  } finally {
    busy = false;
    $('saveGuideResponse').disabled = false;
  }
};

(async () => {
  try {
    const session = await api('/api/session');
    token = session.token;
    await Promise.all([loadInquiries(), loadPlanReviews()]);
    await loadGuideProviders().catch(error => {
      $('tripGuide').replaceChildren(new Option('Guide list unavailable', ''));
      text('guideTripStatus', error.message);
    });
  } catch (error) {
    text('source', error.message);
  }
})();
