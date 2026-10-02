# MBW Inquiry Studio

Inquiry Studio is a protected Mac mini application for preparing unsent guest replies and custom-tour planning records. It uses local Ollama models and never sends email or WhatsApp messages. Custom-tour extraction uses `qwen3.5:9b`; the existing focused quick-reply path uses `qwen3.5:27b`.

## Capabilities

- Sync the active CRM inquiry list every five minutes.
- Merge source details and Studio linkage fields from `crm_inquiries`.
- Prepare quick email drafts in the existing MBW email editor.
- Analyze detailed messages, JPG/PNG/WebP images, and PDFs.
- Produce a structured request, missing questions, proposed days, a guest follow-up, and concise guide-pricing lines.
- Save a reviewed 40-column Studio record to `crm_inquiry_studio` through the MBW n8n CRM API.
- Link the saved Studio ID, status, and update time back to `crm_inquiries`.
- Append the original guide reply to `guide_responses_json`, structure dated supplier costs in `guide_quotes_json`, and merge them into a review-only `final_plan_json`.
- Keep supplier costs private until inclusions, exclusions, pending items, and owner markup have been reviewed.

## Safety boundaries

- Cloudflare Access authentication is required on the admin hostname.
- The service binds to `127.0.0.1` and verifies the Access JWT forwarded by the Pages proxy.
- Uploaded files are bounded, analyzed in a temporary directory, and removed after analysis. Google Sheets receives only a filename/type/size/hash manifest.
- Guest text and attachments are treated as untrusted content, not model instructions.
- The local model cannot approve prices, confirm availability, make reservations, guarantee wildlife, or send messages.
- Every generated record is `needs_review` until a human reviews it.

## Local requirements

- Ollama on `127.0.0.1:11434` with `qwen3.5:9b` and `qwen3.5:27b`.
- The AI-OS Python environment used by the existing launch agents.
- macOS PDFKit for PDF text extraction and page rendering.
- The MBW n8n instance on `127.0.0.1:5681` with the Inquiry Studio CRM actions installed.

Compile the PDF helper before starting the service:

```sh
/usr/bin/xcrun swiftc document_extract.swift -o document_extract -framework PDFKit -framework AppKit
```

Run tests:

```sh
python3 -m unittest test_crm_sync.py test_custom_tours.py test_studio_store.py test_server.py -v
node test_editor.cjs
```

## Deployment order

1. Back up the live `MBW CRM Admin API` workflow.
2. Build, validate, import, and publish the patched n8n workflow.
3. Back up the current Inquiry Studio source while preserving its `private/` directory and access configuration.
4. Deploy the service files and compile `document_extract`.
5. Restart `com.mbw.inquiry-studio` and `com.mbw.inquiry-crm-sync`.
6. Test a new custom intake without a CRM link.
7. Test an existing inquiry and verify both sheets update while no message is sent.
