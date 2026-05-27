from __future__ import annotations

from pathlib import Path

import bpy


ROOT = Path(__file__).resolve().parents[2]
MODEL_DIR = ROOT / "assets" / "models"

EXPECTED = {
    "fish_small.glb": {"nodes": ["fishS_body"], "max_tri": 400},
    "fish_medium.glb": {"nodes": ["fishM_body"], "max_tri": 1000},
    "fish_large.glb": {"nodes": ["fishL_body", "fishL_tail"], "max_tri": 2500},
    "jellyfish.glb": {"nodes": ["jelly_umbrella", "jelly_tentacles"], "max_tri": 1000},
    "whale.glb": {"nodes": ["whale_body", "whale_tail", "whale_pectoral_L", "whale_pectoral_R"], "max_tri": 4000},
}


def reset_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()
    for datablocks in (bpy.data.meshes, bpy.data.materials, bpy.data.images):
        for block in list(datablocks):
            datablocks.remove(block)


def object_triangles(obj) -> int:
    return sum(max(len(poly.vertices) - 2, 0) for poly in obj.data.polygons)


def main() -> int:
    errors = []
    for filename, spec in EXPECTED.items():
        reset_scene()
        path = MODEL_DIR / filename
        if not path.exists():
            errors.append(f"{filename}: missing")
            continue
        bpy.ops.import_scene.gltf(filepath=str(path))
        meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
        names = sorted(obj.name for obj in meshes)
        missing = sorted(set(spec["nodes"]) - set(names))
        tri = sum(object_triangles(obj) for obj in meshes)
        if missing:
            errors.append(f"{filename}: missing nodes {missing}")
        if tri > spec["max_tri"]:
            errors.append(f"{filename}: {tri} tri exceeds {spec['max_tri']}")
        print(f"{filename}: {tri} tri, nodes={names}")
    if errors:
        print("\nFAILED")
        for error in errors:
            print(f"- {error}")
        return 1
    print("\nOK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

