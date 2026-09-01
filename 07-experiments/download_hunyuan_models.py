"""Download only the Hunyuan pilot model subfolders and record exact byte totals."""

import argparse
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

from huggingface_hub import snapshot_download


MODELS = (
    ("tencent/Hunyuan3D-2mv", "hunyuan3d-dit-v2-mv-turbo", "multi_view_shape_turbo"),
    ("tencent/Hunyuan3D-2", "hunyuan3d-paint-v2-0-turbo", "multi_view_texture_turbo"),
    # Paint calls the Delight preprocessor internally; it is a required dependency, not an optional enhancement.
    ("tencent/Hunyuan3D-2", "hunyuan3d-delight-v2-0", "multi_view_texture_turbo"),
)


def file_manifest(root: Path):
    records = []
    for path in sorted(item for item in root.rglob("*") if item.is_file()):
        digest = hashlib.sha256()
        with path.open("rb") as handle:
            for chunk in iter(lambda: handle.read(1024 * 1024), b""):
                digest.update(chunk)
        records.append(
            {
                "path": str(path.relative_to(root)),
                "bytes": path.stat().st_size,
                "sha256": digest.hexdigest(),
            }
        )
    return records


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, required=True)
    args = parser.parse_args()
    model_root = args.root / "models"
    model_root.mkdir(parents=True, exist_ok=True)
    downloads = []
    grouped = {}
    for repo_id, subfolder, label in MODELS:
        grouped.setdefault((repo_id, label), []).append(subfolder)
    for (repo_id, label), subfolders in grouped.items():
        destination = model_root / label
        snapshot_download(
            repo_id=repo_id,
            allow_patterns=[pattern for subfolder in subfolders for pattern in (f"{subfolder}/*", f"{subfolder}/**")],
            local_dir=destination,
        )
        files = file_manifest(destination)
        downloads.append(
            {
                "label": label,
                "repo_id": repo_id,
                "subfolders": subfolders,
                "destination": str(destination),
                "total_bytes": sum(record["bytes"] for record in files),
                "files": files,
            }
        )
    record = {
        "created_at_utc": datetime.now(timezone.utc).isoformat(),
        "downloads": downloads,
        "total_bytes": sum(item["total_bytes"] for item in downloads),
    }
    with (args.root / "model-download-manifest.json").open("w", encoding="utf-8") as handle:
        json.dump(record, handle, indent=2)


if __name__ == "__main__":
    main()
