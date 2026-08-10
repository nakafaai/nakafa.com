#!/usr/bin/env python3
"""Fail-closed identity and artifact checks for versioned releases."""
from __future__ import annotations

import argparse
import hashlib
import re
import subprocess
import sys
import zipfile
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
VERSION_RE = re.compile(r"\d+\.\d+\.\d+")


def release_identity_issues(
    tag: str,
    version: str,
    head_sha: str,
    tag_sha: str,
) -> list[str]:
    """Return identity mismatches that make a versioned release unsafe."""
    issues: list[str] = []
    if not VERSION_RE.fullmatch(version):
        issues.append(f"VERSION must be x.y.z, got {version!r}")
    expected_tag = f"V{version}"
    if tag != expected_tag:
        issues.append(f"tag {tag!r} does not match VERSION ({expected_tag})")
    if head_sha != tag_sha:
        issues.append(f"tag commit {tag_sha} does not match checkout HEAD {head_sha}")
    return issues


def _zip_payloads(path: Path) -> dict[str, str | None]:
    """Return the exact ZIP manifest and payloads, rejecting ambiguous names."""
    with zipfile.ZipFile(path) as archive:
        payloads: dict[str, str | None] = {}
        for info in archive.infolist():
            name = info.filename
            if name in payloads:
                raise ValueError(f"duplicate ZIP entry: {name}")
            payloads[name] = (
                None if info.is_dir()
                else hashlib.sha256(archive.read(info)).hexdigest()
            )
        return dict(sorted(payloads.items()))


def archive_payload_issues(tracked: Path, candidate: Path) -> list[str]:
    """Compare release archives by entry names and uncompressed payload bytes."""
    if not tracked.is_file():
        return [f"tracked archive not found: {tracked}"]
    if not candidate.is_file():
        return [f"candidate archive not found: {candidate}"]
    try:
        tracked_payloads = _zip_payloads(tracked)
        candidate_payloads = _zip_payloads(candidate)
    except (OSError, ValueError, zipfile.BadZipFile) as exc:
        return [f"could not read release archive: {exc}"]

    issues: list[str] = []
    tracked_names = set(tracked_payloads)
    candidate_names = set(candidate_payloads)
    for name in sorted(tracked_names - candidate_names):
        issues.append(f"candidate archive is missing {name}")
    for name in sorted(candidate_names - tracked_names):
        issues.append(f"candidate archive has extra entry {name}")
    for name in sorted(tracked_names & candidate_names):
        if tracked_payloads[name] != candidate_payloads[name]:
            issues.append(f"candidate payload differs: {name}")
    return issues


def _git(*args: str) -> str:
    result = subprocess.run(
        ["git", *args],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or f"git {' '.join(args)} failed")
    return result.stdout.strip()


def resolve_tag_commit(tag: str) -> str:
    """Resolve only the tag namespace, never a same-named branch or revision."""
    return _git("rev-parse", "--verify", f"refs/tags/{tag}^{{commit}}")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--tag", required=True, help="version tag being published")
    parser.add_argument("--tracked-archive", type=Path)
    parser.add_argument("--candidate-archive", type=Path)
    args = parser.parse_args(argv)

    try:
        version = (ROOT / "VERSION").read_text(encoding="utf-8").strip()
        head_sha = _git("rev-parse", "HEAD")
        tag_sha = resolve_tag_commit(args.tag)
    except (OSError, RuntimeError) as exc:
        print(f"ERROR: release identity could not be resolved: {exc}")
        return 2

    issues = release_identity_issues(args.tag, version, head_sha, tag_sha)
    if bool(args.tracked_archive) != bool(args.candidate_archive):
        issues.append("provide both --tracked-archive and --candidate-archive")
    elif args.tracked_archive and args.candidate_archive:
        issues.extend(archive_payload_issues(args.tracked_archive, args.candidate_archive))

    if issues:
        for issue in issues:
            print(f"ERROR: {issue}")
        return 1

    print(f"OK: release identity matches {args.tag} at {head_sha}")
    if args.tracked_archive:
        print("OK: candidate archive payloads match tracked dist/kami.zip")
    return 0


if __name__ == "__main__":
    sys.exit(main())
