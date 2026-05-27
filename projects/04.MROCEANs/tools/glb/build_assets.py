from __future__ import annotations

import math
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[2]
MODEL_DIR = ROOT / "assets" / "models"
TEXTURE_DIR = ROOT / "assets" / "textures"
SOURCE_DIR = ROOT / "assets" / "source"


def ensure_dirs() -> None:
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    TEXTURE_DIR.mkdir(parents=True, exist_ok=True)
    SOURCE_DIR.mkdir(parents=True, exist_ok=True)


def reset_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()
    for datablocks in (
        bpy.data.meshes,
        bpy.data.materials,
        bpy.data.images,
        bpy.data.collections,
        bpy.data.actions,
        bpy.data.armatures,
        bpy.data.cameras,
        bpy.data.lights,
    ):
        for block in list(datablocks):
            datablocks.remove(block)


def lerp(a: float, b: float, t: float) -> float:
    return a + (b - a) * t


def clamp(v: float, lo: float, hi: float) -> float:
    return min(max(v, lo), hi)


def make_image(name: str, width: int, height: int, painter, path: Path):
    image = bpy.data.images.new(name, width=width, height=height, alpha=True)
    pixels = [0.0] * (width * height * 4)
    for y in range(height):
        v = y / max(height - 1, 1)
        for x in range(width):
            u = x / max(width - 1, 1)
            r, g, b, a = painter(u, v)
            i = (y * width + x) * 4
            pixels[i + 0] = clamp(r, 0.0, 1.0)
            pixels[i + 1] = clamp(g, 0.0, 1.0)
            pixels[i + 2] = clamp(b, 0.0, 1.0)
            pixels[i + 3] = clamp(a, 0.0, 1.0)
    image.pixels.foreach_set(pixels)
    image.filepath_raw = str(path)
    image.file_format = "PNG"
    image.save()
    image.pack()
    return image


def build_textures():
    def fish_atlas(u: float, v: float):
        left = u < 0.5
        local_u = u * 2.0 if left else (u - 0.5) * 2.0
        stripe = 1.0 if int(local_u * (7 if left else 9)) % 2 == 0 else 0.0
        belly = 1.0 if v < 0.28 else 0.0
        if left:
            r, g, b = 0.18 + stripe * 0.15, 0.72 + stripe * 0.15, 0.95
            r = lerp(r, 1.0, belly * 0.45)
            g = lerp(g, 0.96, belly * 0.30)
        else:
            r, g, b = 0.08, 0.48 + stripe * 0.18, 0.86
            r = lerp(r, 0.92, belly * 0.40)
            g = lerp(g, 0.93, belly * 0.35)
            b = lerp(b, 0.98, belly * 0.35)
        return r, g, b, 1.0

    def fish_large(u: float, v: float):
        belly = 1.0 if v < 0.30 else 0.0
        stripe = 1.0 if int((u * 6.0 + v * 2.0)) % 4 == 0 else 0.0
        yellow = 1.0 if 0.68 < u < 0.88 and 0.22 < v < 0.78 else 0.0
        r = lerp(0.05, 0.95, yellow * 0.55)
        g = lerp(0.25, 0.82, yellow * 0.65)
        b = lerp(0.82, 0.12, yellow * 0.50)
        r = lerp(r, 0.93, belly * 0.50)
        g = lerp(g, 0.95, belly * 0.35)
        b = lerp(b, 1.00, belly * 0.25)
        if stripe > 0.5:
            r *= 0.35
            g *= 0.45
            b *= 0.55
        return r, g, b, 1.0

    def jelly(u: float, v: float):
        uq = round(u * 24.0) / 24.0
        vq = round(v * 24.0) / 24.0
        glow = 0.5 + 0.5 * math.sin((uq * 2.0 + vq * 3.0) * math.tau)
        edge = abs(u - 0.5) * 2.0
        r = 0.20 + glow * 0.20 + edge * 0.10
        g = 0.72 + glow * 0.18
        b = 0.95
        alpha = 0.42 + round((1.0 - edge) * 8.0) / 8.0 * 0.25
        if v > 0.60:
            alpha = 0.55 + glow * 0.15
        return r, g, b, alpha

    def whale(u: float, v: float):
        belly = clamp((0.42 - v) * 2.8, 0.0, 1.0)
        mottling = 0.5 + 0.5 * math.sin((u * 7.0 + v * 2.0) * math.tau)
        r = lerp(0.13, 0.80, belly)
        g = lerp(0.19, 0.83, belly)
        b = lerp(0.25, 0.86, belly)
        r += mottling * 0.025
        g += mottling * 0.025
        b += mottling * 0.025
        return r, g, b, 1.0

    return {
        "atlas_fish_sm": make_image("atlas_fish_sm.png", 512, 512, fish_atlas, TEXTURE_DIR / "atlas_fish_sm.png"),
        "tex_fish_L": make_image("tex_fish_L.png", 512, 512, fish_large, TEXTURE_DIR / "tex_fish_L.png"),
        "tex_jellyfish": make_image("tex_jellyfish.png", 512, 512, jelly, TEXTURE_DIR / "tex_jellyfish.png"),
        "tex_whale": make_image("tex_whale.png", 1024, 512, whale, TEXTURE_DIR / "tex_whale.png"),
    }


def socket_set(bsdf, name: str, value) -> None:
    socket = bsdf.inputs.get(name)
    if socket is not None:
        socket.default_value = value


def texture_material(name: str, image, roughness: float, alpha: float = 1.0, emissive: bool = False):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    mat.use_backface_culling = False
    if alpha < 1.0:
        mat.blend_method = "BLEND"
        mat.show_transparent_back = True
    nodes = mat.node_tree.nodes
    bsdf = nodes.get("Principled BSDF")
    if bsdf:
        socket_set(bsdf, "Metallic", 0.0)
        socket_set(bsdf, "Roughness", roughness)
        socket_set(bsdf, "Alpha", alpha)
        tex = nodes.new(type="ShaderNodeTexImage")
        tex.image = image
        mat.node_tree.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
        if alpha < 1.0 and "Alpha" in bsdf.inputs:
            mat.node_tree.links.new(tex.outputs["Alpha"], bsdf.inputs["Alpha"])
        if emissive:
            emission = bsdf.inputs.get("Emission Color")
            strength = bsdf.inputs.get("Emission Strength")
            if emission is not None:
                mat.node_tree.links.new(tex.outputs["Color"], emission)
            if strength is not None:
                strength.default_value = 0.1
    return mat


def flat_material(name: str, color, roughness: float = 0.8, alpha: float = 1.0):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = color
    mat.use_nodes = True
    mat.use_backface_culling = False
    if alpha < 1.0:
        mat.blend_method = "BLEND"
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        socket_set(bsdf, "Base Color", color)
        socket_set(bsdf, "Metallic", 0.0)
        socket_set(bsdf, "Roughness", roughness)
        socket_set(bsdf, "Alpha", alpha)
    return mat


class MeshBuilder:
    def __init__(self):
        self.verts = []
        self.faces = []
        self.uvs = []
        self.materials = []

    def v(self, xyz):
        self.verts.append(tuple(xyz))
        return len(self.verts) - 1

    def tri(self, a, b, c, mat=0, uvs=None):
        self.faces.append((a, b, c))
        self.materials.append(mat)
        self.uvs.append(uvs or ((0.0, 0.0), (1.0, 0.0), (0.5, 1.0)))

    def double_tri(self, a, b, c, mat=0, uvs=None):
        self.tri(a, b, c, mat, uvs)

    def quad(self, a, b, c, d, mat=0, uvs=None):
        u = uvs or ((0.0, 0.0), (1.0, 0.0), (1.0, 1.0), (0.0, 1.0))
        self.tri(a, b, c, mat, (u[0], u[1], u[2]))
        self.tri(a, c, d, mat, (u[0], u[2], u[3]))

    def make_object(self, name: str, mats, collection, location=(0.0, 0.0, 0.0)):
        mesh = bpy.data.meshes.new(name + "_mesh")
        mesh.from_pydata(self.verts, [], self.faces)
        mesh.update()
        for mat in mats:
            mesh.materials.append(mat)
        uv_layer = mesh.uv_layers.new(name="UVMap")
        for poly, mat_index, face_uvs in zip(mesh.polygons, self.materials, self.uvs):
            poly.material_index = mat_index
            poly.use_smooth = True
            for loop_index, uv in zip(poly.loop_indices, face_uvs):
                uv_layer.data[loop_index].uv = uv
        obj = bpy.data.objects.new(name, mesh)
        obj.location = location
        obj["mro_triangles"] = sum(max(len(p.vertices) - 2, 0) for p in mesh.polygons)
        collection.objects.link(obj)
        return obj


def uv_rect(rect, u: float, v: float):
    x0, y0, x1, y1 = rect
    return (lerp(x0, x1, u), lerp(y0, y1, v))


def add_body_surface(b: MeshBuilder, length: float, height: float, width: float, z_min: float, z_max: float,
                     segments: int, rings: int, mat=0, uv=(0.0, 0.0, 1.0, 1.0), head_bump=0.0):
    ring_indices = []
    for r in range(1, rings):
        t = r / rings
        z = lerp(z_min, z_max, t)
        base = math.sin(math.pi * t) ** 0.52
        bump = 1.0 + head_bump * math.exp(-((t - 0.78) / 0.18) ** 2)
        rx = width * 0.5 * base * bump
        ry = height * 0.5 * base * bump
        ring = []
        for s in range(segments):
            a = math.tau * s / segments
            ring.append(b.v((math.cos(a) * rx, math.sin(a) * ry, z)))
        ring_indices.append(ring)

    back = b.v((0.0, 0.0, z_min))
    front = b.v((0.0, 0.0, z_max))

    first = ring_indices[0]
    for s in range(segments):
        s2 = (s + 1) % segments
        b.tri(back, first[s2], first[s], mat,
              (uv_rect(uv, 0.5, 0.0), uv_rect(uv, s2 / segments, 1 / rings), uv_rect(uv, s / segments, 1 / rings)))

    for r in range(len(ring_indices) - 1):
        a_ring = ring_indices[r]
        b_ring = ring_indices[r + 1]
        for s in range(segments):
            s2 = (s + 1) % segments
            u0 = s / segments
            u1 = s2 / segments
            v0 = (r + 1) / rings
            v1 = (r + 2) / rings
            b.quad(a_ring[s], a_ring[s2], b_ring[s2], b_ring[s], mat,
                   (uv_rect(uv, u0, v0), uv_rect(uv, u1, v0), uv_rect(uv, u1, v1), uv_rect(uv, u0, v1)))

    last = ring_indices[-1]
    for s in range(segments):
        s2 = (s + 1) % segments
        b.tri(front, last[s], last[s2], mat,
              (uv_rect(uv, 0.5, 1.0), uv_rect(uv, s / segments, (rings - 1) / rings), uv_rect(uv, s2 / segments, (rings - 1) / rings)))


def add_double_fin(b: MeshBuilder, points, mat=0, uv=(0.0, 0.0, 1.0, 1.0)):
    ids = [b.v(p) for p in points]
    if len(ids) == 3:
        b.double_tri(ids[0], ids[1], ids[2], mat,
                     (uv_rect(uv, 0.0, 0.0), uv_rect(uv, 1.0, 0.0), uv_rect(uv, 0.5, 1.0)))
    elif len(ids) == 4:
        b.quad(ids[0], ids[1], ids[2], ids[3], mat)


def add_eye(b: MeshBuilder, side: float, x: float, y: float, z: float, radius: float, mat=1, highlight_mat=2):
    center = b.v((side * x, y, z))
    ring = []
    for i in range(10):
        a = math.tau * i / 10
        ring.append(b.v((side * x, y + math.sin(a) * radius, z + math.cos(a) * radius)))
    for i in range(10):
        b.tri(center, ring[i], ring[(i + 1) % 10], mat)

    h_center = b.v((side * (x + 0.0004), y + radius * 0.25, z + radius * 0.18))
    h1 = b.v((side * (x + 0.0005), y + radius * 0.40, z + radius * 0.18))
    h2 = b.v((side * (x + 0.0005), y + radius * 0.25, z + radius * 0.33))
    h3 = b.v((side * (x + 0.0005), y + radius * 0.10, z + radius * 0.18))
    h4 = b.v((side * (x + 0.0005), y + radius * 0.25, z + radius * 0.03))
    b.tri(h_center, h1, h2, highlight_mat)
    b.tri(h_center, h2, h3, highlight_mat)
    b.tri(h_center, h3, h4, highlight_mat)
    b.tri(h_center, h4, h1, highlight_mat)


def add_fish_tail(b: MeshBuilder, root_z: float, tip_z: float, height: float, width: float, mat=0, uv=(0.0, 0.0, 1.0, 1.0)):
    root = b.v((0.0, 0.0, root_z))
    upper_l = b.v((-width * 0.5, height * 0.45, tip_z))
    upper_r = b.v((width * 0.5, height * 0.45, tip_z))
    lower_l = b.v((-width * 0.5, -height * 0.45, tip_z))
    lower_r = b.v((width * 0.5, -height * 0.45, tip_z))
    notch = b.v((0.0, 0.0, tip_z + abs(root_z - tip_z) * 0.24))
    b.double_tri(root, upper_r, upper_l, mat)
    b.double_tri(root, lower_l, lower_r, mat)
    b.double_tri(notch, upper_l, lower_l, mat)
    b.double_tri(notch, lower_r, upper_r, mat)


def create_fish(name: str, node: str, length: float, height: float, width: float, segments: int, rings: int,
                mats, collection, uv, head_bump: float, medium=False):
    b = MeshBuilder()
    tail_root = -length * 0.20
    add_body_surface(b, length, height, width, tail_root, length * 0.50, segments, rings, 0, uv, head_bump)
    add_fish_tail(b, tail_root, -length * 0.50, height * 1.25, width * 1.75, 0, uv)
    add_double_fin(b, [(0.0, height * 0.36, length * 0.12), (0.0, height * 0.66, -length * 0.05), (0.0, height * 0.34, -length * 0.18)], 0, uv)
    add_double_fin(b, [(width * 0.44, -height * 0.02, length * 0.12), (width * 1.10, -height * 0.22, length * 0.02), (width * 0.46, -height * 0.22, -length * 0.05)], 0, uv)
    add_double_fin(b, [(-width * 0.44, -height * 0.02, length * 0.12), (-width * 1.10, -height * 0.22, length * 0.02), (-width * 0.46, -height * 0.22, -length * 0.05)], 0, uv)
    if medium:
        add_double_fin(b, [(0.0, -height * 0.32, length * 0.08), (0.0, -height * 0.52, -length * 0.02), (0.0, -height * 0.32, -length * 0.12)], 0, uv)
    add_eye(b, 1.0, width * 0.48, height * 0.11, length * 0.32, height * 0.12)
    add_eye(b, -1.0, width * 0.48, height * 0.11, length * 0.32, height * 0.12)
    return b.make_object(node, mats, collection)


def create_large_fish(collection, mats):
    length, height, width = 0.35, 0.14, 0.08
    uv = (0.0, 0.0, 1.0, 1.0)
    tail_root = -length * 0.20

    body = MeshBuilder()
    add_body_surface(body, length, height, width, tail_root, length * 0.50, 30, 13, 0, uv, 0.06)
    add_double_fin(body, [(0.0, height * 0.38, length * 0.33), (0.0, height * 0.72, length * 0.02), (0.0, height * 0.40, -length * 0.20)], 0, uv)
    add_double_fin(body, [(width * 0.45, -height * 0.02, length * 0.14), (width * 1.25, -height * 0.27, length * 0.00), (width * 0.48, -height * 0.24, -length * 0.10)], 0, uv)
    add_double_fin(body, [(-width * 0.45, -height * 0.02, length * 0.14), (-width * 1.25, -height * 0.27, length * 0.00), (-width * 0.48, -height * 0.24, -length * 0.10)], 0, uv)
    add_double_fin(body, [(0.0, -height * 0.33, length * 0.10), (0.0, -height * 0.54, -length * 0.02), (0.0, -height * 0.33, -length * 0.15)], 0, uv)
    add_eye(body, 1.0, width * 0.49, height * 0.12, length * 0.32, height * 0.085)
    add_eye(body, -1.0, width * 0.49, height * 0.12, length * 0.32, height * 0.085)
    body_obj = body.make_object("fishL_body", mats, collection)

    tail = MeshBuilder()
    add_fish_tail(tail, 0.0, -length * 0.30, height * 1.45, width * 2.20, 0, uv)
    tail_obj = tail.make_object("fishL_tail", mats[:1], collection, location=(0.0, 0.0, tail_root))
    return [body_obj, tail_obj]


def create_jellyfish(collection, mats):
    radius, height = 0.18, 0.12
    umbrella = MeshBuilder()
    seg, rings = 32, 10
    ring_indices = []
    uv = (0.0, 0.0, 1.0, 0.6)
    top = umbrella.v((0.0, 0.0, 0.0))
    for r in range(1, rings + 1):
        t = r / rings
        theta = t * math.pi / 2.0
        y = -height * (1.0 - math.cos(theta))
        rr = radius * math.sin(theta) * (1.0 - 0.12 * t)
        ring = []
        for s in range(seg):
            a = math.tau * s / seg
            ring.append(umbrella.v((math.cos(a) * rr, y, math.sin(a) * rr)))
        ring_indices.append(ring)
    for s in range(seg):
        s2 = (s + 1) % seg
        umbrella.tri(top, ring_indices[0][s], ring_indices[0][s2], 0,
                     (uv_rect(uv, 0.5, 0.0), uv_rect(uv, s / seg, 0.1), uv_rect(uv, s2 / seg, 0.1)))
    for r in range(len(ring_indices) - 1):
        a_ring = ring_indices[r]
        b_ring = ring_indices[r + 1]
        for s in range(seg):
            s2 = (s + 1) % seg
            umbrella.quad(a_ring[s], a_ring[s2], b_ring[s2], b_ring[s], 0,
                          (uv_rect(uv, s / seg, r / rings), uv_rect(uv, s2 / seg, r / rings),
                           uv_rect(uv, s2 / seg, (r + 1) / rings), uv_rect(uv, s / seg, (r + 1) / rings)))
    umbrella_obj = umbrella.make_object("jelly_umbrella", mats, collection)

    tentacles = MeshBuilder()
    uv_t = (0.0, 0.6, 1.0, 1.0)
    count, path_steps, radial = 7, 7, 4
    for i in range(count):
        angle = math.tau * i / count
        base_x = math.cos(angle) * radius * 0.46
        base_z = math.sin(angle) * radius * 0.46
        rings_ids = []
        for p in range(path_steps + 1):
            t = p / path_steps
            wave = math.sin(t * math.tau * 1.2 + i * 0.7) * 0.018 * t
            cx = base_x + math.cos(angle + math.pi / 2.0) * wave
            cz = base_z + math.sin(angle + math.pi / 2.0) * wave
            cy = -0.22 * t
            rr = lerp(0.006, 0.0025, t)
            ring = []
            for r in range(radial):
                a = math.tau * r / radial
                ring.append(tentacles.v((cx + math.cos(a) * rr, cy, cz + math.sin(a) * rr)))
            rings_ids.append(ring)
        for p in range(path_steps):
            for r in range(radial):
                r2 = (r + 1) % radial
                tentacles.quad(rings_ids[p][r], rings_ids[p][r2], rings_ids[p + 1][r2], rings_ids[p + 1][r], 0,
                               (uv_rect(uv_t, r / radial, p / path_steps), uv_rect(uv_t, r2 / radial, p / path_steps),
                                uv_rect(uv_t, r2 / radial, (p + 1) / path_steps), uv_rect(uv_t, r / radial, (p + 1) / path_steps)))
    tentacle_obj = tentacles.make_object("jelly_tentacles", mats, collection, location=(0.0, -height * 0.92, 0.0))
    return [umbrella_obj, tentacle_obj]


def create_whale(collection, mats):
    length, height, width = 3.0, 0.70, 0.50
    uv = (0.0, 0.0, 0.80, 1.0)
    body = MeshBuilder()
    add_body_surface(body, length, height, width, -1.24, 1.50, 40, 16, 0, uv, 0.12)
    add_double_fin(body, [(0.0, height * 0.42, -0.12), (0.0, height * 0.82, -0.28), (0.0, height * 0.40, -0.52)], 0, uv)
    add_eye(body, 1.0, width * 0.48, height * 0.11, 0.94, 0.035)
    add_eye(body, -1.0, width * 0.48, height * 0.11, 0.94, 0.035)
    body_obj = body.make_object("whale_body", mats, collection)

    fin_uv = (0.80, 0.0, 1.0, 1.0)
    tail = MeshBuilder()
    root = tail.v((0.0, 0.0, 0.0))
    left_tip = tail.v((-0.40, 0.0, -0.19))
    right_tip = tail.v((0.40, 0.0, -0.19))
    notch = tail.v((0.0, 0.0, -0.30))
    left_inner = tail.v((-0.07, 0.0, -0.15))
    right_inner = tail.v((0.07, 0.0, -0.15))
    tail.double_tri(root, left_inner, left_tip, 0)
    tail.double_tri(root, right_tip, right_inner, 0)
    tail.double_tri(left_inner, notch, left_tip, 0)
    tail.double_tri(right_inner, right_tip, notch, 0)
    tail_obj = tail.make_object("whale_tail", [mats[0]], collection, location=(0.0, 0.0, -1.24))

    def pectoral(side: float, name: str):
        fin = MeshBuilder()
        shoulder = fin.v((0.0, 0.0, 0.0))
        tip = fin.v((side * 0.60, -0.05, -0.20))
        back = fin.v((side * 0.18, -0.04, -0.42))
        front = fin.v((side * 0.12, 0.02, 0.10))
        fin.double_tri(shoulder, tip, front, 0)
        fin.double_tri(shoulder, back, tip, 0)
        return fin.make_object(name, [mats[0]], collection, location=(side * width * 0.45, -0.04, 0.50))

    return [body_obj, tail_obj, pectoral(-1.0, "whale_pectoral_L"), pectoral(1.0, "whale_pectoral_R")]


def make_collection(name: str):
    coll = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(coll)
    return coll


def export_model(filename: str, objects) -> None:
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.export_scene.gltf(
        filepath=str(MODEL_DIR / filename),
        export_format="GLB",
        use_selection=True,
        export_texcoords=True,
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
        export_draco_texcoord_quantization=12,
        export_draco_color_quantization=10,
        export_draco_generic_quantization=12,
        export_image_format="AUTO",
        export_extras=True,
        export_yup=True,
        export_apply=False,
        check_existing=False,
    )


def triangle_total(objects) -> int:
    return sum(int(obj.get("mro_triangles", 0)) for obj in objects)


def main() -> None:
    ensure_dirs()
    reset_scene()
    images = build_textures()

    fish_atlas_mat = texture_material("mat_fish_sm_atlas", images["atlas_fish_sm"], 0.78)
    fish_l_mat = texture_material("mat_fish_large", images["tex_fish_L"], 0.78)
    jelly_mat = texture_material("mat_jellyfish", images["tex_jellyfish"], 0.82, alpha=0.65, emissive=True)
    whale_mat = texture_material("mat_whale", images["tex_whale"], 0.85)
    eye_mat = flat_material("mat_eye_black", (0.015, 0.018, 0.025, 1.0), 0.7)
    eye_hi = flat_material("mat_eye_highlight", (1.0, 1.0, 0.92, 1.0), 0.65)

    fish_s = make_collection("fish_small")
    fish_m = make_collection("fish_medium")
    fish_l = make_collection("fish_large")
    jelly = make_collection("jellyfish")
    whale = make_collection("whale")

    fish_s_objs = [create_fish("fish_small", "fishS_body", 0.08, 0.035, 0.020, 16, 8,
                               [fish_atlas_mat, eye_mat, eye_hi], fish_s, (0.0, 0.0, 0.5, 1.0), 0.22)]
    fish_m_objs = [create_fish("fish_medium", "fishM_body", 0.18, 0.075, 0.045, 24, 10,
                               [fish_atlas_mat, eye_mat, eye_hi], fish_m, (0.5, 0.0, 1.0, 1.0), 0.08, True)]
    fish_l_objs = create_large_fish(fish_l, [fish_l_mat, eye_mat, eye_hi])
    jelly_objs = create_jellyfish(jelly, [jelly_mat])
    whale_objs = create_whale(whale, [whale_mat, eye_mat, eye_hi])

    exports = {
        "fish_small.glb": fish_s_objs,
        "fish_medium.glb": fish_m_objs,
        "fish_large.glb": fish_l_objs,
        "jellyfish.glb": jelly_objs,
        "whale.glb": whale_objs,
    }
    for filename, objects in exports.items():
        export_model(filename, objects)

    source_path = SOURCE_DIR / "mroceans_creatures.blend"
    bpy.ops.wm.save_as_mainfile(filepath=str(source_path))

    print("Generated GLB assets")
    for filename, objects in exports.items():
        size = (MODEL_DIR / filename).stat().st_size
        print(f"  {filename}: {triangle_total(objects)} tri, {size} bytes")
    print(f"  source: {source_path}")


if __name__ == "__main__":
    main()
