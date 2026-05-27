import {
  formatScriptCause,
  getUnknownMessage,
  ScriptFailureError,
} from "@repo/backend/scripts/lib/errors";
import { Cause } from "effect";
import { describe, expect, it } from "vitest";

describe("script errors", () => {
  it("formats unknown values for CLI output", () => {
    expect(getUnknownMessage(new Error("boom"))).toBe("boom");
    expect(getUnknownMessage("plain")).toBe("plain");
    expect(getUnknownMessage(null)).toBe("null");
  });

  it("prefers failure messages before pretty causes", () => {
    expect(
      formatScriptCause(
        Cause.fail(new ScriptFailureError({ message: "expected failure" }))
      )
    ).toBe("expected failure");
    expect(formatScriptCause(Cause.die(new Error("defect")))).toContain(
      "defect"
    );
  });
});
