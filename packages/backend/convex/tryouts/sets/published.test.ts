import { describe, expect, it } from "@effect/vitest";
import { AppLocaleSchema } from "@nakafa/aksara-contracts/locale";
import { canonicalizeContentSnapshotRow } from "@nakafa/aksara-contracts/release/snapshot/data";
import { TryoutCatalogRowSchema } from "@nakafa/aksara-contracts/tryout/catalog";
import { makeTryoutCatalogRecord } from "@nakafa/aksara-contracts/tryout/catalog-hash";
import { tryoutCatalogNodeIdentity } from "@nakafa/aksara-contracts/tryout/identity";
import { api } from "@repo/backend/convex/_generated/api";
import { decodeSnapshotRowJson } from "@repo/backend/convex/contentRelease/parse";
import { tryoutCatalogFacts } from "@repo/backend/convex/contentRelease/tryout/facts";
import {
  TRYOUT_CATALOG_LIMIT,
  TRYOUT_PROGRESS_DOCUMENT_LIMIT,
} from "@repo/backend/convex/contentRelease/tryout/limits";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/convex/test.helpers";
import { getTryoutStatusRank } from "@repo/backend/convex/tryouts/status";
import {
  activateTryoutSetCatalog,
  catalogListArgs,
} from "@repo/backend/test/tryout/catalog";
import {
  activateTryoutStartSource,
  TRYOUT_START_COUNTRY,
  TRYOUT_START_EXAM,
  TRYOUT_START_NOW,
  TRYOUT_START_SET,
  TRYOUT_START_TRACK,
} from "@repo/backend/test/tryout/source";
import type { FunctionArgs } from "convex/server";
import { Effect, Schema, Struct } from "effect";

describe("tryouts/sets/published", () => {
  it.effect(
    "sorts authenticated scores and authored fields with stable ties",
    () =>
      Effect.gen(function* () {
        const { authed, t } = yield* activateTryoutSetCatalog();
        const orders = [
          ["order", "asc", ["set-1", "set-2", "set-3", "set-4"]],
          ["order", "desc", ["set-4", "set-3", "set-2", "set-1"]],
          ["title", "asc", ["set-2", "set-3", "set-4", "set-1"]],
          ["readyQuestionCount", "asc", ["set-1", "set-3", "set-2", "set-4"]],
          ["publishedScore", "asc", ["set-1", "set-2", "set-3", "set-4"]],
          ["publishedScore", "desc", ["set-2", "set-1", "set-3", "set-4"]],
        ] as const;
        for (const [field, direction, expected] of orders) {
          const result = yield* Effect.promise(() =>
            authed.query(api.tryouts.queries.sets.list, {
              ...catalogListArgs,
              sort: { direction, field },
            })
          );
          expect(result.page.map(({ setKey }) => setKey)).toEqual(expected);
        }
        const anonymous = yield* Effect.promise(() =>
          t.query(api.tryouts.queries.sets.list, {
            ...catalogListArgs,
            sort: { direction: "desc", field: "publishedScore" },
          })
        );
        expect(anonymous.page.map(({ setKey }) => setKey)).toEqual(
          orders[0][2]
        );
        expect(
          anonymous.page.every(({ publishedScore }) => publishedScore === null)
        ).toBe(true);
        const unauthenticated = yield* Effect.promise(() =>
          t.query(api.tryouts.queries.sets.list, {
            ...catalogListArgs,
            filter: "completed",
          })
        );
        expect(unauthenticated).toMatchObject({
          continueCursor: "",
          isDone: true,
          page: [],
        });
      })
  );

  it.effect("returns an empty page for an absent signed track", () =>
    Effect.gen(function* () {
      const { authed } = yield* activateTryoutSetCatalog();
      const result = yield* Effect.promise(() =>
        authed.query(api.tryouts.queries.sets.list, {
          ...catalogListArgs,
          trackKey: "missing-track",
        })
      );
      expect(result).toMatchObject({
        continueCursor: "",
        isDone: true,
        page: [],
      });
    })
  );

  it.effect(
    "rejects duplicate, oversized, and conflicting stored progress identities",
    () =>
      Effect.gen(function* () {
        for (const defect of ["duplicate", "oversized", "identity"] as const) {
          const { authed, t } = yield* activateTryoutSetCatalog();
          yield* Effect.promise(() =>
            t.mutation(async (ctx) => {
              const rows = await ctx.db.query("tryoutSetProgress").collect();
              const row = rows.find((progress) => progress.setKey === "set-1");
              if (!row) {
                return;
              }
              if (defect === "duplicate") {
                await ctx.db.insert(
                  "tryoutSetProgress",
                  Struct.omit(row, ["_creationTime", "_id"])
                );
                return;
              }
              await ctx.db.patch(row._id, {
                setIdentity:
                  defect === "oversized"
                    ? "x".repeat(TRYOUT_PROGRESS_DOCUMENT_LIMIT)
                    : "another-signed-set",
              });
            })
          );
          yield* Effect.promise(() =>
            expect(
              authed.query(api.tryouts.queries.sets.list, {
                ...catalogListArgs,
                sort: { direction: "asc", field: "order" },
              })
            ).rejects.toMatchObject({
              data: { code: "CONTENT_RELEASE_INTEGRITY" },
            })
          );
        }
      })
  );

  it.effect(
    "rejects two stored catalog routes that reuse one set identity",
    () =>
      Effect.gen(function* () {
        const { authed, t } = yield* activateTryoutSetCatalog();
        yield* Effect.promise(() =>
          t.mutation((ctx) =>
            runConvexProgram(
              Effect.gen(function* () {
                const rows = yield* Effect.promise(() =>
                  ctx.db.query("tryoutCatalog").collect()
                );
                const stored = rows.find(
                  (row) =>
                    row.kind === "set" && row.publicPath?.endsWith("/set-2")
                );
                if (!stored) {
                  return yield* Effect.die(
                    "Expected the second stored signed set."
                  );
                }
                const snapshot = yield* decodeSnapshotRowJson(stored.rowJson);
                if (
                  snapshot.family !== "tryout" ||
                  snapshot.rowKind !== "catalog" ||
                  snapshot.record.row.kind !== "set"
                ) {
                  return yield* Effect.die("Expected a set catalog payload.");
                }
                const row = yield* Schema.decodeEffect(TryoutCatalogRowSchema)({
                  ...snapshot.record.row,
                  setKey: TRYOUT_START_SET,
                }).pipe(Effect.orDie);
                const record = makeTryoutCatalogRecord(row);
                yield* Effect.promise(() =>
                  ctx.db.patch(stored._id, {
                    ...tryoutCatalogFacts(record),
                    rowHash: record.rowHash,
                    rowJson: canonicalizeContentSnapshotRow({
                      family: "tryout",
                      record,
                      rowKind: "catalog",
                    }),
                  })
                );
              })
            )
          )
        );
        yield* Effect.promise(() =>
          expect(
            authed.query(api.tryouts.queries.sets.list, {
              ...catalogListArgs,
              sort: { direction: "asc", field: "order" },
            })
          ).rejects.toMatchObject({
            data: {
              code: "CONTENT_RELEASE_INTEGRITY",
              message: expect.stringContaining("duplicate set identities"),
            },
          })
        );
      })
  );

  it("joins signed sets without exposing unpublished progress", async () => {
    vi.setSystemTime(new Date(TRYOUT_START_NOW));

    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation(async (ctx) => {
      const user = await seedAuthenticatedUser(ctx, {
        now: TRYOUT_START_NOW,
        suffix: "signed-set-list",
      });
      await activateTryoutStartSource(ctx, "visible");
      return user;
    });
    const authed = t.withIdentity({
      sessionId: identity.sessionId,
      subject: identity.authUserId,
    });
    const args: FunctionArgs<typeof api.tryouts.queries.sets.list> = {
      countryKey: TRYOUT_START_COUNTRY,
      examKey: TRYOUT_START_EXAM,
      filter: "not-started",
      locale: "id",
      paginationOpts: { cursor: null, numItems: 10 },
      sort: { direction: "asc", field: "order" },
      trackKey: TRYOUT_START_TRACK,
    };

    const before = await authed.query(api.tryouts.queries.sets.list, args);
    const attempt = await authed.mutation(
      api.tryouts.mutations.attempts.startAttempt,
      {
        countryKey: TRYOUT_START_COUNTRY,
        examKey: TRYOUT_START_EXAM,
        locale: "id",
        setKey: TRYOUT_START_SET,
        trackKey: TRYOUT_START_TRACK,
      }
    );
    await t.mutation(async (ctx) => {
      for (let index = 0; index <= TRYOUT_CATALOG_LIMIT; index += 1) {
        await ctx.db.insert("tryoutSetProgress", {
          attemptNumber: 1,
          countryKey: TRYOUT_START_COUNTRY,
          examKey: TRYOUT_START_EXAM,
          latestAttemptId: attempt.attemptId,
          appLocale: "id",
          publishedScore: index,
          setIdentity: tryoutCatalogNodeIdentity({
            appLocale: AppLocaleSchema.make("id"),
            countryKey: TRYOUT_START_COUNTRY,
            examKey: TRYOUT_START_EXAM,
            kind: "set",
            setKey: `retired-${index}`,
            trackKey: TRYOUT_START_TRACK,
          }),
          setKey: `retired-${index}`,
          status: "completed",
          statusRank: getTryoutStatusRank("completed"),
          trackKey: TRYOUT_START_TRACK,
          updatedAt: TRYOUT_START_NOW,
          userId: identity.userId,
        });
      }
    });
    const list = await authed.query(api.tryouts.queries.sets.list, {
      ...args,
      filter: "all",
      sort: { direction: "desc", field: "publishedScore" },
    });
    const inProgress = await authed.query(api.tryouts.queries.sets.list, {
      ...args,
      filter: "in-progress",
    });
    const after = await authed.query(api.tryouts.queries.sets.list, args);

    expect(before.page).toMatchObject([
      { attemptStatus: null, setKey: TRYOUT_START_SET },
    ]);
    expect(list.page).toMatchObject([
      {
        attemptStatus: "in-progress",
        publishedScore: null,
        setKey: TRYOUT_START_SET,
      },
    ]);
    expect(inProgress.page).toEqual(list.page);
    expect(after.page).toEqual([]);
    expect(attempt.attemptId).toBeDefined();
  });
});
