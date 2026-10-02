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
            "trip_profile": {"budget": ""},
            "requested_dates": ["2026-12-20"],
            "target_species": ["Spectacled Bear"],
            "requirements": ["Guide"],
            "unknowns": [],
            "assumptions": [],
            "validation_flags": [],
            "recommendations": ["Keep the bear-search days flexible."],
            "knowledge_profile_ids": ["bears-birding-cotopaxi"],
            "knowledge_version": "test-v1",
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
        extracted = json.loads(record["extracted_request_json"])
        self.assertEqual(extracted["knowledge_profile_ids"], ["bears-birding-cotopaxi"])
        updated = studio_store.add_guide_response(record, "Guide and transport: 200", "Neicer")
        self.assertEqual(updated["revision"], 2)
        self.assertEqual(json.loads(updated["guide_responses_json"])[0]["sender"], "Neicer")

    def test_guide_response_is_structured_and_merged_by_date(self):
        analysis = self.analysis()
        analysis["proposed_days"] = [
            {
                "day_number": number,
                "date": f"2026-12-{18 + number:02d}",
                "location": "Ecuador",
                "activity": "Guest request",
                "pricing_needed": ["guide"],
            }
            for number in range(1, 13)
        ]
        record = studio_store.build_record(
            {"inquiry_id": "INQ-1", "guest_id": "G-1"},
            {"message": "Request"},
            analysis,
            [],
        )
        response = """Itinerario 19-30 Diciembre
1. Arribo a Quito traslado al hotel 23 horas costo pendiente
2. Full day Antisana costo total $270 incluye ingresos transporte guía
3. Cayambe-Coca y Papallacta costo total $250 incluye transporte guía ingresos
4. Mirador del Oso Andino costo $190 incluye guía transporte no incluye ingreso a la reserva
23 reserva Sigsipamba costo $190 incluye guía transporte no incluye ingresos a la reserva
24 Retorno a Mindo o caminata nocturna costo $220 incluye transporte guía caminata nocturna
25 aves, mariposario y chocolate costo $150
26 Bellavista y Frutitour costo $240 incluye ingresos desayuno guía transporte
27 Mashpi Amagusa y traslado a Cotopaxi costo $300 incluye transporte guía ingresos
28 Cotopaxi con opción de cabalgata costo $160 no incluye cabalgata
29 Quito, Mitad del Mundo y Centro Histórico $200 incluye transporte guía ingreso
30 traslado al aeropuerto costo $70
Queda pendiente averiguar el costo del ingreso a la reserva de los osos. La alimentación y el hospedaje es adicional y no se incluye."""
        updated = studio_store.add_guide_response(record, response, "Neicer")
        quote = json.loads(updated["guide_quotes_json"])[0]
        plan = json.loads(updated["final_plan_json"])
        self.assertEqual(len(quote["items"]), 12)
        self.assertEqual(quote["known_supplier_subtotal_usd"], 2240)
        self.assertEqual(quote["items"][0]["price_status"], "pending")
        self.assertEqual(quote["items"][1]["amount_usd"], 270)
        self.assertEqual(quote["items"][4]["date"], "2026-12-23")
        self.assertEqual(quote["items"][3]["included"], ["guide", "Ecuador transport"])
        self.assertIn("entrance fees", quote["items"][3]["excluded"])
        self.assertIn("breakfast", quote["items"][7]["included"])
        self.assertNotIn("horse riding", quote["items"][9]["included"])
        self.assertIn("horse riding", quote["items"][9]["excluded"])
        self.assertEqual(quote["global_excluded"], ["meals", "lodging"])
        self.assertIn("Bear reserve entrance fee", quote["global_pending"])
        self.assertFalse(plan["guest_facing_price_approved"])
        self.assertEqual(plan["days"][1]["guide_quote"]["amount_usd"], 270)

        reparsed = studio_store.add_guide_response(updated, response, "Neicer")
        self.assertEqual(len(json.loads(reparsed["guide_responses_json"])), 1)
        self.assertEqual(len(json.loads(reparsed["guide_quotes_json"])), 1)

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

    def test_followup_amends_existing_quote_and_preserves_full_itinerary(self):
        analysis = self.analysis()
        analysis["proposed_days"] = [
            {
                "day_number": number,
                "date": f"2026-12-{18 + number:02d}",
                "location": "Ecuador",
                "activity": "Guest request",
                "pricing_needed": ["guide"],
            }
            for number in range(1, 13)
        ]
        record = studio_store.build_record(
            {"inquiry_id": "INQ-1", "guest_id": "G-1"},
            {"message": "Request"},
            analysis,
            [],
        )
        original = """1. Arribo a Quito costo pendiente
2. Antisana $270 incluye ingresos transporte guía
3. Cayambe-Coca $250 incluye transporte guía ingresos
4. Sigsipamba costo guía transporte $190 no incluye ingreso
23 Sigsipamba $190 incluye guía transporte no incluye ingreso
24 Mindo o caminata nocturna $220 incluye transporte guía caminata nocturna
25 aves y reservas $150
26 Bellavista $240 incluido ingresos desayuno guía transporte
27 Mashpi y Cotopaxi $300 incluye transporte guía ingresos
28 Cotopaxi $160 no incluye cabalgata
29 Quito $200 incluye transporte guía ingreso
30 aeropuerto $70"""
        quoted = studio_store.add_guide_response(record, original, "Neicer")
        followup = """Buenos días, los costos son por las dos personas. El costo del 19 es $70. El 21 ese valor es hasta Ibarra. 22 y 23 ya le confirmo los ingresos o el valor dentro de la reserva. 24 los $220 incluye caminata nocturna, la cena no incluye. 25 incluye lek del gallo de la peña, guía, ingresos, transporte, tour de las mariposas y tour del chocolate. 27 los $300 es por transporte, guía, ingresos a Mashpi Amagusa y traslado a Cotopaxi. 28 los $160 es solo por guía, transporte e ingreso al Parque Nacional Cotopaxi; la cabalgata por confirmar. Hospedaje y alimentación aparte."""
        updated = studio_store.add_guide_response(quoted, followup, "Neicer")
        quote = json.loads(updated["guide_quotes_json"])[-1]
        self.assertEqual(len(quote["items"]), 12)
        self.assertEqual(quote["known_supplier_subtotal_usd"], 2310)
        self.assertEqual(quote["pricing_basis"], "total_for_party")
        self.assertEqual(quote["party_size"], 2)
        self.assertEqual(quote["items"][0]["amount_usd"], 70)
        self.assertIn("Christmas dinner", quote["items"][5]["excluded"])
        self.assertIn("butterfly tour", quote["items"][6]["included"])
        self.assertIn("entrance fees", quote["items"][9]["included"])
        self.assertIn("horse riding price", quote["items"][9]["pending"])
        self.assertNotIn("Arrival airport transfer price", quote["global_pending"])

        riding = "Juan Pablo el costo de la cabalgata es de $30 por persona por alrededor de dos horas en el Tambopaxi"
        with_riding = studio_store.add_guide_response(updated, riding, "Neicer Arias Mindo")
        quote = json.loads(with_riding["guide_quotes_json"])[-1]
        self.assertEqual(quote["known_supplier_subtotal_usd"], 2310)
        self.assertEqual(quote["optional_charges"][0]["amount_usd_per_person"], 30)
        self.assertEqual(quote["optional_charges"][0]["party_total_usd"], 60)
        self.assertEqual(quote["optional_charges"][0]["duration_minutes"], 120)
        self.assertEqual(quote["reusable_facts"][0]["reuse_status"], "verify_before_reuse")
        self.assertNotIn("Horseback riding price for Day 28", quote["global_pending"])

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

    def test_create_accepts_legacy_crm_response_without_ok_envelope(self):
        def opener(request, timeout):
            payload = json.loads(request.data)
            return io.BytesIO(json.dumps(payload["inquiry_row"]).encode())

        created = studio_store.create_crm_guest_and_inquiry(
            {"full_name": "Sjaak Klaassen", "email": "sjaak@example.com"},
            {"message": "Custom wildlife tour request"},
            self.analysis(),
            "IST-20261001190000-ABC123",
            opener,
        )
        self.assertEqual(created["inquiry_id"], "INQ-20261001190000-ABC123")


if __name__ == "__main__":
    unittest.main()
