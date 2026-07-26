import { ContentKeySchema } from "@nakafa/aksara-contracts/ids";
import { deriveOwnership } from "@repo/backend/convex/contentRelease/scope/history";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { testPublicationScope } from "@repo/backend/test/content-release";
import {
  insertZeroRelease,
  type TestIdentity,
} from "@repo/backend/test/content-state";
import { convexTest } from "convex-test";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

const FORWARD = {
  manifestHash: `sha256:${"1".repeat(64)}`,
  releaseId: "release-history-forward",
  sequence: 1,
} satisfies TestIdentity;
const RECOVERY = {
  manifestHash: `sha256:${"2".repeat(64)}`,
  releaseId: "release-history-recovery",
  sequence: 2,
} satisfies TestIdentity;

describe("contentRelease/scope/history", () => {
  it("rejects a recovery that changes its immutable origin scope", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      await insertZeroRelease(ctx, {
        ...FORWARD,
        role: "candidate",
        scope: testPublicationScope({ families: ["article"] }),
        status: "completed",
      });
      await insertZeroRelease(ctx, {
        ...RECOVERY,
        base: FORWARD,
        originReleaseId: FORWARD.releaseId,
        role: "recovery",
        scope: testPublicationScope({
          content: [
            {
              contentKey: ContentKeySchema.make("test:scope-drift"),
              family: "material",
              locale: "en",
            },
          ],
          families: [],
        }),
        status: "verified",
      });
    });
    const releases = await t.run((ctx) =>
      ctx.db.query("contentReleases").withIndex("by_sequence").take(101)
    );

    await expect(
      Effect.runPromise(deriveOwnership(releases).pipe(Effect.flip))
    ).resolves.toMatchObject({ code: "CONTENT_RELEASE_CONFLICT" });
  });
});
