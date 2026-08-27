import { describe, expect, it } from "@effect/vitest";
import { recordPredecessorRead } from "@repo/backend/convex/contentRelease/predecessor/record";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import {
  patchPredecessorRows,
  seedPredecessorObservation,
} from "@repo/backend/test/predecessor";
import { convexTest } from "convex-test";

describe("contentRelease/predecessor/identity", () => {
  it("rejects observation rows from another deployment", async () => {
    const target = convexTest(schema, convexModules);
    await seedPredecessorObservation(target);
    await patchPredecessorRows(target, {
      deploymentName: "other-deployment",
    });
    await expect(
      target.mutation((ctx) =>
        runConvexProgram(recordPredecessorRead(ctx, "batch"))
      )
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_STATE" } });
  });
});
