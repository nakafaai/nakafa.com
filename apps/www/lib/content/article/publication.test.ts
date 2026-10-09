const layerMock = vi.hoisted(() => vi.fn());

// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { ReleaseIdSchema } from "@nakafa/aksara-contracts/ids";
import { ArticleProjectionSchema } from "@nakafa/aksara-contracts/projection/article";
import { ContentRuntimeVerificationError } from "@repo/backend/client/content/errors";
import contentRelease from "@repo/backend/confect/_generated/refs/contentRelease";
import { Array as Arr, Effect, Layer, Schema } from "effect";
import {
  getArticleModel,
  getArticlePublication,
} from "@/lib/content/article/publication";
import {
  testArticleArtifact as artifact,
  testArticleDeProjection as deProjection,
  testArticleIdProjection as idProjection,
  testArticleProjection as projection,
  testArticleSourcePath as sourcePath,
} from "@/test/content-article";

const queryMock = vi.hoisted(() => vi.fn());
const cacheMock = vi.hoisted(() => vi.fn());
const deliveryMock = vi.hoisted(() => vi.fn());
const renderMock = vi.hoisted(() => vi.fn());
const activeReleaseId = ReleaseIdSchema.make("release-article");
const encodeProjection = Schema.encodeSync(
  Schema.fromJsonString(ArticleProjectionSchema)
);
const model = {
  activeReleaseId,
  activeAppLocales: ["en", "id", "de"],
  alternateJson: Arr.map([projection, idProjection, deProjection], (value) =>
    encodeProjection(value)
  ),
  projectionJson: encodeProjection(projection),
};
const data = {
  activeReleaseId,
  artifact,
  projection,
  sourcePath,
  sourceRevision: "a".repeat(40),
  rendererManifest: {},
};
const published = {
  activeReleaseId,
  artifactHash: artifact.artifactHash,
  projection,
  body: "rendered",
};
vi.mock("@/lib/content/published/body", () => ({
  readRenderedBody: vi.fn(),
}));
vi.mock("@confect/js", async (importOriginal) => {
  const { HttpClient } = await importOriginal<typeof import("@confect/js")>();
  return {
    HttpClient: {
      ...HttpClient,
      layer: (...args: Parameters<typeof HttpClient.layer>) => {
        layerMock(...args);
        return Layer.effect(
          HttpClient.HttpClient,
          Effect.gen(function* () {
            const client = yield* HttpClient.HttpClient;
            return {
              ...client,
              query: queryMock,
            };
          })
        ).pipe(Layer.provide(HttpClient.layer(...args)));
      },
    },
  };
});
vi.mock("@/env.client", () => ({
  clientEnv: { NEXT_PUBLIC_CONVEX_URL: "https://test.convex.cloud" },
}));
vi.mock("@/lib/content/cache", () => ({
  applyContentCache: cacheMock,
}));
vi.mock("@/lib/content/published/exchange", () => ({
  decodePublishedDelivery: deliveryMock,
}));
vi.mock("@/lib/content/published/article", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/content/published/article")>()),
  renderArticleArtifact: renderMock,
}));
beforeEach(() => {
  queryMock.mockReset().mockReturnValue(
    Effect.succeed({
      model,
      runtimeJson: "signed-envelope",
    })
  );
  cacheMock.mockReset();
  deliveryMock.mockReset().mockReturnValue(Effect.succeed(data));
  renderMock.mockReset().mockReturnValue(Effect.succeed(published));
});
describe("coherent article publication", () => {
  it("reads the shell and body once and verifies them before rendering", async () => {
    await expect(
      getArticlePublication("en", projection.publicPath)
    ).resolves.toMatchObject({
      model: {
        activeReleaseId,
        projection,
      },
      published,
    });
    expect(queryMock).toHaveBeenCalledExactlyOnceWith(
      contentRelease.article.delivery,
      {
        appLocale: "en",
        publicPath: projection.publicPath,
      }
    );
    expect(layerMock).toHaveBeenCalledWith("https://test.convex.cloud");
    expect(deliveryMock).toHaveBeenCalledExactlyOnceWith(
      {
        appLocale: "en",
        publicPath: projection.publicPath,
      },
      "signed-envelope"
    );
    expect(cacheMock).toHaveBeenCalledExactlyOnceWith("article");
    expect(renderMock).toHaveBeenCalledOnce();
  });
  it("caches an authenticated withdrawal without rendering", async () => {
    queryMock.mockReturnValueOnce(
      Effect.succeed({
        model: {
          ...model,
          alternateJson: [],
          projectionJson: null,
        },
        runtimeJson: null,
      })
    );
    await expect(
      getArticlePublication("en", projection.publicPath)
    ).resolves.toBeNull();
    expect(cacheMock).toHaveBeenCalledWith("article");
    expect(deliveryMock).not.toHaveBeenCalled();
    expect(renderMock).not.toHaveBeenCalled();
  });
  it.each(["missing-body", "orphan-body"])(
    "rejects %s before rendering",
    async (kind) => {
      queryMock.mockReturnValueOnce(
        Effect.succeed({
          model:
            kind === "orphan-body"
              ? {
                  ...model,
                  alternateJson: [],
                  projectionJson: null,
                }
              : model,
          runtimeJson: kind === "missing-body" ? null : "signed-envelope",
        })
      );
      await expect(
        getArticlePublication("en", projection.publicPath)
      ).rejects.toMatchObject({
        _tag: "PublishedProjectionError",
      });
      expect(renderMock).not.toHaveBeenCalled();
    }
  );
  it("rejects mismatched publication generations before rendering", async () => {
    deliveryMock.mockReturnValueOnce(
      Effect.succeed({
        ...data,
        activeReleaseId: ReleaseIdSchema.make("release-other"),
      })
    );
    await expect(
      getArticlePublication("en", projection.publicPath)
    ).rejects.toMatchObject({
      _tag: "PublishedReleaseMismatchError",
    });
    expect(renderMock).not.toHaveBeenCalled();
  });
  it("preserves signed verification failures and never evaluates their body", async () => {
    deliveryMock.mockReturnValueOnce(
      Effect.fail(
        ContentRuntimeVerificationError.make({
          cause: "invalid-signature",
        })
      )
    );
    await expect(
      getArticlePublication("en", projection.publicPath)
    ).rejects.toMatchObject({
      _tag: "ContentRuntimeVerificationError",
    });
    expect(renderMock).not.toHaveBeenCalled();
  });
});
describe("verified article metadata", () => {
  it("resolves the verified model without rendering the body", async () => {
    await expect(
      getArticleModel("en", projection.publicPath)
    ).resolves.toMatchObject({
      model: {
        activeReleaseId,
        projection,
      },
    });
    expect(renderMock).not.toHaveBeenCalled();
    expect(cacheMock).toHaveBeenCalledWith("article");
  });
  it("returns null for a withdrawn release without rendering", async () => {
    queryMock.mockReturnValueOnce(
      Effect.succeed({
        model: {
          ...model,
          alternateJson: [],
          projectionJson: null,
        },
        runtimeJson: null,
      })
    );
    await expect(
      getArticleModel("en", projection.publicPath)
    ).resolves.toBeNull();
    expect(renderMock).not.toHaveBeenCalled();
  });
});
