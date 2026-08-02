import { internal } from "@repo/backend/convex/_generated/api";
import { requireFilesystemOwner } from "@repo/backend/convex/contentSync/tryouts/source";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import {
  activateTryoutSnapshot,
  makeTryoutCatalogRow,
  makeTryoutPlacementRow,
} from "@repo/backend/test/tryout-snapshot";
import { buildSyncPayload } from "@repo/backend/test/tryout-sync";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

describe("contentSync/tryouts/source", () => {
  it("allows filesystem sync before signed ownership activates", async () => {
    const t = convexTest(schema, convexModules);

    await expect(
      t.query((ctx) => runConvexProgram(requireFilesystemOwner(ctx)))
    ).resolves.toBeNull();
  });

  it("rejects every filesystem mutation after signed ownership activates", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation((ctx) =>
      activateTryoutSnapshot(ctx, {
        catalog: [
          makeTryoutCatalogRow("en").record.row,
          makeTryoutCatalogRow("id").record.row,
        ],
        placements: [
          makeTryoutPlacementRow("en").record.row,
          makeTryoutPlacementRow("id").record.row,
        ],
      })
    );

    const mutations = [
      () =>
        t.mutation(
          internal.contentSync.mutations.tryouts.bulkSyncTryouts,
          buildSyncPayload()
        ),
      () =>
        t.mutation(
          internal.contentSync.mutations.tryouts.deleteStaleQuestions,
          { questionIds: [] }
        ),
      () =>
        t.mutation(
          internal.contentSync.mutations.tryouts.deleteStaleQuestionSets,
          { questionSetIds: [] }
        ),
      () =>
        t.mutation(
          internal.contentSync.mutations.tryouts.deleteStaleTryoutSections,
          { sectionIds: [] }
        ),
      () =>
        t.mutation(
          internal.contentSync.mutations.tryouts.deleteStaleTryoutSets,
          { setIds: [] }
        ),
      () =>
        t.mutation(
          internal.contentSync.mutations.tryouts.deleteStaleTryoutTracks,
          { trackIds: [] }
        ),
      () =>
        t.mutation(
          internal.contentSync.mutations.tryouts.deleteStaleTryoutExams,
          { examIds: [] }
        ),
      () =>
        t.mutation(
          internal.contentSync.mutations.tryouts.deleteStaleTryoutCountries,
          { countryIds: [] }
        ),
    ];

    for (const mutate of mutations) {
      await expect(mutate()).rejects.toMatchObject({
        data: { code: "TRYOUT_SYNC_MANAGED" },
      });
    }

    await expect(
      t.query((ctx) => ctx.db.query("tryoutSets").first())
    ).resolves.toBeNull();
  });
});
