import { describe, expect, it } from "@effect/vitest";
import { formatScriptCause } from "@repo/backend/scripts/lib/errors";
import { Cause } from "effect";

describe("formatScriptCause", () => {
  it("reports a typed error with its message", () => {
    expect(formatScriptCause(Cause.fail(new Error("typed failure")))).toBe(
      "typed failure"
    );
  });

  it("reports a typed string failure as its text", () => {
    expect(formatScriptCause(Cause.fail("typed failure"))).toBe(
      "typed failure"
    );
  });

  it("prints a defect with its cause instead of an empty message", () => {
    expect(formatScriptCause(Cause.die(new Error("defect failure")))).toContain(
      "defect failure"
    );
  });
});
