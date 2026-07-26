// @vitest-environment node

import {
  ContentKeySchema,
  CorpusSourcePathSchema,
  PublicPathSchema,
  ReleaseIdSchema,
} from "@nakafa/aksara-contracts/ids";
import {
  ArticleCategorySchema,
  ArticleProjectionSchema,
  ArticleSlugSchema,
} from "@nakafa/aksara-contracts/projection/article";
import { hashContentProjection } from "@nakafa/aksara-contracts/projection/hash";
import { MaterialLessonProjectionSchema } from "@nakafa/aksara-contracts/projection/material";
import type {
  ContentRuntimeFound,
  ContentRuntimeRequest,
} from "@nakafa/aksara-contracts/runtime/spec";
import { ContentVerificationKeyResolver } from "@nakafa/aksara-contracts/signature/spec";
import {
  verifyContentEnvelope,
  verifyContentRenderer,
} from "@repo/backend/content/verify";
import { makeMaterialProjection } from "@repo/backend/test/content-material";
import {
  TEST_KEY_RESOLVER,
  TEST_PROOF_RENDERER,
  testEmptyManifest,
  testProofRenderer,
  testSignedArtifact,
  testSignedRelease,
} from "@repo/backend/test/content-proof";
import { testArticleGraph } from "@repo/backend/test/content-release";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

const release = testSignedRelease(
  testEmptyManifest(ReleaseIdSchema.make("release-envelope"))
);
const materialProjection = makeMaterialProjection("en", 1);
const materialArtifact = testSignedArtifact("mathematics", {
  contentKey: materialProjection.contentKey,
});
const materialRequest = {
  delivery: "public",
  locale: "en",
  publicPath: materialProjection.publicPath,
} satisfies ContentRuntimeRequest;
const materialFound = {
  activeManifestHash: release.manifestHash,
  activeReleaseId: release.manifest.releaseId,
  artifact: materialArtifact,
  delivery: "public",
  kind: "found",
  projection: materialProjection,
  projectionHash: hashContentProjection(materialProjection),
  release,
  rendererManifest: TEST_PROOF_RENDERER,
  sourcePath: CorpusSourcePathSchema.make(
    `packages/corpus/${materialProjection.contentKey}/en.mdx`
  ),
} satisfies ContentRuntimeFound;

/** Runs envelope verification with the isolated test signing authority. */
function verify(request: unknown, response: unknown) {
  return Effect.runPromise(
    verifyContentEnvelope({ request, response }).pipe(
      Effect.provideService(ContentVerificationKeyResolver, TEST_KEY_RESOLVER)
    )
  );
}

/** Exposes one envelope mismatch or signature failure. */
function reject(request: unknown, response: unknown) {
  return Effect.runPromise(
    verifyContentEnvelope({ request, response }).pipe(
      Effect.provideService(ContentVerificationKeyResolver, TEST_KEY_RESOLVER),
      Effect.flip
    )
  );
}

describe("content envelope verification", () => {
  it("passes missing and sanitized failures without artifact work", async () => {
    await expect(verify(materialRequest, { kind: "missing" })).resolves.toEqual(
      { kind: "missing" }
    );
    await expect(
      verify(materialRequest, {
        code: "CONTENT_RUNTIME_INTERNAL",
        kind: "failure",
      })
    ).resolves.toEqual({
      code: "CONTENT_RUNTIME_INTERNAL",
      kind: "failure",
    });
  });

  it("authenticates material and pair-grouped article envelopes", async () => {
    await expect(verify(materialRequest, materialFound)).resolves.toEqual(
      materialFound
    );

    const articleKey = ContentKeySchema.make(
      "articles/politics/dynastic-politics-asian-values"
    );
    const articlePath = PublicPathSchema.make(articleKey);
    const projection = ArticleProjectionSchema.make({
      articleSlug: ArticleSlugSchema.make("dynastic-politics-asian-values"),
      category: ArticleCategorySchema.make("politics"),
      categoryTitle: "Politics",
      contentKey: articleKey,
      graph: testArticleGraph("dynastic-politics-asian-values"),
      kind: "article",
      locale: "en",
      metadata: {
        authors: [{ name: "Nakafa" }],
        date: "2026-07-24",
        title: "Dynastic politics",
      },
      official: false,
      parentPath: PublicPathSchema.make("articles/politics"),
      publicPath: articlePath,
      references: [],
      sitemap: true,
    });
    const artifact = testSignedArtifact("politics", {
      contentKey: articleKey,
    });
    const found = {
      ...materialFound,
      artifact,
      projection,
      projectionHash: hashContentProjection(projection),
      sourcePath: CorpusSourcePathSchema.make(
        "packages/corpus/articles/politics/dynastic-politics/asian-values/en.mdx"
      ),
    };

    await expect(
      verify({ ...materialRequest, publicPath: articlePath }, found)
    ).resolves.toEqual(found);
    await expect(
      reject(
        { ...materialRequest, publicPath: articlePath },
        {
          ...found,
          sourcePath: CorpusSourcePathSchema.make(
            "packages/corpus/articles/science/dynastic-politics/asian-values/en.mdx"
          ),
        }
      )
    ).resolves.toMatchObject({
      _tag: "ContentEnvelopeMismatchError",
      reason: "sourcePath",
    });
  });

  it.each([
    ["delivery", { ...materialFound, delivery: "authenticated" }],
    [
      "publicPath",
      {
        ...materialFound,
        projection: MaterialLessonProjectionSchema.make({
          ...materialProjection,
          parentPath: PublicPathSchema.make("subjects/test/other-topic"),
          publicPath: PublicPathSchema.make(
            "subjects/test/other-topic/section-1"
          ),
        }),
      },
    ],
    [
      "sourcePath",
      {
        ...materialFound,
        sourcePath: CorpusSourcePathSchema.make(
          "packages/corpus/material/lesson/test/other/en.mdx"
        ),
      },
    ],
    [
      "activeReleaseId",
      {
        ...materialFound,
        activeReleaseId: ReleaseIdSchema.make("release-other"),
      },
    ],
    [
      "activeManifestHash",
      {
        ...materialFound,
        activeManifestHash: materialArtifact.artifactHash,
      },
    ],
    [
      "projectionHash",
      {
        ...materialFound,
        projectionHash: materialArtifact.artifactHash,
      },
    ],
  ])("rejects an exact %s mismatch", async (reason, response) => {
    await expect(reject(materialRequest, response)).resolves.toMatchObject({
      _tag: "ContentEnvelopeMismatchError",
      reason,
    });
  });

  it("rejects a response for another requested locale", async () => {
    await expect(
      reject({ ...materialRequest, locale: "id" }, materialFound)
    ).resolves.toMatchObject({
      _tag: "ContentEnvelopeMismatchError",
      reason: "locale",
    });
  });

  it("rejects tampered artifact signatures and live renderer drift", async () => {
    const tampered = {
      ...materialFound,
      artifact: {
        ...materialFound.artifact,
        signature: `${"A".repeat(85)}A`,
      },
    };

    await expect(reject(materialRequest, tampered)).resolves.toMatchObject({
      _tag: "SignatureInvalidError",
    });
    await expect(
      Effect.runPromise(
        verifyContentRenderer({
          found: materialFound,
          rendererManifest: TEST_PROOF_RENDERER,
        })
      )
    ).resolves.toEqual(materialFound);
    await expect(
      Effect.runPromise(
        verifyContentRenderer({
          found: materialFound,
          rendererManifest: testProofRenderer("span", ["politics"]),
        }).pipe(Effect.flip)
      )
    ).resolves.toMatchObject({
      _tag: "ContentEnvelopeMismatchError",
      reason: "rendererManifest",
    });
  });
});
