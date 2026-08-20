// @vitest-environment node

import { Effect, Option } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
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
  return Effect.runPromise(readQuestionPreview(request));
}

/** Returns one expected preview failure. */
function runFailure(request = input) {
  return Effect.runPromise(readQuestionPreview(request).pipe(Effect.flip));
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
  it("leaves production and unrelated routes on their existing source", async () => {
    snapshotMock.mockReturnValueOnce(Effect.succeed(Option.none()));
    await expect(runPreview()).resolves.toEqual(Option.none());

    snapshotMock.mockReturnValueOnce(
      Effect.succeed(
        Option.some({
          config: previewConfig,
          manifest: makeReadyManifest(previewManifestHash),
        })
      )
    );
    await expect(runPreview()).resolves.toEqual(Option.none());

    provideManifest(makeQuestionReadyManifest(previewManifestHash));
    await expect(
      runPreview({ ...input, publicPath: `${input.publicPath}-other` })
    ).resolves.toEqual(Option.none());
    expect(executeMock).not.toHaveBeenCalled();
  });

  it("fails closed while the selected question compiles or fails", async () => {
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

    await expect(runFailure()).resolves.toMatchObject({
      _tag: "PreviewPendingError",
      revision: 1,
    });
    await expect(runFailure()).resolves.toMatchObject({
      _tag: "PreviewCompileError",
      code: "MDX_PARSE",
      message: "Compilation failed.",
    });
  });

  it("renders one authenticated prompt with its authored choices", async () => {
    const manifest = makeQuestionReadyManifest(previewManifestHash);
    provideManifest(manifest);

    const result = Option.getOrThrow(await runPreview());

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
  });

  it("renders the ordered prompt and entitled answer artifacts", async () => {
    const manifest = makeQuestionReadyManifest(previewManifestHash, "answer");
    provideManifest(manifest);

    const result = Option.getOrThrow(await runPreview());

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
  });

  it("rejects a prompt or answer projection from another content family", async () => {
    const materialProjection =
      makeReadyManifest(previewManifestHash).artifacts[0].projection;
    const promptManifest = makeQuestionReadyManifest(previewManifestHash);
    provideManifest({
      ...promptManifest,
      artifacts: [
        { ...promptManifest.artifacts[0], projection: materialProjection },
      ],
    });
    await expect(runFailure()).resolves.toMatchObject({
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
    await expect(runFailure()).resolves.toMatchObject({
      _tag: "PreviewIntegrityError",
      check: "projection",
    });
  });

  it("rejects an answer manifest that loses its second artifact", async () => {
    const manifest = makeQuestionReadyManifest(previewManifestHash, "answer");
    provideManifest({ ...manifest, artifacts: [manifest.artifacts[0]] });

    await expect(runFailure()).resolves.toMatchObject({
      _tag: "PreviewIntegrityError",
      check: "artifact",
    });
  });
});
