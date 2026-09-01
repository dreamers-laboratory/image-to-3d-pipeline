"""Create a separately labelled, Paint-friendly reduced mesh from a raw Hunyuan output."""

import argparse
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

import trimesh

from hy3dgen.shapegen import FaceReducer


def sha256(path: Path):
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--target-faces", type=int, default=40000)
    args = parser.parse_args()
    mesh = trimesh.load(args.input, force="mesh")
    input_faces = int(len(mesh.faces))
    reduced = FaceReducer()(mesh, max_facenum=args.target_faces)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    reduced.export(args.output)
    with args.output.with_suffix(".reduction.json").open("w", encoding="utf-8") as handle:
        json.dump(
            {
                "created_at_utc": datetime.now(timezone.utc).isoformat(),
                "source_mesh": str(args.input),
                "source_mesh_sha256": sha256(args.input),
                "input_faces": input_faces,
                "target_faces": args.target_faces,
                "output_faces": int(len(reduced.faces)),
            },
            handle,
            indent=2,
        )


if __name__ == "__main__":
    main()
