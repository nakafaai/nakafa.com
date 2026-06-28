from cas.format import step


def test_step_preserves_student_facing_reason() -> None:
    math_step = step(
        "evaluate",
        primary="2 + 2",
        secondary="4",
        reason="Evaluate the exact arithmetic expression.",
    )

    assert math_step.reason == "Evaluate the exact arithmetic expression."
    assert math_step.model_dump(exclude_none=True)["reason"] == math_step.reason


def test_step_omits_absent_reason_from_api_shape() -> None:
    math_step = step("evaluate", primary="2 + 2", secondary="4")

    assert math_step.reason is None
    assert "reason" not in math_step.model_dump(exclude_none=True)
