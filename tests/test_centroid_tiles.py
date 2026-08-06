import json
from pathlib import Path

import numpy as np
import pandas as pd

from minerva_analysis.server.models import centroid_tiles


def _config(csv_path, name="sample", max_level=3):
    return {
        name: {
            "featureData": [
                {
                    "src": str(csv_path),
                    "idField": "CellID",
                    "xCoordinate": "x",
                    "yCoordinate": "y",
                }
            ],
            "width": 1024,
            "height": 1024,
            "tileWidth": 256,
            "tileHeight": 256,
            "maxLevel": max_level,
        }
    }


def _write_csv(path, count=32):
    xs = np.arange(count, dtype=np.float32) * 20 + 5
    ys = np.arange(count, dtype=np.float32) * 10 + 7
    df = pd.DataFrame(
        {
            "CellID": np.arange(count, dtype=np.uint32) + 100,
            "x": xs,
            "y": ys,
            "MarkerA": np.linspace(0, 10, count),
            "MarkerB": np.linspace(10, 0, count),
        }
    )
    df.to_csv(path, index=False)
    return df


def test_centroid_manifest_created_from_external_csv(tmp_path, monkeypatch):
    monkeypatch.setattr(centroid_tiles, "data_path", tmp_path / "data")
    csv_path = tmp_path / "external.csv"
    _write_csv(csv_path)

    manifest = centroid_tiles.get_manifest(_config(csv_path), "sample", build=True)

    assert manifest["status"] == "ready"
    assert manifest["csv_path"] == str(csv_path.resolve())
    assert manifest["point_count"] == 32
    assert (tmp_path / "data" / "sample" / "centroids_v1" / "manifest.json").exists()


def test_centroid_manifest_rebuilds_when_csv_changes(tmp_path, monkeypatch):
    monkeypatch.setattr(centroid_tiles, "data_path", tmp_path / "data")
    csv_path = tmp_path / "cells.csv"
    _write_csv(csv_path, count=8)
    config = _config(csv_path)

    first = centroid_tiles.get_manifest(config, "sample", build=True)
    _write_csv(csv_path, count=12)
    second = centroid_tiles.get_manifest(config, "sample", build=True)

    assert first["point_count"] == 8
    assert second["point_count"] == 12
    assert second["csv_size"] != first["csv_size"]


def test_centroid_tile_query_returns_requested_tile_points(tmp_path, monkeypatch):
    monkeypatch.setattr(centroid_tiles, "data_path", tmp_path / "data")
    csv_path = tmp_path / "cells.csv"
    df = _write_csv(csv_path, count=16)
    config = _config(csv_path)
    centroid_tiles.get_manifest(config, "sample", build=True)

    records = centroid_tiles.get_tiles(config, "sample", 0, [{"x": 0, "y": 0}])

    assert records.dtype == centroid_tiles.RESPONSE_DTYPE
    expected = df[(df["x"] < 256) & (df["y"] < 256)]["CellID"].astype(np.uint32).to_numpy()
    np.testing.assert_array_equal(records["id"], expected)


def test_centroid_tile_query_applies_gates_vectorized(tmp_path, monkeypatch):
    monkeypatch.setattr(centroid_tiles, "data_path", tmp_path / "data")
    csv_path = tmp_path / "cells.csv"
    df = _write_csv(csv_path, count=24)
    config = _config(csv_path)
    centroid_tiles.get_manifest(config, "sample", build=True)

    records = centroid_tiles.get_tiles(
        config,
        "sample",
        0,
        [{"x": 0, "y": 0}, {"x": 1, "y": 0}],
        {"MarkerA": [3.0, 7.0], "MarkerB": [2.0, 8.0]},
    )

    expected = df[
        (df["x"] < 512)
        & (df["y"] < 256)
        & (df["MarkerA"] > 3.0)
        & (df["MarkerA"] < 7.0)
        & (df["MarkerB"] > 2.0)
        & (df["MarkerB"] < 8.0)
    ]["CellID"].astype(np.uint32).to_numpy()
    np.testing.assert_array_equal(records["id"], expected)


def test_low_zoom_tile_query_respects_max_points(tmp_path, monkeypatch):
    monkeypatch.setattr(centroid_tiles, "data_path", tmp_path / "data")
    csv_path = tmp_path / "cells.csv"
    _write_csv(csv_path, count=200)
    config = _config(csv_path)
    centroid_tiles.get_manifest(config, "sample", build=True)

    records = centroid_tiles.get_tiles(config, "sample", 1, [{"x": 0, "y": 0}], max_points=20)

    assert len(records) <= 20
