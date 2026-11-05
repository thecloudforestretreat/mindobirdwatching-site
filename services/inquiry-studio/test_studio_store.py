import io
import json
import unittest

import studio_store


class StudioStoreTests(unittest.TestCase):
    def analysis(self):
        return {
            "inquiry_complexity": "custom_tour",
            "input_language": "English",
            "output_language": "en",
            "request_summary": "Custom request",
            "guest_profile": {"party_size": 2},
            "requested_dates": ["2026-12-20"],
            "target_species": ["Spectacled Bear"],
            "requirements": ["Guide"],
            "unknowns": [],
            "assumptions": [],
            "validation_flags": [],
            "proposed_days": [],
            "guest_reply_draft": "Draft",
            "guide_brief_draft": "Dec 20 – Quote guide.",
            "internal_summary": "Summary",
            "ai_model": "qwen3.5:27b",
            "prompt_version": "test",
            "validation_status": "needs_review",
            "last_analyzed_at": "2026-10-01T00:00:00Z",
        }

    def test_build_and_revision(self):
        record = studio_store.build_record(
            {"inquiry_id": "INQ-1", "guest_id": "G-1"},
            {"message": "Request"},
            self.analysis(),
            [],
        )
        self.assertTrue(record["inquiry_studio_id"].startswith("IST-"))
        self.assertEqual(record["revision"], 1)
        updated = studio_store.add_guide_response(record, "Guide and transport: 200", "Neicer")
        self.assertEqual(updated["revision"], 2)
        self.assertEqual(json.loads(updated["guide_responses_json"])[0]["sender"], "Neicer")

    def test_save_links_existing_inquiry(self):
        record = studio_store.build_record(
            {"inquiry_id": "INQ-1", "guest_id": "G-1"},
            {"message": "Request"},
            self.analysis(),
            [],
        )
        requests = []

        def opener(request, timeout):
            requests.append(json.loads(request.data))
            return io.BytesIO(json.dumps({"ok": True}).encode())

        studio_store.save(record, opener)
        self.assertEqual([item["action"] for item in requests], ["save_inquiry_studio", "update_inquiry"])
        self.assertEqual(requests[1]["inquiry_row"]["inquiry_studio_id"], record["inquiry_studio_id"])

    def test_create_new_guest_and_inquiry_from_studio(self):
        requests = []

        def opener(request, timeout):
            payload = json.loads(request.data)
            requests.append(payload)
            return io.BytesIO(json.dumps({"ok": True, "record": payload["inquiry_row"]}).encode())

        row = {
            "full_name": "Sjaak Klaassen",
            "email": "sjaak@example.com",
            "phone_number": "+31 6 1234 5678",
        }
        analysis = self.analysis()
        analysis["guest_profile"] = {"party_size": 2, "country": "The Netherlands"}
        created = studio_store.create_crm_guest_and_inquiry(
            row,
            {"message": "Custom wildlife tour request"},
            analysis,
            "IST-20261001190000-ABC123",
            opener,
        )
        self.assertEqual(created["inquiry_id"], "INQ-20261001190000-ABC123")
        self.assertEqual(requests[0]["action"], "create_guest_and_inquiry")
        self.assertEqual(requests[0]["guest_row"]["phone_normalized"], "31612345678")
        self.assertEqual(requests[0]["inquiry_row"]["guest_count"], "2")
        self.assertEqual(requests[0]["inquiry_row"]["inquiry_studio_id"], "IST-20261001190000-ABC123")

    def test_list_guides_filters_inactive_and_non_guide_providers(self):
        def opener(request, timeout):
            return io.BytesIO(json.dumps({"ok": True, "records": [
                {"provider_id": "P-2", "provider_name": "Transporter", "provider_role": "driver", "active": "yes"},
                {"provider_id": "P-3", "provider_name": "Inactive Guide", "provider_role": "guide", "active": "no"},
                {"provider_id": "P-1", "provider_name": "Neicer", "provider_role": "guide", "active": "yes"},
            ]}).encode())

        self.assertEqual(studio_store.list_guides(opener), [{"provider_id": "P-1", "provider_name": "Neicer"}])

    def test_create_guide_quote_request_links_assignment_and_handoff(self):
        record = studio_store.build_record(
            {"inquiry_id": "INQ-1", "guest_id": "G-1"},
            {"subject": "Older traveler route", "message": "Request"},
            self.analysis(),
            [],
        )
        requests = []
        created_assignment = None

        def opener(request, timeout):
            nonlocal created_assignment
            payload = json.loads(request.data)
            requests.append(payload)
            if payload["action"] == "list_assignments":
                result = {"ok": True, "records": [created_assignment] if created_assignment else []}
            elif payload["action"] == "create_assignment":
                created_assignment = {**payload["assignment"], "assignment_id": "A-QUOTE"}
                result = {"ok": True, "record": created_assignment}
            else:
                result = {"ok": True}
            return io.BytesIO(json.dumps(result).encode())

        updated, _ = studio_store.create_guide_quote_request(record, "P-1", "Neicer", "mindo-tours", "2026-11-01", opener)
        assignment = next(item["assignment"] for item in requests if item["action"] == "create_assignment")
        self.assertEqual(assignment["assignment_kind"], "quote_request")
        self.assertEqual(assignment["provider_id"], "P-1")
        self.assertIn("brand=mindo-tours", assignment["internal_note"])
        handoff = json.loads(updated["handoff_json"])
        self.assertEqual(handoff["brand_id"], "mindo-tours")
        self.assertEqual(handoff["guide_quote_requests"][0]["provider_name"], "Neicer")
        self.assertEqual([item["action"] for item in requests], ["list_assignments", "create_assignment", "list_assignments", "save_inquiry_studio", "update_inquiry"])

    def test_approve_guide_quote_prepares_final_plan_for_markup(self):
        record = studio_store.build_record(
            {"inquiry_id": "INQ-1", "guest_id": "G-1"},
            {"message": "Request"},
            self.analysis(),
            [],
        )
        record["guide_quotes_json"] = json.dumps([{
            "quote_id": "GQ-1", "version": 1, "status": "submitted", "provider_id": "P-1", "provider_name": "Neicer",
            "brand_id": "mindo-tours", "currency": "USD", "options": [{"name": "Private", "net_total": 300}],
        }])
        requests = []

        def opener(request, timeout):
            requests.append(json.loads(request.data))
            return io.BytesIO(json.dumps({"ok": True}).encode())

        updated = studio_store.review_guide_quote(record, "GQ-1", "approve", "", "Juan", opener)
        quote = json.loads(updated["guide_quotes_json"])[0]
        final_plan = json.loads(updated["final_plan_json"])
        handoff = json.loads(updated["handoff_json"])
        self.assertEqual(quote["admin_status"], "approved")
        self.assertEqual(final_plan["pricing_status"], "markup_required")
        self.assertEqual(final_plan["net_options"][0]["net_total"], 300)
        self.assertEqual(handoff["itinerary_status"], "awaiting_markup")

    def test_revision_request_requires_instructions(self):
        record = {"inquiry_studio_id": "IST-1", "inquiry_id": "INQ-1", "revision": 1, "guide_quotes_json": json.dumps([{"quote_id": "GQ-1", "status": "submitted"}])}
        with self.assertRaisesRegex(ValueError, "Explain"):
            studio_store.review_guide_quote(record, "GQ-1", "request_revision", "")

    def test_admin_plan_keeps_net_costs_private_and_prices_lodging_at_net(self):
        record = studio_store.build_record(
            {"inquiry_id": "INQ-1", "guest_id": "G-1"},
            {"message": "Request"},
            self.analysis(),
            [],
        )
        record["guide_quotes_json"] = json.dumps([{
            "quote_id": "GQ-1", "version": 1, "status": "submitted", "admin_status": "approved",
            "provider_id": "P-1", "provider_name": "Neicer", "brand_id": "mindo-tours",
            "options": [{"option_id": "OPT-1", "name": "Private", "days": [{
                "day_id": "DAY-1", "day_number": 1, "date": "2027-02-09", "title": "Mindo", "agenda": "Birding",
                "costs": [
                    {"cost_id": "C-GUIDE", "category": "guide", "description": "Guide", "amount": 100, "quantity": 1, "basis": "per_day", "status": "confirmed"},
                    {"cost_id": "C-HOTEL", "category": "accommodation", "description": "Hotel", "amount": 75, "quantity": 1, "basis": "per_room_night", "status": "confirmed"},
                ],
            }]}],
        }])
        requests = []

        def opener(request, timeout):
            requests.append(json.loads(request.data))
            return io.BytesIO(json.dumps({"ok": True}).encode())

        updated = studio_store.save_admin_plan(record, {
            "quote_id": "GQ-1", "selected_option_id": "OPT-1", "default_markup_percent": 30,
            "sell_prices": {}, "admin_days": [{"day_id": "DAY-1", "title": "Mindo revised"}],
        }, "Juan", opener)
        plan = json.loads(updated["final_plan_json"])
        self.assertEqual(plan["net_total"], 175)
        self.assertEqual(plan["sell_prices"]["C-GUIDE"], 130)
        self.assertEqual(plan["sell_prices"]["C-HOTEL"], 75)
        self.assertEqual(plan["sell_total"], 205)
        self.assertEqual(plan["gross_profit"], 30)
        self.assertEqual(plan["admin_days"][0]["title"], "Mindo revised")
        self.assertNotIn("sell_prices", updated["guide_quotes_json"])

    def test_workflow_requires_saved_pricing_and_records_events(self):
        record = {
            "inquiry_studio_id": "IST-1", "inquiry_id": "INQ-1", "revision": 2,
            "final_plan_json": json.dumps({"selected_option_id": "OPT-1", "pricing_status": "ready", "workflow": {"stage": "admin_proposal", "events": []}}),
        }
        requests = []

        def opener(request, timeout):
            requests.append(json.loads(request.data))
            return io.BytesIO(json.dumps({"ok": True}).encode())

        updated = studio_store.advance_workflow(record, "mark_preliminary_sent", "Sent by email", "Juan", opener, {"guest_reply": "Exact email"})
        plan = json.loads(updated["final_plan_json"])
        artifacts = json.loads(updated["handoff_json"])["sent_artifacts"]
        self.assertEqual(plan["workflow"]["stage"], "guest_review")
        self.assertEqual(plan["workflow"]["events"][-1]["note"], "Sent by email")
        self.assertEqual(updated["status"], "guest_review")
        self.assertEqual(artifacts[0]["artifact"]["guest_reply"], "Exact email")
        self.assertEqual(len(artifacts[0]["sha256"]), 64)

    def test_case_context_tracks_owner_decisions_and_room_deposit(self):
        record = studio_store.build_record(
            {"inquiry_id": "INQ-ROBERT", "guest_id": "G-ROBERT"},
            {"message": "Request"}, self.analysis(), [],
        )
        requests = []

        def opener(request, timeout):
            requests.append(json.loads(request.data))
            return io.BytesIO(json.dumps({"ok": True}).encode())

        updated = studio_store.save_case_context(record, {
            "case_owner": {"name": "Juan", "phone": "+1 555 0100"},
            "guest_timezone": "Australia/Perth",
            "preferred_contact": "phone",
            "budget_ceiling": 2500,
            "confirmed_facts": ["Two nights in Mindo"],
            "open_decisions": ["Select Mindo room"],
            "commitments": ["Juan will confirm lodging"],
            "next_action": "Call Robert",
            "accommodations": [{
                "location": "Intag", "property": "El Refugio", "check_in": "2027-02-11",
                "check_out": "2027-02-13", "net_total": 200, "deposit_percent": 50,
                "status": "available",
            }],
            "suppliers": [{
                "name": "Neicer", "role": "guide", "service": "Private guiding",
                "service_date": "2027-02-11", "net_cost": 80, "deposit_percent": 25,
                "availability": "available", "verified_at": "2026-11-04",
                "valid_until": "2026-12-04", "evidence_source": "WhatsApp 2026-11-04",
            }],
        }, "Juan", opener)
        context = json.loads(updated["handoff_json"])["case_context"]
        self.assertEqual(context["case_owner"]["name"], "Juan")
        self.assertEqual(context["budget_ceiling"], 2500)
        self.assertEqual(context["accommodations"][0]["deposit_amount"], 100)
        self.assertEqual(context["open_decisions"], ["Select Mindo room"])
        self.assertEqual(context["suppliers"][0]["deposit_amount"], 20)
        self.assertEqual([item["action"] for item in requests], ["save_inquiry_studio", "update_inquiry", "update_inquiry"])
        self.assertEqual(requests[-1]["record"]["followup_date"], "")

    def test_post_invoice_workflow_and_final_assignments_are_idempotent(self):
        record = studio_store.build_record(
            {"inquiry_id": "INQ-OPS", "guest_id": "G-OPS"}, {"message": "Request"}, self.analysis(), [],
        )
        quote = {
            "quote_id": "GQ-OPS", "version": 2, "status": "submitted", "admin_status": "approved",
            "provider_id": "P-1", "provider_name": "Neicer", "brand_id": "mindo-tours",
            "options": [{"option_id": "OPT-1", "name": "Private", "days": [{
                "day_id": "D-1", "day_number": 1, "date": "2027-02-09", "title": "Mindo", "agenda": "Birding",
                "start_location": "Quito", "end_location": "Mindo",
                "costs": [{"cost_id": "C-1", "category": "guide", "amount": 80, "quantity": 1, "status": "confirmed"}],
            }]}],
        }
        record["guide_quotes_json"] = json.dumps([quote])
        record["final_plan_json"] = json.dumps({
            "quote_id": "GQ-OPS", "quote_version": 2, "selected_option_id": "OPT-1", "pricing_status": "ready",
            "admin_days": [{"day_id": "D-1", "date": "2027-02-09", "title": "Mindo", "agenda": "Birding", "start_location": "Quito", "end_location": "Mindo"}],
            "workflow": {"stage": "reservations_confirmed", "events": []},
        })
        assignments = []

        def opener(request, timeout):
            payload = json.loads(request.data)
            if payload["action"] == "list_assignments":
                result = {"ok": True, "records": assignments}
            elif payload["action"] == "create_assignment":
                saved = {**payload["assignment"], "assignment_id": f"A-{len(assignments) + 1}"}
                assignments.append(saved)
                result = {"ok": True, "record": saved}
            else:
                result = {"ok": True}
            return io.BytesIO(json.dumps(result).encode())

        updated, first = studio_store.create_operations_assignments(record, "Robert", "+61", "Juan", opener)
        updated_again, second = studio_store.create_operations_assignments(updated, "Robert", "+61", "Juan", opener)
        self.assertEqual(len(first), 1)
        self.assertEqual(len(second), 1)
        self.assertEqual(len(assignments), 1)
        self.assertEqual(assignments[0]["assignment_status"], "confirmed")
        self.assertEqual(assignments[0]["provider_cost"], 80)
        self.assertEqual(json.loads(updated_again["handoff_json"])["operations_assignments"][0]["provider_name"], "Neicer")


if __name__ == "__main__":
    unittest.main()
