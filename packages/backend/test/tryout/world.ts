import type { RegisteredConvexFunction } from "@confect/server";
import { assert } from "@effect/vitest";
import type {
  AssessmentRowKind,
  AssessmentRowSchema,
} from "@nakafa/aksara-contracts/assessment/snapshot";
import type { AppLocaleCode } from "@nakafa/aksara-contracts/locale";
import {
  ContentSnapshotRowSchema,
  canonicalizeContentSnapshotRow,
} from "@nakafa/aksara-contracts/release/snapshot/data";
import tryouts from "@repo/backend/confect/_generated/refs/tryouts";
import type databaseSchema from "@repo/backend/confect/_generated/schema";
import type { ExamResponse } from "@repo/backend/confect/assessment/response";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/confect/test.helpers";
import { startTryoutAttempt } from "@repo/backend/confect/tryouts/start/impl";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  FIXTURE_TRACK,
  type makeAssessmentSnapshot,
} from "@repo/backend/test/assessment/snapshot";
import { client, inMutation, internalClient } from "@repo/backend/test/client";
import {
  activateAssessmentTestSnapshot,
  replaceAssessmentTestSnapshot,
} from "@repo/backend/test/snapshot/assessment";
import { Array as Arr, Clock, Effect, Option, Schema } from "effect";

/** The moment every try-out world starts at. */
export const TRYOUT_NOW = Date.UTC(2026, 6, 8, 12, 0, 0);

/** How long before `TRYOUT_NOW` a world commits its seed, so the test's first write runs at `TRYOUT_NOW`. */
const SEED_LEAD_MILLISECONDS = 60_000;

/**
 * The key and a wrong answer of each fixture question, by section and question number: a single
 * choice and a multiple choice in section A, and a table in section B.
 */
const FIXTURE_ANSWERS = {
  "section-a": [
    { correct: ["option-2"], wrong: ["option-1"] },
    { correct: ["option-1", "option-3"], wrong: ["option-1"] },
  ],
  "section-b": [
    {
      correct: {
        cells: [
          { column: "column-1", statement: "statement-1" },
          { column: "column-2", statement: "statement-2" },
        ],
      },
      wrong: { cells: [{ column: "column-2", statement: "statement-1" }] },
    },
  ],
} satisfies Record<
  string,
  readonly Readonly<Record<"correct" | "wrong", ExamResponse>>[]
>;

/** One row of an assessment snapshot. */
type AssessmentRow = typeof AssessmentRowSchema.Type;

/** The stored text of one snapshot row. */
const StoredRowText = Schema.fromJsonString(ContentSnapshotRowSchema);

/** The options of the shared assessment fixture a world activates. */
type FixtureOptions = NonNullable<Parameters<typeof makeAssessmentSnapshot>[0]>;

/**
 * The start arguments of one fixture set in one app locale: set 1 in Indonesian unless given, entered
 * through its internal entry section when `entry` is set.
 */
export function startArgs(
  options: {
    readonly entry?: boolean;
    readonly locale?: AppLocaleCode;
    readonly setKey?: string;
  } = {}
) {
  return {
    ...FIXTURE_TRACK,
    ...(options.entry ? { entrySectionKey: "section-a" } : {}),
    locale: options.locale ?? "id",
    setKey: options.setKey ?? "set-1",
  };
}

/**
 * Seeds one try-out world for `TRYOUT_NOW`: the shared fixture snapshot active with `options`, and
 * one signed-in learner. It returns a typed client as the learner, one for a visitor, a start of a
 * fixture set as the learner, and a runner for Confect programs in one mutation. convex-test runs
 * each transaction at or after the commit before it, as Convex does, so the seed commits a minute
 * before `TRYOUT_NOW` and leaves the clock there, where the test's first write runs.
 */
export const tryoutWorld = Effect.fn("test.tryout.world")(function* (
  options: FixtureOptions & { readonly suffix?: string } = {}
) {
  vi.setSystemTime(TRYOUT_NOW - SEED_LEAD_MILLISECONDS);
  const t = createConvexTestWithBetterAuth();
  const { suffix = "learner", ...fixture } = options;
  const seeded = yield* Effect.promise(() =>
    t.mutation(async (ctx) => {
      const learner = await seedAuthenticatedUser(ctx, {
        now: TRYOUT_NOW,
        suffix,
      });
      const { snapshotId } = await activateAssessmentTestSnapshot(ctx, fixture);
      return { learner, snapshotId };
    })
  );
  vi.setSystemTime(TRYOUT_NOW);
  const signedIn = t.withIdentity({
    sessionId: seeded.learner.sessionId,
    subject: seeded.learner.authUserId,
  });
  const learner = client(signedIn);
  return {
    /** Calls internal functions as the platform does. */
    internal: internalClient(t),
    learner,
    /** The learner's untyped convex-test client, for arguments the typed client refuses to send. */
    learnerConvex: signedIn,
    snapshotId: seeded.snapshotId,
    /** Moves the active release onto another fixture snapshot, as a later release does. */
    release: (next: FixtureOptions) =>
      Effect.promise(() =>
        t.mutation((ctx) => replaceAssessmentTestSnapshot(ctx, next))
      ),
    /**
     * Rewrites the first stored row of the world's snapshot that `match` selects through `change`;
     * both also see every row. The stored hash stays, as a snapshot changed after signing holds it.
     */
    rewrite: (
      match: (row: AssessmentRow, rows: readonly AssessmentRow[]) => boolean,
      change: (
        row: AssessmentRow,
        rows: readonly AssessmentRow[]
      ) => AssessmentRow
    ) =>
      Effect.gen(function* () {
        const stored = yield* Effect.promise(() =>
          t.query((ctx) =>
            ctx.db
              .query("assessmentRows")
              .withIndex("by_snapshotId_and_index", (query) =>
                query.eq("snapshotId", seeded.snapshotId)
              )
              .collect()
          )
        );
        const decoded = yield* Effect.forEach(stored, (row) =>
          Effect.map(
            Schema.decodeEffect(StoredRowText)(row.rowJson),
            (text) => {
              assert.ok(
                text.family === "assessment",
                "Expected an assessment row."
              );
              return { id: row._id, text };
            }
          )
        );
        const rows = Arr.map(decoded, ({ text }) => text.record.row);
        const found = Arr.findFirst(decoded, ({ text }) =>
          match(text.record.row, rows)
        );
        assert.ok(Option.isSome(found), "Expected the row to rewrite.");
        const { id, text } = found.value;
        const rowJson = canonicalizeContentSnapshotRow({
          ...text,
          record: { ...text.record, row: change(text.record.row, rows) },
        });
        yield* Effect.promise(() =>
          t.mutation((ctx) => ctx.db.patch("assessmentRows", id, { rowJson }))
        );
      }),
    /**
     * Replaces the stored text of the snapshot row of `kind` and `identity` with `rowJson`, or deletes
     * the row when `rowJson` is empty, as a broken snapshot holds it.
     */
    replaceRow: (kind: AssessmentRowKind, identity: string, rowJson: string) =>
      Effect.promise(() =>
        t.mutation(async (ctx) => {
          const row = await ctx.db
            .query("assessmentRows")
            .withIndex("by_snapshotId_and_kind_and_identity", (query) =>
              query
                .eq("snapshotId", seeded.snapshotId)
                .eq("kind", kind)
                .eq("identity", identity)
            )
            .unique();
          assert.ok(row, `Expected the ${kind} row ${identity}.`);
          if (rowJson === "") {
            await ctx.db.delete("assessmentRows", row._id);
            return;
          }
          await ctx.db.patch("assessmentRows", row._id, { rowJson });
        })
      ),
    /** Runs one Confect program in a mutation, failing as a defect when it fails. */
    run: <A, E>(
      program: Effect.Effect<
        A,
        E,
        RegisteredConvexFunction.MutationServices<typeof databaseSchema>
      >
    ) => Effect.promise(() => t.run(inMutation(() => program))),
    /**
     * Answers one question of an attempt as the learner: its key, a wrong answer, or a clear, at
     * version `version` (1 unless given).
     */
    answer: (
      attemptId: Id<"tryoutAttempts">,
      question: {
        readonly order: number;
        readonly pick: "clear" | "correct" | "wrong";
        readonly section: keyof typeof FIXTURE_ANSWERS;
        readonly version?: number;
      }
    ) =>
      Effect.gen(function* () {
        const placement = yield* Effect.promise(() =>
          t.query((ctx) =>
            ctx.db
              .query("tryoutAttemptPlacements")
              .withIndex(
                "by_tryoutAttemptId_and_sectionKey_and_questionOrder",
                (query) =>
                  query
                    .eq("tryoutAttemptId", attemptId)
                    .eq("sectionKey", question.section)
                    .eq("questionOrder", question.order)
              )
              .unique()
          )
        );
        assert.ok(placement, "Expected the fixture question.");
        const answers = FIXTURE_ANSWERS[question.section][question.order - 1];
        assert.ok(answers, "Expected the fixture answers of the question.");
        return yield* learner.mutation(tryouts.mutations.responses.save, {
          placementId: placement._id,
          response: question.pick === "clear" ? null : answers[question.pick],
          version: question.version ?? 1,
        });
      }),
    start: (args?: Parameters<typeof startArgs>[0]) =>
      learner.mutation(
        tryouts.mutations.attempts.startAttempt,
        startArgs(args)
      ),
    /** Starts one section of an attempt as the learner. */
    startSection: (attemptId: Id<"tryoutAttempts">, sectionKey: string) =>
      learner.mutation(tryouts.mutations.sections.start, {
        attemptId,
        sectionKey,
      }),
    /** Completes one section of an attempt as the learner. */
    completeSection: (attemptId: Id<"tryoutAttempts">, sectionKey: string) =>
      learner.mutation(tryouts.mutations.sections.complete, {
        attemptId,
        sectionKey,
      }),
    t,
    userId: seeded.learner.userId,
    visitor: client(t),
  };
});

/**
 * Starts, inside one mutation, the fixture set for `userId` from the active fixture snapshot, which
 * the caller activated, as the start mutation does, and returns the attempt's identifier.
 */
export async function insertStartedAttempt(
  ctx: MutationCtx,
  userId: Id<"users">,
  options?: Parameters<typeof startArgs>[0]
) {
  const started = await inMutation(() =>
    Effect.flatMap(Clock.currentTimeMillis, (now) =>
      startTryoutAttempt({ args: startArgs(options), now, userId })
    )
  )(ctx);
  return started.attemptId;
}

/** One seeded try-out world. */
export type TryoutWorld = Effect.Success<ReturnType<typeof tryoutWorld>>;
