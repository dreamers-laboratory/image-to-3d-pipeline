import math
import os
import sys

import bpy
from mathutils import Vector


def look_at(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()


def main():
    argv = sys.argv[sys.argv.index("--") + 1 :]
    source, output_dir = argv[0], argv[1]
    os.makedirs(output_dir, exist_ok=True)

    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=source)
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    if not meshes:
        raise RuntimeError(f"No mesh in {source}")

    mins = Vector((float("inf"),) * 3)
    maxs = Vector((float("-inf"),) * 3)
    for obj in meshes:
        for corner in obj.bound_box:
            p = obj.matrix_world @ Vector(corner)
            mins = Vector(min(a, b) for a, b in zip(mins, p))
            maxs = Vector(max(a, b) for a, b in zip(maxs, p))
    center = (mins + maxs) * 0.5
    size = max(maxs - mins)
    scale = 4.8 / size
    for obj in meshes:
        obj.scale *= scale
        obj.location = (obj.location - center) * scale

    world = bpy.context.scene.world or bpy.data.worlds.new("World")
    bpy.context.scene.world = world
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.018, 0.07, 0.085, 1)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.35

    for name, energy, position, color, size_lamp in (
        ("Key", 1100, (4, -5, 6), (0.68, 0.92, 1.0), 4.0),
        ("Rim", 850, (-5, 2, 3), (0.2, 0.65, 0.8), 3.0),
        ("Fill", 500, (0, 5, 1), (1.0, 0.82, 0.58), 5.0),
    ):
        data = bpy.data.lights.new(name, "AREA")
        data.energy = energy
        data.color = color
        data.shape = "DISK"
        data.size = size_lamp
        obj = bpy.data.objects.new(name, data)
        obj.location = position
        look_at(obj, (0, 0, 0))
        bpy.context.collection.objects.link(obj)

    camera_data = bpy.data.cameras.new("Camera")
    camera = bpy.data.objects.new("Camera", camera_data)
    bpy.context.collection.objects.link(camera)
    bpy.context.scene.camera = camera
    camera_data.lens = 58

    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE_NEXT"
    scene.render.resolution_x = 900
    scene.render.resolution_y = 700
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False
    scene.view_settings.look = "AgX - Medium High Contrast"

    for index, degrees in enumerate((0, 90, 180, 270)):
        angle = math.radians(degrees)
        camera.location = (7.0 * math.sin(angle), -7.0 * math.cos(angle), 2.7)
        look_at(camera, (0, 0, 0))
        scene.render.filepath = os.path.join(output_dir, f"view-{index + 1}-{degrees:03d}.png")
        bpy.ops.render.render(write_still=True)


if __name__ == "__main__":
    main()
