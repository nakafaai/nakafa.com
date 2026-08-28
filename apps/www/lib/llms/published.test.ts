// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import {
  GitCommitShaSchema,
  ReleaseIdSchema,
} from "@nakafa/aksara-contracts/ids";
import { Data, Effect } from "effect";
import { vi } from "vitest";
import { readPublishedPage } from "@/lib/content/page/published";
import { readPublishedArticle } from "@/lib/content/published/article";
import { readPublishedMaterial } from "@/lib/content/published/material";
import { rendererManifest } from "@/lib/content/renderer/manifest";
import { getCachedPublishedText } from "@/lib/llms/published";
import {
  testArticleArtifact,
  testArticleProjection,
  testArticleSourcePath,
} from "@/test/content-article";
import { testPageArtifact, testPageProjection } from "@/test/content-page";
import {
  previewMetadata,
  previewProjection,
  previewSourcePath,
  previewWireArtifact,
} from "@/test/content-preview";

const cacheLifeMock = vi.hoisted(() => vi.fn());
const cacheTagMock = vi.hoisted(() => vi.fn());
const readArticleMock = vi.hoisted(() => vi.fn());
const readMaterialMock = vi.hoisted(() => vi.fn());
const readPageMock = vi.hoisted(() => vi.fn());
const sourceRevision = GitCommitShaSchema.make("a".repeat(40));

/** Test-only typed failure for the cached Promise boundary. */
class TestPublishedTextError extends Data.TaggedError(
  "TestPublishedTextError"
)<{
  readonly cause: unknown;
}> {}

const rawMdx = `## What is a Function?

A function maps one input to exactly one output.

<FunctionMachine />`;

const preparePublishedFixtures = Effect.fn(
  "llms.test.preparePublishedFixtures"
)(function* () {
  const liveRenderer = yield* rendererManifest;
  const materialData = {
    activeReleaseId: ReleaseIdSchema.make("release-function-concept"),
    artifact: {
      ...previewWireArtifact,
      payload: {
        ...previewWireArtifact.payload,
        rawMdx,
      },
    },
    metadata: previewMetadata,
    projection: previewProjection,
    rendererManifest: liveRenderer,
    sourcePath: previewSourcePath,
    sourceRevision,
  };
  const articleData = {
    activeReleaseId: ReleaseIdSchema.make("release-article"),
    artifact: testArticleArtifact,
    projection: testArticleProjection,
    rendererManifest: liveRenderer,
    sourcePath: testArticleSourcePath,
    sourceRevision,
  };
  const pageData = {
    activeReleaseId: ReleaseIdSchema.make("release-pages"),
    artifact: testPageArtifact,
    projection: testPageProjection,
    rendererManifest: liveRenderer,
    sourcePath: testPageProjection.sourcePath,
    sourceRevision,
  };

  yield* Effect.sync(() => {
    readArticleMock.mockReturnValue(Effect.succeed(articleData));
    readMaterialMock.mockReturnValue(Effect.succeed(materialData));
    readPageMock.mockReturnValue(Effect.succeed(pageData));
  });

  return { articleData, materialData, pageData } as const;
});

vi.mock("next/cache", () => ({
  cacheLife: cacheLifeMock,
  cacheTag: cacheTagMock,
}));
vi.mock("@/lib/content/published/material", () => ({
  readPublishedMaterial: readMaterialMock,
}));
vi.mock("@/lib/content/published/article", () => ({
  readPublishedArticle: readArticleMock,
}));
vi.mock("@/lib/content/page/published", () => ({
  readPublishedPage: readPageMock,
}));
beforeEach(() => {
  cacheLifeMock.mockReset();
  cacheTagMock.mockReset();
  readArticleMock.mockReset();
  readMaterialMock.mockReset();
  readPageMock.mockReset();
});

describe("published llms markdown", () => {
  it.effect(
    "projects verified source with immutable provenance and exact cache tags",
    () =>
      Effect.gen(function* () {
        const { materialData } = yield* preparePublishedFixtures();
        const text = yield* Effect.tryPromise(() =>
          getCachedPublishedText({
            activeReleaseId: materialData.activeReleaseId,
            appLocale: previewProjection.appLocale,
            family: "material",
            publicPath: previewProjection.publicPath,
          })
        );

        expect(text).toContain(previewMetadata.description);
        expect(text).toContain("What is a Function?");
        expect(text).toContain("Component: FunctionMachine");
        expect(text).toContain(
          `https://raw.githubusercontent.com/nakafaai/aksara/${sourceRevision}/${previewSourcePath}`
        );
        expect(readPublishedMaterial).toHaveBeenCalledWith({
          activeReleaseId: materialData.activeReleaseId,
          appLocale: previewProjection.appLocale,
          family: "material",
          publicPath: previewProjection.publicPath,
        });
        expect(cacheLifeMock).toHaveBeenCalledWith("contentRuntime");
        expect(cacheTagMock).toHaveBeenCalledWith(
          "content-runtime",
          "content-family:material",
          `content-artifact:${materialData.artifact.artifactHash}`
        );
      })
  );

  it.effect(
    "selects article metadata and provenance through the same cache seam",
    () =>
      Effect.gen(function* () {
        const { articleData } = yield* preparePublishedFixtures();
        const text = yield* Effect.tryPromise(() =>
          getCachedPublishedText({
            activeReleaseId: articleData.activeReleaseId,
            appLocale: testArticleProjection.appLocale,
            family: "article",
            publicPath: testArticleProjection.publicPath,
          })
        );

        expect(text).toContain(testArticleProjection.metadata.description);
        expect(text).toContain(testArticleArtifact.payload.rawMdx);
        expect(readPublishedArticle).toHaveBeenCalledWith({
          activeReleaseId: articleData.activeReleaseId,
          appLocale: testArticleProjection.appLocale,
          family: "article",
          publicPath: testArticleProjection.publicPath,
        });
        expect(cacheTagMock).toHaveBeenCalledWith(
          "content-runtime",
          "content-family:article",
          `content-artifact:${testArticleArtifact.artifactHash}`
        );
      })
  );

  it.effect(
    "selects signed Page metadata and provenance without filesystem fallback",
    () =>
      Effect.gen(function* () {
        const { pageData } = yield* preparePublishedFixtures();
        const text = yield* Effect.tryPromise(() =>
          getCachedPublishedText({
            activeReleaseId: pageData.activeReleaseId,
            appLocale: testPageProjection.appLocale,
            family: "page",
            publicPath: testPageProjection.publicPath,
          })
        );

        expect(text).toContain(testPageProjection.metadata.description);
        expect(text).toContain(testPageArtifact.payload.rawMdx);
        expect(readPublishedPage).toHaveBeenCalledWith({
          activeReleaseId: pageData.activeReleaseId,
          appLocale: testPageProjection.appLocale,
          family: "page",
          publicPath: testPageProjection.publicPath,
        });
        expect(cacheTagMock).toHaveBeenCalledWith(
          "content-runtime",
          "content-family:page",
          `content-artifact:${testPageArtifact.artifactHash}`
        );
      })
  );

  it.effect(
    "omits source links for rollback state without an exact Git revision",
    () =>
      Effect.gen(function* () {
        const { materialData } = yield* preparePublishedFixtures();
        readMaterialMock.mockReturnValueOnce(
          Effect.succeed({ ...materialData, sourceRevision: null })
        );
        const text = yield* Effect.tryPromise(() =>
          getCachedPublishedText({
            activeReleaseId: materialData.activeReleaseId,
            appLocale: previewProjection.appLocale,
            family: "material",
            publicPath: previewProjection.publicPath,
          })
        );

        expect(text).not.toContain("Source:");
      })
  );

  it.effect(
    "fails closed when semantic projection cannot parse signed source",
    () =>
      Effect.gen(function* () {
        const { materialData } = yield* preparePublishedFixtures();
        const incompleteMdx = `${rawMdx}\n{`;
        readMaterialMock.mockReturnValueOnce(
          Effect.succeed({
            ...materialData,
            artifact: {
              ...materialData.artifact,
              payload: {
                ...materialData.artifact.payload,
                rawMdx: incompleteMdx,
              },
            },
          })
        );
        const failure = yield* Effect.tryPromise({
          catch: (cause) => new TestPublishedTextError({ cause }),
          try: () =>
            getCachedPublishedText({
              activeReleaseId: materialData.activeReleaseId,
              appLocale: previewProjection.appLocale,
              family: "material",
              publicPath: previewProjection.publicPath,
            }),
        }).pipe(Effect.flip);

        expect(failure.cause).toBeInstanceOf(Error);
        if (failure.cause instanceof Error) {
          expect(failure.cause.message).toContain(
            "Unexpected end of file in expression"
          );
        }
      })
  );
});
