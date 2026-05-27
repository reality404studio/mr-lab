from __future__ import annotations

import math
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[2]
GLB_PATH = ROOT / "exports" / "fish_small.glb"
PREVIEW_DIR = ROOT / "exports" / "previews" / "fish_small"
CONTACT_SHEET = PREVIEW_DIR / "fish_small_contact_sheet.png"

NODE_NAME = "fishS_body"
RESOLUTION_X = 1200
RESOLUTION_Y = 800


def reset_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()
    for datablocks in (
        bpy.data.meshes,
        bpy.data.materials,
        bpy.data.images,
        bpy.data.actions,
        bpy.data.armatures,
        bpy.data.cameras,
        bpy.data.lights,
    ):
        for block in list(datablocks):
            datablocks.remove(block)


def import_model():
    if not GLB_PATH.exists():
        raise FileNotFoundError(f"Missing GLB: {GLB_PATH}")
    bpy.ops.import_scene.gltf(filepath=str(GLB_PATH))
    obj = bpy.data.objects.get(NODE_NAME)
    if obj is None:
        raise RuntimeError(f"Missing node after import: {NODE_NAME}")
    return obj


def mesh_bounds(objects):
    corners = []
    for obj in objects:
        if obj.type != "MESH":
            continue
        corners.extend(obj.matrix_world @ Vector(corner) for corner in obj.bound_box)
    if not corners:
        raise RuntimeError("No mesh bounds found")
    min_v = Vector((min(v.x for v in corners), min(v.y for v in corners), min(v.z for v in corners)))
    max_v = Vector((max(v.x for v in corners), max(v.y for v in corners), max(v.z for v in corners)))
    return min_v, max_v, (min_v + max_v) * 0.5, max_v - min_v


def set_render_engine() -> None:
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = RESOLUTION_X
    scene.render.resolution_y = RESOLUTION_Y
    scene.render.film_transparent = False
    scene.view_settings.view_transform = "Standard"
    try:
        scene.view_settings.look = "None"
    except TypeError:
        pass
    scene.view_settings.exposure = -0.35
    scene.view_settings.gamma = 1.0
    scene.world = scene.world or bpy.data.worlds.new("World")
    scene.world.color = (0.18, 0.18, 0.18)


def add_lighting(center: Vector, size: Vector) -> None:
    lights = [
        ((math.radians(55), 0.0, math.radians(35)), 1.0),
        ((math.radians(115), 0.0, math.radians(-120)), 0.28),
    ]
    for i, (rotation, energy) in enumerate(lights):
        bpy.ops.object.light_add(type="SUN", location=center)
        light = bpy.context.object
        light.name = f"preview_sun_{i + 1}"
        light.data.energy = energy
        light.rotation_euler = rotation


def look_at(camera, target: Vector, up_axis: str = "Y") -> None:
    direction = target - camera.location
    camera.rotation_euler = direction.to_track_quat("-Z", up_axis).to_euler()


def create_camera(center: Vector):
    bpy.ops.object.camera_add(location=(0.0, 0.0, 0.0))
    camera = bpy.context.object
    camera.name = "preview_camera"
    camera.data.type = "ORTHO"
    bpy.context.scene.camera = camera
    return camera


def ortho_scale_for_view(size: Vector, horizontal: float, vertical: float, margin: float = 2.05) -> float:
    aspect = RESOLUTION_X / RESOLUTION_Y
    return max(vertical, horizontal / aspect) * margin


def render_view(
    name: str,
    camera,
    center: Vector,
    size: Vector,
    direction,
    up_axis: str,
    horizontal: float,
    vertical: float,
    roll_degrees: float = 0.0,
):
    direction = Vector(direction).normalized()
    distance = max(size.x, size.y, size.z) * 10.0 + 0.35
    camera.location = center + direction * distance
    look_at(camera, center, up_axis)
    if roll_degrees:
        camera.rotation_euler.rotate_axis("Z", math.radians(roll_degrees))
    camera.data.ortho_scale = ortho_scale_for_view(size, horizontal, vertical)
    out_path = PREVIEW_DIR / f"{name}.png"
    bpy.context.scene.render.filepath = str(out_path)
    bpy.ops.render.render(write_still=True)
    return out_path


def make_contact_sheet(paths: list[Path], out_path: Path, columns: int = 2) -> None:
    images = [bpy.data.images.load(str(path)) for path in paths]
    tile_w = images[0].size[0]
    tile_h = images[0].size[1]
    rows = math.ceil(len(images) / columns)
    sheet_w = tile_w * columns
    sheet_h = tile_h * rows
    sheet_pixels = [0.18, 0.18, 0.18, 1.0] * (sheet_w * sheet_h)

    for index, image in enumerate(images):
        col = index % columns
        row = index // columns
        target_y0 = (rows - 1 - row) * tile_h
        source_pixels = list(image.pixels)
        for y in range(tile_h):
            for x in range(tile_w):
                src = (y * tile_w + x) * 4
                dst_x = col * tile_w + x
                dst_y = target_y0 + y
                dst = (dst_y * sheet_w + dst_x) * 4
                sheet_pixels[dst:dst + 4] = source_pixels[src:src + 4]

    sheet = bpy.data.images.new("fish_small_contact_sheet", sheet_w, sheet_h, alpha=True)
    sheet.pixels.foreach_set(sheet_pixels)
    sheet.filepath_raw = str(out_path)
    sheet.file_format = "PNG"
    sheet.save()


def main() -> None:
    PREVIEW_DIR.mkdir(parents=True, exist_ok=True)
    reset_scene()
    obj = import_model()
    mesh_objects = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    min_v, max_v, center, size = mesh_bounds(mesh_objects)
    set_render_engine()
    add_lighting(center, size)
    camera = create_camera(center)

    renders = [
        render_view("side_plus_x", camera, center, size, (1, 0, 0), "Y", size.z, size.y, 90.0),
        render_view("side_minus_x", camera, center, size, (-1, 0, 0), "Y", size.z, size.y, -90.0),
        render_view("front_plus_z", camera, center, size, (0, 0, 1), "Y", size.x, size.y),
        render_view("top_plus_y", camera, center, size, (0, 1, 0), "Z", size.x, size.z),
        render_view("three_quarter", camera, center, size, (1, -0.65, 1.25), "Y", max(size.x, size.z), size.y + size.z * 0.25),
    ]
    make_contact_sheet(renders, CONTACT_SHEET)

    print("Rendered fish_small preview")
    print(f"  source: {GLB_PATH}")
    print(f"  node: {obj.name}")
    print(f"  bounds min: {tuple(round(v, 5) for v in min_v)}")
    print(f"  bounds max: {tuple(round(v, 5) for v in max_v)}")
    for path in renders:
        print(f"  view: {path}")
    print(f"  contact_sheet: {CONTACT_SHEET}")


if __name__ == "__main__":
    main()
