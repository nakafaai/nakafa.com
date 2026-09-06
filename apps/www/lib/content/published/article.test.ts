// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import {
  GitCommitShaSchema,
  ReleaseIdSchema,
} from "@nakafa/aksara-contracts/ids";
import { AppLocaleSchema } from "@nakafa/aksara-contracts/locale";
import { hashContentProjection } from "@nakafa/aksara-contracts/projection/hash";
import type { PublicContentRuntimeFound } from "@nakafa/aksara-contracts/runtime/spec";
import { ContentRuntimeVerificationError } from "@repo/backend/client/content/errors";
import {
  TEST_PROOF_RENDERER,
  testEmptyManifest,
  testSignedArtifact,
  testSignedRelease,
} from "@repo/backend/test/content/proof";
import { Effect } from "effect";
import {
  readPublishedArticle,
  renderArticleArtifact,
} from "@/lib/content/published/article";
import { ContentExecutionError } from "@/lib/content/published/errors";
import {
  testArticleProjection as projection,
  testArticleSourcePath as sourcePath,
} from "@/test/content-article";
import { previewProjection } from "@/test/content-preview";

const readMock = vi.hoisted(() => vi.fn());
const bodyMock = vi.hoisted(() => vi.fn());
const release = testSignedRelease(
  testEmptyManifest(ReleaseIdSchema.make("release-article-domain"))
);
const found: PublicContentRuntimeFound = {
  activeManifestHash: release.manifestHash,
  activeReleaseId: release.manifest.releaseId,
  artifact: testSignedArtifact("politics", {
    contentKey: projection.contentKey,
    rawMdx: "## Article delivery evidence\n\nThe signed article source.",
  }),
  delivery: "public",
  kind: "found",
  projection,
  projectionHash: hashContentProjection(projection),
  release,
  rendererManifest: TEST_PROOF_RENDERER,
  sourcePath,
};
const input = {
  activeReleaseId: found.activeReleaseId,
  appLocale: projection.appLocale,
  publicPath: projection.publicPath,
};

vi.mock("@repo/backend/client/content/public", () => ({
  readPublicContent: readMock,
}));
vi.mock("@repo/next-config/keys", () => ({
  contentRuntimeKeys: () => ({ CONTENT_RUNTIME_TOKEN: "test-runtime-token" }),
}));
vi.mock("@/env", () => ({
  env: { NEXT_PUBLIC_CONVEX_SITE_URL: "https://test.convex.site" },
}));
vi.mock("@/lib/content/renderer/manifest", () => ({
  rendererManifest: Effect.succeed(TEST_PROOF_RENDERER),
}));
vi.mock("@/lib/content/published/body", () => ({
  readRenderedBody: bodyMock,
}));

beforeEach(() => {
  readMock.mockReset().mockReturnValue(Effect.succeed(found));
  bodyMock.mockReset().mockReturnValue(Effect.succeed("cached-article-body"));
});

describe("published article delivery", () => {
  it.effect("keeps pinned source evidence with its signed rendered body", () =>
    Effect.gen(function* () {
      const data = yield* readPublishedArticle(input);

      expect(bodyMock).not.toHaveBeenCalled();
      expect(readMock).toHaveBeenCalledExactlyOnceWith(
        {
          siteUrl: "https://test.convex.site",
          token: "test-runtime-token",
        },
        { appLocale: input.appLocale, publicPath: input.publicPath },
        TEST_PROOF_RENDERER
      );
      expect(yield* renderArticleArtifact(data)).toEqual({
        activeReleaseId: found.activeReleaseId,
        artifactHash: found.artifact.artifactHash,
        body: "cached-article-body",
        categoryTitle: projection.categoryTitle,
        contentId: projection.graph.assetId,
        metadata: projection.metadata,
        official: projection.official,
        projection,
        publicPath: projection.publicPath,
        rawMdx: found.artifact.payload.rawMdx,
        references: projection.references,
        sourcePath,
        sourceRevision: GitCommitShaSchema.make("a".repeat(40)),
      });
      expect(bodyMock).toHaveBeenCalledExactlyOnceWith(found.artifact);
      expect(readMock).toHaveBeenCalledOnce();
    })
  );

  it.effect("rejects an article from a different signed release", () =>
    Effect.gen(function* () {
      const expectedReleaseId = ReleaseIdSchema.make("release-older");

      expect(
        yield* readPublishedArticle({
          ...input,
          activeReleaseId: expectedReleaseId,
        }).pipe(Effect.flip)
      ).toMatchObject({
        _tag: "PublishedReleaseMismatchError",
        actualReleaseId: found.activeReleaseId,
        expectedReleaseId,
      });
      expect(bodyMock).not.toHaveBeenCalled();
    })
  );

  it.effect.each([{ ...projection, unexpected: true }, previewProjection])(
    "rejects excess fields and a different content family",
    (invalid) =>
      Effect.gen(function* () {
        readMock.mockReturnValueOnce(
          Effect.succeed({ ...found, projection: invalid })
        );

        expect(
          yield* readPublishedArticle(input).pipe(Effect.flip)
        ).toMatchObject({
          _tag: "PublishedProjectionError",
          appLocale: input.appLocale,
          publicPath: input.publicPath,
        });
        expect(bodyMock).not.toHaveBeenCalled();
      })
  );

  it.effect.each([
    { ...input, appLocale: AppLocaleSchema.make("de") },
    { ...input, publicPath: "articles/politics/another-article" },
  ])(
    "rejects a projection selected for a different public identity",
    (request) =>
      Effect.gen(function* () {
        expect(
          yield* readPublishedArticle(request).pipe(Effect.flip)
        ).toMatchObject({
          _tag: "PublishedProjectionError",
          appLocale: request.appLocale,
          publicPath: request.publicPath,
        });
        expect(bodyMock).not.toHaveBeenCalled();
      })
  );

  it.effect("preserves signed-read failure before rendering", () =>
    Effect.gen(function* () {
      const failure = new ContentRuntimeVerificationError({
        cause: "Invalid article signature",
      });
      readMock.mockReturnValueOnce(Effect.fail(failure));

      expect(yield* readPublishedArticle(input).pipe(Effect.flip)).toBe(
        failure
      );
      expect(bodyMock).not.toHaveBeenCalled();
    })
  );

  it.effect("preserves a typed failure from the immutable body cache", () =>
    Effect.gen(function* () {
      const data = yield* readPublishedArticle(input);
      const failure = new ContentExecutionError({
        contentKey: found.artifact.payload.contentKey,
        stage: "evaluate",
      });
      bodyMock.mockReturnValueOnce(Effect.fail(failure));

      expect(yield* renderArticleArtifact(data).pipe(Effect.flip)).toBe(
        failure
      );
      expect(readMock).toHaveBeenCalledOnce();
    })
  );
});
