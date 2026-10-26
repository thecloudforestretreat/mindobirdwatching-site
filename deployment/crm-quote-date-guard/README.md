# New inquiry quote-date guard

An October 25 creation request reached the CRM webhook with quote_status=not_sent and quote_sent_at=2026-09-08T12:48:00.000Z. Execution 281337 confirms the contradictory value was already in the browser payload, before normalization or Sheets append. It does not establish why the browser supplied that value or that every historical conflict has the same cause.

The frontend blocks this combination on new/returning inquiry saves and opens the quote panel with an actionable message. The matching n8n Validate Create Against CRM guard returns ok=false and _route=respond before any append route, protecting against stale clients. Blank/whitespace dates and explicitly sent/accepted quotes remain supported. Existing inquiry updates preserve historical data for separate evidence-based review.

The standalone node code is based on the live October 26 export. For an existing live workflow, replace only this node's jsCode after comparing the current version. Do not import the older multi-invoice workflow template over newer live workflow changes. No historical timestamps are bulk cleared.

Run: node --test tests/crm-quote-date.test.mjs tests/crm-quote-create-guard.test.mjs tests/crm-quote-workflow.test.mjs
