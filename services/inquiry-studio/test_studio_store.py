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


if __name__ == "__main__":
    unittest.main()

