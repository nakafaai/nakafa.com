import {
  decodePredecessorObservationId,
  PREDECESSOR_QUIET_WINDOW_MS,
  PREDECESSOR_ROUTES,
} from "@repo/backend/convex/contentRelease/predecessor/spec";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

describe("contentRelease/predecessor/spec", () => {
  it("owns the exact temporary route set and quiet period", () => {
    expect(PREDECESSOR_ROUTES).toEqual(["singular", "batch"]);
    expect(PREDECESSOR_QUIET_WINDOW_MS).toBe(86_400_000);
  });

  it("accepts concise receipt IDs and rejects ambiguous values", async () => {
    await expect(
      Effect.runPromise(
        decodePredecessorObservationId("dates-cutover-4974ee8c")
      )
    ).resolves.toBe("dates-cutover-4974ee8c");

    for (const invalid of ["", "Dates-Cutover", "dates_cutover", "dates--x"]) {
      await expect(
        Effect.runPromise(decodePredecessorObservationId(invalid))
      ).rejects.toMatchObject({
        code: "CONTENT_RELEASE_INTEGRITY",
        message: "Predecessor observation ID is invalid.",
      });
    }
  });
});
