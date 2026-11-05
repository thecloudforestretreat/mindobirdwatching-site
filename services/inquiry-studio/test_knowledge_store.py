import tempfile
import unittest
from pathlib import Path

import knowledge_store


class KnowledgeStoreTests(unittest.TestCase):
    def test_only_evidenced_supplier_facts_are_published_and_replaced(self):
        original = knowledge_store.PATH
        with tempfile.TemporaryDirectory() as directory:
            knowledge_store.PATH = Path(directory) / "knowledge.json"
            first = knowledge_store.publish([{
                "name": "Neicer", "role": "guide", "service": "Private guiding", "net_cost": 80,
                "verified_at": "2026-11-04", "valid_until": "2026-12-04", "evidence_source": "WhatsApp 2026-11-04",
            }], "INQ-1", "Juan")
            knowledge_store.publish([{
                "name": "Neicer", "role": "guide", "service": "Private guiding", "net_cost": 85,
                "verified_at": "2026-11-05", "valid_until": "2026-12-05", "evidence_source": "WhatsApp 2026-11-05",
            }], "INQ-2", "Juan")
            rows = knowledge_store.read()
            self.assertEqual(len(first), 1)
            self.assertEqual(len(rows), 1)
            self.assertEqual(rows[0]["net_cost"], 85)
            self.assertEqual(rows[0]["source_inquiry_id"], "INQ-2")
            self.assertIn("Reverify", rows[0]["reuse_rule"])
            with self.assertRaisesRegex(ValueError, "verification date"):
                knowledge_store.publish([{"name": "Hotel", "service": "Room"}], "INQ-3", "Juan")
        knowledge_store.PATH = original


if __name__ == "__main__":
    unittest.main()
