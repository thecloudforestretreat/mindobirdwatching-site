# Local CRM conversation summary

The staff-reviewed assistant summarizes up to 20 recorded guest/staff messages, identifies missing information and drafts a reply. It never saves records or sends messages. The CRM endpoint isolates the inquiry, removes deleted/internal metadata, redacts contacts and validates output/source IDs; the browser escapes model text and discards stale results.

The protected same-origin `/api/crm/summary` endpoint calls the dedicated header-authenticated n8n webhook. The prepared workflow uses loopback Ollama `/api/chat`, local `gpt-oss:20b`, low thinking, a fixed 32K context and a strict response schema whose references are restricted to the input message IDs. Execution payload retention stays disabled. No Ollama port, credential, webhook authentication or access scope is widened. Model metadata comes from the bridge response rather than a hard-coded name.

The previous `qwen3.5:9b` completion request timed out during controlled QA. An unconstrained completion response from the resident model was invalid JSON. A schema-constrained chat request returned a valid, grounded synthetic summary in 7.8 seconds. Runtime remains dependent on local model capacity; this timing is not a guarantee under load or with longer conversations.

**Prepared, not yet applied to the live workflow.** Automatic approval review rejected reading the existing n8n administration key from its local database without explicit approval for that credential source. Apply only after that approval or through an authenticated n8n user session.

For deployment, back up the current workflow and patch only `Prepare`, `Local model` and `Parse`. Preserve the live webhook node ID, existing header-auth credential reference, connections and privacy settings. Do not replace the live webhook with the template's placeholder credential. Publish the updated version of the same workflow, then run the controlled CRM test and remove its synthetic interactions. Roll back those three node parameters if validation fails. Do not enable execution payload storage for diagnosis.
