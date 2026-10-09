# Local CRM conversation summary — prepared, not activated

The saved-record assistant summarizes the last 20 recorded guest/staff conversation messages, identifies missing information and drafts a reply. It never saves records or sends messages. Contact strings are redacted, internal metadata is excluded, and model output is escaped and validated. Source IDs must belong to the selected conversation. Suggestions remain staff-reviewed; validation does not establish factual accuracy.

Route: staff-authenticated same-origin POST /api/crm/summary. The server reads the selected inquiry and interactions, then calls the dedicated n8n webhook with backend-only CRM_SUMMARY_TOKEN. The workflow calls loopback Ollama qwen3.5:9b and disables execution payload retention. Ollama stays private.

Pending explicit approval: use the existing local n8n administration API credential to create and activate the workflow, create its HTTP header credential, store the matching production Cloudflare Pages secret, test with synthetic data, and deploy the feature. No existing CRM workflow is replaced. Rollback removes the new UI/API and deactivates the dedicated workflow.

QA: synthetic UI output verified. Three new tests validate conversation scoping/contact redaction, output shape/source IDs, cross-origin rejection and unavailable bridge state. Existing CRM regression tests pass. Backend workflow activation and end-to-end model connection remain untested until approval.

n8n reference: https://docs.n8n.io/workflows/settings/
