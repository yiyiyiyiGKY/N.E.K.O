from __future__ import annotations

import json
from pathlib import Path

from scripts.check_nuitka_dist import _check_unity_avatar_build


def _write_build(dist_root: Path) -> tuple[Path, dict[str, object]]:
    avatar_root = dist_root / "static/unity/avatar"
    build_root = avatar_root / "Build"
    build_root.mkdir(parents=True)
    manifest: dict[str, object] = {
        "version": 1,
        "loaderUrl": "/static/unity/avatar/Build/avatar.loader.js",
        "dataUrl": "/static/unity/avatar/Build/avatar.data",
        "frameworkUrl": "/static/unity/avatar/Build/avatar.framework.js",
        "codeUrl": "/static/unity/avatar/Build/avatar.wasm",
    }
    for url in manifest.values():
        if not isinstance(url, str):
            continue
        target = avatar_root / url.removeprefix("/static/unity/avatar/")
        target.write_bytes(b"unity")
    (avatar_root / "build-manifest.json").write_text(
        json.dumps(manifest), encoding="utf-8"
    )
    return avatar_root, manifest


def test_packaged_unity_manifest_resolves_all_build_files(tmp_path: Path) -> None:
    _write_build(tmp_path)

    assert _check_unity_avatar_build(tmp_path) == []


def test_packaged_unity_manifest_rejects_missing_hashed_file(tmp_path: Path) -> None:
    avatar_root, manifest = _write_build(tmp_path)
    missing_url = str(manifest["codeUrl"])
    (avatar_root / missing_url.removeprefix("/static/unity/avatar/")).unlink()

    assert _check_unity_avatar_build(tmp_path) == [
        f"missing or empty Unity avatar build file: {missing_url}"
    ]


def test_packaged_unity_manifest_rejects_path_outside_avatar_root(tmp_path: Path) -> None:
    avatar_root, manifest = _write_build(tmp_path)
    manifest["codeUrl"] = "/static/unity/avatar/../../outside.wasm"
    (avatar_root / "build-manifest.json").write_text(
        json.dumps(manifest), encoding="utf-8"
    )

    assert _check_unity_avatar_build(tmp_path) == [
        "invalid Unity avatar build manifest: codeUrl escapes avatar root"
    ]
