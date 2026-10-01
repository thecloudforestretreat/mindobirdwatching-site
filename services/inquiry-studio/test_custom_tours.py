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
        response = io.BytesIO(
            json.dumps({"message": {"content": json.dumps(self.sample())}}).encode()
        )
        result = custom_tours.analyze_request(
            {"inquiry_id": "INQ-1"},
            message="Plan a custom trip",
            opener=lambda *args, **kwargs: response,
        )
        self.assertEqual(result["ai_model"], "qwen3.5:27b")
        self.assertEqual(result["validation_status"], "needs_review")


if __name__ == "__main__":
    unittest.main()

