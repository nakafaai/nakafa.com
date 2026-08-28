// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { Effect, Option } from "effect";
import { vi } from "vitest";
import { executePreviewArtifact } from "@/lib/content/preview/artifact";
import { readPreviewSnapshot } from "@/lib/content/preview/manifest";
import {
  type QuestionPreviewInput,
  readQuestionPreview,
} from "@/lib/content/preview/question";
import {
  makeReadyManifest,
  previewConfig,
  previewManifestHash,
  previewWireArtifact,
} from "@/test/content-preview";
import {
  makeQuestionFailedManifest,
  makeQuestionPendingManifest,
  makeQuestionReadyManifest,
  questionAnswerHash,
  questionPreviewTarget,
  questionPromptHash,
} from "@/test/preview-question";

vi.mock("@/lib/content/preview/artifact", () => ({
  executePreviewArtifact: vi.fn(),
}));
vi.mock("@/lib/content/preview/manifest", () => ({
  readPreviewSnapshot: vi.fn(),
}));

const snapshotMock = vi.mocked(readPreviewSnapshot);
const executeMock = vi.mocked(executePreviewArtifact);
const input: QuestionPreviewInput = {
  appLocale: questionPreviewTarget.section.appLocale,
  publicPath: questionPreviewTarget.section.publicPath ?? "",
};

function QuestionContent() {
  return null;
}

function AnswerContent() {
  return null;
}

/** Runs one preview while preserving its typed domain failures. */
function runPreview(request = input) {
  return readQuestionPreview(request);
}

/** Returns one expected preview failure. */
function runFailure(request = input) {
  return readQuestionPreview(request).pipe(Effect.flip);
}

/** Supplies one exact provider snapshot to the reader boundary. */
function provideManifest(
  manifest: ReturnType<typeof makeQuestionReadyManifest>
) {
  snapshotMock.mockReturnValueOnce(
    Effect.succeed(Option.some({ config: previewConfig, manifest }))
  );
}

beforeEach(() => {
  snapshotMock.mockReset();
  executeMock.mockReset();
  executeMock.mockImplementation(({ previewArtifact }) =>
    Effect.succeed({
      artifact: previewWireArtifact,
      Content:
        previewArtifact.artifactHash === questionAnswerHash
          ? AnswerContent
          : QuestionContent,
    })
  );
});

describe("local question preview", () => {
  it.effect(
    "leaves production and unrelated routes on their existing source",
    () =>
      Effect.gen(function* () {
        snapshotMock.mockReturnValueOnce(Effect.succeed(Option.none()));
        expect(yield* runPreview()).toEqual(Option.none());

        snapshotMock.mockReturnValueOnce(
          Effect.succeed(
            Option.some({
              config: previewConfig,
              manifest: makeReadyManifest(previewManifestHash),
            })
          )
        );
        expect(yield* runPreview()).toEqual(Option.none());

        provideManifest(makeQuestionReadyManifest(previewManifestHash));
        expect(
          yield* runPreview({
            ...input,
            publicPath: `${input.publicPath}-other`,
          })
        ).toEqual(Option.none());
        expect(executeMock).not.toHaveBeenCalled();
      })
  );

  it.effect("fails closed while the selected question compiles or fails", () =>
    Effect.gen(function* () {
      snapshotMock
        .mockReturnValueOnce(
          Effect.succeed(
            Option.some({
              config: previewConfig,
              manifest: makeQuestionPendingManifest(),
            })
          )
        )
        .mockReturnValueOnce(
          Effect.succeed(
            Option.some({
              config: previewConfig,
              manifest: makeQuestionFailedManifest(),
            })
          )
        );

      expect(yield* runFailure()).toMatchObject({
        _tag: "PreviewPendingError",
        revision: 1,
      });
      expect(yield* runFailure()).toMatchObject({
        _tag: "PreviewCompileError",
        code: "MDX_PARSE",
        message: "Compilation failed.",
      });
    })
  );

  it.effect("renders one authenticated prompt with its authored choices", () =>
    Effect.gen(function* () {
      const manifest = makeQuestionReadyManifest(previewManifestHash);
      provideManifest(manifest);

      const result = Option.getOrThrow(yield* runPreview());

      expect(result).toMatchObject({
        Answer: null,
        Question: QuestionContent,
        choices: [
          { label: "Correct", value: true },
          { label: "Incorrect", value: false },
        ],
        selectedBodyKind: "question",
      });
      expect(executeMock).toHaveBeenCalledOnce();
      expect(executeMock).toHaveBeenCalledWith(
        expect.objectContaining({ previewArtifact: manifest.artifacts[0] })
      );
    })
  );

  it.effect("renders the ordered prompt and entitled answer artifacts", () =>
    Effect.gen(function* () {
      const manifest = makeQuestionReadyManifest(previewManifestHash, "answer");
      provideManifest(manifest);

      const result = Option.getOrThrow(yield* runPreview());

      expect(result).toMatchObject({
        Answer: AnswerContent,
        Question: QuestionContent,
        selectedBodyKind: "answer",
      });
      expect(executeMock).toHaveBeenCalledTimes(2);
      expect(executeMock).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          previewArtifact: expect.objectContaining({
            artifactHash: questionPromptHash,
          }),
        })
      );
      expect(executeMock).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          previewArtifact: expect.objectContaining({
            artifactHash: questionAnswerHash,
          }),
        })
      );
    })
  );

  it.effect(
    "rejects a prompt or answer projection from another content family",
    () =>
      Effect.gen(function* () {
        const materialProjection =
          makeReadyManifest(previewManifestHash).artifacts[0].projection;
        const promptManifest = makeQuestionReadyManifest(previewManifestHash);
        provideManifest({
          ...promptManifest,
          artifacts: [
            { ...promptManifest.artifacts[0], projection: materialProjection },
          ],
        });
        expect(yield* runFailure()).toMatchObject({
          _tag: "PreviewIntegrityError",
          check: "projection",
        });

        const answerManifest = makeQuestionReadyManifest(
          previewManifestHash,
          "answer"
        );
        provideManifest({
          ...answerManifest,
          artifacts: [
            answerManifest.artifacts[0],
            { ...answerManifest.artifacts[1], projection: materialProjection },
          ],
        });
        expect(yield* runFailure()).toMatchObject({
          _tag: "PreviewIntegrityError",
          check: "projection",
        });
      })
  );

  it.effect("rejects an answer manifest that loses its second artifact", () =>
    Effect.gen(function* () {
      const manifest = makeQuestionReadyManifest(previewManifestHash, "answer");
      provideManifest({ ...manifest, artifacts: [manifest.artifacts[0]] });

      expect(yield* runFailure()).toMatchObject({
        _tag: "PreviewIntegrityError",
        check: "artifact",
      });
    })
  );
});
