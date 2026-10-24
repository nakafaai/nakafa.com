// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { requireNonEmptyBindings } from "#www/deploy/bindings";

describe("requireNonEmptyBindings", () => {
  it.effect("accepts set values and leaves unset values unbound", () =>
    requireNonEmptyBindings({
      CONVEX_URL: "https://a.convex.cloud",
      OTHER: undefined,
    })
  );

  it.effect("names the empty binding without printing a value", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(
        requireNonEmptyBindings({ A: "s3cr3t-token", B: "" })
      );

      expect(error._tag).toBe("ConfigError");
      expect(error.message).toContain('"B"');
      expect(error.message).not.toContain("s3cr3t-token");
    })
  );
});
