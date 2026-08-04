"""Baseline smoke checks for the local orion2 Minerva datasource.

Run directly:
    python -m tests.baseline_orion2

Or with pytest:
    pytest tests/baseline_orion2.py
"""

from __future__ import annotations

import json
import os
import unittest
from pathlib import Path


DATASOURCE = os.environ.get("MINERVA_BASELINE_DATASOURCE", "orion2")


def _load_app_context():
    from minerva_analysis import app, get_config

    return app, get_config()


def _required_paths(config, datasource):
    ds_config = config[datasource]
    feature_path = Path(ds_config["featureData"][0]["src"])
    return {
        "feature CSV": feature_path,
        "segmentation": Path(ds_config["segmentation"]),
        "channel image": Path(ds_config["channelFile"]),
    }


def _skip_reason():
    try:
        _, config = _load_app_context()
    except Exception as exc:
        return f"Minerva app could not be imported: {exc}"

    if DATASOURCE not in config:
        return f"Datasource {DATASOURCE!r} is not present in config.json"

    missing = [
        f"{label}: {path}"
        for label, path in _required_paths(config, DATASOURCE).items()
        if not path.exists()
    ]
    if missing:
        return "Missing local orion2 inputs: " + "; ".join(missing)
    return None


def _json_response(response):
    assert response.status_code == 200, response.data[:500]
    return json.loads(response.data.decode("utf-8"))


@unittest.skipIf(_skip_reason() is not None, _skip_reason() or "")
class Orion2BaselineTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app, cls.config = _load_app_context()
        cls.client = cls.app.test_client()
        cls.ds_config = cls.config[DATASOURCE]

    def test_config_and_viewer_page_render(self):
        config = _json_response(self.client.get("/config"))
        self.assertIn(DATASOURCE, config)

        response = self.client.get(f"/{DATASOURCE}")
        self.assertEqual(response.status_code, 200)
        self.assertIn(b"openseadragon", response.data)
        self.assertIn(DATASOURCE.encode("utf-8"), response.data)

    def test_metadata_route_returns_valid_json(self):
        response = self.client.get(
            "/get_ome_metadata",
            query_string={"datasource": DATASOURCE},
        )
        metadata = _json_response(response)
        self.assertIsInstance(metadata, dict)

    def test_datasource_channel_metadata(self):
        response = self.client.get(
            "/get_channel_names",
            query_string={"datasource": DATASOURCE, "shortNames": "true"},
        )
        channels = _json_response(response)
        self.assertIn("DNA", channels)
        self.assertIn("CD3e", channels)

    def test_image_and_segmentation_tiles_render_pngs(self):
        image_response = self.client.get("/generated/data/orion2/image_12/0/2_2.png")
        self.assertEqual(image_response.status_code, 200)
        self.assertEqual(image_response.mimetype.lower(), "image/png")
        self.assertGreater(len(image_response.data), 100)
        self.assertEqual(image_response.data[:8], b"\x89PNG\r\n\x1a\n")

        label_name = self.ds_config["imageData"][0]["src"].strip("/").split("/")[-1]
        segmentation_response = self.client.get(
            f"/generated/data/{DATASOURCE}/{label_name}/0/2_2.png"
        )
        self.assertEqual(segmentation_response.status_code, 200)
        self.assertEqual(segmentation_response.mimetype.lower(), "image/png")
        self.assertGreater(len(segmentation_response.data), 100)
        self.assertEqual(segmentation_response.data[:8], b"\x89PNG\r\n\x1a\n")


if __name__ == "__main__":
    unittest.main(verbosity=2)
