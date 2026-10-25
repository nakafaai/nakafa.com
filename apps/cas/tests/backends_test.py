"""The absent optional backends are refused before any importer runs.

The list is checked against the vendored SymPy source, because a probe that the list
misses fails only inside a Worker restored from its memory snapshot.
"""

import importlib
import re
import sys
from collections.abc import Iterator, Sequence
from importlib.abc import MetaPathFinder
from importlib.machinery import ModuleSpec
from pathlib import Path
from types import ModuleType

import pytest
import sympy as sp

from cas.backends import ABSENT_BACKENDS, AbsentBackendFinder, refuse_absent_backends
from cas.engine import run
from cas.schema import MathRequest

VENDORED = {"mpmath", "sympy"}
PROBE = re.compile(r"""import_module\(\s*['"]([A-Za-z0-9_.]+)['"]""")


@pytest.fixture
def refused() -> Iterator[None]:
    """Installs the finder for one test and restores the import system afterwards."""
    finders = list(sys.meta_path)
    refuse_absent_backends()
    yield
    sys.meta_path[:] = finders


def probed_top_level_names() -> set[str]:
    root = Path(sp.__file__).parent
    names: set[str] = set()
    for source in root.rglob("*.py"):
        if "tests" in source.relative_to(root).parts:
            continue
        for match in PROBE.finditer(source.read_text(encoding="utf-8")):
            names.add(match.group(1).partition(".")[0])
    return names


def test_lists_every_optional_backend_that_sympy_probes() -> None:
    assert probed_top_level_names() - VENDORED == ABSENT_BACKENDS


@pytest.mark.usefixtures("refused")
def test_refuses_an_absent_backend_before_any_other_importer() -> None:
    consulted: list[str] = []

    class Spy(MetaPathFinder):
        def find_spec(
            self,
            fullname: str,
            path: Sequence[str] | None,
            target: ModuleType | None = None,
        ) -> ModuleSpec | None:
            consulted.append(fullname)
            return None

    sys.meta_path.insert(1, Spy())
    with pytest.raises(ModuleNotFoundError) as refused_import:
        importlib.import_module("pycosat")
    assert refused_import.value.name == "pycosat"
    assert consulted == []


@pytest.mark.usefixtures("refused")
def test_leaves_other_imports_to_the_next_finder() -> None:
    assert importlib.import_module("json").dumps([1]) == "[1]"


@pytest.mark.usefixtures("refused")
def test_installs_one_finder_at_the_front() -> None:
    refuse_absent_backends()
    finders = [f for f in sys.meta_path if isinstance(f, AbsentBackendFinder)]
    assert len(finders) == 1
    assert isinstance(sys.meta_path[0], AbsentBackendFinder)


@pytest.mark.usefixtures("refused")
def test_solves_the_snapshot_failure_body_with_the_backends_refused() -> None:
    result = run(
        MathRequest(
            expression="x^x * (ln(x) + 1) = 0",
            kind="math",
            operation="solve",
            variable="x",
        )
    )

    assert result.status == "inconclusive"
