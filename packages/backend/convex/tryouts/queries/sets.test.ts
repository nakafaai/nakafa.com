import { describe, expect, it } from "@effect/vitest";
import { TryoutCatalogRowSchema } from "@nakafa/aksara-contracts/tryout/catalog";
import { api } from "@repo/backend/convex/_generated/api";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/convex/test.helpers";
import { getTryoutStatusRank } from "@repo/backend/convex/tryouts/status";
import {
  activateTryoutSetCatalog,
  catalogListArgs,
} from "@repo/backend/test/tryout/catalog";
import { activateTryoutSnapshot } from "@repo/backend/test/tryout/snapshot";
import {
  activateTryoutStartSource,
  makeTryoutStartHierarchy,
  makeTryoutStartPlacement,
  TRYOUT_START_NOW,
} from "@repo/backend/test/tryout/source";
import { Effect, Schema } from "effect";

describe("tryouts/queries/sets", () => {
  it.effect("requires an active signed try-out publication", () =>
    Effect.gen(function* () {
      const t = createConvexTestWithBetterAuth();
      yield* Effect.promise(() =>
        expect(
          t.query(api.tryouts.queries.sets.list, {
            ...catalogListArgs,
            sort: { direction: "asc", field: "order" },
          })
        ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_MISSING" } })
      );
    })
  );

  it.effect.each([0, -1, 1.5])(
    "rejects the invalid signed page size %s",
    (numItems) =>
      Effect.gen(function* () {
        const t = createConvexTestWithBetterAuth();
        yield* Effect.promise(() =>
          t.mutation((ctx) => activateTryoutStartSource(ctx, "visible"))
        );
        yield* Effect.promise(() =>
          expect(
            t.query(api.tryouts.queries.sets.list, {
              ...catalogListArgs,
              paginationOpts: { cursor: null, numItems },
              sort: { direction: "asc", field: "order" },
            })
          ).rejects.toMatchObject({
            data: { code: "INVALID_TRYOUT_SET_PAGE_SIZE" },
          })
        );
      })
  );

  it.effect(
    "breaks equal authored ranks by identity and keeps missing scores last",
    () =>
      Effect.gen(function* () {
        const { authed, t } = yield* activateTryoutSetCatalog([
          {
            setKey: "set-2",
            title: "Same",
            order: 1,
            questionCount: 1,
            durationSeconds: 60,
          },
          {
            setKey: "set-1",
            title: "Same",
            order: 1,
            questionCount: 1,
            durationSeconds: 60,
          },
        ]);
        yield* Effect.promise(() =>
          t.mutation(async (ctx) => {
            for (const row of await ctx.db
              .query("tryoutSetProgress")
              .collect()) {
              await ctx.db.patch(row._id, { publishedScore: 0 });
            }
          })
        );
        for (const direction of ["asc", "desc"] as const) {
          const tied = yield* Effect.promise(() =>
            authed.query(api.tryouts.queries.sets.list, {
              ...catalogListArgs,
              sort: { field: "publishedScore", direction },
            })
          );
          expect(tied.page.map(({ setKey }) => setKey)).toEqual([
            "set-1",
            "set-2",
          ]);
        }
        yield* Effect.promise(() =>
          t.mutation(async (ctx) => {
            const rows = await ctx.db.query("tryoutSetProgress").collect();
            for (const row of rows) {
              if (row.setKey === "set-1") {
                await ctx.db.patch(row._id, { publishedScore: null });
              }
            }
          })
        );
        for (const direction of ["asc", "desc"] as const) {
          const ranked = yield* Effect.promise(() =>
            authed.query(api.tryouts.queries.sets.list, {
              ...catalogListArgs,
              sort: { field: "publishedScore", direction },
            })
          );
          expect(ranked.page.map(({ setKey }) => setKey)).toEqual([
            "set-2",
            "set-1",
          ]);
        }
      })
  );

  it.effect(
    "applies status filtering before sorting and limiting the same result",
    () =>
      Effect.gen(function* () {
        const { authed } = yield* activateTryoutSetCatalog();
        const selections = [
          ["completed", "title", "asc", ["set-2", "set-1"]],
          ["not-started", "readyQuestionCount", "desc", ["set-4", "set-3"]],
          [
            "all",
            "durationSeconds",
            "desc",
            ["set-2", "set-1", "set-4", "set-3"],
          ],
          ["in-progress", "title", "asc", []],
          ["expired", "publishedScore", "desc", []],
        ] as const;
        for (const [filter, field, direction, expected] of selections) {
          const result = yield* Effect.promise(() =>
            authed.query(api.tryouts.queries.sets.list, {
              ...catalogListArgs,
              filter,
              sort: { field, direction },
            })
          );
          expect(result.page.map(({ setKey }) => setKey)).toEqual(expected);
        }
        const first = yield* Effect.promise(() =>
          authed.query(api.tryouts.queries.sets.list, {
            ...catalogListArgs,
            filter: "not-started",
            sort: { field: "readyQuestionCount", direction: "desc" },
            paginationOpts: { cursor: null, numItems: 1 },
          })
        );
        expect(first.page.map(({ setKey }) => setKey)).toEqual(["set-4"]);
        expect(first.isDone).toBe(false);
      })
  );

  it.effect(
    "preserves completed zero scores and scored expiry without crossing accounts",
    () =>
      Effect.gen(function* () {
        const { authed, identity, snapshotId, t } =
          yield* activateTryoutSetCatalog();
        const other = yield* Effect.promise(() =>
          t.mutation(async (ctx) => {
            for (const row of await ctx.db
              .query("tryoutSetProgress")
              .collect()) {
              const status = row.setKey === "set-1" ? "completed" : "expired";
              await ctx.db.patch(row._id, {
                publishedScore: row.setKey === "set-1" ? 0 : 80,
                status,
                statusRank: getTryoutStatusRank(status),
              });
            }
            return await seedAuthenticatedUser(ctx, {
              now: TRYOUT_START_NOW,
              suffix: "other-catalog-viewer",
            });
          })
        );
        const args = {
          ...catalogListArgs,
          sort: { field: "publishedScore", direction: "desc" },
        } as const;
        const result = yield* Effect.promise(() =>
          authed.query(api.tryouts.queries.sets.list, args)
        );
        expect(result).toMatchObject({
          snapshotId,
          viewerId: identity.authUserId,
        });
        expect(
          result.page.map(({ setKey, attemptStatus, publishedScore }) => ({
            setKey,
            attemptStatus,
            publishedScore,
          }))
        ).toEqual([
          { setKey: "set-2", attemptStatus: "expired", publishedScore: 80 },
          { setKey: "set-1", attemptStatus: "completed", publishedScore: 0 },
          { setKey: "set-3", attemptStatus: null, publishedScore: null },
          { setKey: "set-4", attemptStatus: null, publishedScore: null },
        ]);
        const completed = yield* Effect.promise(() =>
          authed.query(api.tryouts.queries.sets.list, {
            ...args,
            filter: "completed",
          })
        );
        expect(completed.page).toMatchObject([
          { setKey: "set-1", publishedScore: 0 },
        ]);
        const expired = yield* Effect.promise(() =>
          authed.query(api.tryouts.queries.sets.list, {
            ...args,
            filter: "expired",
          })
        );
        expect(expired.page).toMatchObject([
          { setKey: "set-2", publishedScore: 80 },
        ]);
        const secondViewer = t.withIdentity({
          subject: other.authUserId,
          sessionId: other.sessionId,
        });
        const separate = yield* Effect.promise(() =>
          secondViewer.query(api.tryouts.queries.sets.list, args)
        );
        const anonymous = yield* Effect.promise(() =>
          t.query(api.tryouts.queries.sets.list, args)
        );
        expect(separate).toMatchObject({
          snapshotId,
          viewerId: other.authUserId,
        });
        expect(anonymous).toMatchObject({ snapshotId, viewerId: null });
        for (const page of [separate, anonymous]) {
          expect(
            page.page.map(({ attemptStatus, publishedScore }) => [
              attemptStatus,
              publishedScore,
            ])
          ).toEqual([
            [null, null],
            [null, null],
            [null, null],
            [null, null],
          ]);
        }
        yield* Effect.promise(() =>
          t.mutation((ctx) =>
            ctx.db.patch(identity.userId, { deletedAt: TRYOUT_START_NOW })
          )
        );
        const deleted = yield* Effect.promise(() =>
          authed.query(api.tryouts.queries.sets.list, args)
        );
        expect(deleted.viewerId).toBeNull();
        expect(deleted.page).toEqual(anonymous.page);
      })
  );

  it.effect(
    "grows beyond one hundred rows and atomically refreshes the complete prefix",
    () =>
      Effect.gen(function* () {
        const definitions = Array.from({ length: 125 }, (_, index) => ({
          durationSeconds: 60 * (index + 1),
          order: index + 1,
          questionCount: 1,
          setKey: `set-${index + 1}`,
          title: `Set ${index + 1}`,
        }));
        const { authed, t } = yield* activateTryoutSetCatalog(definitions);
        const args = {
          ...catalogListArgs,
          sort: { field: "order", direction: "asc" },
        } as const;
        const first = yield* Effect.promise(() =>
          authed.query(api.tryouts.queries.sets.list, {
            ...args,
            paginationOpts: { cursor: null, numItems: 25 },
          })
        );
        const grown = yield* Effect.promise(() =>
          authed.query(api.tryouts.queries.sets.list, {
            ...args,
            paginationOpts: { cursor: null, numItems: 125 },
          })
        );
        expect(first.isDone).toBe(false);
        expect(grown.isDone).toBe(true);
        expect(grown.page).toHaveLength(125);
        expect(grown.page.slice(0, 25)).toEqual(first.page);
        expect(new Set(grown.page.map(({ setKey }) => setKey)).size).toBe(125);
        yield* Effect.promise(() =>
          t.mutation(async (ctx) => {
            for (const row of await ctx.db
              .query("tryoutSetProgress")
              .collect()) {
              await ctx.db.patch(row._id, { publishedScore: 0 });
            }
          })
        );
        const refreshed = yield* Effect.promise(() =>
          authed.query(api.tryouts.queries.sets.list, {
            ...args,
            paginationOpts: { cursor: null, numItems: 125 },
          })
        );
        expect(refreshed.page).toHaveLength(125);
        expect(refreshed.snapshotId).toBe(grown.snapshotId);
        expect(
          refreshed.page.slice(0, 2).map(({ publishedScore }) => publishedScore)
        ).toEqual([0, 0]);
      })
  );

  it.effect(
    "counts every visible section once and includes the hidden internal entry",
    () =>
      Effect.gen(function* () {
        for (const visibility of ["visible", "internal-entry"] as const) {
          const t = createConvexTestWithBetterAuth();
          const source = makeTryoutStartHierarchy("id", visibility);
          const durationSeconds = visibility === "visible" ? 11_700 : 4500;
          const section = source.find((row) => row.kind === "section");
          if (section?.kind !== "section") {
            return yield* Effect.die("Expected the technical section fixture.");
          }
          const catalog = source.map((row) => {
            if (row.kind === "section") {
              return {
                ...row,
                timeLimitSeconds:
                  visibility === "visible" ? 3600 : durationSeconds,
              };
            }
            if (
              visibility === "visible" &&
              (row.kind === "set" || row.kind === "track")
            ) {
              return {
                ...row,
                questionCount: 2,
                sectionCount: 2,
                visibleSectionCount: 2,
              };
            }
            return row;
          });
          if (visibility === "visible") {
            catalog.push(
              yield* Schema.decodeEffect(TryoutCatalogRowSchema)({
                ...section,
                graph: {
                  ...section.graph,
                  assetId: `${section.graph.assetId}-second`,
                },
                order: 2,
                publicPath: `${section.publicPath}-second`,
                sectionKey: "second-section",
                timeLimitSeconds: 8100,
              }).pipe(Effect.orDie)
            );
          }
          const signedCatalog = yield* Schema.decodeEffect(
            Schema.Array(TryoutCatalogRowSchema)
          )(catalog).pipe(Effect.orDie);
          yield* Effect.promise(() =>
            t.mutation((ctx) =>
              activateTryoutSnapshot(ctx, {
                catalog: signedCatalog,
                placements: [makeTryoutStartPlacement("id")],
              })
            )
          );
          const result = yield* Effect.promise(() =>
            t.query(api.tryouts.queries.sets.list, {
              ...catalogListArgs,
              sort: { field: "durationSeconds", direction: "asc" },
            })
          );
          expect(result.page).toMatchObject([
            {
              durationSeconds,
              readyQuestionCount: visibility === "visible" ? 2 : 1,
              readyVisibleSectionCount: visibility === "visible" ? 2 : 0,
            },
          ]);
          const publicPath = section.publicPath;
          if (publicPath !== undefined) {
            const entry = yield* Effect.promise(() =>
              t.query(api.tryouts.queries.catalog.getSectionPage, {
                appLocale: "id",
                publicPath,
              })
            );
            expect(entry).toMatchObject({
              section: { timeLimitSeconds: 3600 },
              set: { readyQuestionCount: 2 },
            });
          }
        }
      })
  );
});
