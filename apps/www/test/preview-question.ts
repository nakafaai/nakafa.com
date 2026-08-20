import { Sha256HashSchema } from "@nakafa/aksara-contracts/ids";
import {
  QuestionAnswerPreviewDocumentSchema,
  QuestionPromptPreviewDocumentSchema,
} from "@nakafa/aksara-contracts/preview/document";
import {
  LOCAL_PREVIEW_FORMAT,
  localPreviewArtifactPath,
  PreviewFailedSchema,
  PreviewPendingSchema,
  PreviewReadySchema,
} from "@nakafa/aksara-contracts/preview/spec";
import { TryoutPreviewTargetSchema } from "@nakafa/aksara-contracts/preview/target";
import {
  QuestionAnswerProjectionSchema,
  QuestionPromptProjectionSchema,
} from "@nakafa/aksara-contracts/projection/question";
import { Schema } from "effect";
import { previewRepositories } from "@/test/content-preview";

const graph = {
  alignmentId: "alignment:test:preview",
  assetId: "asset:test:preview",
  conceptId: "concept:test:preview",
  learningObjectId: "lo:test:preview",
  lensId: "lens:test:preview",
};
const setKey = "question-bank/tryout/indonesia/snbt/general-reasoning/set-1";
const questionKey = `${setKey}/question-1`;
const questionRoot = `packages/corpus/${questionKey}`;
const sourceRevision = "test-preview";

/** Exact visible try-out target used only by Nakafa preview tests. */
export const questionPreviewTarget = Schema.decodeSync(
  TryoutPreviewTargetSchema
)({
  exam: {
    appLocale: "en",
    countryKey: "indonesia",
    examKey: "snbt",
    graph,
    kind: "exam",
    order: 1,
    publicPath: "try-out/indonesia/snbt",
    scoringStrategy: "irt",
    sourceRevision,
    title: "Test Exam",
  },
  placement: {
    answerArtifactLocale: "en",
    answerContentKey: `${questionKey}/answer`,
    appLocale: "en",
    countryKey: "indonesia",
    deliveryLanguage: "en",
    examKey: "snbt",
    questionArtifactLocale: "en",
    questionContentKey: `${questionKey}/question`,
    questionOrder: 1,
    questionSourcePath: questionRoot,
    rendererDomain: "snbt-general",
    scope: "server",
    sectionKey: "general-reasoning",
    setKey: "set-1",
    sourceRevision,
    trackKey: "2027",
  },
  section: {
    appLocale: "en",
    countryKey: "indonesia",
    examKey: "snbt",
    graph,
    kind: "section",
    order: 1,
    publicPath: "try-out/indonesia/snbt/2027/set-1/general-reasoning",
    questionCount: 20,
    questionSourcePath:
      "packages/corpus/question-bank/tryout/indonesia/snbt/general-reasoning/set-1",
    sectionKey: "general-reasoning",
    setKey: "set-1",
    sourceRevision,
    timeLimitSeconds: 1800,
    title: "Test Section",
    trackKey: "2027",
    visibility: "visible",
  },
  set: {
    appLocale: "en",
    countryKey: "indonesia",
    examKey: "snbt",
    graph,
    kind: "set",
    order: 1,
    publicPath: "try-out/indonesia/snbt/2027/set-1",
    questionCount: 20,
    scoringStrategy: "irt",
    sectionCount: 1,
    setKey: "set-1",
    sourceRevision,
    title: "Test Set",
    trackKey: "2027",
    visibleSectionCount: 1,
  },
  track: {
    appLocale: "en",
    countryKey: "indonesia",
    examKey: "snbt",
    graph,
    kind: "track",
    order: 1,
    publicPath: "try-out/indonesia/snbt/2027",
    questionCount: 20,
    sectionCount: 1,
    setCount: 1,
    sourceRevision,
    title: "Test Track",
    trackKey: "2027",
    trackKind: "year",
    visibleSectionCount: 1,
  },
});

const promptIdentity = {
  artifactLocale: "en",
  bodyKind: "question",
  contentKey: `${questionKey}/question`,
  peerContentKey: `${questionKey}/answer`,
  questionKey,
  questionNumber: 1,
  setKey,
} as const;
const answerIdentity = {
  ...promptIdentity,
  bodyKind: "answer",
  contentKey: `${questionKey}/answer`,
  peerContentKey: `${questionKey}/question`,
} as const;

/** Exact prompt document accepted by the local preview protocol. */
export const questionPromptDocument = Schema.decodeSync(
  QuestionPromptPreviewDocumentSchema
)({
  delivery: "authenticated",
  family: "question",
  identity: promptIdentity,
  rendererDomain: "snbt-general",
  sourcePath: `${questionRoot}/question.en.mdx`,
  target: questionPreviewTarget,
});

/** Exact answer document carrying its required prompt-first closure. */
export const questionAnswerDocument = Schema.decodeSync(
  QuestionAnswerPreviewDocumentSchema
)({
  delivery: "entitled",
  family: "question",
  identity: answerIdentity,
  rendererDomain: "snbt-general",
  sourcePath: `${questionRoot}/answer.en.mdx`,
  target: questionPreviewTarget,
});

const metadata = {
  authors: [{ name: "Test Author" }],
  date: "2026-07-24",
  title: "Test Preview",
};

/** Exact prompt projection with one correct authored choice. */
export const questionPromptProjection = Schema.decodeSync(
  QuestionPromptProjectionSchema
)({
  ...promptIdentity,
  choices: [
    { label: "Correct", value: true },
    { label: "Incorrect", value: false },
  ],
  kind: "question-body",
  metadata,
});

/** Exact answer projection paired with the selected prompt. */
export const questionAnswerProjection = Schema.decodeSync(
  QuestionAnswerProjectionSchema
)({
  ...answerIdentity,
  kind: "question-body",
  metadata,
});

export const questionPromptHash = Sha256HashSchema.make(
  `sha256:${"e".repeat(64)}`
);
export const questionAnswerHash = Sha256HashSchema.make(
  `sha256:${"f".repeat(64)}`
);

const promptArtifact = {
  artifactHash: questionPromptHash,
  artifactPath: localPreviewArtifactPath(questionPromptHash),
  projection: questionPromptProjection,
};
const answerArtifact = {
  artifactHash: questionAnswerHash,
  artifactPath: localPreviewArtifactPath(questionAnswerHash),
  projection: questionAnswerProjection,
};

/** Builds one coherent prompt or prompt-answer ready manifest. */
export function makeQuestionReadyManifest(
  rendererManifestHash: typeof Sha256HashSchema.Type,
  bodyKind: "answer" | "question" = "question"
) {
  return Schema.decodeSync(PreviewReadySchema)({
    artifacts:
      bodyKind === "answer"
        ? [promptArtifact, answerArtifact]
        : [promptArtifact],
    document:
      bodyKind === "answer" ? questionAnswerDocument : questionPromptDocument,
    format: LOCAL_PREVIEW_FORMAT,
    rendererManifestHash,
    repositories: previewRepositories,
    revision: 1,
    status: "ready",
  });
}

/** Builds one pending question manifest without stale artifact fallback. */
export function makeQuestionPendingManifest() {
  return Schema.decodeSync(PreviewPendingSchema)({
    document: questionPromptDocument,
    format: LOCAL_PREVIEW_FORMAT,
    repositories: previewRepositories,
    revision: 1,
    status: "pending",
  });
}

/** Builds one failed question manifest without stale artifact fallback. */
export function makeQuestionFailedManifest() {
  return Schema.decodeSync(PreviewFailedSchema)({
    document: questionPromptDocument,
    failure: { code: "MDX_PARSE", message: "Compilation failed." },
    format: LOCAL_PREVIEW_FORMAT,
    repositories: previewRepositories,
    revision: 1,
    status: "failed",
  });
}
