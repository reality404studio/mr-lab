from __future__ import annotations

import json
import struct
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
MODEL_DIR = ROOT / "assets" / "models"

EXPECTED = {
    "fish_small.glb": ["fishS_body"],
    "fish_medium.glb": ["fishM_body"],
    "fish_large.glb": ["fishL_body", "fishL_tail"],
    "jellyfish.glb": ["jelly_umbrella", "jelly_tentacles"],
    "whale.glb": ["whale_body", "whale_tail", "whale_pectoral_L", "whale_pectoral_R"],
}

TARGET_BYTES = {
    "fish_small.glb": 30 * 1024,
    "fish_medium.glb": 60 * 1024,
    "fish_large.glb": 120 * 1024,
    "jellyfish.glb": 70 * 1024,
    "whale.glb": 350 * 1024,
}


def read_glb(path: Path):
    data = path.read_bytes()
    magic, version, total_len = struct.unpack_from("<III", data, 0)
    if magic != 0x46546C67:
        raise ValueError(f"{path.name}: not a GLB file")
    if version != 2:
        raise ValueError(f"{path.name}: unsupported GLB version {version}")
    if total_len != len(data):
        raise ValueError(f"{path.name}: header length mismatch")
    offset = 12
    json_doc = None
    while offset < len(data):
        chunk_len, chunk_type = struct.unpack_from("<II", data, offset)
        offset += 8
        chunk = data[offset:offset + chunk_len]
        offset += chunk_len
        if chunk_type == 0x4E4F534A:
            json_doc = json.loads(chunk.decode("utf-8"))
    if json_doc is None:
        raise ValueError(f"{path.name}: JSON chunk missing")
    return json_doc, len(data)


def mesh_uses_draco(doc, mesh_index: int) -> bool:
    mesh = doc.get("meshes", [])[mesh_index]
    for primitive in mesh.get("primitives", []):
        if "KHR_draco_mesh_compression" not in primitive.get("extensions", {}):
            return False
    return True


def inspect_file(path: Path) -> list[str]:
    errors = []
    doc, size = read_glb(path)
    expected_nodes = set(EXPECTED[path.name])
    actual_nodes = {node.get("name") for node in doc.get("nodes", []) if node.get("name")}
    missing = expected_nodes - actual_nodes
    if missing:
        errors.append(f"missing nodes: {sorted(missing)}")

    if doc.get("animations"):
        errors.append("animations exported")
    if doc.get("cameras"):
        errors.append("cameras exported")
    if doc.get("lights") or doc.get("extensions", {}).get("KHR_lights_punctual"):
        errors.append("lights exported")

    for node in doc.get("nodes", []):
        name = node.get("name")
        if name in expected_nodes and "mesh" in node:
            if not mesh_uses_draco(doc, node["mesh"]):
                errors.append(f"{name}: missing Draco compression")

    if size > TARGET_BYTES[path.name]:
        errors.append(f"size {size} exceeds target {TARGET_BYTES[path.name]}")

    images = doc.get("images", [])
    for image in images:
        if "uri" in image:
            errors.append(f"external image reference: {image['uri']}")

    print(f"{path.name}: {size} bytes, nodes={sorted(actual_nodes & expected_nodes)}, images={len(images)}")
    return errors


def main() -> int:
    all_errors = []
    for name in EXPECTED:
        path = MODEL_DIR / name
        if not path.exists():
            all_errors.append(f"{name}: file missing")
            continue
        errors = inspect_file(path)
        all_errors.extend(f"{name}: {e}" for e in errors)
    if all_errors:
        print("\nFAILED")
        for error in all_errors:
            print(f"- {error}")
        return 1
    print("\nOK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

