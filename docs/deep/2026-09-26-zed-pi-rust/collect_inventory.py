#!/usr/bin/env python3
"""Read local manifests and Git metadata; never run Cargo or modify source repos."""
import argparse
import hashlib
import json
import subprocess
import tomllib
from datetime import datetime, timezone
from pathlib import Path


def command(root, *args):
    return subprocess.check_output(args, cwd=root, text=True).strip()


def manifest(path):
    return tomllib.loads(path.read_text())


def snapshot(root):
    return {
        "root": str(root),
        "head": command(root, "git", "rev-parse", "HEAD"),
        "commit_date": command(root, "git", "show", "-s", "--format=%cI", "HEAD"),
        "status": command(root, "git", "status", "--short").splitlines(),
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--zed", type=Path, default=Path("/Users/chp/explore/zed"))
    parser.add_argument("--pi", type=Path, default=Path("/Users/chp/codex/PI-Desktop"))
    parser.add_argument("--out", type=Path, default=Path(__file__).with_name("inventory.json"))
    args = parser.parse_args()
    zed, pi = args.zed.resolve(), args.pi.resolve()
    root = manifest(zed / "Cargo.toml")
    workspace = root["workspace"]
    members = workspace["members"]
    paths = sorted(set(members) | {
        str(p.parent.relative_to(zed)) for p in (zed / "crates").rglob("Cargo.toml")
        if "target" not in p.parts
    })
    packages = []
    for relative in paths:
        path = zed / relative / "Cargo.toml"
        data = manifest(path)
        package = data.get("package", {})
        record = {"path": relative, "name": package.get("name"),
                  "explicit_member": relative in members,
                  "version": package.get("version"), "license": package.get("license"),
                  "manifest_sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
                  "local_dependencies": []}
        tables = [(None, data)] + list(data.get("target", {}).items())
        for target, table in tables:
            for kind in ("dependencies", "dev-dependencies", "build-dependencies"):
                for alias, value in table.get(kind, {}).items():
                    if not isinstance(value, dict):
                        continue
                    inherited = value.get("workspace", False)
                    spec = workspace.get("dependencies", {}).get(alias, {}) if inherited else value
                    if not isinstance(spec, dict) or "path" not in spec:
                        continue
                    base = zed if inherited else path.parent
                    destination = (base / spec["path"]).resolve()
                    record["local_dependencies"].append({
                        "alias": alias, "package": spec.get("package", alias),
                        "path": str(destination.relative_to(zed)), "kind": kind,
                        "target": target, "optional": value.get("optional", False),
                        "features": sorted(set(spec.get("features", [])) | set(value.get("features", []))),
                    })
        packages.append(record)
    pi_root = manifest(pi / "Cargo.toml")
    pi_packages = []
    package_paths = command(pi, "rg", "--files", "--hidden", "-g", "package.json",
                            "-g", "!node_modules", "-g", "!target", "-g", "!.git",
                            "-g", "!dist", "-g", "!build").splitlines()
    for name in sorted(package_paths):
        data = json.loads((pi / name).read_text())
        pi_packages.append({"path": name, "name": data.get("name"), "version": data.get("version")})
    result = {
        "collected_at_utc": datetime.now(timezone.utc).isoformat(),
        "method": "Static TOML/JSON parsing of working trees. Explicit members and declared local dependency edges; NOT Cargo metadata, resolved features, binary size, runtime processes or compiled package counts. Target/dev/build edges remain labeled. No source repository writes.",
        "zed": {**snapshot(zed), "toolchain": manifest(zed / "rust-toolchain.toml"),
                "explicit_member_count": len(members),
                "explicit_members_under_crates": sum(p.startswith("crates/") for p in members),
                "crates_manifest_count": sum(p.startswith("crates/") for p in paths),
                "non_crates_members": [p for p in members if not p.startswith("crates/")],
                "crates_paths_not_explicit_members": [p for p in paths if p.startswith("crates/") and p not in members],
                "packages": packages},
        "pi_desktop": {**snapshot(pi), "rust_workspace": pi_root.get("workspace"),
                       "package_json_files": pi_packages},
    }
    args.out.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({"out": str(args.out), "zed_explicit_members": len(members),
                      "zed_crates_manifests": result["zed"]["crates_manifest_count"],
                      "pi_package_json_files": len(pi_packages)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
