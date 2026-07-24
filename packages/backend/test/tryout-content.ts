import { tryoutCatalogIdentity } from "@nakafa/aksara-contracts/tryout/identity";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import type { AttemptEndReason } from "@repo/backend/convex/lib/attempts";
import { seedAuthenticatedUser } from "@repo/backend/convex/test.helpers";
import type {
  TryoutAttemptAccessSourceKind,
  TryoutStatus,
} from "@repo/backend/convex/tryouts/schema";
import { testArtifactJson } from "@repo/backend/test/content-artifact";
import {
  insertTryoutQuestionSource,
  insertTryoutSection,
  insertTryoutSet,
  TRYOUT_SECTION_KEY,
  TRYOUT_TEST_NOW,
} from "@repo/backend/test/tryouts";

const QUESTION_ROOT =
  "question-bank/tryout/indonesia/snbt/mathematical-reasoning/set-1";
const TRYOUT_RENDERER_DOMAIN = "snbt-math";

/** Returns the stored terminal reason matching one fixture status. */
function endReason(status: TryoutStatus): AttemptEndReason | null {
  if (status === "in-progress") {
    return null;
  }
  return status === "completed" ? "submitted" : "time-expired";
}

/** Builds one stable lowercase technical hash unique to its fixture namespace. */
function artifactHash(index: number, namespace: string) {
  let value = index;
  for (const character of namespace) {
    value = (value * 31 + character.charCodeAt(0)) % 4_294_967_296;
  }
  return `sha256:${value.toString(16).padStart(64, "0")}`;
}

/** Builds the real question-bank content identity for one fixture body. */
function contentKey(index: number, kind: "answer" | "question") {
  return `${QUESTION_ROOT}/question-${index}/${kind}`;
}

/** Inserts one signed technical artifact referenced by a placement fixture. */
function insertArtifact(
  ctx: MutationCtx,
  args: {
    artifactHash: string;
    compiledBytes: number;
    contentKey: string;
  }
) {
  return ctx.db.insert("contentArtifacts", {
    artifactHash: args.artifactHash,
    artifactJson: testArtifactJson({
      artifactHash: args.artifactHash,
      compiledCode: `/*${"x".repeat(args.compiledBytes)}*/\nreturn {};`,
      contentKey: args.contentKey,
      locale: "id",
      rendererDomain: TRYOUT_RENDERER_DOMAIN,
    }),
    createdAt: TRYOUT_TEST_NOW,
    retainUntil: TRYOUT_TEST_NOW,
  });
}

/** Inserts one question source and its frozen attempt placement. */
async function insertPlacement(
  ctx: MutationCtx,
  args: {
    compiledBytes: number;
    includeReferences: boolean;
    index: number;
    namespace: string;
    questionSetId: Id<"questionSets">;
    tryoutAttemptId: Id<"tryoutAttempts">;
    tryoutSectionId: Id<"tryoutSections">;
  }
) {
  const questionContentKey = contentKey(args.index, "question");
  const answerContentKey = contentKey(args.index, "answer");
  const questionArtifactHash = artifactHash(args.index, args.namespace);
  const answerArtifactHash = artifactHash(args.index + 1000, args.namespace);
  const sourcePath = `${QUESTION_ROOT}/question-${args.index}`;
  const questionId = await ctx.db.insert("questions", {
    answerBody: "Technical answer fixture",
    contentHash: `${sourcePath}:hash`,
    date: 0,
    locale: "id",
    number: args.index,
    questionBody: "Technical question fixture",
    questionSetId: args.questionSetId,
    sourceKey: `${sourcePath}:question`,
    sourcePath,
    sourceRevision: "2026",
    syncedAt: TRYOUT_TEST_NOW,
    title: `Technical question ${args.index}`,
  });

  if (args.includeReferences) {
    await insertArtifact(ctx, {
      artifactHash: questionArtifactHash,
      compiledBytes: args.compiledBytes,
      contentKey: questionContentKey,
    });
    await insertArtifact(ctx, {
      artifactHash: answerArtifactHash,
      compiledBytes: 16,
      contentKey: answerContentKey,
    });
  }

  const placementId = await ctx.db.insert("tryoutAttemptPlacements", {
    ...(args.includeReferences
      ? {
          answerArtifactHash,
          answerContentKey,
          questionArtifactHash,
          questionContentKey,
          rendererDomain: TRYOUT_RENDERER_DOMAIN,
        }
      : {}),
    choiceSnapshots: [
      { isCorrect: true, label: "A", optionKey: "a", order: 1 },
    ],
    contentHash: `${sourcePath}:hash`,
    questionId,
    questionOrder: args.index,
    questionSourceKey: `${sourcePath}:question`,
    sectionKey: TRYOUT_SECTION_KEY,
    sourcePath,
    sourceRevision: "2026",
    title: `Technical question ${args.index}`,
    tryoutAttemptId: args.tryoutAttemptId,
    tryoutSectionId: args.tryoutSectionId,
  });

  return {
    answerArtifactHash,
    answerContentKey,
    placementId,
    questionArtifactHash,
    questionContentKey,
    questionId,
  };
}

/** Reads one required fixture value without unsafe non-null assertions. */
export function requireFixtureValue<A>(values: readonly A[]) {
  const value = values.at(0);
  if (value === undefined) {
    throw new Error("Expected one try-out content fixture value.");
  }
  return value;
}

/** Exact identities returned by the attempt-owned artifact fixture builder. */
export interface TryoutContentFixture {
  readonly answerHashes: readonly string[];
  readonly answerKeys: readonly string[];
  readonly attemptId: Id<"tryoutAttempts">;
  readonly identity: Awaited<ReturnType<typeof seedAuthenticatedUser>>;
  readonly placementIds: readonly Id<"tryoutAttemptPlacements">[];
  readonly questionHashes: readonly string[];
  readonly questionIds: readonly Id<"questions">[];
  readonly questionKeys: readonly string[];
  readonly sectionAttemptId: Id<"tryoutSectionAttempts">;
  readonly sectionKey: string;
  readonly tryoutSetId: Id<"tryoutSets">;
}

/** Seeds an owned attempt with exact frozen question and answer artifacts. */
export async function seedTryoutArtifactState(
  ctx: MutationCtx,
  args: {
    accessSourceKind?: TryoutAttemptAccessSourceKind;
    attemptStatus?: TryoutStatus;
    compiledBytes?: number;
    includeReferences?: boolean;
    placementCount?: number;
    sectionStatus?: TryoutStatus;
    suffix: string;
  }
): Promise<TryoutContentFixture> {
  const attemptStatus = args.attemptStatus ?? "in-progress";
  const sectionStatus = args.sectionStatus ?? attemptStatus;
  const placementCount = args.placementCount ?? 1;
  const identity = await seedAuthenticatedUser(ctx, {
    now: TRYOUT_TEST_NOW,
    suffix: args.suffix,
  });
  const tryoutSetId = await insertTryoutSet(ctx, {
    totalQuestionCount: placementCount,
  });
  const questionSetId = await insertTryoutQuestionSource(ctx, {
    questionCount: placementCount,
    sourcePath: QUESTION_ROOT,
    withQuestion: false,
  });
  const tryoutSectionId = await insertTryoutSection(ctx, {
    questionCount: placementCount,
    questionSetId,
    questionSourcePath: QUESTION_ROOT,
    tryoutSetId,
  });
  const attemptId = await ctx.db.insert("tryoutAttempts", {
    accessEndsAt: TRYOUT_TEST_NOW + 86_400_000,
    accessSourceKind: args.accessSourceKind ?? "free",
    attemptNumber: 1,
    completedAt: attemptStatus === "in-progress" ? null : TRYOUT_TEST_NOW,
    completedSectionKeys:
      sectionStatus === "in-progress" ? [] : [TRYOUT_SECTION_KEY],
    countsForCompetition: args.accessSourceKind === "competition",
    countryKey: "indonesia",
    endReason: endReason(attemptStatus),
    examKey: "snbt",
    expiresAt: TRYOUT_TEST_NOW + 86_400_000,
    lastActivityAt: TRYOUT_TEST_NOW,
    locale: "id",
    scoreStatus: "official",
    scoringStrategy: "raw",
    sectionSnapshots: [
      {
        questionCount: placementCount,
        questionSetId,
        questionSourcePath: QUESTION_ROOT,
        sectionKey: TRYOUT_SECTION_KEY,
        sectionOrder: 1,
        sourceRevision: "2026",
        timeLimitSeconds: 1800,
        tryoutSectionId,
      },
    ],
    setIdentity: tryoutCatalogIdentity({
      countryKey: "indonesia",
      examKey: "snbt",
      kind: "set",
      locale: "id",
      setKey: "set-1",
      trackKey: "2027",
    }),
    setKey: "set-1",
    startedAt: TRYOUT_TEST_NOW,
    status: attemptStatus,
    totalCorrect: 0,
    totalQuestions: placementCount,
    trackKey: "2027",
    tryoutSetId,
    userId: identity.userId,
  });
  const sectionAttemptId = await ctx.db.insert("tryoutSectionAttempts", {
    answeredCount: 0,
    completedAt: sectionStatus === "in-progress" ? null : TRYOUT_TEST_NOW,
    correctAnswers: 0,
    endReason: endReason(sectionStatus),
    expiresAt: TRYOUT_TEST_NOW + 86_400_000,
    lastActivityAt: TRYOUT_TEST_NOW,
    sectionKey: TRYOUT_SECTION_KEY,
    sectionOrder: 1,
    startedAt: TRYOUT_TEST_NOW,
    status: sectionStatus,
    totalQuestions: placementCount,
    tryoutAttemptId: attemptId,
    tryoutSectionId,
  });

  const placements: Awaited<ReturnType<typeof insertPlacement>>[] = [];
  for (let index = 1; index <= placementCount; index += 1) {
    placements.push(
      await insertPlacement(ctx, {
        compiledBytes: args.compiledBytes ?? 16,
        includeReferences: args.includeReferences ?? true,
        index,
        namespace: args.suffix,
        questionSetId,
        tryoutAttemptId: attemptId,
        tryoutSectionId,
      })
    );
  }

  return {
    answerHashes: placements.map(
      ({ answerArtifactHash }) => answerArtifactHash
    ),
    answerKeys: placements.map(({ answerContentKey }) => answerContentKey),
    attemptId,
    identity,
    placementIds: placements.map(({ placementId }) => placementId),
    questionHashes: placements.map(
      ({ questionArtifactHash }) => questionArtifactHash
    ),
    questionIds: placements.map(({ questionId }) => questionId),
    questionKeys: placements.map(
      ({ questionContentKey }) => questionContentKey
    ),
    sectionAttemptId,
    sectionKey: TRYOUT_SECTION_KEY,
    tryoutSetId,
  };
}
