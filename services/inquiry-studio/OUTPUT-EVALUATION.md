# Local drafting evaluation — September 28, 2026

Two fresh generations using qwen3.5:27b and the current pilot prompt. Saved customer drafts were not replaced; no email was sent. Raw outputs are stored privately in private/evaluation-two-inquiries.json.

Scores are manual assessments, not a statistical benchmark. Rubric: request coverage 3 points; factual/logistical accuracy 3; style 2; follow-up quality 1; pricing and confirmation restraint 1.

| Case | Coverage | Accuracy | Style | Follow-up | Restraint | Total | Generation |
|---|---:|---:|---:|---:|---:|---:|---:|
| Andrew: tanagers, Tababela pickup, Mindo drop-off | 3 | 2.5 | 1.5 | 0.5 | 1 | 8.5/10 | 41.4s |
| Kathy: Hilton Colon Quito, early birding, Quito return by 5pm | 1 | 0.5 | 1.5 | 0 | 1 | 4/10 | 54.5s |

Andrew: correct short heading, full-day/Andean/Jewels order, relevant transport explanation, missing pickup/drop-off requested, no invented prices or unwanted disclaimer. Repeats address request in body and Next Steps. Private note incorrectly calls tanagers a single species. Good owner-review draft with minor editing.

Kathy: incorrectly introduces Tababela, despite Hilton Colon Quito being supplied. Asks for exact pickup near the hotel unnecessarily. Omits the 5pm return deadline from customer copy; asks whether return to Quito is preferred although already requested. Private note assumes the full-day tour ending at 3pm fits well without establishing return timing. Good title/order and no invented price do not compensate for incorrect logistics. Not ready to use.

Both select full-day, Andean, Jewels, Quito transport. The template supplies the approved reply/WhatsApp closing separately from model prose. Catalog amounts remain unapproved defaults; these scores do not validate quote prices.

Supporting checks: all 9 backend unit tests passed; editor regression suite passed its export lock, review invalidation, and readonly HTML checks. These checks do not catch semantic itinerary errors.

Next fixes: provide location guidance only when applicable to the current inquiry; treat known pickup and required return destination/time as explicit constraints; check generated copy for contradictory or irrelevant locations and redundant questions; remove duplicate follow-up prose. Re-run both cases plus a Spanish and time-limited inquiry after changes. Two samples are insufficient to estimate overall reliability.

## Follow-up fixes and verification

Location guidance is now conditional on the inquiry. Checks reject unrelated Tababela mentions, missing recognized return deadlines/destinations, contradictory Mindo/Quito drop-off requests, repeat requests for a named hotel pickup, and address requests embedded in the body. One local repair attempt is allowed; a second failure is blocked from the editor. Named-hotel recognition and deadline/destination extraction are conservative patterns, not a general travel planner.

Two subsequent live generations: Kathy 58.0s, Andrew 53.5s. Both used the short title and correct tour ordering. Andrew stated the Quito outskirts relationship and requested pickup/drop-off details only in Next Steps. Kathy acknowledged Hilton Colon Quito and return to Quito by 5pm, with no Tababela or Mindo drop-off request. Wording such as “We acknowledge” is still somewhat formal.

Final deterministic cleanup was then tested against both fresh outputs: unnecessary participant-name requests removed; model assertions about schedule feasibility replaced by a private instruction to verify tour finish, driving time and traffic buffer. These final processed outputs are in private/evaluation-verified-itinerary-fix.json. No saved guest drafts were replaced. Manual grades: Andrew 8.5/10, Kathy 8/10. Remaining limits: tone refinement, no verified live logistics, unapproved default prices, only two live test cases.

17 backend tests and the editor export/review regression checks pass. Existing production workflows remain untouched.
