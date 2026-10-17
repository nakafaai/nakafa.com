import { assert, describe, expect, it } from "@effect/vitest";
import { verifyTryoutPlacement } from "@repo/backend/confect/contentRelease/tryout/verify";
import { convexModules } from "@repo/backend/confect/test.setup";
import schema from "@repo/backend/convex/schema";
import {
  activateTryoutSnapshot,
  makeTryoutCatalogRow,
  makeTryoutPlacementRow,
} from "@repo/backend/test/tryout/snapshot";
import { convexTest } from "convex-test";
import { Effect } from "effect";

/** Activates and returns one exact technical placement row. */
const activatePlacement = Effect.fn("test.contentRelease.tryoutPlacement")(
  function* () {
    const t = convexTest(schema, convexModules);
    const runtimeServices = yield* Effect.context<never>();
    const [countryEn, countryId] = yield* Effect.all([
      makeTryoutCatalogRow("en"),
      makeTryoutCatalogRow("id"),
    ]);
    const [placementEn, placementId] = yield* Effect.all([
      makeTryoutPlacementRow("en"),
      makeTryoutPlacementRow("id"),
    ]);
    const snapshotId = yield* Effect.promise(() =>
      t.mutation((ctx) =>
        Effect.runPromiseWith(runtimeServices)(
          activateTryoutSnapshot(ctx, {
            catalog: [countryEn.record.row, countryId.record.row],
            placements: [placementEn.record.row, placementId.record.row],
          })
        )
      )
    );
    const placement = yield* Effect.promise(() =>
      t.run((ctx) =>
        ctx.db
          .query("tryoutPlacements")
          .withIndex(
            "by_snapshotId_and_appLocale_and_section_and_questionOrder",
            (index) =>
              index
                .eq("snapshotId", snapshotId)
                .eq("appLocale", "en")
                .eq("countryKey", "indonesia")
                .eq("examKey", "snbt")
                .eq("trackKey", "2027")
                .eq("setKey", "set-1")
                .eq("sectionKey", "quantitative-knowledge")
                .eq("questionOrder", 1)
          )
          .unique()
      )
    );
    assert(placement, "Expected one technical placement.");
    return {
      placement,
      snapshotId,
      t,
    };
  }
);
describe("contentRelease/tryout/verify", () => {
  it.effect("authenticates one exact server-only placement", () =>
    Effect.gen(function* () {
      const { placement, snapshotId } = yield* activatePlacement();
      expect(yield* verifyTryoutPlacement(placement, snapshotId)).toMatchObject(
        {
          countryKey: "indonesia",
          questionOrder: 1,
          sectionKey: "quantitative-knowledge",
        }
      );
    })
  );
  it.effect("rejects a placement with lost signed or indexed facts", () =>
    Effect.gen(function* () {
      const lost = yield* activatePlacement();
      expect(
        yield* verifyTryoutPlacement(
          lost.placement,
          `sha256:${"0".repeat(64)}`
        ).pipe(Effect.flip)
      ).toMatchObject({
        code: "CONTENT_RELEASE_INTEGRITY",
      });
      const changed = yield* activatePlacement();
      yield* Effect.promise(() =>
        changed.t.mutation((ctx) =>
          ctx.db.patch("tryoutPlacements", changed.placement._id, {
            contentHash: "7".repeat(64),
          })
        )
      );
      const tampered = yield* Effect.promise(() =>
        changed.t.run((ctx) => ctx.db.get(changed.placement._id))
      );
      assert(tampered, "Expected one tampered placement.");
      expect(
        yield* verifyTryoutPlacement(tampered, changed.snapshotId).pipe(
          Effect.flip
        )
      ).toMatchObject({
        code: "CONTENT_RELEASE_INTEGRITY",
      });
    })
  );
});
