"""The optional SymPy backends that the CAS engine does not vendor, refused at import.

SymPy probes optional packages through sympy.external.import_module, which treats an
ImportError as absence and falls back to its own algorithm. Some probes run lazily, at
the first call that could use the package. In the Worker, such a call runs in a Durable
Object restored from the deploy-time memory snapshot, where the import system can no
longer read the standard library archive /lib/python313.zip: a probe for a package that
is not installed reaches that archive's importer and fails with OSError (Errno 8, Bad
file descriptor) instead of ImportError. Workers Logs recorded it on 24 October 2026:
solving x^x * (ln(x) + 1) = 0 asks whether x^x is nonzero, and SymPy's satisfiable()
probes pycosat.

A finder at the front of sys.meta_path refuses every absent backend with
ModuleNotFoundError before any other importer runs, the same answer CPython gives when
the package is missing. tests/backends_test.py derives the list from the vendored SymPy
source, so an upgrade that probes a new package fails there.
"""

import sys
from collections.abc import Sequence
from importlib.abc import MetaPathFinder
from importlib.machinery import ModuleSpec
from types import ModuleType

# Every top-level package that the vendored SymPy 1.14.0 names in import_module, other
# than SymPy itself and its vendored dependency mpmath.
ABSENT_BACKENDS = frozenset(
    {
        "IPython",
        "aesara",
        "antlr4",
        "clang",
        "cupy",
        "flint",
        "gmpy",
        "gmpy2",
        "jax",
        "lark",
        "lfortran",
        "llvmlite",
        "matchpy",
        "matplotlib",
        "mpl_toolkits",
        "numexpr",
        "numpy",
        "pycosat",
        "pyglet",
        "pymc3",
        "pysat",
        "scipy",
        "tensorflow",
        "theano",
        "torch",
        "z3",
    }
)


class AbsentBackendFinder(MetaPathFinder):
    """Refuses the absent backends and leaves every other import to the next finder."""

    def find_spec(
        self,
        fullname: str,
        path: Sequence[str] | None,
        target: ModuleType | None = None,
    ) -> ModuleSpec | None:
        if fullname.partition(".")[0] in ABSENT_BACKENDS:
            raise ModuleNotFoundError(f"No module named {fullname!r}", name=fullname)
        return None


def refuse_absent_backends() -> None:
    """Put the finder first on sys.meta_path, once, before any lazy import."""
    if not any(isinstance(finder, AbsentBackendFinder) for finder in sys.meta_path):
        sys.meta_path.insert(0, AbsentBackendFinder())
