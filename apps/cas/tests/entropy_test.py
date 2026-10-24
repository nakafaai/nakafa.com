"""The entropy allowance of entry.py covers the unseeded generators that SymPy makes.

The Worker's import allowance is a count of getentropy calls, and SymPy's import
creates the generators that make them. This test counts the generators in a fresh
interpreter, so a SymPy upgrade that adds one fails here before it fails a deploy.
"""

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
# Two unseeded generators in sympy/core/random.py and one in sympy/core/symbol.py.
UNSEEDED_GENERATORS = 3

COUNT_UNSEEDED = """
import random

unseeded = 0
original_seed = random.Random.seed


def counting_seed(self, a=None, version=2):
    global unseeded
    if a is None:
        unseeded += 1
    return original_seed(self, a, version)


random.Random.seed = counting_seed
import cas.compute  # noqa: E402

print(unseeded)
"""


def test_importing_the_engine_creates_the_counted_generators() -> None:
    result = subprocess.run(
        [sys.executable, "-c", COUNT_UNSEEDED],
        cwd=ROOT,
        check=True,
        capture_output=True,
        text=True,
    )

    assert int(result.stdout.strip()) == UNSEEDED_GENERATORS
