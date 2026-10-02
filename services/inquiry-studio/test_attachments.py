import base64
import unittest
from unittest.mock import patch

import attachments


class AttachmentTests(unittest.TestCase):
    def item(self):
        return {
            "name": "itinerary.png",
            "type": "image/png",
            "data": base64.b64encode(b"not-a-real-image").decode(),
        }

    def test_image_ocr_avoids_vision_payload(self):
        with patch.object(
            attachments,
            "_extract",
            return_value={"text": "Day 1 Quito birding " * 12, "images": []},
        ):
            result = attachments.prepare_attachments([self.item()])
        self.assertEqual(result["images"], [])
        self.assertEqual(result["manifest"][0]["extraction"], "image_ocr")
        self.assertIn("Day 1 Quito", result["text"])

    def test_short_image_ocr_uses_vision_fallback(self):
        with patch.object(attachments, "_extract", return_value={"text": "Day 1", "images": []}):
            result = attachments.prepare_attachments([self.item()])
        self.assertEqual(len(result["images"]), 1)
        self.assertEqual(result["manifest"][0]["extraction"], "vision_fallback")


if __name__ == "__main__":
    unittest.main()
