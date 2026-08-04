import json
import re
import shutil
from pathlib import Path

import pandas as pd


def _default_marker_columns(columns, x, y, id_column, celltype_column):
    excluded = {
        x,
        y,
        id_column,
        celltype_column,
        "id",
        "Area",
        "CellID",
        "ID",
        "X Position",
        "Y Position",
        "X_centroid",
        "Y_centroid",
        "column_centroid",
        "row_centroid",
        "phenotype",
    }
    return [column for column in columns if column and column not in excluded]


def _copy_if_requested(path, target_dir, copy):
    path = Path(path).expanduser().resolve()
    if not copy:
        return path
    target = target_dir / path.name
    if path != target:
        shutil.copy2(path, target)
    return target


def _segmentation_channel_name(segmentation_path):
    name = Path(segmentation_path).name
    lowered = name.lower()
    for suffix in (".ome.tiff", ".ome.tif", ".tiff", ".tif", ".png", ".zarr"):
        if lowered.endswith(suffix):
            channel_name = name[: -len(suffix)]
            break
    else:
        channel_name = Path(name).stem
    if re.match(r".*_(\d*)$", channel_name):
        channel_name = f"{channel_name}_segmentation"
    return channel_name


def register_datasource(
    name,
    image,
    segmentation,
    features,
    x,
    y,
    id_column="CellID",
    celltype_column=None,
    channel_names=None,
    copy=False,
    data_dir=None,
):
    """Register a dataset in Minerva's config without using the upload UI."""
    from minerva_analysis import config_json_path, data_path
    from minerva_analysis.server.models import data_model

    data_root = Path(data_dir).expanduser().resolve() if data_dir else data_path
    dataset_dir = data_root / name
    dataset_dir.mkdir(parents=True, exist_ok=True)
    config_path = data_root / "config.json"
    if not config_path.exists():
        config_path.write_text("{}", encoding="utf-8")

    image_path = _copy_if_requested(image, dataset_dir, copy)
    segmentation_path = _copy_if_requested(segmentation, dataset_dir, copy)
    features_path = _copy_if_requested(features, dataset_dir, copy)

    feature_table = pd.read_csv(features_path, nrows=1)
    missing = [column for column in [x, y, id_column] if column not in feature_table.columns]
    if missing:
        raise ValueError("Missing required feature columns: " + ", ".join(missing))
    if celltype_column and celltype_column not in feature_table.columns:
        raise ValueError(f"Missing celltype column: {celltype_column}")

    channel_info = data_model.convertOmeTiff(image_path, isLabelImg=False)
    label_info = data_model.convertOmeTiff(
        segmentation_path,
        channelFilePath=image_path,
        dataDirectory=str(dataset_dir),
        isLabelImg=True,
    )

    n_channels = channel_info["num_channels"]
    if channel_names is None:
        marker_columns = _default_marker_columns(feature_table.columns, x, y, id_column, celltype_column)
        channel_names = marker_columns[:n_channels]
    if len(channel_names) < n_channels:
        stem = image_path.name
        channel_names = list(channel_names) + [f"{stem}_{i}" for i in range(len(channel_names), n_channels)]

    with config_path.open("r", encoding="utf-8") as handle:
        config = json.load(handle)

    feature_data = {
        "src": str(features_path),
        "normalization": "none",
        "isTransformed": False,
        "xCoordinate": x,
        "yCoordinate": y,
        "idField": id_column,
    }
    if celltype_column:
        feature_data["celltype"] = celltype_column

    label_name = _segmentation_channel_name(segmentation_path)
    image_data = [
        {
            "name": "Area",
            "fullname": "Area",
            "src": f"/generated/data/{name}/{label_name}/",
        }
    ]
    generated_channel_names = channel_info["channel_names"]
    for idx in range(n_channels):
        display_name = str(channel_names[idx])
        image_data.append(
            {
                "name": display_name,
                "fullname": display_name,
                "src": f"/generated/data/{name}/{generated_channel_names[idx]}/",
            }
        )

    config[name] = {
        "shapes": "",
        "activeChannel": "",
        "featureData": [feature_data],
        "imageData": image_data,
        "height": channel_info["height"],
        "width": channel_info["width"],
        "maxLevel": channel_info["maxLevel"],
        "num_channels": channel_info["num_channels"],
        "tileHeight": channel_info["tileHeight"],
        "tileWidth": channel_info["tileWidth"],
        "segmentation": label_info["segmentation"],
        "channelFile": str(image_path),
    }

    with config_path.open("w", encoding="utf-8") as handle:
        json.dump(config, handle, indent=4)

    return config[name]
