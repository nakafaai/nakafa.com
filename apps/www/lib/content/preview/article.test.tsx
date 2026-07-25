// @vitest-environment node

import { PublicPathSchema } from "@nakafa/aksara-contracts/ids";
import { Effect, Option } from "effect";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readArticlePreview } from "@/lib/content/preview/article";
import { executePreviewArtifact } from "@/lib/content/preview/artifact";
import { readPreviewSnapshot } from "@/lib/content/preview/manifest";
import {
  testArticleArtifact,
  testArticleProjection,
} from "@/test/content-article";
import {
  makePendingManifest,
  previewConfig,
  previewManifestHash,
  previewProjection,
} from "@/test/content-preview";
import {
  articlePendingManifest,
  makeArticleFailedManifest,
  makeArticleReadyManifest,
} from "@/test/preview-article";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/content/preview/artifact", () => ({
  executePreviewArtifact: vi.fn(),
}));
vi.mock("@/lib/content/preview/manifest", () => ({
  readPreviewSnapshot: vi.fn(),
}));

const executeMock = vi.mocked(executePreviewArtifact);
const snapshotMock = vi.mocked(readPreviewSnapshot);
const input = {
  locale: testArticleProjection.locale,
  publicPath: testArticleProjection.publicPath,
};

/** Runs the article preview program with typed failures preserved. */
function runPreview(request = input) {
  return Effect.runPromise(readArticlePreview(request));
}

/** Reads one expected local article preview failure. */
function runFailure(request = input) {
  return Effect.runPromise(readArticlePreview(request).pipe(Effect.flip));
}

beforeEach(() => {
  executeMock.mockReset();
  snapshotMock.mockReset();
  snapshotMock.mockReturnValue(Effect.succeed(Option.none()));
  executeMock.mockReturnValue(
    Effect.succeed({
      artifact: testArticleArtifact,
      /** Represents the reviewed article body returned by official MDX run. */
      Content: () => <h2>Political Maneuvers</h2>,
    })
  );
});

describe("local article preview", () => {
  it("leaves disabled, other-family, and other-route previews alone", async () => {
    await expect(runPreview()).resolves.toEqual(Option.none());

    snapshotMock.mockReturnValueOnce(
      Effect.succeed(
        Option.some({ config: previewConfig, manifest: makePendingManifest() })
      )
    );
    await expect(runPreview()).resolves.toEqual(Option.none());

    snapshotMock.mockReturnValueOnce(
      Effect.succeed(
        Option.some({ config: previewConfig, manifest: articlePendingManifest })
      )
    );
    await expect(
      runPreview({
        ...input,
        publicPath: PublicPathSchema.make(`${input.publicPath}-other`),
      })
    ).resolves.toEqual(Option.none());
    expect(executeMock).not.toHaveBeenCalled();
  });

  it("fails closed while the selected article compiles or reports an error", async () => {
    snapshotMock
      .mockReturnValueOnce(
        Effect.succeed(
          Option.some({
            config: previewConfig,
            manifest: articlePendingManifest,
          })
        )
      )
      .mockReturnValueOnce(
        Effect.succeed(
          Option.some({
            config: previewConfig,
            manifest: makeArticleFailedManifest(),
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

  it("renders the selected signed article through its real route registry", async () => {
    const manifest = makeArticleReadyManifest(previewManifestHash);
    snapshotMock.mockReturnValueOnce(
      Effect.succeed(Option.some({ config: previewConfig, manifest }))
    );

    const result = Option.getOrUndefined(await runPreview());

    expect(result).toMatchObject({
      body: testArticleArtifact.payload.rawMdx,
      categoryTitle: testArticleProjection.categoryTitle,
      metadata: testArticleProjection.metadata,
      references: testArticleProjection.references,
    });
    expect(renderToStaticMarkup(result?.children)).toBe(
      "<h2>Political Maneuvers</h2>"
    );
    expect(executeMock).toHaveBeenCalledWith({
      config: previewConfig,
      document: manifest.document,
      manifest,
      projection: testArticleProjection,
    });
  });

  it("rejects a ready manifest whose projection changes family", async () => {
    const manifest = makeArticleReadyManifest(previewManifestHash);
    snapshotMock.mockReturnValueOnce(
      Effect.succeed(
        Option.some({
          config: previewConfig,
          manifest: {
            ...manifest,
            artifacts: [
              {
                ...manifest.artifacts[0],
                projection: previewProjection,
              },
            ],
          },
        })
      )
    );

    await expect(runFailure()).resolves.toMatchObject({
      _tag: "PreviewIntegrityError",
      check: "projection",
    });
    expect(executeMock).not.toHaveBeenCalled();
  });
});
