"""Pydantic contracts for the Nakafa CAS HTTP API."""

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, field_serializer

# School calculations keep each operand readable and each collection modest.
# These shape limits complement the process deadline: short expressions can still
# expand into expensive symbolic work, so shape validation is not a CPU budget.
MathText = Annotated[str, Field(max_length=2048)]
MathValues = Annotated[list[MathText], Field(max_length=128)]
MathMatrixRow = Annotated[list[MathText], Field(max_length=16)]
MathMatrix = Annotated[list[MathMatrixRow], Field(max_length=16)]

MathStatus = Literal["verified", "contradicted", "inconclusive"]
MathSource = Literal["math"]
MathStepStatus = Literal["complete", "partial", "unavailable"]


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
    order: int | None = Field(default=None, le=100)
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


class MathExpression(BaseModel):
    """String and LaTeX rendering for an expression-like value."""

    model_config = ConfigDict(extra="forbid")

    expression: str
    latex: str


class MathItem(BaseModel):
    """Labeled supporting item returned by operations with multiple outputs."""

    model_config = ConfigDict(extra="forbid")

    label: str
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
