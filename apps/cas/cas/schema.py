"""Pydantic contracts for the Nakafa CAS HTTP API."""

import re
from typing import Annotated, Literal

from pydantic import (
    AfterValidator,
    BaseModel,
    ConfigDict,
    Field,
    field_serializer,
    model_validator,
)

# Complexity bounds. A bound limits the work that a request causes, not only the
# length of its text. SymPy computes powers, factorials, sums, series, expansions,
# and determinants eagerly, so a request beyond a bound is refused before SymPy
# builds the value: here for text and tokens, in cas/work.py for computed values and
# shapes, and in the operation that owns the value. The bounds follow the corpus at
# ten times its largest value where a measured Pyodide worst case allows it, and
# docs/adr/0037-cloudflare.md records the measurement behind every other bound.
MAX_INTEGER_DIGITS = 30
MAX_EXPONENT = 70
MAX_DEGREE = 70
MAX_DENOMINATOR_DEGREE = 6
MAX_EXPANSION_TERMS = 2000
MAX_EXPRESSION_TOKENS = 200
MAX_MATRIX_DIMENSION = 30
MAX_SYMBOLIC_MATRIX_DIMENSION = 3
MAX_DERIVATIVE_ORDER = 20
MAX_SERIES_ORDER = 60
MAX_TRANSCENDENTAL_SERIES_ORDER = 8
MAX_COUNT_OPERAND = 50
MAX_BINOMIAL_TRIALS = 100
MAX_POISSON_BOUND = 100
MAX_SUMMATION_TERMS = 40
MAX_SYSTEM_WORK = 40
MAX_NONLINEAR_UNKNOWNS = 2

DIGIT_RUN = re.compile(r"\d+")
# A token is one number, name, or operator, so the count approximates the node
# count of the expression without parsing it.
EXPRESSION_TOKEN = re.compile(r"\d+(?:\.\d+)?|[A-Za-z_]\w*|\*\*|[-+*/^!=<>(),]")


def _refuse_beyond_bounds(text: str) -> str:
    """Refuse a text value whose digit runs or token count exceed a bound."""
    # A lexical digit rule suffices for a literal. Exponents and computed integers
    # need their values, which cas/parse.py reads from the tree.
    if any(len(run) > MAX_INTEGER_DIGITS for run in DIGIT_RUN.findall(text)):
        raise ValueError(
            f"A number may have at most {MAX_INTEGER_DIGITS} digits in each part."
        )
    if len(EXPRESSION_TOKEN.findall(text)) > MAX_EXPRESSION_TOKENS:
        raise ValueError(
            f"An expression may have at most {MAX_EXPRESSION_TOKENS} tokens."
        )
    return text


# School calculations keep each operand readable and each collection modest.
MathText = Annotated[str, Field(max_length=2048), AfterValidator(_refuse_beyond_bounds)]
MathValues = Annotated[list[MathText], Field(max_length=128)]
MathMatrixRow = Annotated[list[MathText], Field(max_length=MAX_MATRIX_DIMENSION)]
MathMatrix = Annotated[list[MathMatrixRow], Field(max_length=MAX_MATRIX_DIMENSION)]

MathStatus = Literal["verified", "contradicted", "inconclusive"]
MathSource = Literal["math"]
MathStepStatus = Literal["complete", "partial", "unavailable"]

# Every label a math item may carry. The web app gives each one a translation
# key, and tests/schema_test.py fails when this list and the one in
# packages/math/schema/shared.ts differ. A new label reaches learners in this
# order: the app that accepts it first, then the CAS that emits it.
MathItemLabel = Literal[
    "algebraic_multiplicity",
    "approximation",
    "counterexample",
    "diagonalizable",
    "domain",
    "eigenbasis",
    "eigenvalue",
    "eigenvector",
    "factor",
    "geometric_multiplicity",
    "mode",
    "q1",
    "q2",
    "q3",
    "root",
    "singularity",
    "solution",
    "status",
]


class PointInput(BaseModel):
    """Two-dimensional point payload accepted by geometry operations."""

    model_config = ConfigDict(extra="forbid")

    x: MathText
    y: MathText


class MathRequest(BaseModel):
    """Single fixed-operation math request accepted by the CAS API."""

    # Extra fields are forbidden so the AI/tool contract cannot silently drift.
    # https://docs.pydantic.dev/latest/concepts/models/#extra-data
    model_config = ConfigDict(extra="forbid")

    kind: MathSource
    operation: MathText
    expression: MathText | None = None
    expressions: MathValues = Field(default_factory=list)
    inclusive: bool | None = None
    left: MathText | None = None
    right: MathText | None = None
    variable: MathText | None = None
    variables: MathValues = Field(default_factory=list)
    point: MathText | None = None
    order: int | None = None
    lower: MathText | None = None
    lowerInclusive: bool | None = None
    upper: MathText | None = None
    upperInclusive: bool | None = None
    matrix: MathMatrix = Field(default_factory=list)
    right_matrix: MathMatrix = Field(default_factory=list)
    vector: MathValues = Field(default_factory=list)
    values: MathValues = Field(default_factory=list)
    points: list[PointInput] = Field(default_factory=list, max_length=128)
    distribution: MathText | None = None
    parameters: dict[MathText, MathText] = Field(default_factory=dict, max_length=16)
    modulus: MathText | None = None
    n: MathText | None = None
    k: MathText | None = None

    @model_validator(mode="after")
    def refuse_order_beyond_bound(self) -> "MathRequest":
        """Refuse a derivative or series order beyond the bound of its operation."""
        if self.order is None:
            return self
        if self.operation == "differentiate" and self.order > MAX_DERIVATIVE_ORDER:
            raise ValueError(f"Derivative order may be at most {MAX_DERIVATIVE_ORDER}.")
        if self.operation == "series" and self.order > MAX_SERIES_ORDER:
            raise ValueError(f"Series order may be at most {MAX_SERIES_ORDER}.")
        return self


class MathExpression(BaseModel):
    """String and LaTeX rendering for an expression-like value."""

    model_config = ConfigDict(extra="forbid")

    expression: str
    latex: str


class MathItem(BaseModel):
    """Labeled supporting item returned by operations with multiple outputs."""

    model_config = ConfigDict(extra="forbid")

    label: MathItemLabel
    value: str
    latex: str | None = None


class MathStep(BaseModel):
    """One deterministic transformation step produced by the CAS engine."""

    model_config = ConfigDict(extra="forbid")

    action: str
    primary: MathExpression
    relation: MathExpression | None = None
    secondary: MathExpression | None = None
    items: list[MathItem] = Field(default_factory=list)


class MathResult(BaseModel):
    """Deterministic CAS result returned to the TypeScript math service."""

    model_config = ConfigDict(extra="forbid")

    kind: str
    operation: str
    status: MathStatus
    input: MathRequest
    primary: MathExpression
    secondary: MathExpression | None = None
    items: list[MathItem] = Field(default_factory=list)
    conditions: list[MathExpression] = Field(default_factory=list)
    steps: list[MathStep] = Field(default_factory=list)
    stepStatus: MathStepStatus = "unavailable"
    reason: str

    @field_serializer("input")
    def compact_input(self, request: MathRequest) -> dict[str, object]:
        """Serialize only the request fields the caller intentionally sent."""
        # Keep result payloads compact by excluding defaults and None values.
        # https://docs.pydantic.dev/latest/concepts/serialization/
        return request.model_dump(exclude_defaults=True, exclude_none=True)
