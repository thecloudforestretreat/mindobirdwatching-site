# Local guide-plan translation

The admin-only Guide Nest translation action converts the saved Spanish itinerary source into a separate English draft. It does not replace Spanish text, alter guide costs, approve a plan, or send anything to a guest. Administrators must review and explicitly save the English draft.

The protected same-origin endpoint calls a dedicated header-authenticated n8n webhook. The workflow uses the existing local `gpt-oss:20b` Ollama service with a strict schema, fixed day IDs, zero temperature, and execution-data retention disabled. The prompt treats itinerary text as untrusted data and prohibits invented activities, prices, confirmations, or omissions.

Publish the workflow with the existing `CRM Local Summary Bridge` header-auth credential. Do not expose Ollama, loosen Guide Nest access, or enable execution payload storage. Verify with a synthetic itinerary before enabling the UI in production.
