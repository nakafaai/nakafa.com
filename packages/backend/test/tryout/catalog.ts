import { TryoutCatalogRowSchema } from "@nakafa/aksara-contracts/tryout/catalog";
import { TryoutPlacementSchema } from "@nakafa/aksara-contracts/tryout/placement";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/confect/test.helpers";
import { getTryoutStatusRank } from "@repo/backend/confect/tryouts/status";
import { api } from "@repo/backend/convex/_generated/api";
import { testTextHash } from "@repo/backend/test/content/release";
import { insertTestTryoutRuntimeBundle } from "@repo/backend/test/runtime/bundle";
import { activateTryoutSnapshot } from "@repo/backend/test/tryout/snapshot";
import {
  makeTryoutStartHierarchy,
  makeTryoutStartPlacement,
  TRYOUT_START_COUNTRY,
  TRYOUT_START_EXAM,
  TRYOUT_START_NOW,
  TRYOUT_START_TRACK,
} from "@repo/backend/test/tryout/source";
import type { FunctionArgs } from "convex/server";
import { Array as Arr, Effect, Option, Schema, Struct } from "effect";
export const catalogListArgs: FunctionArgs<
  typeof api.tryouts.queries.sets.list
> = {
  countryKey: TRYOUT_START_COUNTRY,
  examKey: TRYOUT_START_EXAM,
  filter: "all",
  locale: "id",
  paginationOpts: {
    cursor: null,
    numItems: 10,
  },
  sort: {
    direction: "asc",
    field: "order",
  },
  trackKey: TRYOUT_START_TRACK,
};
const defaultSets = [
  {
    questionCount: 1,
    setKey: "set-1",
    title: "Zeta",
    durationSeconds: 4500,
    order: 1,
  },
  {
    questionCount: 2,
    setKey: "set-2",
    title: "Alpha",
    durationSeconds: 11_700,
    order: 2,
  },
  {
    questionCount: 1,
    setKey: "set-3",
    title: "Alpha",
    durationSeconds: 1800,
    order: 3,
  },
  {
    questionCount: 2,
    setKey: "set-4",
    title: "Beta",
    durationSeconds: 4500,
    order: 4,
  },
] as const;

/** Publishes distinct authored sets and starts two real authenticated attempts. */
export const activateTryoutSetCatalog = Effect.fn(
  "tryouts.sets.test.activateList"
)(function* (
  setDefinitions: readonly {
    questionCount: number;
    setKey: string;
    title: string;
    durationSeconds: number;
    order: number;
  }[] = defaultSets
) {
  vi.setSystemTime(TRYOUT_START_NOW);
  const t = createConvexTestWithBetterAuth();
  const { identity, snapshotId } = yield* Effect.promise(() =>
    t.mutation(async (ctx) => {
      const user = await seedAuthenticatedUser(ctx, {
        now: TRYOUT_START_NOW,
        suffix: "signed-sorted-sets",
      });
      const source = makeTryoutStartHierarchy("id", "visible");
      const parents = Arr.map(
        Arr.filter(
          source,
          (row) => row.kind !== "set" && row.kind !== "section"
        ),
        (row) =>
          row.kind === "track"
            ? {
                ...row,
                questionCount: Arr.reduce(
                  setDefinitions,
                  0,
                  (total, set) => total + set.questionCount
                ),
                sectionCount: setDefinitions.length,
                setCount: setDefinitions.length,
                visibleSectionCount: setDefinitions.length,
              }
            : row
      );
      const children = Arr.flatMap(setDefinitions, (definition) =>
        Arr.map(
          Arr.filter(
            source,
            (row) => row.kind === "set" || row.kind === "section"
          ),
          (row) => ({
            ...row,
            questionCount: definition.questionCount,
            setKey: definition.setKey,
            title: definition.title,
            graph: {
              ...row.graph,
              assetId: `${row.graph.assetId}-${definition.setKey}`,
            },
            order: row.kind === "set" ? definition.order : 1,
            publicPath: row.publicPath?.replace("set-1", definition.setKey),
            ...(row.kind === "section"
              ? {
                  timeLimitSeconds: definition.durationSeconds,
                  questionSourcePath: row.questionSourcePath.replace(
                    "set-1",
                    definition.setKey
                  ),
                }
              : {}),
          })
        )
      );
      const placements = Arr.flatMap(setDefinitions, (definition) =>
        Array.from(
          {
            length: definition.questionCount,
          },
          (_, index) => {
            const original = makeTryoutStartPlacement("id");
            const questionKey = original.questionContentKey
              .replace("set-1", definition.setKey)
              .replace("question-1", `question-${index + 1}`);
            const questionPath = questionKey.slice(0, -"/question".length);
            return Schema.decodeSync(TryoutPlacementSchema)({
              ...original,
              answerArtifactHash: testTextHash(`${questionKey}:answer`),
              answerContentKey: `${questionPath}/answer`,
              questionArtifactHash: testTextHash(`${questionKey}:question`),
              questionContentKey: questionKey,
              questionOrder: index + 1,
              questionSourcePath: `packages/corpus/${questionPath}`,
              setKey: definition.setKey,
            });
          }
        )
      );
      const snapshotId = await activateTryoutSnapshot(ctx, {
        catalog: Schema.decodeUnknownSync(Schema.Array(TryoutCatalogRowSchema))(
          [...parents, ...children]
        ),
        placements,
      });
      await insertTestTryoutRuntimeBundle(ctx, snapshotId);
      return {
        identity: user,
        snapshotId,
      };
    })
  );
  const authed = t.withIdentity({
    sessionId: identity.sessionId,
    subject: identity.authUserId,
  });
  for (const setKey of ["set-1", "set-2"]) {
    const attempt = yield* Effect.promise(() =>
      authed.mutation(api.tryouts.mutations.attempts.startAttempt, {
        ...Struct.omit(catalogListArgs, ["filter", "paginationOpts", "sort"]),
        setKey,
      })
    );
    yield* Effect.promise(() =>
      t.mutation(async (ctx) => {
        await ctx.db.patch(attempt.attemptId, {
          completedAt: TRYOUT_START_NOW,
          endReason: "submitted",
          status: "completed",
        });
        const progress = await ctx.db.query("tryoutSetProgress").collect();
        const selected = Arr.findFirst(
          progress,
          (row) => row.setKey === setKey
        );
        if (Option.isSome(selected)) {
          await ctx.db.patch(selected.value._id, {
            publishedScore: setKey === "set-1" ? 60 : 80,
            status: "completed",
            statusRank: getTryoutStatusRank("completed"),
          });
        }
      })
    );
  }
  return {
    authed,
    identity,
    snapshotId,
    t,
  };
});
