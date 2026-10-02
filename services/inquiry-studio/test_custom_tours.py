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
            "guest_profile": {
                "guest_names": ["Sjaak", "Carline"],
                "party_size": "2",
                "home_country": "The Netherlands",
                "travel_style": "Wildlife enthusiasts",
            },
            "trip_profile": {
                "travel_window": "2026-12-20",
                "arrival_details": "",
                "departure_details": "",
                "lodging_preferences": "Cloud forest lodge",
                "room_configuration": "",
                "walking_ability": "Physically fit",
                "altitude_experience": "",
                "transport_requirements": "Ecuador ground transfers",
                "budget": "",
            },
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
            "internal_summary": "Custom itinerary requires guide pricing.",
        }

    def test_valid_analysis(self):
        result = custom_tours.validate_analysis(self.sample())
        self.assertEqual(result["proposed_days"][0]["date"], "2026-12-20")
        self.assertEqual(
            result["guide_brief_draft"],
            "2026-12-20 – Antisana · Full-day wildlife search; price guide, Ecuador transport, entrance fees.",
        )
        self.assertEqual(result["proposed_days"][0]["targets"], [])

    def test_invalid_profile_is_rejected(self):
        value = self.sample()
        value["trip_profile"] = []
        with self.assertRaisesRegex(ValueError, "trip profile"):
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
        self.assertNotIn("business_knowledge", prompt)
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
        self.assertEqual(result["ai_model"], "qwen3.5:9b")
        self.assertEqual(result["validation_status"], "needs_review")
        self.assertIn("Dear Sjaak and Carline", result["guest_reply_draft"])
        self.assertEqual(
            captured["payload"]["options"]["num_predict"],
            custom_tours.MAX_OUTPUT_TOKENS,
        )
        self.assertEqual(captured["timeout"], custom_tours.MODEL_TIMEOUT_SECONDS)
        self.assertNotIn("guest_reply_draft", captured["payload"]["format"]["properties"])
        self.assertIn("proposed_days", captured["payload"]["messages"][0]["content"])

    def test_model_json_can_be_wrapped_in_markdown(self):
        content = f"Here is the result:\n```json\n{json.dumps(self.sample())}\n```"
        parsed = custom_tours.parse_model_json(content)
        self.assertEqual(parsed["inquiry_complexity"], "custom_tour")

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

    def test_known_details_are_not_reasked_and_knowledge_is_attached(self):
        value = self.sample()
        value["unknowns"] = [
            "Specific birding targets",
            "Flight booking assistance",
            "Budget range",
        ]
        response = io.BytesIO(
            json.dumps({"message": {"content": json.dumps(value)}}).encode()
        )
        result = custom_tours.analyze_request(
            {"inquiry_id": "INQ-1"},
            message="We are physically fit and want Spectacled Bear, Bellavista and Cotopaxi. Targets include toucans and quetzals.",
            opener=lambda *args, **kwargs: response,
        )
        self.assertFalse(any("bird" in item.lower() for item in result["unknowns"]))
        self.assertFalse(any("flight" in item.lower() for item in result["unknowns"]))
        self.assertTrue(any("budget" in item.lower() for item in result["unknowns"]))
        self.assertIn("bears-birding-cotopaxi", result["knowledge_profile_ids"])
        self.assertTrue(result["recommendations"])

    def test_international_flight_transport_is_not_sent_for_pricing(self):
        value = self.sample()
        value["proposed_days"][0].update(
            {
                "location": "Pereira / Quito",
                "activity": "Nightflight from Pereira to Quito",
                "pricing_needed": ["transport", "lodging"],
            }
        )
        result = custom_tours.validate_analysis(value)
        self.assertEqual(result["proposed_days"][0]["pricing_needed"], ["lodging"])
        self.assertNotIn("transport", result["guide_brief_draft"])

    def test_panama_departure_day_is_not_sent_for_pricing(self):
        value = self.sample()
        value["proposed_days"][0].update(
            {
                "location": "Quito / Panama",
                "activity": "Dayflight Quito to Panama",
                "pricing_needed": ["Guide", "Transport", "Lodging"],
            }
        )
        result = custom_tours.validate_analysis(value)
        self.assertEqual(result["proposed_days"][0]["pricing_needed"], [])
        self.assertEqual(result["guide_brief_draft"], "")

    def test_source_day_dates_and_flights_override_model_omissions(self):
        value = self.sample()
        value["proposed_days"][0]["date"] = "2026-12-19"
        value["unknowns"] = ["Exact arrival flight details", "Exact departure flight details"]
        source = """Day 1
Saturday, 19 December 2026
Nightflight Pereira [18:20] - Quito [23:00]
Day 2
Sunday, 20 December 2026
Day 12
Wednesday, 30 December 2026
Dayflight Quito [14:26] - Panama [16:27]"""
        result = custom_tours.apply_source_guards(
            custom_tours.validate_analysis(value), source
        )
        self.assertEqual(result["proposed_days"][0]["date"], "2026-12-19")
        self.assertEqual(result["trip_profile"]["travel_window"], "2026-12-19 to 2026-12-30")
        self.assertIn("Pereira", result["trip_profile"]["arrival_details"])
        self.assertIn("Panama", result["trip_profile"]["departure_details"])
        self.assertFalse(any("arrival" in item.lower() for item in result["unknowns"]))
        self.assertFalse(any("departure" in item.lower() for item in result["unknowns"]))

    def test_table_transfer_before_day_marker_moves_to_that_day(self):
        value = self.sample()
        value["proposed_days"] = [
            {
                "day_number": 5,
                "date": "2026-12-23",
                "location": "Mirador to Bellavista",
                "activity": "Bear search; transfer to Bellavista",
                "pricing_needed": ["guide", "Ecuador transport", "lodging"],
            },
            {
                "day_number": 6,
                "date": "2026-12-24",
                "location": "Bellavista",
                "activity": "Birding",
                "pricing_needed": ["guide", "lodging"],
            },
        ]
        source = """Day 5
Wednesday, 23 December 2026
Bear search
Transfer Mirador to Bellavista [4hr drive]
Day 6
Thursday, 24 December 2026
Birding"""
        result = custom_tours.apply_source_guards(
            custom_tours.validate_analysis(value), source
        )
        self.assertNotIn("transfer", result["proposed_days"][0]["activity"].lower())
        self.assertEqual(result["proposed_days"][0]["location"], "Mirador")
        self.assertNotIn("Ecuador transport", result["proposed_days"][0]["pricing_needed"])
        self.assertIn("Transfer Mirador to Bellavista", result["proposed_days"][1]["activity"])
        self.assertIn("Ecuador transport", result["proposed_days"][1]["pricing_needed"])


if __name__ == "__main__":
    unittest.main()
