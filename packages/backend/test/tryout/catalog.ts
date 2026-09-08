import { TryoutCatalogRowSchema } from "@nakafa/aksara-contracts/tryout/catalog";
import { TryoutPlacementSchema } from "@nakafa/aksara-contracts/tryout/placement";
import { api } from "@repo/backend/convex/_generated/api";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/convex/test.helpers";
import { tryoutEntitlementSourceKindCompetition } from "@repo/backend/convex/tryoutAccess/schema";
import { getTryoutStatusRank } from "@repo/backend/convex/tryouts/status";
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
import { Effect, Schema, Struct } from "effect";

type UnattemptedArgs = FunctionArgs<
  typeof api.tryouts.queries.sets.unattempted
>;

export const catalogListArgs: UnattemptedArgs = {
  countryKey: TRYOUT_START_COUNTRY,
  examKey: TRYOUT_START_EXAM,
  locale: "id",
  paginationOpts: { cursor: null, numItems: 10 },
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
  vi.setSystemTime(new Date(TRYOUT_START_NOW));
  const t = createConvexTestWithBetterAuth();
  const { identity, snapshotId } = yield* Effect.promise(() =>
    t.mutation(async (ctx) => {
      const user = await seedAuthenticatedUser(ctx, {
        now: TRYOUT_START_NOW,
        suffix: "signed-sorted-sets",
      });
      const source = makeTryoutStartHierarchy("id", "visible");
      const parents = source
        .filter((row) => row.kind !== "set" && row.kind !== "section")
        .map((row) =>
          row.kind === "track"
            ? {
                ...row,
                questionCount: setDefinitions.reduce(
                  (total, set) => total + set.questionCount,
                  0
                ),
                sectionCount: setDefinitions.length,
                setCount: setDefinitions.length,
                visibleSectionCount: setDefinitions.length,
              }
            : row
        );
      const children = setDefinitions.flatMap((definition) =>
        source
          .filter((row) => row.kind === "set" || row.kind === "section")
          .map((row) => ({
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
          }))
      );
      const placements = setDefinitions.flatMap((definition) =>
        Array.from({ length: definition.questionCount }, (_, index) => {
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
        })
      );
      const snapshotId = await activateTryoutSnapshot(ctx, {
        catalog: Schema.decodeUnknownSync(Schema.Array(TryoutCatalogRowSchema))(
          [...parents, ...children]
        ),
        placements,
      });
      await insertTestTryoutRuntimeBundle(ctx, snapshotId);
      for (const { setKey } of setDefinitions) {
        await ctx.db.insert("tryoutEntitlements", {
          countryKey: TRYOUT_START_COUNTRY,
          endsAt: TRYOUT_START_NOW + 86_400_000,
          examKey: TRYOUT_START_EXAM,
          setKey,
          sourceKind: tryoutEntitlementSourceKindCompetition,
          startsAt: TRYOUT_START_NOW,
          trackKey: TRYOUT_START_TRACK,
          userId: user.userId,
        });
      }
      return { identity: user, snapshotId };
    })
  );
  const authed = t.withIdentity({
    sessionId: identity.sessionId,
    subject: identity.authUserId,
  });
  for (const setKey of ["set-1", "set-2"]) {
    const attempt = yield* Effect.promise(() =>
      authed.mutation(api.tryouts.mutations.attempts.startAttempt, {
        ...Struct.omit(catalogListArgs, ["paginationOpts"]),
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
        const selected = progress.find((row) => row.setKey === setKey);
        if (selected) {
          await ctx.db.patch(selected._id, {
            publishedScore: setKey === "set-1" ? 60 : 80,
            status: "completed",
            statusRank: getTryoutStatusRank("completed"),
          });
        }
      })
    );
  }
  return { authed, identity, snapshotId, t };
});
