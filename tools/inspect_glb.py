"""Emit mesh-health facts from a GLB without making quality claims."""

import argparse
import json
import os

import numpy as np
import trimesh


def as_number(value):
    if isinstance(value, np.generic):
        return value.item()
    return value


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    loaded = trimesh.load(args.input, force="scene")
    geometries = list(loaded.geometry.items())
    if not geometries:
        raise RuntimeError(f"No geometry in {args.input}")

    records = []
    total_faces = 0
    total_vertices = 0
    raster_textured_geometries = 0
    vertex_colored_geometries = 0
    largest_component_faces = 0
    small_components = 0
    for name, mesh in geometries:
        faces = int(len(mesh.faces))
        vertices = int(len(mesh.vertices))
        total_faces += faces
        total_vertices += vertices
        components = mesh.split(only_watertight=False)
        component_faces = [int(len(component.faces)) for component in components]
        largest_component_faces = max(largest_component_faces, max(component_faces, default=0))
        small_components += sum(1 for face_count in component_faces if face_count < max(25, faces * 0.002))
        material = getattr(mesh.visual, "material", None)
        image = getattr(material, "image", None)
        has_image = image is not None
        raster_textured_geometries += int(has_image)
        vertex_colors = getattr(mesh.visual, "vertex_colors", None)
        has_vertex_colors = vertex_colors is not None and len(vertex_colors) == vertices
        vertex_colored_geometries += int(has_vertex_colors)
        records.append(
            {
                "name": name,
                "vertices": vertices,
                "faces": faces,
                "watertight": bool(mesh.is_watertight),
                "euler_number": int(mesh.euler_number),
                "connected_components": len(components),
                "component_face_counts": component_faces,
                "has_raster_texture": has_image,
                "has_vertex_colors": has_vertex_colors,
                "bounds": [[float(x) for x in row] for row in mesh.bounds],
            }
        )

    report = {
        "input": os.path.abspath(args.input),
        "geometry_count": len(records),
        "total_vertices": total_vertices,
        "total_faces": total_faces,
        "largest_component_face_fraction": largest_component_faces / total_faces if total_faces else 0,
        "small_component_count": small_components,
        "raster_textured_geometry_count": raster_textured_geometries,
        "vertex_colored_geometry_count": vertex_colored_geometries,
        "geometry": records,
        "interpretation_limits": [
            "These are structural facts, not a fidelity score.",
            "A watertight mesh is not necessarily visually correct; an open mesh is not necessarily unusable.",
            "Raster-texture or vertex-color presence does not establish texture fidelity or continuity.",
        ],
    }
    with open(args.output, "w", encoding="utf-8") as handle:
        json.dump(report, handle, indent=2, default=as_number)


if __name__ == "__main__":
    main()
