import { ContentVerificationKeyResolver } from "@nakafa/aksara-contracts/signature/spec";
import {
  type StoredProtectedRuntimeFound,
  StoredProtectedRuntimeFoundSchema,
  type StoredProtectedRuntimeRequest,
  StoredProtectedRuntimeRequestSchema,
} from "@nakafa/aksara-history/history/decode";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { retainedTryoutHistoryPlan } from "@repo/backend/convex/tryouts/history/spec";
import { Effect, Schema } from "effect";

export const RETAINED_RUNTIME_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEA8CkCLtsNT5jK7aJUHJZDW2xmMLFegNT2t+u6Ejv1igU=
-----END PUBLIC KEY-----
`;

export const retainedRuntimeKeyResolver = ContentVerificationKeyResolver.of({
  resolve: () => Effect.succeed(RETAINED_RUNTIME_PUBLIC_KEY),
});

export const RETAINED_RUNTIME_SNAPSHOT_ID =
  retainedTryoutHistoryPlan.snapshotId;
export const RETAINED_RUNTIME_RELEASE_ID = "retained-runtime-test-release";
const retainedRendererDomain = "snbt-general";
const questionRoot =
  "question-bank/tryout/indonesia/snbt/general-reasoning/set-1/question-1";
const historicalDomains = [
  "ai-ds",
  "biology",
  "chemistry",
  "mathematics",
  "physics",
  "politics",
  "snbt-general",
  "snbt-math",
  "snbt-plain",
  "snbt-quant",
  "tka-math",
];
const rendererCapability = {
  authoringComponents: [{ name: "BlockMath", version: 1 }],
  supportedComponents: [{ name: "BlockMath", version: 1 }],
};

export const RETAINED_RUNTIME_RENDERER = {
  base: rendererCapability,
  domains: historicalDomains.map((name) => ({
    authoringComponents: [],
    name,
    supportedComponents: [],
  })),
  format: "nakafa-mdx-renderer-v1",
  hash: "sha256:3c9d887a434a5a0cb5b6852e7d9ec8cbeb993098013b75619a4e332e78576847",
  publishedDomains: ["snbt-general"],
  rendererContractVersion: "1.0.0",
};

export const RETAINED_RUNTIME_QUESTION = {
  artifactHash:
    "sha256:16a285d42daff0ec95dee67d126ab8e99851e6633f378b48d29f7c9ad3a3e173",
  keyId: "retained-runtime-test-key",
  payload: {
    byteLength: 31,
    compiledCode: "return { default: () => null };",
    compilerConfigHash: `sha256:${"1".repeat(64)}`,
    compilerVersion: "0.1.0",
    contentKey: `${questionRoot}/question`,
    format: "mdx-function-body-v1",
    locale: "en",
    mdxCompilerVersion: "3.1.1",
    plainText: "Retained question",
    rawMdx: "# Retained question",
    rendererDomain: retainedRendererDomain,
    requiredComponents: [{ name: "BlockMath", version: 1 }],
    sourceHash:
      "sha256:89d61668075d8af7b5cec9489dc9ecbe7bcde0665441eb66ef7d0aeecd809273",
  },
  signature:
    "mrn9hsXM22W-olZlNTiDt1wBJtgVI0MJdntVy9NBnSDdvfict7lfcPnWX1CPdFCLeuqCE6f99THbalQA_6gdDA",
};

export const RETAINED_RUNTIME_ANSWER = {
  artifactHash:
    "sha256:648b1fe4f4ab6bdbd1fee6794f24fdf114ba5e67bf8a3d9200b044360d5343ef",
  keyId: "retained-runtime-test-key",
  payload: {
    ...RETAINED_RUNTIME_QUESTION.payload,
    contentKey: `${questionRoot}/answer`,
    plainText: "Retained answer",
    rawMdx: "#### Retained answer",
    sourceHash:
      "sha256:da81c1dd1410c406cf7558552af5221698b1df34f3f0bbc16b4e383112e814c3",
  },
  signature:
    "Ka5-H6Vwp52HtbgT9yEfPYfhrMXtG_rVkZtTt5fgPo60sj7Zls83CgBwoChAymzF2_tKQPc_z1z8c_zLfBoQDg",
};

export const RETAINED_RUNTIME_RELEASE = {
  keyId: "retained-runtime-test-key",
  manifest: {
    baseManifestHash: null,
    baseReleaseId: null,
    baseResultCount: 0,
    baseResultDigest:
      "sha256:ed7d49e237dadbd311a1599264b00852ae18657d123c8f9cbc26c1c62c8f81cd",
    deleteCount: 0,
    itemCount: 0,
    itemsDigest: `sha256:${"1".repeat(64)}`,
    origin: { kind: "git", sha: "a".repeat(40) },
    projectionCount: 0,
    projectionDigest: `sha256:${"2".repeat(64)}`,
    releaseId: RETAINED_RUNTIME_RELEASE_ID,
    rendererContractVersion: "1.0.0",
    rendererManifestHash: RETAINED_RUNTIME_RENDERER.hash,
    resultCount: 0,
    resultDigest:
      "sha256:ed7d49e237dadbd311a1599264b00852ae18657d123c8f9cbc26c1c62c8f81cd",
    rollbackCount: 0,
    rollbackDigest: `sha256:${"4".repeat(64)}`,
    routeCount: 0,
    routeDigest: `sha256:${"5".repeat(64)}`,
    scope: { content: [], families: [], snapshots: ["tryout"] },
    snapshots: {
      program: {
        baseSnapshotId: null,
        mode: "inherit",
        resultSnapshotId: null,
        rowCount: 0,
        rowDigest:
          "sha256:eb27aa7f59e41b14a3f76d951c5a50cb954a19f3f6e6c44bc21a733f606e888f",
      },
      quran: {
        baseSnapshotId: null,
        mode: "inherit",
        resultSnapshotId: null,
        rowCount: 0,
        rowDigest:
          "sha256:eb27aa7f59e41b14a3f76d951c5a50cb954a19f3f6e6c44bc21a733f606e888f",
      },
      tryout: {
        baseSnapshotId: null,
        mode: "replace",
        resultSnapshotId: RETAINED_RUNTIME_SNAPSHOT_ID,
        rowCount: 1,
        rowDigest: `sha256:${"7".repeat(64)}`,
      },
    },
    upsertCount: 0,
  },
  manifestHash:
    "sha256:b88717c38bfe73b9c2405965cadf71334fe5d750952b36d76678025a6f63ef35",
  signature:
    "JvlUtfXXK7CWN5hziGDqxTpdnBQmuwle4lCKZHD--q_BDU8t1mQ6s4lTojbcAmeyJoNNIoXNiu_fMIH9Bx_cAA",
};

export const RETAINED_RUNTIME_PLACEMENT = {
  answerArtifactHash: RETAINED_RUNTIME_ANSWER.artifactHash,
  answerContentKey: RETAINED_RUNTIME_ANSWER.payload.contentKey,
  choices: [
    { isCorrect: true, label: "A", optionKey: "option-1", order: 1 },
    { isCorrect: false, label: "B", optionKey: "option-2", order: 2 },
  ],
  contentHash: "e".repeat(64),
  countryKey: "indonesia",
  examKey: "snbt",
  locale: "en",
  questionArtifactHash: RETAINED_RUNTIME_QUESTION.artifactHash,
  questionContentKey: RETAINED_RUNTIME_QUESTION.payload.contentKey,
  questionOrder: 1,
  questionSourcePath: `packages/corpus/${questionRoot}`,
  rendererDomain: retainedRendererDomain,
  scope: "server",
  sectionKey: "general-reasoning",
  setKey: "set-1",
  sourceRevision: "retained-source",
  title: "Question 1",
  trackKey: "2027",
};
export const RETAINED_RUNTIME_PLACEMENT_HASH =
  "sha256:2e0183f410950cb7e755ce3c99153ae73887f5bd995e4f7326bca89f9479cbb9";

/** Fixed authenticated envelope shared by retained-reader tests. */
export const RETAINED_RUNTIME_PLACEMENT_ROW = {
  family: "tryout",
  record: {
    row: RETAINED_RUNTIME_PLACEMENT,
    rowHash: RETAINED_RUNTIME_PLACEMENT_HASH,
  },
  rowKind: "placement",
};

/** Builds one found response from fixed synthetic immutable history bytes. */
export function retainedRuntimeFound(
  attemptId: string
): StoredProtectedRuntimeFound {
  return Schema.decodeUnknownSync(StoredProtectedRuntimeFoundSchema)({
    appLocale: "en",
    attemptId,
    items: [
      {
        artifact: RETAINED_RUNTIME_QUESTION,
        delivery: "authenticated",
        sourcePath: `${RETAINED_RUNTIME_PLACEMENT.questionSourcePath}/question.en.mdx`,
      },
    ],
    kind: "found",
    release: RETAINED_RUNTIME_RELEASE,
    rendererManifest: RETAINED_RUNTIME_RENDERER,
    snapshotId: RETAINED_RUNTIME_SNAPSHOT_ID,
    snapshotManifestHash: RETAINED_RUNTIME_RELEASE.manifestHash,
    snapshotReleaseId: RETAINED_RUNTIME_RELEASE_ID,
  });
}

/** Inserts one fixed synthetic attempt and its exact retained history bytes. */
export async function insertRetainedRuntime(
  ctx: MutationCtx,
  args: { readonly appLocale?: "en" | "id" } = {}
): Promise<{ readonly request: StoredProtectedRuntimeRequest }> {
  const appLocale = args.appLocale ?? "en";
  const userId = await ctx.db.insert("users", {
    authId: "retained-runtime-test-user",
    credits: 0,
    creditsResetAt: 1,
    email: "retained-runtime@example.com",
    name: "Retained Runtime",
    plan: "pro",
  });
  const attemptId = await ctx.db.insert("tryoutAttempts", {
    accessEndsAt: 10,
    accessSourceKind: "free",
    appLocale,
    attemptNumber: 1,
    completedAt: null,
    completedSectionKeys: [],
    countsForCompetition: false,
    countryKey: "indonesia",
    endReason: null,
    examKey: "snbt",
    expiresAt: 10,
    lastActivityAt: 1,
    locale: appLocale,
    scoreStatus: "official",
    scoringStrategy: "raw",
    sectionSnapshots: [],
    setIdentity: "retained-set",
    setKey: "set-1",
    setPublicPath: "try-out/indonesia/snbt/2027/set-1",
    snapshotReleaseId: RETAINED_RUNTIME_RELEASE_ID,
    startedAt: 1,
    status: "in-progress",
    totalCorrect: 0,
    totalQuestions: 1,
    trackKey: "2027",
    tryoutSnapshotId: RETAINED_RUNTIME_SNAPSHOT_ID,
    userId,
  });
  await ctx.db.insert("tryoutAttemptHistory", {
    snapshotReleaseId: RETAINED_RUNTIME_RELEASE_ID,
    tryoutAttemptId: attemptId,
    tryoutSnapshotId: RETAINED_RUNTIME_SNAPSHOT_ID,
  });
  await ctx.db.insert("tryoutHistoryRows", {
    answerArtifactHash: RETAINED_RUNTIME_PLACEMENT.answerArtifactHash,
    index: 54,
    questionArtifactHash: RETAINED_RUNTIME_PLACEMENT.questionArtifactHash,
    rowHash: RETAINED_RUNTIME_PLACEMENT_HASH,
    rowJson: JSON.stringify(RETAINED_RUNTIME_PLACEMENT_ROW),
    rowKind: "placement",
    snapshotId: RETAINED_RUNTIME_SNAPSHOT_ID,
  });
  await ctx.db.insert("tryoutAttemptPlacements", {
    answerArtifactHash: RETAINED_RUNTIME_PLACEMENT.answerArtifactHash,
    answerContentKey: RETAINED_RUNTIME_PLACEMENT.answerContentKey,
    choiceSnapshots: RETAINED_RUNTIME_PLACEMENT.choices,
    contentHash: RETAINED_RUNTIME_PLACEMENT.contentHash,
    placementIdentity: "retained-placement",
    placementRowHash: RETAINED_RUNTIME_PLACEMENT_HASH,
    questionArtifactHash: RETAINED_RUNTIME_PLACEMENT.questionArtifactHash,
    questionContentKey: RETAINED_RUNTIME_PLACEMENT.questionContentKey,
    questionOrder: RETAINED_RUNTIME_PLACEMENT.questionOrder,
    rendererDomain: retainedRendererDomain,
    sectionIdentity: "retained-section",
    sectionKey: RETAINED_RUNTIME_PLACEMENT.sectionKey,
    sourcePath: RETAINED_RUNTIME_PLACEMENT.questionSourcePath,
    sourceRevision: RETAINED_RUNTIME_PLACEMENT.sourceRevision,
    title: RETAINED_RUNTIME_PLACEMENT.title,
    tryoutAttemptId: attemptId,
  });
  await ctx.db.insert("tryoutBundles", {
    createdAt: 1,
    index: 0,
    manifestHash: RETAINED_RUNTIME_RELEASE.manifestHash,
    releaseId: RETAINED_RUNTIME_RELEASE_ID,
    releaseJson: JSON.stringify(RETAINED_RUNTIME_RELEASE),
    rendererJson: JSON.stringify(RETAINED_RUNTIME_RENDERER),
    snapshotId: RETAINED_RUNTIME_SNAPSHOT_ID,
  });
  for (const artifact of [RETAINED_RUNTIME_QUESTION, RETAINED_RUNTIME_ANSWER]) {
    await ctx.db.insert("contentArtifacts", {
      artifactHash: artifact.artifactHash,
      artifactJson: JSON.stringify(artifact),
      createdAt: 1,
      retainUntil: Number.MAX_SAFE_INTEGER,
    });
  }
  return {
    request: Schema.decodeUnknownSync(StoredProtectedRuntimeRequestSchema)({
      appLocale,
      attemptId,
      selectors: [
        {
          artifactHash: RETAINED_RUNTIME_QUESTION.artifactHash,
          artifactLocale: "en",
          contentKey: RETAINED_RUNTIME_QUESTION.payload.contentKey,
          delivery: "authenticated",
        },
      ],
      snapshotId: RETAINED_RUNTIME_SNAPSHOT_ID,
      snapshotReleaseId: RETAINED_RUNTIME_RELEASE_ID,
    }),
  };
}
