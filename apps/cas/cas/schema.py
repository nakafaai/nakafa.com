"""Pydantic contracts for the Nakafa CAS HTTP API."""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_serializer

MathStatus = Literal["verified", "contradicted", "inconclusive"]
MathSource = Literal["math"]
MathStepStatus = Literal["complete", "partial", "unavailable"]


class PointInput(BaseModel):
    """Two-dimensional point payload accepted by geometry operations."""

    model_config = ConfigDict(extra="forbid")

    x: str
    y: str


class MathRequest(BaseModel):
    """Single fixed-operation math request accepted by the CAS API."""

    # Extra fields are forbidden so the AI/tool contract cannot silently drift.
    # https://docs.pydantic.dev/latest/concepts/models/#extra-data
    model_config = ConfigDict(extra="forbid")

    kind: MathSource
    operation: str
    expression: str | None = None
    expressions: list[str] = Field(default_factory=list)
    inclusive: bool | None = None
    left: str | None = None
    right: str | None = None
    variable: str | None = None
    variables: list[str] = Field(default_factory=list)
    point: str | None = None
    order: int | None = None
    lower: str | None = None
    lowerInclusive: bool | None = None
    upper: str | None = None
    upperInclusive: bool | None = None
    matrix: list[list[str]] = Field(default_factory=list)
    right_matrix: list[list[str]] = Field(default_factory=list)
    vector: list[str] = Field(default_factory=list)
    values: list[str] = Field(default_factory=list)
    points: list[PointInput] = Field(default_factory=list)
    distribution: str | None = None
    parameters: dict[str, str] = Field(default_factory=dict)
    modulus: str | None = None
    n: str | None = None
    k: str | None = None


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
