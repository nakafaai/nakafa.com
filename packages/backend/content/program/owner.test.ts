import { assert, describe, expect, it } from "@effect/vitest";
import { api } from "@repo/backend/convex/_generated/api";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import {
  activateProgramSnapshot,
  makeProgramSnapshotData,
} from "@repo/backend/test/program/snapshot";
import { convexTest } from "convex-test";
import { Effect } from "effect";

describe("program and material owner coherence", () => {
  it.effect(
    "keeps a retained program snapshot unmanaged without material ownership",
    () =>
      Effect.gen(function* () {
        const t = convexTest(schema, convexModules);
        const data = yield* makeProgramSnapshotData();
        yield* Effect.promise(() => activateProgramSnapshot(t, data));
        yield* Effect.promise(() =>
          t.mutation(async (ctx) => {
            const release = await ctx.db.query("contentReleases").unique();
            assert(release);
            await ctx.db.patch("contentReleases", release._id, {
              resultFamilies: [],
            });
          })
        );
        const [catalog, page] = yield* Effect.promise(() =>
          Promise.all([
            t.query(api.contentRelease.program.catalog, { appLocale: "en" }),
            t.query(api.contentRelease.program.page, {
              appLocale: "en",
              expectedManifestHash: "old",
              expectedReleaseId: "old",
              paginationOpts: { cursor: "old", numItems: 2 },
            }),
          ])
        );
        expect(catalog).toMatchObject({
          managed: false,
          snapshotId: data.snapshotId,
          programJson: [],
          routeJson: [],
        });
        expect(page).toMatchObject({
          managed: false,
          snapshotId: data.snapshotId,
          stale: true,
        });
      })
  );

  it.effect(
    "rejects program reads while the active material buffer is behind",
    () =>
      Effect.gen(function* () {
        const t = convexTest(schema, convexModules);
        const data = yield* makeProgramSnapshotData();
        yield* Effect.promise(() => activateProgramSnapshot(t, data));
        yield* Effect.promise(() =>
          t.mutation(async (ctx) => {
            const state = await ctx.db.query("contentState").unique();
            assert(state);
            await ctx.db.patch("contentState", state._id, {
              materialSequence: undefined,
            });
          })
        );
        yield* Effect.promise(() =>
          expect(
            t.query(api.contentRelease.program.catalog, { appLocale: "en" })
          ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_STATE" } })
        );
      })
  );
});
