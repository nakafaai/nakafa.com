import {
  decodePredecessorObservationId,
  PREDECESSOR_QUIET_WINDOW_MS,
  PREDECESSOR_ROUTES,
} from "@repo/backend/convex/contentRelease/predecessor/spec";
import { describe, expect, it } from "@repo/testing/effect";
import { Effect } from "effect";

describe("contentRelease/predecessor/spec", () => {
  it("owns the exact temporary route set and quiet period", () => {
    expect(PREDECESSOR_ROUTES).toEqual(["singular", "batch"]);
    expect(PREDECESSOR_QUIET_WINDOW_MS).toBe(86_400_000);
  });

  it.effect("accepts concise receipt IDs and rejects ambiguous values", () =>
    Effect.gen(function* () {
      expect(
        yield* decodePredecessorObservationId("dates-cutover-4974ee8c")
      ).toBe("dates-cutover-4974ee8c");

      for (const invalid of ["", "Dates-Cutover", "dates_cutover", "dates--x"]) {
        expect(
          yield* decodePredecessorObservationId(invalid).pipe(Effect.flip)
        ).toMatchObject({
          code: "CONTENT_RELEASE_INTEGRITY",
          message: "Predecessor observation ID is invalid.",
        });
      }
    })
  );
});
