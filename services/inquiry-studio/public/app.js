'use strict';

const APP_BASE = location.pathname.startsWith('/inquiry-studio/') ? '/inquiry-studio' : '';
const $ = id => document.getElementById(id);

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
    await loadInquiries();
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
  $('studioResults').hidden = true;
  $('studioSubject').value = '';
  $('studioMessage').value = '';
  $('studioGuestEmail').value = '';
  $('studioGuestPhone').value = '';
  $('studioFiles').value = '';
  $('studioLanguage').value = 'auto';
  $('guideResponse').value = '';
  $('guideSender').value = '';
  $('guideQuoteReview').hidden = true;
  $('guideQuoteDays').replaceChildren();
  $('guideQuoteFlags').replaceChildren();
  text('guideQuoteSubtotal', '');
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
    text('studioStatus', 'Local extraction and planning are structuring the request on the Mac mini…');
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
    return JSON.parse(value || '');
  } catch {
    return fallback;
  }
}

function analysisFromRecord(record) {
  const extracted = parseJson(record.extracted_request_json, {});
  return {
    inquiry_complexity: record.inquiry_complexity || 'custom_tour',
    input_language: record.input_language || '',
    output_language: record.output_language || 'en',
    request_summary: record.request_summary || '',
    guest_profile: parseJson(record.guest_profile_json, {}),
    trip_profile: extracted.trip_profile || {},
    requested_dates: parseJson(record.requested_dates_json, []),
    target_species: parseJson(record.target_species_json, []),
    requirements: parseJson(record.requirements_json, []),
    unknowns: parseJson(record.unknowns_json, []),
    assumptions: parseJson(record.assumptions_json, []),
    validation_flags: parseJson(record.validation_flags_json, []),
    recommendations: extracted.recommendations || [],
    knowledge_profile_ids: extracted.knowledge_profile_ids || [],
    knowledge_version: extracted.knowledge_version || '',
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

function renderGuideQuote(record) {
  const quotes = parseJson(record?.guide_quotes_json, []);
  const quote = quotes.length ? quotes[quotes.length - 1] : null;
  if (!quote) {
    $('guideQuoteReview').hidden = true;
    return;
  }
  $('guideQuoteReview').hidden = false;
  text('guideQuoteSubtotal', 'Known supplier subtotal: $' + Number(quote.known_supplier_subtotal_usd || 0).toLocaleString('en-US'));
  $('guideQuoteDays').replaceChildren(
    ...(quote.items || []).map(item => {
      const article = document.createElement('article');
      article.className = 'dayRow quoteDay';
      const title = document.createElement('strong');
      title.textContent = [item.date || 'Day ' + item.day_number, item.location].filter(Boolean).join(' · ');
      const plan = document.createElement('p');
      plan.textContent = item.supplier_plan || '';
      const amount = document.createElement('b');
      amount.textContent = item.amount_usd == null ? 'Price pending' : '$' + Number(item.amount_usd).toLocaleString('en-US');
      const scope = document.createElement('small');
      scope.textContent = [
        (item.included || []).length ? 'Includes: ' + item.included.join(', ') : '',
        (item.excluded || []).length ? 'Excludes: ' + item.excluded.join(', ') : '',
      ].filter(Boolean).join(' · ');
      article.append(title, plan, amount, scope);
      return article;
    }),
  );
  const flags = [
    ...(quote.global_excluded || []).length ? ['Generally excluded: ' + quote.global_excluded.join(', ')] : [],
    ...(quote.review_flags || []),
  ];
  $('guideQuoteFlags').replaceChildren(
    ...(flags.length ? flags : ['No additional quote checks detected.']).map(value => {
      const item = document.createElement('li');
      item.textContent = value;
      return item;
    }),
  );
}

function renderStudio(analysis) {
  studioAnalysis = analysis;
  $('studioResults').hidden = false;
  text('complexity', (analysis.inquiry_complexity || '').replaceAll('_', ' '));
  text('validationStatus', analysis.validation_status || 'needs review');
  text('requestSummary', analysis.request_summary);
  const profileLabels = {
    travel_window: 'Travel window',
    arrival_details: 'Arrival',
    departure_details: 'Departure',
    lodging_preferences: 'Lodging',
    room_configuration: 'Room setup',
    walking_ability: 'Walking ability',
    altitude_experience: 'Altitude experience',
    transport_requirements: 'Transport',
    budget: 'Budget',
  };
  const profileItems = Object.entries(analysis.trip_profile || {})
    .filter(([, value]) => value)
    .map(([key, value]) => (profileLabels[key] || key.replaceAll('_', ' ')) + ': ' + value);
  $('tripProfile').replaceChildren(
    ...(profileItems.length ? profileItems : ['No verified trip-profile details extracted.']).map(value => {
      const item = document.createElement('li');
      item.textContent = value;
      return item;
    }),
  );
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
  const recommendations = analysis.recommendations || [];
  $('knowledgeRecommendations').replaceChildren(
    ...(recommendations.length ? recommendations : ['No knowledge-base profile matched this request.']).map(value => {
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
  renderGuideQuote(studioRecord);
  text('saveNote', studioRecord ? 'Loaded revision ' + studioRecord.revision + '. Saving creates a new revision.' : 'Review both drafts before saving.');
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
  } catch (error) {
    text('studioStatus', error.message);
  } finally {
    busy = false;
    $('saveStudio').disabled = false;
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
    renderGuideQuote(studioRecord);
    text('studioStatus', 'Guide response saved, structured by day, and merged into the review plan.');
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
    await loadInquiries();
  } catch (error) {
    text('source', error.message);
  }
})();
