// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import {
  GitCommitShaSchema,
  ReleaseIdSchema,
} from "@nakafa/aksara-contracts/ids";
import { Data, Effect } from "effect";
import { PublishedProjectionError } from "@/lib/content/published/errors";
import { readPublishedContent } from "@/lib/content/published/exchange";
import { rendererManifest } from "@/lib/content/renderer/manifest";
import {
  type PublishedMarkdownInput,
  readPublishedText,
} from "@/lib/llms/published";
import { activateTestRelease } from "@/test/active";
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
import { resetTestRuntimeCache, testRuntimeCache } from "@/test/store";

const readContentMock = vi.hoisted(() => vi.fn());
const derivation = vi.hoisted(() => ({ baseUrl: "" }));
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
    readContentMock.mockImplementation((input: PublishedMarkdownInput) =>
      Effect.succeed(
        { article: articleData, material: materialData, page: pageData }[
          input.family
        ]
      )
    );
  });

  return { articleData, materialData, pageData } as const;
});

/** Lets a test change what code derives from a stored answer, as a deploy does. */
vi.mock("@/lib/llms/constants", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("@/lib/llms/constants")>();
  derivation.baseUrl = original.BASE_URL;
  return {
    ...original,
    get BASE_URL() {
      return derivation.baseUrl;
    },
  };
});
vi.mock("@/lib/content/published/exchange", () => ({
  readPublishedContent: readContentMock,
}));
vi.mock(
  "@/lib/content/published/active",
  async () => (await import("@/test/active")).testActiveModule
);
vi.mock(
  "@vercel/functions",
  async () => (await import("@/test/store")).testRuntimeCacheModule
);
beforeEach(() => {
  resetTestRuntimeCache();
  readContentMock.mockReset();
});

describe("published llms markdown", () => {
  it.effect(
    "projects verified source with immutable provenance and exact cache tags",
    () =>
      Effect.gen(function* () {
        const { materialData } = yield* preparePublishedFixtures();
        activateTestRelease(materialData.activeReleaseId);
        const text = yield* readPublishedText({
          activeReleaseId: materialData.activeReleaseId,
          appLocale: previewProjection.appLocale,
          family: "material",
          publicPath: previewProjection.publicPath,
        });

        expect(text).toContain(previewMetadata.description);
        expect(text).toContain("What is a Function?");
        expect(text).toContain("Component: FunctionMachine");
        expect(text).toContain(
          `https://raw.githubusercontent.com/nakafaai/aksara/${sourceRevision}/${previewSourcePath}`
        );
        expect(readPublishedContent).toHaveBeenCalledWith({
          activeReleaseId: materialData.activeReleaseId,
          appLocale: previewProjection.appLocale,
          family: "material",
          publicPath: previewProjection.publicPath,
        });
        // The key names the release, so the entry has no timer and only its
        // scope tag expires it.
      })
  );

  it.effect(
    "selects article metadata and provenance through the same cache seam",
    () =>
      Effect.gen(function* () {
        const { articleData } = yield* preparePublishedFixtures();
        activateTestRelease(articleData.activeReleaseId);
        const text = yield* readPublishedText({
          activeReleaseId: articleData.activeReleaseId,
          appLocale: testArticleProjection.appLocale,
          family: "article",
          publicPath: testArticleProjection.publicPath,
        });

        expect(text).toContain(testArticleProjection.metadata.description);
        expect(text).toContain(testArticleArtifact.payload.rawMdx);
        expect(readPublishedContent).toHaveBeenCalledWith({
          activeReleaseId: articleData.activeReleaseId,
          appLocale: testArticleProjection.appLocale,
          family: "article",
          publicPath: testArticleProjection.publicPath,
        });
      })
  );

  it.effect(
    "selects signed Page metadata and provenance without filesystem fallback",
    () =>
      Effect.gen(function* () {
        const { pageData } = yield* preparePublishedFixtures();
        activateTestRelease(pageData.activeReleaseId);
        const text = yield* readPublishedText({
          activeReleaseId: pageData.activeReleaseId,
          appLocale: testPageProjection.appLocale,
          family: "page",
          publicPath: testPageProjection.publicPath,
        });

        expect(text).toContain(testPageProjection.metadata.description);
        expect(text).toContain(testPageArtifact.payload.rawMdx);
        expect(readPublishedContent).toHaveBeenCalledWith({
          activeReleaseId: pageData.activeReleaseId,
          appLocale: testPageProjection.appLocale,
          family: "page",
          publicPath: testPageProjection.publicPath,
        });
      })
  );

  it.effect(
    "omits source links for rollback state without an exact Git revision",
    () =>
      Effect.gen(function* () {
        const { materialData } = yield* preparePublishedFixtures();
        activateTestRelease(materialData.activeReleaseId);
        readContentMock.mockReturnValueOnce(
          Effect.succeed({ ...materialData, sourceRevision: null })
        );
        const text = yield* readPublishedText({
          activeReleaseId: materialData.activeReleaseId,
          appLocale: previewProjection.appLocale,
          family: "material",
          publicPath: previewProjection.publicPath,
        });

        expect(text).not.toContain("Source:");
      })
  );

  it.effect(
    "fails closed when semantic projection cannot parse signed source",
    () =>
      Effect.gen(function* () {
        const { materialData } = yield* preparePublishedFixtures();
        activateTestRelease(materialData.activeReleaseId);
        const incompleteMdx = `${rawMdx}\n{`;
        readContentMock.mockReturnValueOnce(
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
        const failure = yield* readPublishedText({
          activeReleaseId: materialData.activeReleaseId,
          appLocale: previewProjection.appLocale,
          family: "material",
          publicPath: previewProjection.publicPath,
        }).pipe(
          Effect.mapError((cause) => new TestPublishedTextError({ cause })),
          Effect.flip
        );

        expect(failure.cause).toBeInstanceOf(Error);
        if (failure.cause instanceof Error) {
          expect(failure.cause.message).toContain(
            "Unexpected end of file in expression"
          );
        }
      })
  );
});

it.effect("reads and projects one body once for each release", () =>
  Effect.gen(function* () {
    const { materialData } = yield* preparePublishedFixtures();
    activateTestRelease(materialData.activeReleaseId);
    const input = {
      activeReleaseId: materialData.activeReleaseId,
      appLocale: previewProjection.appLocale,
      family: "material",
      publicPath: previewProjection.publicPath,
    } as const;

    const first = yield* readPublishedText(input);
    const second = yield* readPublishedText(input);

    expect(second).toBe(first);
    expect(readContentMock).toHaveBeenCalledTimes(1);

    // The next release names itself, and the text is read and projected again.
    const nextInput = {
      ...input,
      activeReleaseId: ReleaseIdSchema.make("release-function-concept-next"),
    };
    activateTestRelease(nextInput.activeReleaseId);
    yield* readPublishedText(nextInput);
    expect(readContentMock).toHaveBeenCalledTimes(2);
  })
);

it.effect("keeps the signed source in the store and no derived text", () =>
  Effect.gen(function* () {
    const { materialData } = yield* preparePublishedFixtures();
    activateTestRelease(materialData.activeReleaseId);

    yield* readPublishedText({
      activeReleaseId: materialData.activeReleaseId,
      appLocale: previewProjection.appLocale,
      family: "material",
      publicPath: previewProjection.publicPath,
    });

    // The stored value has exactly these four fields: the signed projection,
    // the raw source and its provenance. The header and the projected Markdown
    // are not in it.
    expect(testRuntimeCache.set).toHaveBeenCalledExactlyOnceWith(
      expect.any(String),
      {
        value: {
          projection: expect.anything(),
          rawMdx,
          sourcePath: previewSourcePath,
          sourceRevision,
        },
      },
      expect.objectContaining({ name: "markdown.source" })
    );
  })
);

it.effect("derives the text from the stored source on every build", () =>
  Effect.gen(function* () {
    const { materialData } = yield* preparePublishedFixtures();
    activateTestRelease(materialData.activeReleaseId);
    const input = {
      activeReleaseId: materialData.activeReleaseId,
      appLocale: previewProjection.appLocale,
      family: "material",
      publicPath: previewProjection.publicPath,
    } as const;

    const before = yield* readPublishedText(input);
    // A deploy changes what code derives, while the release and the answers
    // that Convex gave for it stay the same.
    const original = derivation.baseUrl;
    derivation.baseUrl = "https://deployed.example";
    const after = yield* readPublishedText(input);
    derivation.baseUrl = original;

    expect(before).toContain(`URL: ${original}/`);
    expect(after).toContain("URL: https://deployed.example/");
    expect(readContentMock).toHaveBeenCalledTimes(1);
  })
);

it.effect("rejects a signed projection from a different family", () =>
  Effect.gen(function* () {
    const { materialData } = yield* preparePublishedFixtures();
    activateTestRelease(materialData.activeReleaseId);
    readContentMock.mockReturnValueOnce(Effect.succeed(materialData));
    const failure = yield* readPublishedText({
      activeReleaseId: materialData.activeReleaseId,
      appLocale: previewProjection.appLocale,
      family: "article",
      publicPath: previewProjection.publicPath,
    }).pipe(
      Effect.mapError((cause) => new TestPublishedTextError({ cause })),
      Effect.flip
    );
    expect(failure.cause).toBeInstanceOf(PublishedProjectionError);
  })
);
