import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { createConvexTestWithBetterAuth } from "@repo/backend/convex/test.helpers";
import { loadTryoutStartSource } from "@repo/backend/convex/tryouts/start/source";
import type { StartAttemptArgs } from "@repo/backend/convex/tryouts/start/spec";
import {
  activateTryoutStartSource,
  TRYOUT_START_COUNTRY as COUNTRY,
  TRYOUT_START_EXAM as EXAM,
  TRYOUT_START_NOW as NOW,
  TRYOUT_START_SET as SET,
  TRYOUT_START_TRACK as TRACK,
} from "@repo/backend/test/tryout-source";
import { describe, expect, it, vi } from "vitest";

const startArgs: StartAttemptArgs = {
  countryKey: COUNTRY,
  examKey: EXAM,
  locale: "id",
  setKey: SET,
  trackKey: TRACK,
};
describe("tryouts/start/source", () => {
  it("starts from signed rows after filesystem ownership is removed", async () => {
    vi.setSystemTime(new Date(NOW));

    const t = createConvexTestWithBetterAuth();
    await t.mutation((ctx) => activateTryoutStartSource(ctx, "visible", "raw"));
    const source = await t.query((ctx) =>
      runConvexProgram(loadTryoutStartSource(ctx, startArgs))
    );

    expect(source).toMatchObject({
      snapshot: {
        setIdentity: expect.any(String),
        snapshotId: expect.any(String),
      },
    });
  });
});
