"""Render a deterministic textured/clay inspection orbit for a GLB.

Run via Blender, not normal Python:
  Blender --background --python render_reconstruction_eval.py -- --input mesh.glb --output out
"""

import argparse
import json
import math
import os
import sys

import bpy
from mathutils import Vector


VIEWS = (
    ("az000_el10", 0, 10),
    ("az045_el10", 45, 10),
    ("az090_el10", 90, 10),
    ("az135_el10", 135, 10),
    ("az180_el10", 180, 10),
    ("az225_el10", 225, 10),
    ("az270_el10", 270, 10),
    ("az315_el10", 315, 10),
    ("az045_el35", 45, 35),
    ("az225_elm15", 225, -15),
)


def parse_args():
    argv = sys.argv[sys.argv.index("--") + 1 :]
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--resolution", type=int, default=768)
    return parser.parse_args(argv)


def look_at(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()


def world_bounds(meshes):
    low = Vector((float("inf"),) * 3)
    high = Vector((float("-inf"),) * 3)
    for obj in meshes:
        for corner in obj.bound_box:
            point = obj.matrix_world @ Vector(corner)
            low = Vector(min(a, b) for a, b in zip(low, point))
            high = Vector(max(a, b) for a, b in zip(high, point))
    return low, high


def add_area_light(name, energy, position, color, size):
    data = bpy.data.lights.new(name, "AREA")
    data.energy = energy
    data.color = color
    data.shape = "DISK"
    data.size = size
    obj = bpy.data.objects.new(name, data)
    obj.location = position
    look_at(obj, (0, 0, 0))
    bpy.context.collection.objects.link(obj)


def add_camera():
    data = bpy.data.cameras.new("Inspection Camera")
    data.lens = 55
    camera = bpy.data.objects.new("Inspection Camera", data)
    bpy.context.collection.objects.link(camera)
    bpy.context.scene.camera = camera
    return camera


def camera_position(azimuth, elevation, radius):
    az = math.radians(azimuth)
    el = math.radians(elevation)
    horizontal = radius * math.cos(el)
    return Vector((horizontal * math.sin(az), -horizontal * math.cos(az), radius * math.sin(el)))


def main():
    args = parse_args()
    textured_dir = os.path.join(args.output, "textured")
    clay_dir = os.path.join(args.output, "clay")
    os.makedirs(textured_dir, exist_ok=True)
    os.makedirs(clay_dir, exist_ok=True)

    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=args.input)
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    if not meshes:
        raise RuntimeError(f"No mesh objects imported from {args.input}")

    low, high = world_bounds(meshes)
    center = (low + high) * 0.5
    longest_axis = max(high - low)
    if longest_axis <= 0:
        raise RuntimeError("Imported mesh has a zero bounding extent")
    scale = 4.8 / longest_axis
    for obj in meshes:
        obj.location = (obj.location - center) * scale
        obj.scale *= scale

    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE_NEXT"
    scene.render.resolution_x = args.resolution
    scene.render.resolution_y = args.resolution
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.resolution_percentage = 100
    scene.render.image_settings.color_depth = "8"
    scene.view_settings.look = "AgX - Medium High Contrast"

    world = bpy.data.worlds.new("Inspection World")
    scene.world = world
    world.use_nodes = True
    background = world.node_tree.nodes.get("Background")
    background.inputs["Color"].default_value = (0.025, 0.03, 0.04, 1)
    background.inputs["Strength"].default_value = 0.28
    add_area_light("Key", 1150, (5, -6, 7), (0.88, 0.95, 1.0), 4.5)
    add_area_light("Fill", 700, (-5, -2, 3), (0.55, 0.75, 1.0), 4.0)
    add_area_light("Rim", 800, (-3, 5, 5), (1.0, 0.72, 0.48), 3.0)

    clay = bpy.data.materials.new("Evaluation clay")
    clay.diffuse_color = (0.43, 0.52, 0.58, 1)
    clay.use_nodes = True
    principled = clay.node_tree.nodes.get("Principled BSDF")
    principled.inputs["Base Color"].default_value = (0.26, 0.39, 0.47, 1)
    principled.inputs["Roughness"].default_value = 0.58
    camera = add_camera()
    radius = 8.0

    manifest = {
        "input": os.path.abspath(args.input),
        "renderer": "Blender 4.3 EEVEE",
        "resolution": args.resolution,
        "views": [],
        "controls": {
            "lighting": "fixed three-area-light rig",
            "background": "fixed dark neutral world",
            "normalization": "largest mesh bound scaled to 4.8 units",
        },
    }
    original_materials = [(obj, [slot.material for slot in obj.material_slots]) for obj in meshes]
    for label, azimuth, elevation in VIEWS:
        camera.location = camera_position(azimuth, elevation, radius)
        look_at(camera, (0, 0, 0))
        scene.render.filepath = os.path.join(textured_dir, f"{label}.png")
        bpy.ops.render.render(write_still=True)
        for obj, materials in original_materials:
            for slot in obj.material_slots:
                slot.material = clay
        scene.render.filepath = os.path.join(clay_dir, f"{label}.png")
        bpy.ops.render.render(write_still=True)
        for obj, materials in original_materials:
            for slot, material in zip(obj.material_slots, materials):
                slot.material = material
        manifest["views"].append({"label": label, "azimuth_degrees": azimuth, "elevation_degrees": elevation})

    with open(os.path.join(args.output, "render-manifest.json"), "w", encoding="utf-8") as handle:
        json.dump(manifest, handle, indent=2)


if __name__ == "__main__":
    main()
