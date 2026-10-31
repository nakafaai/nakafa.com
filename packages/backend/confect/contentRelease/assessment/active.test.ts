import { RegisteredConvexFunction } from "@confect/server";
import { assert, describe, expect, it } from "@effect/vitest";
import { ACTIVE_APP_LOCALES } from "@nakafa/aksara-contracts/locale";
import confectSchema from "@repo/backend/confect/_generated/schema";
import { findActiveAssessmentSnapshot } from "@repo/backend/confect/contentRelease/assessment/active";
import { encodeSnapshotJson } from "@repo/backend/confect/contentRelease/wire";
import { convexModules } from "@repo/backend/confect/test.setup";
import schema from "@repo/backend/convex/schema";
import { TEST_RELEASE_ID } from "@repo/backend/test/content/release";
import { makeQuranSearch } from "@repo/backend/test/quran/rows";
import {
  activateQuranSnapshot,
  makeQuranSnapshot,
} from "@repo/backend/test/quran/snapshot";
import {
  activateAssessmentTestSnapshot,
  makeAssessmentTestSnapshot,
} from "@repo/backend/test/snapshot/assessment";
import { convexTest, type TestConvex } from "convex-test";
import { Effect, Option } from "effect";

/** Reads the active assessment snapshot in one Convex transaction. */
function readActive(t: TestConvex<typeof schema>) {
  return t.mutation((ctx) =>
    Effect.runPromise(
      findActiveAssessmentSnapshot().pipe(
        Effect.provide(
          RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
        )
      )
    )
  );
}

describe("contentRelease/assessment/active", () => {
  it("finds no snapshot before any release is active", async () => {
    const t = convexTest(schema, convexModules);
    expect(await readActive(t)).toEqual(Option.none());
  });

  it("finds no snapshot when the active release selects no assessment", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation((ctx) =>
      activateQuranSnapshot(ctx, [makeQuranSearch("en", 1, "Technical")])
    );
    expect(await readActive(t)).toEqual(Option.none());
  });

  it("names the active release, its snapshot and its app locales", async () => {
    const t = convexTest(schema, convexModules);
    const { snapshotId } = await t.mutation(activateAssessmentTestSnapshot);
    expect(await readActive(t)).toEqual(
      Option.some({
        activeAppLocales: ACTIVE_APP_LOCALES,
        releaseId: TEST_RELEASE_ID,
        snapshotId,
      })
    );
  });

  it.each(["missing", "unverified", "foreign", "renamed"] as const)(
    "refuses an active release whose assessment manifest is %s",
    async (corruption) => {
      const { manifest } = await Effect.runPromise(
        makeAssessmentTestSnapshot()
      );
      const quran = await Effect.runPromise(makeQuranSnapshot());
      const t = convexTest(schema, convexModules);
      await t.mutation(activateAssessmentTestSnapshot);
      await t.mutation(async (ctx) => {
        const stored = await ctx.db.query("contentSnapshots").unique();
        assert.ok(stored, "Expected one assessment manifest.");
        if (corruption === "missing") {
          await ctx.db.delete("contentSnapshots", stored._id);
          return;
        }
        if (corruption === "unverified") {
          await ctx.db.patch("contentSnapshots", stored._id, {
            verifiedAt: undefined,
          });
          return;
        }
        await ctx.db.patch("contentSnapshots", stored._id, {
          snapshotJson: encodeSnapshotJson(
            corruption === "foreign"
              ? quran
              : {
                  ...manifest,
                  manifest: {
                    ...manifest.manifest,
                    snapshotId: quran.manifest.snapshotId,
                  },
                }
          ),
        });
      });
      await expect(readActive(t)).rejects.toMatchObject({
        code: "CONTENT_RELEASE_INTEGRITY",
      });
    }
  );
});
