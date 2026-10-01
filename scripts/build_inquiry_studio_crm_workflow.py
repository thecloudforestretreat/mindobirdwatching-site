#!/usr/bin/env python3
"""Add Inquiry Studio storage actions to the existing MBW CRM Admin API export."""

from __future__ import annotations

import argparse
import copy
import json
from pathlib import Path

STUDIO_DOCUMENT = "https://docs.google.com/spreadsheets/d/1UzXuwNx7eBC3BFfTycCO5X_M97BYVC-enj3bNJYzsh8/edit"
STUDIO_SHEET = "crm_inquiry_studio"

FIELDS = [
    "inquiry_studio_id",
    "inquiry_id",
    "guest_id",
    "created_at",
    "updated_at",
    "created_by",
    "assigned_to",
    "status",
    "inquiry_complexity",
    "revision",
    "source_type",
    "source_subject",
    "source_message",
    "input_language",
    "output_language",
    "attachment_manifest_json",
    "extracted_request_json",
    "request_summary",
    "guest_profile_json",
    "requested_dates_json",
    "target_species_json",
    "requirements_json",
    "unknowns_json",
    "assumptions_json",
    "validation_flags_json",
    "proposed_days_json",
    "guest_reply_draft",
    "guide_brief_draft",
    "internal_summary",
    "guide_responses_json",
    "guide_quotes_json",
    "final_plan_json",
    "handoff_json",
    "ai_model",
    "prompt_version",
    "validation_status",
    "validation_notes",
    "last_analyzed_at",
    "approved_at",
    "approved_by",
]

JSON_FIELDS = [
    "attachment_manifest_json",
    "extracted_request_json",
    "guest_profile_json",
    "requested_dates_json",
    "target_species_json",
    "requirements_json",
    "unknowns_json",
    "assumptions_json",
    "validation_flags_json",
    "proposed_days_json",
    "guide_responses_json",
    "guide_quotes_json",
    "final_plan_json",
    "handoff_json",
]

ARRAY_JSON_FIELDS = [
    "attachment_manifest_json",
    "requested_dates_json",
    "target_species_json",
    "requirements_json",
    "unknowns_json",
    "assumptions_json",
    "validation_flags_json",
    "proposed_days_json",
    "guide_responses_json",
    "guide_quotes_json",
]

LINK_FIELDS = [
    "inquiry_studio_id",
    "inquiry_studio_status",
    "inquiry_studio_updated_at",
]


def schema(field):
    return {
        "id": field,
        "displayName": field,
        "required": False,
        "defaultMatch": False,
        "display": True,
        "type": "string",
        "canBeUsedToMatch": True,
        "removed": False,
    }


def rule(action):
    return {
        "conditions": {
            "options": {"caseSensitive": False, "leftValue": "", "typeValidation": "strict"},
            "conditions": [
                {
                    "leftValue": "={{$json.action}}",
                    "rightValue": action,
                    "operator": {"type": "string", "operation": "equals"},
                }
            ],
            "combinator": "and",
        }
    }


def read_node(name, identifier, position, credential):
    return {
        "parameters": {
            "documentId": {"__rl": True, "value": STUDIO_DOCUMENT, "mode": "url"},
            "sheetName": {"__rl": True, "value": STUDIO_SHEET, "mode": "name"},
            "options": {},
        },
        "id": identifier,
        "name": name,
        "type": "n8n-nodes-base.googleSheets",
        "typeVersion": 4.7,
        "position": position,
        "alwaysOutputData": True,
        "credentials": credential,
    }


def code_node(name, identifier, position, source):
    return {
        "parameters": {"jsCode": source},
        "id": identifier,
        "name": name,
        "type": "n8n-nodes-base.code",
        "typeVersion": 2,
        "position": position,
    }


def connection(node):
    return {"node": node, "type": "main", "index": 0}


def build(source):
    data = copy.deepcopy(source)
    workflow = data[0] if isinstance(data, list) else data
    nodes = workflow["nodes"]
    by_name = {node["name"]: node for node in nodes}
    required = [
        "Switch - Action",
        "Unsupported Action",
        "Respond to Admin Page",
        "Update Inquiry - Prepare Row",
        "Update CRM Inquiry - Google Sheets",
        "Get row(s) in sheet",
    ]
    missing = [name for name in required if name not in by_name]
    if missing:
        raise ValueError("Missing expected nodes: " + ", ".join(missing))
    if any(name.startswith("Read Inquiry Studio") for name in by_name):
        raise ValueError("Workflow already contains Inquiry Studio nodes")

    credential = copy.deepcopy(by_name["Get row(s) in sheet"]["credentials"])
    switch = by_name["Switch - Action"]
    switch["parameters"]["rules"]["values"].extend(
        [rule("save_inquiry_studio"), rule("get_inquiry_studio")]
    )
    outputs = workflow["connections"]["Switch - Action"]["main"]
    fallback = outputs.pop()
    outputs.extend(
        [
            [connection("Read Inquiry Studio For Save")],
            [connection("Read Inquiry Studio For Get")],
            fallback,
        ]
    )

    allowed = by_name["Unsupported Action"]["parameters"]["jsCode"]
    allowed = allowed.replace(
        '"invite_assignment_provider"]',
        '"invite_assignment_provider","save_inquiry_studio","get_inquiry_studio"]',
    )
    by_name["Unsupported Action"]["parameters"]["jsCode"] = allowed

    prepare_save = f"""const request = $('Normalize Request').first().json;
const incoming = {{ ...(request.record || {{}}) }};
const fields = {json.dumps(FIELDS)};
const jsonFields = new Set({json.dumps(JSON_FIELDS)});
const arrayJsonFields = new Set({json.dumps(ARRAY_JSON_FIELDS)});
const clean = value => String(value ?? '').trim();
if (!clean(incoming.inquiry_studio_id)) throw new Error('Missing inquiry_studio_id.');
const rows = $input.all().map(item => item.json || item).filter(row => clean(row.inquiry_studio_id));
const existing = rows.find(row => clean(row.inquiry_studio_id) === clean(incoming.inquiry_studio_id)) || {{}};
const now = new Date().toISOString();
const record = {{}};
for (const field of fields) record[field] = incoming[field] ?? existing[field] ?? '';
record.inquiry_studio_id = clean(record.inquiry_studio_id);
record.created_at = clean(existing.created_at) || clean(record.created_at) || now;
record.updated_at = now;
record.status = clean(record.status) || 'draft';
record.revision = Math.max(Number(existing.revision || 0) + 1, Number(record.revision || 1));
for (const field of jsonFields) {{
  const value = clean(record[field]);
  if (!value) record[field] = arrayJsonFields.has(field) ? '[]' : '{{}}';
  try {{ JSON.parse(record[field]); }} catch {{ throw new Error(field + ' must contain valid JSON.'); }}
}}
return [{{ json: {{ ok: true, action: 'save_inquiry_studio', record }} }}];"""

    filter_get = """const request = $('Normalize Request').first().json;
const clean = value => String(value ?? '').trim();
const studioId = clean(request.inquiry_studio_id);
const inquiryId = clean(request.inquiry_id);
if (!studioId && !inquiryId) throw new Error('Provide inquiry_studio_id or inquiry_id.');
const records = $input.all().map(item => item.json || item).filter(row => clean(row.inquiry_studio_id));
const matches = records.filter(row => studioId ? clean(row.inquiry_studio_id) === studioId : clean(row.inquiry_id) === inquiryId);
matches.sort((a,b) => clean(b.updated_at).localeCompare(clean(a.updated_at)) || Number(b.revision || 0) - Number(a.revision || 0));
return [{ json: { ok: true, action: 'get_inquiry_studio', record: matches[0] || null } }];"""

    finalize_save = """const prepared = $('Prepare Inquiry Studio Save').first().json;
return [{ json: { ok: true, action: 'save_inquiry_studio', record: prepared.record } }];"""

    write = {
        "parameters": {
            "operation": "appendOrUpdate",
            "documentId": {"__rl": True, "value": STUDIO_DOCUMENT, "mode": "url"},
            "sheetName": {"__rl": True, "value": STUDIO_SHEET, "mode": "name"},
            "columns": {
                "mappingMode": "defineBelow",
                "value": {field: f"={{{{ $json.record?.{field} ?? '' }}}}" for field in FIELDS},
                "matchingColumns": ["inquiry_studio_id"],
                "schema": [schema(field) for field in FIELDS],
                "attemptToConvertTypes": False,
                "convertFieldsToString": False,
            },
            "options": {},
        },
        "id": "8bd9a1d7-a557-4b98-bc9a-42797c47cd4b",
        "name": "Write Inquiry Studio Record",
        "type": "n8n-nodes-base.googleSheets",
        "typeVersion": 4.7,
        "position": [47400, 14680],
        "credentials": credential,
    }

    added = [
        read_node(
            "Read Inquiry Studio For Save",
            "4b36ad86-c232-4658-8ee5-6e758b28d3d7",
            [46880, 14680],
            credential,
        ),
        code_node(
            "Prepare Inquiry Studio Save",
            "4b887e58-ce15-48db-aacd-4a3f6f0c7469",
            [47120, 14680],
            prepare_save,
        ),
        write,
        code_node(
            "Finalize Inquiry Studio Save",
            "a4dfdca5-7554-405a-ac1a-8ff19fde8449",
            [47640, 14680],
            finalize_save,
        ),
        read_node(
            "Read Inquiry Studio For Get",
            "92c25d38-6428-4a9c-961f-2e1910372718",
            [46880, 14920],
            credential,
        ),
        code_node(
            "Filter Inquiry Studio Record",
            "36018629-c17c-42db-a987-c09b8d0c9389",
            [47120, 14920],
            filter_get,
        ),
    ]
    nodes.extend(added)

    workflow["connections"].update(
        {
            "Read Inquiry Studio For Save": {"main": [[connection("Prepare Inquiry Studio Save")]]},
            "Prepare Inquiry Studio Save": {"main": [[connection("Write Inquiry Studio Record")]]},
            "Write Inquiry Studio Record": {"main": [[connection("Finalize Inquiry Studio Save")]]},
            "Finalize Inquiry Studio Save": {"main": [[connection("Respond to Admin Page")]]},
            "Read Inquiry Studio For Get": {"main": [[connection("Filter Inquiry Studio Record")]]},
            "Filter Inquiry Studio Record": {"main": [[connection("Respond to Admin Page")]]},
        }
    )

    prepare_update = by_name["Update Inquiry - Prepare Row"]["parameters"]["jsCode"]
    marker = "  'guest_calendar_synced_at'\n];"
    replacement = "  'guest_calendar_synced_at',\n  'inquiry_studio_id',\n  'inquiry_studio_status',\n  'inquiry_studio_updated_at'\n];"
    if marker not in prepare_update:
        raise ValueError("Could not patch protected CRM fields")
    by_name["Update Inquiry - Prepare Row"]["parameters"]["jsCode"] = prepare_update.replace(
        marker, replacement
    )

    update_columns = by_name["Update CRM Inquiry - Google Sheets"]["parameters"]["columns"]
    existing_schema = {item["id"] for item in update_columns["schema"]}
    for field in LINK_FIELDS:
        update_columns["value"][field] = f"={{{{ $json.inquiry_row?.{field} || $json.record?.{field} || '' }}}}"
        if field not in existing_schema:
            update_columns["schema"].append(schema(field))

    return data


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("input", type=Path)
    parser.add_argument("output", type=Path)
    arguments = parser.parse_args()
    source = json.loads(arguments.input.read_text())
    updated = build(source)
    arguments.output.write_text(json.dumps(updated, ensure_ascii=False, indent=2) + "\n")


if __name__ == "__main__":
    main()
