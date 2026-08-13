import {
  RETIRED_PROGRAM_ZERO_RECEIPT,
  requireRetiredProgramZeroReceipt,
} from "@repo/backend/convex/contentRelease/cutover/retiredPrograms";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

describe("contentRelease/cutover/retiredPrograms", () => {
  it("accepts the exact Phase 1 receipt", async () => {
    await expect(
      Effect.runPromise(
        requireRetiredProgramZeroReceipt(RETIRED_PROGRAM_ZERO_RECEIPT)
      )
    ).resolves.toEqual(RETIRED_PROGRAM_ZERO_RECEIPT);
  });

  it("rejects a missing Phase 1 receipt", async () => {
    await expect(
      Effect.runPromise(
        requireRetiredProgramZeroReceipt(undefined).pipe(Effect.flip)
      )
    ).resolves.toMatchObject({
      code: "CONTENT_RELEASE_INTEGRITY",
      message: expect.stringContaining("zero receipt is missing"),
    });
  });
});
