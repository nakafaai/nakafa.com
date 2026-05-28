import { describe, expect, it } from "@effect/vitest";
import {
  formatScriptCause,
  getUnknownMessage,
  ScriptFailureError,
} from "@repo/backend/scripts/lib/errors";
import { Cause, Effect } from "effect";

describe("script errors", () => {
  it.effect("formats unknown values for CLI output", () =>
    Effect.sync(() => {
      expect(getUnknownMessage(new Error("boom"))).toBe("boom");
      expect(getUnknownMessage("plain")).toBe("plain");
      expect(getUnknownMessage(null)).toBe("null");
    })
  );

  it.effect("prefers failure messages before pretty causes", () =>
    Effect.sync(() => {
      expect(
        formatScriptCause(
          Cause.fail(new ScriptFailureError({ message: "expected failure" }))
        )
      ).toBe("expected failure");
      expect(formatScriptCause(Cause.die(new Error("defect")))).toContain(
        "defect"
      );
    })
  );
});
