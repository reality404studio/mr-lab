from __future__ import annotations

import json
import math
import struct
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[2]
EXPORT_DIR = ROOT / "exports"

OUT_GLB = EXPORT_DIR / "fish_small.glb"
OUT_BLEND = EXPORT_DIR / "fish_small.blend"

NODE_NAME = "fishS_body"
TRIANGLE_LIMIT = 400

LENGTH = 0.08
HEIGHT = 0.035
WIDTH = 0.020

Z_MIN = -LENGTH * 0.5
Z_MAX = LENGTH * 0.5
Y_MIN = -HEIGHT * 0.5
Y_MAX = HEIGHT * 0.5
X_MAX = WIDTH * 0.5
DECAL_SURFACE_OFFSET = 0.00012


PALETTE = {
    "body": "#40C7CF",
    "belly": "#BDEBD9",
    "fins": "#FFD15A",
    "spots": "#289EA6",
    "cheek": "#FFC6C6",
    "eye_white": "#F8F8F2",
    "eye_black": "#10100D",
}


def hex_rgba(value: str):
    value = value.lstrip("#")
    return tuple(int(value[i:i + 2], 16) / 255.0 for i in (0, 2, 4)) + (1.0,)


def ensure_dirs() -> None:
    EXPORT_DIR.mkdir(parents=True, exist_ok=True)


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


def make_material(name: str, color_hex: str, roughness: float = 0.82):
    mat = bpy.data.materials.new(name)
    color = hex_rgba(color_hex)
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
        for poly, material_index in zip(mesh.polygons, self.material_indices):
            poly.material_index = material_index
            poly.use_smooth = False
        obj = bpy.data.objects.new(name, mesh)
        bpy.context.collection.objects.link(obj)
        obj.location = (0.0, 0.0, 0.0)
        obj.rotation_euler = (0.0, 0.0, 0.0)
        obj.scale = (1.0, 1.0, 1.0)
        return obj


def body_radius_at(z: float):
    # Hand-tuned low-poly profile: narrow tail root, oval body, large rounded head.
    points = [
        (-0.016, 0.0028, 0.0050),
        (-0.006, 0.0068, 0.0110),
        (0.006, 0.0088, 0.0143),
        (0.018, 0.0090, 0.0145),
        (0.030, 0.0072, 0.0130),
        (0.038, 0.0036, 0.0060),
    ]
    if z <= points[0][0]:
        return points[0][1], points[0][2]
    if z >= points[-1][0]:
        return points[-1][1], points[-1][2]
    for i in range(len(points) - 1):
        z0, rx0, ry0 = points[i]
        z1, rx1, ry1 = points[i + 1]
        if z0 <= z <= z1:
            t = (z - z0) / (z1 - z0)
            return rx0 + (rx1 - rx0) * t, ry0 + (ry1 - ry0) * t
    return points[-1][1], points[-1][2]


def body_surface_x(side: float, y: float, z: float, offset: float = DECAL_SURFACE_OFFSET) -> float:
    rx, ry = body_radius_at(z)
    safe_ry = max(ry, 0.0001)
    local_y = max(min(y, safe_ry * 0.98), -safe_ry * 0.98)
    ellipse_factor = math.sqrt(max(0.0, 1.0 - (local_y / safe_ry) ** 2))
    return side * (rx * ellipse_factor + offset)


def side_surface_point(side: float, y: float, z: float, offset: float = DECAL_SURFACE_OFFSET):
    return (body_surface_x(side, y, z, offset), y, z)


def add_body(builder: MeshBuilder, mat_body: int, mat_belly: int):
    segments = 8
    z_rings = [-0.016, -0.006, 0.006, 0.018, 0.030, 0.038]
    rings = []
    for z in z_rings:
        rx, ry = body_radius_at(z)
        ring = []
        for i in range(segments):
            angle = math.tau * i / segments
            ring.append(builder.v((math.cos(angle) * rx, math.sin(angle) * ry, z)))
        rings.append(ring)

    tail_root = builder.v((0.0, 0.0, z_rings[0] - 0.002))
    nose = builder.v((0.0, 0.0, Z_MAX))

    first = rings[0]
    for i in range(segments):
        j = (i + 1) % segments
        builder.tri(tail_root, first[j], first[i], mat_body)

    for r in range(len(rings) - 1):
        for i in range(segments):
            j = (i + 1) % segments
            a = rings[r][i]
            b = rings[r][j]
            c = rings[r + 1][j]
            d = rings[r + 1][i]
            avg_y = sum(builder.verts[idx][1] for idx in (a, b, c, d)) / 4.0
            mat = mat_belly if avg_y < -0.002 else mat_body
            builder.quad(a, b, c, d, mat)

    last = rings[-1]
    for i in range(segments):
        j = (i + 1) % segments
        avg_y = (builder.verts[last[i]][1] + builder.verts[last[j]][1]) * 0.5
        mat = mat_belly if avg_y < -0.002 else mat_body
        builder.tri(nose, last[i], last[j], mat)


def add_fin(builder: MeshBuilder, points, mat_fins: int):
    ids = [builder.v(point) for point in points]
    if len(ids) == 3:
        builder.tri(ids[0], ids[1], ids[2], mat_fins)
    elif len(ids) == 4:
        builder.quad(ids[0], ids[1], ids[2], ids[3], mat_fins)


def add_tail(builder: MeshBuilder, mat_fins: int):
    root_top = builder.v((0.0, 0.0042, -0.0165))
    root_bottom = builder.v((0.0, -0.0042, -0.0165))
    hub = builder.v((0.0, 0.0, -0.0245))
    upper_tip = builder.v((0.0, Y_MAX, Z_MIN))
    lower_tip = builder.v((0.0, Y_MIN, Z_MIN))
    outer_notch = builder.v((0.0, 0.0, -0.0335))

    builder.tri(root_top, root_bottom, hub, mat_fins)
    builder.tri(root_top, hub, upper_tip, mat_fins)
    builder.tri(hub, outer_notch, upper_tip, mat_fins)
    builder.tri(hub, lower_tip, outer_notch, mat_fins)
    builder.tri(root_bottom, lower_tip, hub, mat_fins)


def add_spot(builder: MeshBuilder, side: float, y: float, z: float, radius: float, mat_spots: int, segments: int = 6):
    center = builder.v(side_surface_point(side, y, z))
    ring = []
    for i in range(segments):
        angle = math.tau * i / segments
        py = y + math.sin(angle) * radius
        pz = z + math.cos(angle) * radius
        ring.append(builder.v(side_surface_point(side, py, pz)))
    for i in range(segments):
        a = ring[i]
        b = ring[(i + 1) % segments]
        if side > 0:
            builder.tri(center, a, b, mat_spots)
        else:
            builder.tri(center, b, a, mat_spots)


def add_eye(builder: MeshBuilder, side: float, mat_white: int, mat_black: int):
    z = 0.0305
    y = 0.0040
    add_spot(builder, side, y, z, 0.0052, mat_white, segments=10)
    add_spot(builder, side, y, z + 0.0003, 0.0034, mat_black, segments=10)
    add_spot(builder, side, y + 0.0018, z + 0.0023, 0.0010, mat_white, segments=6)


def add_details(builder: MeshBuilder, material_slots):
    mat_fins = material_slots["fins"]
    mat_spots = material_slots["spots"]
    mat_cheek = material_slots["cheek"]
    mat_eye_white = material_slots["eye_white"]
    mat_eye_black = material_slots["eye_black"]

    add_tail(builder, mat_fins)
    add_fin(builder, [(0.0, 0.0102, -0.0020), (0.0, Y_MAX, 0.0065), (0.0, 0.0112, 0.0170)], mat_fins)
    add_fin(builder, [(X_MAX, -0.0035, 0.0100), (X_MAX, -0.0145, -0.0060), (X_MAX, -0.0065, -0.0015)], mat_fins)
    add_fin(builder, [(-X_MAX, -0.0035, 0.0100), (-X_MAX, -0.0065, -0.0015), (-X_MAX, -0.0145, -0.0060)], mat_fins)

    spot_positions = [(-0.004, 0.0042), (0.006, 0.0052), (0.015, 0.0034), (0.024, 0.0066), (0.033, 0.0032)]
    for side in (-1.0, 1.0):
        for z, y in spot_positions:
            add_spot(builder, side, y, z, 0.00175, mat_spots)
        add_eye(builder, side, mat_eye_white, mat_eye_black)
        add_spot(builder, side, -0.0048, 0.026, 0.0017, mat_cheek)


def create_fish_small():
    materials = [
        make_material("mat_fishS_turquoise_body", PALETTE["body"]),
        make_material("mat_fishS_light_mint_belly", PALETTE["belly"]),
        make_material("mat_fishS_warm_yellow_fins_tail", PALETTE["fins"]),
        make_material("mat_fishS_deep_teal_spots", PALETTE["spots"]),
        make_material("mat_fishS_soft_blush_cheek", PALETTE["cheek"]),
        make_material("mat_fishS_eye_white", PALETTE["eye_white"], 0.72),
        make_material("mat_fishS_eye_black", PALETTE["eye_black"], 0.65),
    ]
    slots = {
        "body": 0,
        "belly": 1,
        "fins": 2,
        "spots": 3,
        "cheek": 4,
        "eye_white": 5,
        "eye_black": 6,
    }
    builder = MeshBuilder()
    add_body(builder, slots["body"], slots["belly"])
    add_details(builder, slots)
    obj = builder.make_object(NODE_NAME, materials)
    obj["mro_spec_length_m"] = LENGTH
    obj["mro_spec_height_m"] = HEIGHT
    obj["mro_spec_width_m"] = WIDTH
    return obj


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


def triangle_count(obj) -> int:
    return sum(max(len(poly.vertices) - 2, 0) for poly in obj.data.polygons)


def bbox(obj):
    corners = [obj.matrix_world @ Vector(corner) for corner in obj.bound_box]
    return (
        min(v.x for v in corners),
        max(v.x for v in corners),
        min(v.y for v in corners),
        max(v.y for v in corners),
        min(v.z for v in corners),
        max(v.z for v in corners),
    )


def dimensions(obj):
    min_x, max_x, min_y, max_y, min_z, max_z = bbox(obj)
    return max_x - min_x, max_y - min_y, max_z - min_z


def approx_equal(actual: float, expected: float, tolerance: float = 0.001) -> bool:
    return abs(actual - expected) <= tolerance


def validate_blender_object(obj) -> list[str]:
    errors = []
    width, height, length = dimensions(obj)
    tri = triangle_count(obj)
    if obj.name != NODE_NAME:
        errors.append(f"node name must be {NODE_NAME}, got {obj.name}")
    if tri > TRIANGLE_LIMIT:
        errors.append(f"triangle count {tri} exceeds {TRIANGLE_LIMIT}")
    if not approx_equal(width, WIDTH):
        errors.append(f"width {width:.5f}m is not close to {WIDTH:.5f}m")
    if not approx_equal(height, HEIGHT):
        errors.append(f"height {height:.5f}m is not close to {HEIGHT:.5f}m")
    if not approx_equal(length, LENGTH):
        errors.append(f"length {length:.5f}m is not close to {LENGTH:.5f}m")
    if tuple(round(v, 6) for v in obj.location) != (0.0, 0.0, 0.0):
        errors.append(f"origin/pivot must be at body center (0,0,0), got {tuple(obj.location)}")
    if bpy.data.armatures:
        errors.append("armature data exists")
    if obj.data.shape_keys:
        errors.append("shape keys exist")
    if bpy.data.actions:
        errors.append("animation actions exist")
    if bpy.data.cameras:
        errors.append("camera data exists")
    if bpy.data.lights:
        errors.append("light data exists")
    if len([mesh_obj for mesh_obj in bpy.context.scene.objects if mesh_obj.type == "MESH"]) != 1:
        errors.append("scene should contain exactly one mesh object")
    return errors


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


def validate_glb(path: Path) -> list[str]:
    errors = []
    doc = read_glb_json(path)
    node_names = {node.get("name") for node in doc.get("nodes", [])}
    if NODE_NAME not in node_names:
        errors.append(f"{NODE_NAME} node missing in GLB")
    if doc.get("animations"):
        errors.append("GLB contains animations")
    if doc.get("cameras"):
        errors.append("GLB contains cameras")
    if doc.get("images"):
        errors.append("GLB contains images, but this material-only pass should not")
    if "KHR_lights_punctual" in doc.get("extensionsUsed", []):
        errors.append("GLB contains lights")
    if "KHR_draco_mesh_compression" not in doc.get("extensionsUsed", []):
        errors.append("Draco compression extension missing")
    for mesh in doc.get("meshes", []):
        for primitive in mesh.get("primitives", []):
            extensions = primitive.get("extensions", {})
            if "KHR_draco_mesh_compression" not in extensions:
                errors.append("a mesh primitive is not Draco-compressed")
    return errors


def fail_if_errors(label: str, errors: list[str]) -> None:
    if not errors:
        return
    print(f"\n{label} FAILED")
    for error in errors:
        print(f"- {error}")
    raise SystemExit(1)


def main() -> None:
    ensure_dirs()
    reset_scene()
    obj = create_fish_small()
    fail_if_errors("Blender object validation", validate_blender_object(obj))
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT_BLEND))
    export_glb(obj)
    fail_if_errors("GLB validation", validate_glb(OUT_GLB))
    width, height, length = dimensions(obj)
    print("Generated material-only fish_small.glb")
    print(f"  node: {obj.name}")
    print(f"  triangles: {triangle_count(obj)}")
    print(f"  dimensions: width={width:.5f}m height={height:.5f}m length={length:.5f}m")
    print(f"  origin/pivot: {tuple(round(v, 6) for v in obj.location)}")
    print(f"  glb: {OUT_GLB} ({OUT_GLB.stat().st_size} bytes)")
    print(f"  blend: {OUT_BLEND}")
    print("  validation: OK")


if __name__ == "__main__":
    main()
