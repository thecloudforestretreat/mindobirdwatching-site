import io
import json
import unittest

import custom_tours


class CustomTourTests(unittest.TestCase):
    def sample(self):
        return {
            "inquiry_complexity": "custom_tour",
            "input_language": "English",
            "output_language": "en",
            "request_summary": "Two guests want a wildlife itinerary.",
            "guest_profile": {"party_size": 2},
            "requested_dates": ["2026-12-20"],
            "target_species": ["Spectacled Bear"],
            "requirements": ["Active tracking"],
            "unknowns": ["Budget"],
            "assumptions": [],
            "validation_flags": [],
            "proposed_days": [
                {
                    "day_number": 1,
                    "date": "2026-12-20",
                    "location": "Antisana",
                    "activity": "Full-day wildlife search",
                    "targets": ["Andean Condor"],
                    "logistics": ["Quito base"],
                    "pricing_needed": ["guide", "transport", "entrance fees"],
                    "guide_line": "Dec 20 – Full-day Antisana; quote guide, transport and entrance fees.",
                }
            ],
            "guest_reply_draft": "Dear Guest,\n\nThank you for the detailed request. What lodging level and approximate budget would you prefer?\n\nBest regards,\nMindo Bird Watching",
            "guide_brief_draft": "Dec 20 – Full-day Antisana; quote guide, transport and entrance fees.",
            "internal_summary": "Custom itinerary requires guide pricing.",
        }

    def test_valid_analysis(self):
        result = custom_tours.validate_analysis(self.sample())
        self.assertEqual(result["proposed_days"][0]["date"], "2026-12-20")
        self.assertEqual(
            result["guide_brief_draft"],
            "2026-12-20 – Antisana · Full-day wildlife search; price guide, transport, entrance fees.",
        )
        self.assertEqual(result["proposed_days"][0]["targets"], [])

    def test_unapproved_price_is_rejected(self):
        value = self.sample()
        value["guest_reply_draft"] = "The trip costs $500."
        with self.assertRaisesRegex(ValueError, "unapproved price"):
            custom_tours.validate_analysis(value)

    def test_prompt_uses_only_safe_crm_fields(self):
        prompt = custom_tours.build_prompt(
            {
                "full_name": "Guest",
                "email": "private@example.com",
                "internal_notes": "secret",
                "message_questions": "Please plan three days.",
            },
            "Trip",
            "",
            "",
            [],
            "auto",
        )
        self.assertIn("Please plan three days", prompt)
        self.assertNotIn("private@example.com", prompt)
        self.assertNotIn("secret", prompt)

    def test_model_response_is_structured(self):
        captured = {}

        def opener(request, **kwargs):
            captured["payload"] = json.loads(request.data)
            captured["timeout"] = kwargs["timeout"]
            return response

        response = io.BytesIO(
            json.dumps({"message": {"content": json.dumps(self.sample())}}).encode()
        )
        result = custom_tours.analyze_request(
            {"inquiry_id": "INQ-1"},
            message="Plan a custom trip",
            opener=opener,
        )
        self.assertEqual(result["ai_model"], "qwen3.5:27b")
        self.assertEqual(result["validation_status"], "needs_review")
        self.assertEqual(
            captured["payload"]["options"]["num_predict"],
            custom_tours.MAX_OUTPUT_TOKENS,
        )
        self.assertEqual(captured["timeout"], custom_tours.MODEL_TIMEOUT_SECONDS)

    def test_unsupported_permit_claim_is_removed(self):
        value = self.sample()
        value["validation_flags"] = [
            "Special permits are required.",
            "Lodging still needs confirmation.",
        ]
        response = io.BytesIO(
            json.dumps({"message": {"content": json.dumps(value)}}).encode()
        )
        result = custom_tours.analyze_request(
            {"inquiry_id": "INQ-1"},
            message="Plan a custom wildlife trip.",
            opener=lambda *args, **kwargs: response,
        )
        self.assertEqual(result["validation_flags"], ["Lodging still needs confirmation."])


if __name__ == "__main__":
    unittest.main()
