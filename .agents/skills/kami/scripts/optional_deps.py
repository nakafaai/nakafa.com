"""Centralized loader for optional third-party deps (weasyprint, pypdf, PyMuPDF).

build.py previously had inline `from weasyprint import HTML` try/except blocks
with duplicated install hints; this module collapses those into one resolver
each so the import error message stays consistent and the WeasyPrint runtime
is configured once at the import call site.
"""
from __future__ import annotations

import importlib
import importlib.metadata
import shutil
import subprocess
import sys

from shared import ROOT, configure_weasyprint_runtime, kami_version

# On Linux, WeasyPrint links against cairo / pango / harfbuzz at runtime; a bare
# `pip install weasyprint` succeeds but then fails to load with a cryptic
# "cannot load library 'libgobject-2.0'" until the native libs are present. Spell
# them out so the error message is actionable on a fresh Linux box.
_LINUX_NATIVE_LIBS = (
    "Linux also needs native libs: "
    "sudo apt-get install -y libcairo2 libpango-1.0-0 libpangoft2-1.0-0 libharfbuzz0b "
    "(Debian/Ubuntu), or `sudo dnf install cairo pango harfbuzz` (Fedora/RHEL)"
)

WEASYPRINT_INSTALL_HINT = "pip install weasyprint pypdf --break-system-packages"
if sys.platform.startswith("linux"):
    WEASYPRINT_INSTALL_HINT = f"{WEASYPRINT_INSTALL_HINT}. {_LINUX_NATIVE_LIBS}"
PYMUPDF_INSTALL_HINT = "pip install pymupdf --break-system-packages"


class MissingDepError(RuntimeError):
    """Raised when an optional dependency is requested but not installed."""


def require_weasyprint_html():
    """Return the weasyprint.HTML class, configuring native libs first."""
    configure_weasyprint_runtime()
    try:
        from weasyprint import HTML
        return HTML
    except ImportError as exc:
        raise MissingDepError(
            f"missing weasyprint. {WEASYPRINT_INSTALL_HINT}"
        ) from exc


def _require_pypdf_attr(name: str):
    try:
        import pypdf
    except ImportError as exc:
        raise MissingDepError(
            f"missing pypdf. {WEASYPRINT_INSTALL_HINT}"
        ) from exc
    return getattr(pypdf, name)


def require_pypdf_reader():
    """Return the pypdf.PdfReader class."""
    return _require_pypdf_attr("PdfReader")


def require_pypdf_writer():
    """Return the pypdf.PdfWriter class."""
    return _require_pypdf_attr("PdfWriter")


def require_pymupdf():
    """Return the PyMuPDF module (imported as fitz)."""
    try:
        import fitz
        return fitz
    except ImportError as exc:
        raise MissingDepError(
            f"missing PyMuPDF. {PYMUPDF_INSTALL_HINT}"
        ) from exc


def _distribution_version(name: str) -> str | None:
    try:
        return importlib.metadata.version(name)
    except importlib.metadata.PackageNotFoundError:
        return None


def _probe_dependency(
    name: str,
    distribution: str,
    purpose: str,
    loader,
    *,
    required: bool,
) -> dict:
    try:
        loader()
    except MissingDepError as exc:
        return {
            "name": name,
            "status": "missing",
            "required": required,
            "purpose": purpose,
            "version": _distribution_version(distribution),
            "detail": str(exc),
        }
    except Exception as exc:
        return {
            "name": name,
            "status": "degraded",
            "required": required,
            "purpose": purpose,
            "version": _distribution_version(distribution),
            "detail": f"import failed: {type(exc).__name__}: {exc}",
        }
    return {
        "name": name,
        "status": "available",
        "required": required,
        "purpose": purpose,
        "version": _distribution_version(distribution),
    }


def _probe_module(name: str):
    return importlib.import_module(name)


def _probe_font(family: str, bundled_names: tuple[str, ...], purpose: str) -> dict:
    font_dir = ROOT / "assets" / "fonts"
    bundled = [name for name in bundled_names if (font_dir / name).is_file()]
    matched = None
    matcher = shutil.which("fc-match")
    if matcher:
        try:
            result = subprocess.run(
                [matcher, "-f", "%{family}\n", family],
                capture_output=True,
                text=True,
                timeout=5,
                check=False,
            )
            if result.returncode == 0:
                matched = (result.stdout.splitlines() or [""])[0].strip() or None
        except (OSError, subprocess.TimeoutExpired):
            matched = None
    resolved = bool(matched and family.casefold() in matched.casefold())
    status = "available" if bundled or resolved else "unconfirmed"
    return {
        "name": family,
        "status": status,
        "purpose": purpose,
        "bundled": bundled,
        "fontconfig_match": matched,
        "detail": (
            None if status == "available"
            else "not bundled and fontconfig did not confirm the requested family"
        ),
    }


def doctor_report() -> dict:
    """Return installed render, verification, and font capabilities.

    Required dependencies define whether the normal HTML -> PDF -> visual
    verification path is ready. Editable PPTX and language-specific font
    families are reported separately so an unavailable optional path cannot be
    mistaken for a clean check or for a broken core install.
    """
    dependencies = [
        _probe_dependency(
            "weasyprint", "weasyprint", "HTML to PDF rendering",
            require_weasyprint_html, required=True,
        ),
        _probe_dependency(
            "pypdf", "pypdf", "PDF text, metadata, and page checks",
            require_pypdf_reader, required=True,
        ),
        _probe_dependency(
            "pymupdf", "PyMuPDF", "page screenshots, density, and orphan checks",
            require_pymupdf, required=True,
        ),
        _probe_dependency(
            "python-pptx", "python-pptx", "editable PPTX fallback",
            lambda: _probe_module("pptx"), required=False,
        ),
        _probe_dependency(
            "pygments", "Pygments", "build-time code highlighting",
            lambda: _probe_module("pygments"), required=False,
        ),
    ]
    fonts = [
        _probe_font(
            "JetBrains Mono", ("JetBrainsMono.woff2",),
            "code and metadata labels",
        ),
        _probe_font(
            "TsangerJinKai02", ("TsangerJinKai02-W04.ttf", "TsangerJinKai02-W05.ttf"),
            "primary Chinese editorial serif",
        ),
        _probe_font(
            "Source Han Serif KR",
            ("SourceHanSerifKR-Regular.otf", "SourceHanSerifKR-Medium.otf"),
            "Korean editorial serif fallback",
        ),
    ]
    required_ready = all(
        item["status"] == "available"
        for item in dependencies
        if item["required"]
    )
    return {
        "version": kami_version(),
        "ok": required_ready,
        "dependencies": dependencies,
        "fonts": fonts,
        "capabilities": {
            "pdf_render": all(
                item["status"] == "available"
                for item in dependencies
                if item["name"] in {"weasyprint", "pypdf"}
            ),
            "pdf_visual_review": all(
                item["status"] == "available"
                for item in dependencies
                if item["name"] in {"pypdf", "pymupdf"}
            ),
            "editable_pptx": next(
                item["status"] == "available"
                for item in dependencies
                if item["name"] == "python-pptx"
            ),
        },
    }


def run_doctor() -> int:
    report = doctor_report()
    print(f"Kami doctor {report['version']}")
    for item in report["dependencies"]:
        label = "OK" if item["status"] == "available" else item["status"].upper()
        version = f" {item['version']}" if item.get("version") else ""
        print(f"{label}: {item['name']}{version}: {item['purpose']}")
        if item.get("detail"):
            print(f"  {item['detail']}")
    for item in report["fonts"]:
        label = "OK" if item["status"] == "available" else item["status"].upper()
        source = "bundled" if item["bundled"] else (item.get("fontconfig_match") or "not confirmed")
        print(f"{label}: font {item['name']}: {source}")
    print("OK: core render and visual verification ready" if report["ok"] else "ERROR: core capability missing or degraded")
    return 0 if report["ok"] else 1
