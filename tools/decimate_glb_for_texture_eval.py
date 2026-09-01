"""Create a review-only triangle-bounded GLB for texture-model experiments.

The source GLB is never modified.  The script preserves materials/UVs where
Blender's collapse decimator can do so, and emits a compact manifest.
"""

import argparse
import json
import sys
from pathlib import Path

import bpy


def mesh_triangles(obj):
    return sum(len(poly.vertices) - 2 for poly in obj.data.polygons)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--target-triangles", type=int, default=80000)
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    args = parser.parse_args(argv)

    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(args.input))
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    before = sum(mesh_triangles(obj) for obj in meshes)
    if not meshes or before <= 0:
        raise RuntimeError("No triangulable mesh geometry imported")

    ratio = min(1.0, args.target_triangles / before)
    for obj in meshes:
        bpy.context.view_layer.objects.active = obj
        obj.select_set(True)
        modifier = obj.modifiers.new("texture_eval_decimate", "DECIMATE")
        modifier.decimate_type = "COLLAPSE"
        modifier.ratio = ratio
        modifier.use_collapse_triangulate = True
        bpy.ops.object.modifier_apply(modifier=modifier.name)
        obj.select_set(False)

    after = sum(mesh_triangles(obj) for obj in meshes)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.export_scene.gltf(
        filepath=str(args.output),
        export_format="GLB",
        export_materials="EXPORT",
        export_texcoords=True,
        export_normals=True,
        export_tangents=True,
    )
    manifest = {
        "input": str(args.input),
        "target_triangles": args.target_triangles,
        "triangles_before": before,
        "triangles_after": after,
        "ratio_requested": ratio,
        "mesh_objects": len(meshes),
        "purpose": "Hunyuan Paint five-reference texture evaluation only; not the production mesh",
    }
    args.output.with_suffix(".decimation.json").write_text(json.dumps(manifest, indent=2) + "\n")


if __name__ == "__main__":
    main()
