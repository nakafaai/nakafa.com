const layerMock = vi.hoisted(() => vi.fn());

// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { ReleaseIdSchema } from "@nakafa/aksara-contracts/ids";
import { ArticleProjectionSchema } from "@nakafa/aksara-contracts/projection/article";
import { ContentRuntimeVerificationError } from "@repo/backend/client/content/errors";
import contentRelease from "@repo/backend/confect/_generated/refs/contentRelease";
import { Array as Arr, Effect, Layer, Option, Schema } from "effect";
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

/** Reads one delivery that the test expects to exist. */
const readArticleDelivery = (publicPath: string) =>
  getArticlePublication("en", publicPath).pipe(Effect.map(Option.getOrThrow));
/** Reads one model that the test expects to exist. */
const readArticleModel = (publicPath: string) =>
  getArticleModel("en", publicPath).pipe(Effect.map(Option.getOrThrow));

const queryMock = vi.hoisted(() => vi.fn());
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
vi.mock("@/env.public", () => ({
  clientEnv: { VITE_CONVEX_URL: "https://test.convex.cloud" },
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
  deliveryMock.mockReset().mockReturnValue(Effect.succeed(data));
  renderMock.mockReset().mockReturnValue(Effect.succeed(published));
});
describe("coherent article publication", () => {
  it.effect(
    "reads the shell and body once and verifies them before rendering",
    () =>
      Effect.gen(function* () {
        expect(yield* readArticleDelivery(projection.publicPath)).toMatchObject(
          {
            model: {
              activeReleaseId,
              projection,
            },
            published,
          }
        );
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
        expect(renderMock).toHaveBeenCalledOnce();
      })
  );
  it.effect("caches an authenticated withdrawal without rendering", () =>
    Effect.gen(function* () {
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
      expect(
        Option.isNone(yield* getArticlePublication("en", projection.publicPath))
      ).toBe(true);
      expect(deliveryMock).not.toHaveBeenCalled();
      expect(renderMock).not.toHaveBeenCalled();
    })
  );
  it.effect.each(["missing-body", "orphan-body"])(
    "rejects %s before rendering",
    (kind) =>
      Effect.gen(function* () {
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
        expect(
          yield* getArticlePublication("en", projection.publicPath).pipe(
            Effect.flip
          )
        ).toMatchObject({
          _tag: "PublishedProjectionError",
        });
        expect(renderMock).not.toHaveBeenCalled();
      })
  );
  it.effect("rejects mismatched publication generations before rendering", () =>
    Effect.gen(function* () {
      deliveryMock.mockReturnValueOnce(
        Effect.succeed({
          ...data,
          activeReleaseId: ReleaseIdSchema.make("release-other"),
        })
      );
      expect(
        yield* getArticlePublication("en", projection.publicPath).pipe(
          Effect.flip
        )
      ).toMatchObject({
        _tag: "PublishedReleaseMismatchError",
      });
      expect(renderMock).not.toHaveBeenCalled();
    })
  );
  it.effect(
    "preserves signed verification failures and never evaluates their body",
    () =>
      Effect.gen(function* () {
        deliveryMock.mockReturnValueOnce(
          Effect.fail(
            new ContentRuntimeVerificationError({
              cause: "invalid-signature",
            })
          )
        );
        expect(
          yield* getArticlePublication("en", projection.publicPath).pipe(
            Effect.flip
          )
        ).toMatchObject({
          _tag: "ContentRuntimeVerificationError",
        });
        expect(renderMock).not.toHaveBeenCalled();
      })
  );
});
describe("verified article metadata", () => {
  it.effect("resolves the verified model without rendering the body", () =>
    Effect.gen(function* () {
      expect(yield* readArticleModel(projection.publicPath)).toMatchObject({
        model: {
          activeReleaseId,
          projection,
        },
      });
      expect(renderMock).not.toHaveBeenCalled();
    })
  );
  it.effect("returns none for a withdrawn release without rendering", () =>
    Effect.gen(function* () {
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
      expect(
        Option.isNone(yield* getArticleModel("en", projection.publicPath))
      ).toBe(true);
      expect(renderMock).not.toHaveBeenCalled();
    })
  );
});
