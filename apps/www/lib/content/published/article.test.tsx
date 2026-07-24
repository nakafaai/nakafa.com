// @vitest-environment node

import { SignedContentArtifactSchema } from "@nakafa/aksara-contracts/content";
import {
  ContentKeySchema,
  CorpusSourcePathSchema,
  GitCommitShaSchema,
  PublicPathSchema,
  ReleaseIdSchema,
} from "@nakafa/aksara-contracts/ids";
import { ArticleProjectionSchema } from "@nakafa/aksara-contracts/projection/article";
import { ContentVerificationKeyResolver } from "@nakafa/aksara-contracts/signature/spec";
import { Effect, Schema } from "effect";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getPublishedArticle,
  readPublishedArticle,
  renderPublishedArticle,
} from "@/lib/content/published/article";
import { executeSignedArtifact } from "@/lib/content/published/artifact";
import { readPublishedContent } from "@/lib/content/published/exchange";
import {
  makeArticleGraph,
  previewWireArtifact,
} from "@/test/content-preview";

const cacheMock = vi.hoisted(() => vi.fn());
const executeMock = vi.hoisted(() => vi.fn());
const readContentMock = vi.hoisted(() => vi.fn());
const politicsComponents = vi.hoisted(() => ({}));
const publicPath = PublicPathSchema.make(
  "articles/politics/dynastic-politics-asian-values"
);
const projection = Schema.decodeUnknownSync(ArticleProjectionSchema)({
  articleSlug: "dynastic-politics-asian-values",
  category: "politics",
  contentKey: ContentKeySchema.make(publicPath),
  graph: makeArticleGraph("dynastic-politics-asian-values", "en"),
  kind: "article",
  locale: "en",
  metadata: {
    authors: [{ name: "Nabil Akbarazzima Fatih" }],
    date: "2024-09-20",
    description:
      "Political dynasties are growing. Their influence brings risks to democracy and good governance.",
    title: "Dynastic Politics and Asian Values",
  },
  official: true,
  parentPath: PublicPathSchema.make("articles/politics"),
  publicPath,
  references: [
    {
      authors: "Transparency International",
      title: "Corruption Perceptions Index",
      url: "https://www.transparency.org/en/cpi",
      year: 2023,
    },
  ],
  sitemap: true,
});
const articleArtifact = SignedContentArtifactSchema.make({
  ...previewWireArtifact,
  payload: {
    ...previewWireArtifact.payload,
    contentKey: projection.contentKey,
    rendererDomain: "politics",
  },
});
const data = {
  activeReleaseId: ReleaseIdSchema.make("release-article"),
  artifact: articleArtifact,
  projection,
  rendererManifest: {
    hash: `sha256:${"e".repeat(64)}`,
    rendererContractVersion: "1.0.0",
  },
  sourcePath: CorpusSourcePathSchema.make(
    "packages/corpus/articles/politics/dynastic-politics/asian-values/en.mdx"
  ),
  sourceRevision: GitCommitShaSchema.make("a".repeat(40)),
};
const input = { locale: "en" as const, publicPath };

vi.mock("server-only", () => ({}));
vi.mock("@repo/design-system/lib/markdown/domain/politics", () => ({
  politicsComponents,
}));
vi.mock("@/lib/content/cache", () => ({
  applyPublishedContentCache: cacheMock,
}));
vi.mock("@/lib/content/published/artifact", () => ({
  executeSignedArtifact: executeMock,
}));
vi.mock("@/lib/content/published/exchange", () => ({
  readPublishedContent: readContentMock,
}));

beforeEach(() => {
  cacheMock.mockReset();
  executeMock.mockReset();
  readContentMock.mockReset();
  readContentMock.mockReturnValue(Effect.succeed(data));
  executeMock.mockImplementation(
    ({ artifact }: { readonly artifact: typeof articleArtifact }) =>
      ContentVerificationKeyResolver.pipe(
        Effect.as({
          artifact,
          /** Represents one authenticated compiled politics article. */
          Content: () => <h2>Dynastic Politics</h2>,
        })
      )
  );
});

describe("published article", () => {
  it("strictly narrows the family-neutral runtime exchange", async () => {
    await expect(
      Effect.runPromise(readPublishedArticle(input))
    ).resolves.toEqual(data);
    expect(readPublishedContent).toHaveBeenCalledWith(input);
  });

  it("rejects a runtime projection owned by another family", async () => {
    readContentMock.mockReturnValueOnce(
      Effect.succeed({ ...data, projection: { kind: "material-lesson" } })
    );

    await expect(
      Effect.runPromise(readPublishedArticle(input).pipe(Effect.flip))
    ).resolves.toMatchObject({
      _tag: "PublishedProjectionError",
      locale: "en",
      publicPath,
    });
  });

  it("caches metadata and provenance under article-specific tags", async () => {
    await expect(getPublishedArticle(input)).resolves.toEqual(data);
    expect(cacheMock).toHaveBeenCalledWith(
      "article",
      articleArtifact.artifactHash
    );
  });

  it("renders only through the physical politics registry", async () => {
    const content = await renderPublishedArticle(input);

    expect(renderToStaticMarkup(content.body)).toBe(
      "<h2>Dynastic Politics</h2>"
    );
    expect(content).toMatchObject({
      metadata: projection.metadata,
      official: true,
      publicPath,
      rawMdx: articleArtifact.payload.rawMdx,
      references: projection.references,
      sourcePath: data.sourcePath,
      sourceRevision: data.sourceRevision,
    });
    expect(executeSignedArtifact).toHaveBeenCalledWith({
      artifact: articleArtifact,
      components: politicsComponents,
      rendererContractVersion: "1.0.0",
      rendererManifest: data.rendererManifest,
    });
    expect("Content" in content).toBe(false);
  });

  it("fails closed before execution for a non-politics artifact", async () => {
    readContentMock.mockReturnValueOnce(
      Effect.succeed({
        ...data,
        artifact: previewWireArtifact,
      })
    );

    await expect(renderPublishedArticle(input)).rejects.toThrow(
      '"rendererDomain": "mathematics"'
    );
    expect(executeMock).not.toHaveBeenCalled();
  });
});
