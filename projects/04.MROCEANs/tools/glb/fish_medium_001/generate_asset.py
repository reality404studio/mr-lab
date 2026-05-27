from __future__ import annotations

import json
import math
import struct
from pathlib import Path

import bpy
from mathutils import Matrix, Vector


ROOT = Path(__file__).resolve().parents[3]
OUT_DIR = ROOT / "exports" / "fish_medium_001"
RENDER_DIR = OUT_DIR / "renders"
OUT_GLB = OUT_DIR / "fish_medium_001.glb"
QA_REPORT = OUT_DIR / "qa_report.json"

ASSET_ID = "fish_medium_001"
ASSET_NAME = "FishMedium Reef Lowpoly"
NODE_NAME = "fishM_body"

LENGTH = 0.18
HEIGHT = 0.075
WIDTH = 0.045
TRIANGLE_MIN = 300
TRIANGLE_IDEAL = 800
TRIANGLE_MAX = 2000

# FishMedium coordinate convention for this asset:
#   head/front: +X, tail/rear: -X, top/dorsal: +Z, visible side: -Y.
X_MIN = -LENGTH * 0.5
X_MAX = LENGTH * 0.5
Z_MIN = -HEIGHT * 0.5
Z_MAX = HEIGHT * 0.5
Y_HALF = WIDTH * 0.49

TAIL_ROOT_X = -0.036
BODY_X_MAX = X_MAX

SURFACE_OFFSET = 0.00010
PATCH_OFFSET = 0.00022
EYE_OFFSET = 0.00045

RENDER_W = 1200
RENDER_H = 800


PALETTE = {
    "main_body": "#F28C52",
    "belly": "#F5E8CC",
    "fins_tail": "#F6C24A",
    "eye_band": "#233A63",
    "rear_accents": "#D95E5E",
    "eye_white": "#FFFFFF",
    "eye_black": "#050505",
}


MAT_ORDER = [
    "main_body",
    "belly",
    "fins_tail",
    "eye_band",
    "rear_accents",
    "eye_white",
    "eye_black",
]


def hex_rgba(value: str):
    value = value.lstrip("#")
    return tuple(int(value[i:i + 2], 16) / 255.0 for i in (0, 2, 4)) + (1.0,)


def ensure_dirs() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    RENDER_DIR.mkdir(parents=True, exist_ok=True)


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


def make_material(key: str, roughness: float = 0.82):
    mat = bpy.data.materials.new(f"mat_fishM_{key}")
    color = hex_rgba(PALETTE[key])
    mat.diffuse_color = color
    mat.use_nodes = True
    mat.use_backface_culling = False
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        if "Base Color" in bsdf.inputs:
            bsdf.inputs["Base Color"].default_value = color
        if "Metallic" in bsdf.inputs:
            bsdf.inputs["Metallic"].default_value = 0.0
        if "Roughness" in bsdf.inputs:
            bsdf.inputs["Roughness"].default_value = roughness
    return mat


def set_material_color(material, color_hex: str) -> None:
    color = hex_rgba(color_hex)
    material.diffuse_color = color
    if material.use_nodes:
        bsdf = material.node_tree.nodes.get("Principled BSDF")
        if bsdf and "Base Color" in bsdf.inputs:
            bsdf.inputs["Base Color"].default_value = color


class MeshBuilder:
    def __init__(self):
        self.verts = []
        self.faces = []
        self.material_indices = []

    def v(self, xyz):
        self.verts.append(tuple(xyz))
        return len(self.verts) - 1

    def tri(self, a: int, b: int, c: int, mat: int):
        self.faces.append((a, b, c))
        self.material_indices.append(mat)

    def quad(self, a: int, b: int, c: int, d: int, mat: int):
        self.tri(a, b, c, mat)
        self.tri(a, c, d, mat)

    def make_object(self, name: str, materials):
        mesh = bpy.data.meshes.new(f"{name}_mesh")
        mesh.from_pydata(self.verts, [], self.faces)
        mesh.update(calc_edges=True)
        for mat in materials:
            mesh.materials.append(mat)
        for poly, mat_index in zip(mesh.polygons, self.material_indices):
            poly.material_index = mat_index
            poly.use_smooth = False
        obj = bpy.data.objects.new(name, mesh)
        bpy.context.collection.objects.link(obj)
        bpy.context.view_layer.objects.active = obj
        obj.select_set(True)
        bpy.ops.object.mode_set(mode="EDIT")
        bpy.ops.mesh.select_all(action="SELECT")
        bpy.ops.mesh.normals_make_consistent(inside=False)
        bpy.ops.object.mode_set(mode="OBJECT")
        obj.select_set(False)
        return obj


def material_slots():
    return {key: index for index, key in enumerate(MAT_ORDER)}


def body_radius_at(x: float):
    # Lengthwise hull: small tail root, deep oval mid body, compact pointed head.
    points = [
        (TAIL_ROOT_X, 0.0055, 0.0100),
        (-0.028, 0.0145, 0.0240),
        (-0.012, 0.0208, 0.0315),
        (0.012, 0.0220, 0.0322),
        (0.036, 0.0195, 0.0285),
        (0.058, 0.0140, 0.0210),
        (0.075, 0.0070, 0.0115),
        (0.086, 0.0025, 0.0042),
    ]
    if x <= points[0][0]:
        return points[0][1], points[0][2]
    if x >= points[-1][0]:
        return points[-1][1], points[-1][2]
    for index in range(len(points) - 1):
        x0, ry0, rz0 = points[index]
        x1, ry1, rz1 = points[index + 1]
        if x0 <= x <= x1:
            t = (x - x0) / (x1 - x0)
            return ry0 + (ry1 - ry0) * t, rz0 + (rz1 - rz0) * t
    return points[-1][1], points[-1][2]


def body_top_z_at(x: float) -> float:
    _, rz = body_radius_at(x)
    return rz


def body_bottom_z_at(x: float) -> float:
    _, rz = body_radius_at(x)
    return -rz


def body_surface_y(side: float, z: float, x: float, offset: float = SURFACE_OFFSET) -> float:
    ry, rz = body_radius_at(x)
    safe_rz = max(rz, 0.0001)
    local_z = max(min(z, safe_rz * 0.985), -safe_rz * 0.985)
    ellipse_factor = math.sqrt(max(0.0, 1.0 - (local_z / safe_rz) ** 2))
    return side * (ry * ellipse_factor + offset)


def surface_point(side: float, z: float, x: float, offset: float = SURFACE_OFFSET):
    return (x, body_surface_y(side, z, x, offset), z)


def add_body_hull(builder: MeshBuilder, slots: dict[str, int]) -> None:
    segments = 12
    x_rings = [-0.036, -0.026, -0.012, 0.006, 0.024, 0.044, 0.064, 0.082]
    rings = []
    for x in x_rings:
        ry, rz = body_radius_at(x)
        ring = []
        for index in range(segments):
            angle = math.tau * index / segments
            y = math.cos(angle) * ry
            z = math.sin(angle) * rz
            ring.append(builder.v((x, y, z)))
        rings.append(ring)

    rear = builder.v((TAIL_ROOT_X - 0.0035, 0.0, 0.0))
    nose = builder.v((BODY_X_MAX, 0.0, 0.0))

    first = rings[0]
    for index in range(segments):
        nxt = (index + 1) % segments
        builder.tri(rear, first[index], first[nxt], slots["main_body"])

    for ring_index in range(len(rings) - 1):
        for index in range(segments):
            nxt = (index + 1) % segments
            a = rings[ring_index][index]
            b = rings[ring_index][nxt]
            c = rings[ring_index + 1][nxt]
            d = rings[ring_index + 1][index]
            avg_z = sum(builder.verts[i][2] for i in (a, b, c, d)) / 4.0
            mat = slots["belly"] if avg_z < -0.014 else slots["main_body"]
            builder.quad(a, b, c, d, mat)

    last = rings[-1]
    for index in range(segments):
        nxt = (index + 1) % segments
        avg_z = (builder.verts[last[index]][2] + builder.verts[last[nxt]][2]) * 0.5
        mat = slots["belly"] if avg_z < -0.006 else slots["main_body"]
        builder.tri(nose, last[nxt], last[index], mat)


def add_surface_disc(builder: MeshBuilder, side: float, z: float, x: float, radius: float, mat: int,
                     segments: int = 10, offset: float = PATCH_OFFSET, z_scale: float = 1.0):
    center = builder.v(surface_point(side, z, x, offset))
    ring = []
    for index in range(segments):
        angle = math.tau * index / segments
        px = x + math.cos(angle) * radius
        pz = z + math.sin(angle) * radius * z_scale
        ring.append(builder.v(surface_point(side, pz, px, offset)))
    for index in range(segments):
        a = ring[index]
        b = ring[(index + 1) % segments]
        if side > 0:
            builder.tri(center, b, a, mat)
        else:
            builder.tri(center, a, b, mat)


def add_surface_polygon(builder: MeshBuilder, side: float, xz_points, mat: int, offset: float):
    center_x = sum(point[0] for point in xz_points) / len(xz_points)
    center_z = sum(point[1] for point in xz_points) / len(xz_points)
    center = builder.v(surface_point(side, center_z, center_x, offset))
    verts = [builder.v(surface_point(side, z, x, offset)) for x, z in xz_points]
    for index in range(len(verts)):
        a = verts[index]
        b = verts[(index + 1) % len(verts)]
        if side > 0:
            builder.tri(center, b, a, mat)
        else:
            builder.tri(center, a, b, mat)


def add_surface_strip(builder: MeshBuilder, side: float, x_center: float, width: float,
                      z_min: float, z_max: float, slant: float, mat: int,
                      offset: float, steps: int = 5):
    left = []
    right = []
    for step in range(steps + 1):
        t = step / steps
        z = z_min + (z_max - z_min) * t
        curve = math.sin((t - 0.5) * math.pi) * 0.0015
        x = x_center + slant * (t - 0.5) + curve
        left.append(builder.v(surface_point(side, z, x - width * 0.5, offset)))
        right.append(builder.v(surface_point(side, z, x + width * 0.5, offset)))
    for step in range(steps):
        if side > 0:
            builder.quad(right[step], left[step], left[step + 1], right[step + 1], mat)
        else:
            builder.quad(left[step], right[step], right[step + 1], left[step + 1], mat)


def add_tail_fork(builder: MeshBuilder, slots: dict[str, int]) -> None:
    mat = slots["fins_tail"]
    root_top = builder.v((TAIL_ROOT_X, 0.0, 0.014))
    root_bottom = builder.v((TAIL_ROOT_X, 0.0, -0.014))
    hub = builder.v((-0.055, 0.0, 0.0))
    upper_tip = builder.v((X_MIN, 0.0, 0.035))
    lower_tip = builder.v((X_MIN, 0.0, -0.035))
    fork_notch = builder.v((-0.083, 0.0, 0.0))
    builder.tri(root_top, root_bottom, hub, mat)
    builder.tri(root_top, hub, upper_tip, mat)
    builder.tri(hub, fork_notch, upper_tip, mat)
    builder.tri(root_bottom, lower_tip, hub, mat)
    builder.tri(hub, lower_tip, fork_notch, mat)


def add_dorsal_fin(builder: MeshBuilder, slots: dict[str, int]) -> None:
    mat = slots["fins_tail"]
    base_x = [-0.028, -0.010, 0.014, 0.038, 0.060]
    base_ids = [builder.v((x, 0.0, body_top_z_at(x) - 0.0012)) for x in base_x]
    crest_points = [
        (-0.034, 0.024),
        (-0.014, Z_MAX),
        (0.018, 0.0360),
        (0.045, 0.0315),
        (0.066, 0.0225),
    ]
    crest_ids = [builder.v((x, 0.0, z)) for x, z in crest_points]
    for index in range(len(base_ids) - 1):
        builder.quad(base_ids[index], base_ids[index + 1], crest_ids[index + 1], crest_ids[index], mat)


def add_pectoral_and_pelvic_fins(builder: MeshBuilder, slots: dict[str, int]) -> None:
    mat = slots["fins_tail"]
    for side in (-1.0, 1.0):
        p0 = builder.v(surface_point(side, 0.003, 0.034, 0.00018))
        p1 = builder.v(surface_point(side, -0.026, 0.004, 0.00018))
        p2 = builder.v(surface_point(side, -0.007, 0.058, 0.00018))
        if side > 0:
            builder.tri(p0, p2, p1, mat)
        else:
            builder.tri(p0, p1, p2, mat)

    base_a = builder.v((0.000, 0.0, body_bottom_z_at(0.000) + 0.0015))
    base_b = builder.v((0.030, 0.0, body_bottom_z_at(0.030) + 0.0015))
    tip = builder.v((0.014, 0.0, Z_MIN))
    builder.tri(base_a, tip, base_b, mat)


def add_patterns_and_eyes(builder: MeshBuilder, slots: dict[str, int]) -> None:
    for side in (-1.0, 1.0):
        add_surface_polygon(
            builder,
            side,
            [(0.052, 0.032), (0.069, 0.034), (0.087, -0.006), (0.070, -0.024)],
            slots["eye_band"],
            PATCH_OFFSET,
        )

        for x_center, width, slant in [(-0.026, 0.0050, -0.003), (-0.012, 0.0046, -0.002), (0.003, 0.0042, -0.0015)]:
            add_surface_strip(
                builder,
                side,
                x_center,
                width,
                -0.020,
                0.027,
                slant,
                slots["rear_accents"],
                PATCH_OFFSET,
            )

        add_surface_disc(builder, side, 0.004, 0.071, 0.0085, slots["eye_white"], 14, EYE_OFFSET)
        add_surface_disc(builder, side, 0.004, 0.072, 0.0054, slots["eye_black"], 12, EYE_OFFSET + 0.00012)
        add_surface_disc(builder, side, 0.0085, 0.0748, 0.0013, slots["eye_white"], 8, EYE_OFFSET + 0.00024)


def create_fish_medium():
    materials = [make_material(key, 0.84 if key != "eye_black" else 0.68) for key in MAT_ORDER]
    slots = material_slots()
    builder = MeshBuilder()
    add_body_hull(builder, slots)
    add_tail_fork(builder, slots)
    add_dorsal_fin(builder, slots)
    add_pectoral_and_pelvic_fins(builder, slots)
    add_patterns_and_eyes(builder, slots)
    obj = builder.make_object(NODE_NAME, materials)
    obj["asset_id"] = ASSET_ID
    obj["asset_name"] = ASSET_NAME
    obj["coordinate_convention"] = "head +X, tail -X, top +Z, visible side -Y"
    obj["spec_length_m"] = LENGTH
    obj["spec_height_m"] = HEIGHT
    obj["spec_width_m"] = WIDTH
    return obj


def triangle_count(obj) -> int:
    return sum(max(len(poly.vertices) - 2, 0) for poly in obj.data.polygons)


def mesh_bounds(objects):
    corners = []
    for obj in objects:
        if obj.type == "MESH":
            corners.extend(obj.matrix_world @ Vector(corner) for corner in obj.bound_box)
    min_v = Vector((min(v.x for v in corners), min(v.y for v in corners), min(v.z for v in corners)))
    max_v = Vector((max(v.x for v in corners), max(v.y for v in corners), max(v.z for v in corners)))
    return min_v, max_v, (min_v + max_v) * 0.5, max_v - min_v


def dimensions(obj):
    _, _, _, size = mesh_bounds([obj])
    return size.x, size.z, size.y


def validate_object(obj) -> tuple[dict, list[str]]:
    length, height, width = dimensions(obj)
    tri = triangle_count(obj)
    checks = {
        "node_name": obj.name == NODE_NAME,
        "single_mesh_object": len([o for o in bpy.context.scene.objects if o.type == "MESH"]) == 1,
        "triangle_count_within_limit": TRIANGLE_MIN <= tri <= TRIANGLE_MAX,
        "length_close_x_axis": abs(length - LENGTH) <= 0.003,
        "height_close_z_axis": abs(height - HEIGHT) <= 0.003,
        "width_close_y_axis": abs(width - WIDTH) <= 0.003,
        "no_armature": not bpy.data.armatures,
        "no_shape_keys": obj.data.shape_keys is None,
        "no_animation": not bpy.data.actions,
        "no_camera_before_export": not bpy.data.cameras,
        "no_light_before_export": not bpy.data.lights,
        "flat_shading": all(not poly.use_smooth for poly in obj.data.polygons),
    }
    failures = [key for key, ok in checks.items() if not ok]
    metrics = {
        "triangle_count": tri,
        "dimensions_m": {"length": length, "height": height, "width": width},
        "axis_mapping": {"length": "X", "height": "Z", "width": "Y"},
        "materials": [mat.name for mat in obj.data.materials],
    }
    return {"checks": checks, "metrics": metrics}, failures


def export_glb(obj) -> None:
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.export_scene.gltf(
        filepath=str(OUT_GLB),
        export_format="GLB",
        use_selection=True,
        export_texcoords=False,
        export_normals=True,
        export_tangents=False,
        export_materials="EXPORT",
        export_animations=False,
        export_cameras=False,
        export_lights=False,
        export_draco_mesh_compression_enable=True,
        export_draco_mesh_compression_level=10,
        export_draco_position_quantization=14,
        export_draco_normal_quantization=10,
        export_draco_generic_quantization=12,
        export_extras=True,
        export_yup=True,
        export_apply=False,
        check_existing=False,
    )


def read_glb_json(path: Path):
    data = path.read_bytes()
    magic, version, total_length = struct.unpack_from("<III", data, 0)
    if magic != 0x46546C67:
        raise ValueError("not a GLB binary")
    if version != 2:
        raise ValueError(f"unsupported GLB version: {version}")
    if total_length != len(data):
        raise ValueError("GLB header length mismatch")
    offset = 12
    while offset < len(data):
        chunk_length, chunk_type = struct.unpack_from("<II", data, offset)
        offset += 8
        chunk = data[offset:offset + chunk_length]
        offset += chunk_length
        if chunk_type == 0x4E4F534A:
            return json.loads(chunk.decode("utf-8"))
    raise ValueError("GLB JSON chunk missing")


def validate_glb() -> tuple[dict, list[str]]:
    doc = read_glb_json(OUT_GLB)
    node_names = {node.get("name") for node in doc.get("nodes", [])}
    primitive_draco = []
    for mesh in doc.get("meshes", []):
        for primitive in mesh.get("primitives", []):
            primitive_draco.append("KHR_draco_mesh_compression" in primitive.get("extensions", {}))
    checks = {
        "glb_file_exists": OUT_GLB.exists(),
        "node_exists": NODE_NAME in node_names,
        "binary_glb": True,
        "draco_extension_used": "KHR_draco_mesh_compression" in doc.get("extensionsUsed", []),
        "all_primitives_draco": bool(primitive_draco) and all(primitive_draco),
        "no_animations": not doc.get("animations"),
        "no_cameras": not doc.get("cameras"),
        "no_lights": "KHR_lights_punctual" not in doc.get("extensionsUsed", []),
        "materials_embedded": bool(doc.get("materials")),
        "no_external_images": not any("uri" in image for image in doc.get("images", [])),
    }
    failures = [key for key, ok in checks.items() if not ok]
    return {"checks": checks, "file_size_bytes": OUT_GLB.stat().st_size}, failures


def set_render_engine() -> None:
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = RENDER_W
    scene.render.resolution_y = RENDER_H
    scene.render.film_transparent = False
    scene.view_settings.view_transform = "Standard"
    try:
        scene.view_settings.look = "None"
    except TypeError:
        pass
    scene.view_settings.exposure = -0.05
    scene.view_settings.gamma = 1.0
    scene.world = scene.world or bpy.data.worlds.new("World")
    scene.world.color = (0.20, 0.20, 0.20)


def add_lighting(center: Vector) -> None:
    for index, (rotation, energy) in enumerate([
        ((math.radians(55), 0.0, math.radians(30)), 1.10),
        ((math.radians(115), 0.0, math.radians(-145)), 0.40),
    ]):
        bpy.ops.object.light_add(type="SUN", location=center)
        light = bpy.context.object
        light.name = f"preview_sun_{index + 1}"
        light.rotation_euler = rotation
        light.data.energy = energy


def create_camera():
    bpy.ops.object.camera_add(location=(0.0, 0.0, 0.0))
    camera = bpy.context.object
    camera.name = "preview_camera"
    camera.data.type = "ORTHO"
    bpy.context.scene.camera = camera
    return camera


def look_at(camera, target: Vector, world_up=Vector((0.0, 0.0, 1.0))) -> None:
    forward = (target - camera.location).normalized()
    right = forward.cross(world_up)
    if right.length < 0.00001:
        right = forward.cross(Vector((0.0, 1.0, 0.0)))
    right.normalize()
    up = right.cross(forward).normalized()
    rotation = Matrix((
        (right.x, up.x, -forward.x),
        (right.y, up.y, -forward.y),
        (right.z, up.z, -forward.z),
    ))
    camera.rotation_euler = rotation.to_euler()


def ortho_scale(horizontal: float, vertical: float, margin: float = 1.42) -> float:
    return max(vertical, horizontal / (RENDER_W / RENDER_H)) * margin


def render_view(name: str, camera, center: Vector, size: Vector, direction,
                horizontal: float, vertical: float):
    direction = Vector(direction).normalized()
    camera.location = center + direction * (max(size.x, size.y, size.z) * 8.0 + 0.45)
    look_at(camera, center)
    camera.data.ortho_scale = ortho_scale(horizontal, vertical)
    path = RENDER_DIR / f"{name}.png"
    bpy.context.scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)
    return path


def render_previews(obj) -> dict[str, str]:
    set_render_engine()
    min_v, max_v, center, size = mesh_bounds([obj])
    add_lighting(center)
    camera = create_camera()
    paths = {
        "front": render_view("front", camera, center, size, (1, 0, 0), size.y, size.z),
        "side": render_view("side", camera, center, size, (0, -1, 0), size.x, size.z),
        "back": render_view("back", camera, center, size, (-1, 0, 0), size.y, size.z),
        "three_quarter": render_view("three_quarter", camera, center, size, (1.0, -0.62, 0.38), size.x, size.z + size.y * 0.24),
    }

    original_colors = [(mat, tuple(mat.diffuse_color)) for mat in obj.data.materials]
    for mat in obj.data.materials:
        set_material_color(mat, "#050505")
    bpy.context.scene.world.color = (1.0, 1.0, 1.0)
    paths["silhouette"] = render_view("silhouette", camera, center, size, (0, -1, 0), size.x, size.z)
    for mat, color in original_colors:
        mat.diffuse_color = color
        if mat.use_nodes:
            bsdf = mat.node_tree.nodes.get("Principled BSDF")
            if bsdf and "Base Color" in bsdf.inputs:
                bsdf.inputs["Base Color"].default_value = color
    return {name: str(path) for name, path in paths.items()}


def write_qa_report(object_report: dict, object_failures: list[str], glb_report: dict,
                    glb_failures: list[str], renders: dict[str, str]):
    failures = object_failures + glb_failures
    report = {
        "asset_id": ASSET_ID,
        "asset_name": ASSET_NAME,
        "status": "pass" if not failures else "fail",
        "output": {
            "glb": str(OUT_GLB),
            "renders": renders,
        },
        "spec": {
            "dimensions_m": {"length": LENGTH, "height": HEIGHT, "width": WIDTH},
            "axis_mapping": {"length": "X", "height": "Z", "width": "Y"},
            "coordinate_convention": {
                "head_front": "+X",
                "tail_rear": "-X",
                "dorsal_top": "+Z",
                "belly": "-Z",
                "visible_side": "-Y",
            },
            "proportion_ratio": {"head": 2, "body": 5, "tail": 3},
            "triangle_target": {"min": TRIANGLE_MIN, "ideal": TRIANGLE_IDEAL, "max": TRIANGLE_MAX},
            "node_name": NODE_NAME,
        },
        "object_validation": object_report,
        "glb_validation": glb_report,
        "visual_features": {
            "horizontal_x_axis_body": True,
            "deep_body_silhouette": True,
            "wide_fork_tail_at_negative_x": True,
            "continuous_dorsal_fin_on_positive_z": True,
            "broad_triangular_pectoral_fin_on_side": True,
            "cream_belly_region_lower_z_faces": True,
            "navy_eye_band_single_surface_patch": True,
            "rear_stripes_vertical_on_rear_body": True,
            "flat_low_poly_style": True,
            "manual_visual_review_recommended": True,
        },
        "failures": failures,
    }
    QA_REPORT.write_text(json.dumps(report, indent=2), encoding="utf-8")
    return report


def main() -> None:
    ensure_dirs()
    reset_scene()
    obj = create_fish_medium()
    object_report, object_failures = validate_object(obj)
    export_glb(obj)
    glb_report, glb_failures = validate_glb()
    renders = render_previews(obj)
    report = write_qa_report(object_report, object_failures, glb_report, glb_failures, renders)
    print(f"Generated {ASSET_ID}")
    print(f"  glb: {OUT_GLB}")
    print(f"  qa: {QA_REPORT}")
    print(f"  status: {report['status']}")
    print(f"  triangles: {object_report['metrics']['triangle_count']}")
    dims = object_report["metrics"]["dimensions_m"]
    print(f"  dimensions: length(X)={dims['length']:.5f}m height(Z)={dims['height']:.5f}m width(Y)={dims['width']:.5f}m")
    for name, path in renders.items():
        print(f"  render {name}: {path}")
    if report["failures"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
