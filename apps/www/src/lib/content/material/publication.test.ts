// @vitest-environment node

import { HttpClient } from "@confect/js";
import { beforeEach, describe, expect, it } from "@effect/vitest";
import { ReleaseIdSchema } from "@nakafa/aksara-contracts/ids";
import { ContentRuntimeVerificationError } from "@repo/backend/client/content/errors";
import contentRelease from "@repo/backend/confect/_generated/refs/contentRelease";
import { ReleaseError } from "@repo/backend/confect/contentRelease/error";
import { Effect, Layer } from "effect";
import { getMaterialModel } from "@/lib/content/material/model";
import { getMaterialPublication } from "@/lib/content/material/publication";
import { activateTestRelease, advanceTestRelease } from "@/test/active";
import {
  activeReleaseId,
  data,
  model,
  published,
} from "@/test/content-material";
import { previewProjection as projection } from "@/test/content-preview";
import { resetTestRuntimeCache } from "@/test/store";

const queryMock = vi.hoisted(() => vi.fn());
const deliveryMock = vi.hoisted(() => vi.fn());
const renderMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/content/published/body", () => ({
  readRenderedBody: vi.fn(),
}));
vi.mock("@confect/js", async (importOriginal) => {
  const { HttpClient } = await importOriginal<typeof import("@confect/js")>();
  return {
    HttpClient: {
      ...HttpClient,
      layer: (...args: Parameters<typeof HttpClient.layer>) =>
        Layer.effect(
          HttpClient.HttpClient,
          Effect.gen(function* () {
            const client = yield* HttpClient.HttpClient;
            return {
              ...client,
              query: queryMock,
            };
          })
        ).pipe(Layer.provide(HttpClient.layer(...args))),
    },
  };
});
vi.mock("@/lib/content/cache", () => ({}));
vi.mock(
  "@/lib/content/published/active",
  async () => (await import("@/test/active")).testActiveModule
);
vi.mock(
  "@vercel/functions",
  async () => (await import("@/test/store")).testRuntimeCacheModule
);
vi.mock("@/lib/content/published/exchange", () => ({
  decodePublishedDelivery: deliveryMock,
}));
vi.mock("@/lib/content/published/material", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@/lib/content/published/material")
  >()),
  renderMaterialArtifact: renderMock,
}));
beforeEach(() => {
  resetTestRuntimeCache();
  activateTestRelease(activeReleaseId);
  queryMock.mockReset().mockImplementation((reference) =>
    Effect.succeed(
      reference.convexFunctionName ===
        contentRelease.material.navigation.convexFunctionName
        ? {
            activeManifestHash: model.activeManifestHash,
            activeReleaseId,
            siblingJson: model.siblingJson,
          }
        : {
            materialKey: projection.materialKey,
            model,
            runtimeJson: "signed-envelope",
          }
    )
  );
  deliveryMock.mockReset().mockReturnValue(Effect.succeed(data));
  renderMock.mockReset().mockReturnValue(Effect.succeed(published));
});
describe("coherent material publication", () => {
  it.effect(
    "restarts a cold lesson read once when publication advances before navigation",
    () =>
      Effect.gen(function* () {
        const nextRelease = ReleaseIdSchema.make("release-next");
        const nextModel = {
          ...model,
          activeReleaseId: nextRelease,
        };
        queryMock
          .mockReturnValueOnce(
            Effect.succeed({
              materialKey: projection.materialKey,
              model,
              runtimeJson: "old-envelope",
            })
          )
          // Native HTTP failures remain tagged across the content-read boundary.
          // The next release goes live in Convex while the navigation read fails.
          // The stored pointer still names the old release until the failed read
          // drops it, so the lesson read that follows must start from Convex.
          .mockImplementationOnce(() => {
            advanceTestRelease(nextRelease);
            return Effect.fail(
              new HttpClient.HttpClientError({
                cause: new Error("Cached navigation read failed"),
              })
            );
          })
          .mockReturnValueOnce(
            Effect.succeed({
              materialKey: projection.materialKey,
              model: nextModel,
              runtimeJson: "new-envelope",
            })
          )
          .mockReturnValueOnce(
            Effect.succeed({
              activeReleaseId: nextRelease,
              activeManifestHash: model.activeManifestHash,
              siblingJson: model.siblingJson,
            })
          );
        deliveryMock.mockReturnValueOnce(
          Effect.succeed({
            ...data,
            activeReleaseId: nextRelease,
          })
        );
        expect(
          yield* getMaterialPublication("en", projection.publicPath)
        ).toMatchObject({
          model: {
            activeReleaseId: nextRelease,
          },
        });
        expect(queryMock).toHaveBeenCalledTimes(4);
        expect(queryMock).toHaveBeenNthCalledWith(
          4,
          contentRelease.material.navigation,
          {
            appLocale: "en",
            expectedActiveReleaseId: nextRelease,
            materialKey: projection.materialKey,
          }
        );
        expect(deliveryMock).toHaveBeenCalledExactlyOnceWith(
          {
            appLocale: "en",
            publicPath: projection.publicPath,
          },
          "new-envelope"
        );
      })
  );
  it.effect.each(["lesson", "navigation"])(
    "bounds the retry when the next %s read fails",
    (stage) =>
      Effect.gen(function* () {
        const cause = new ReleaseError({
          code: "CONTENT_RELEASE_STATE",
          message: "Read failed",
        });
        const lesson = {
          materialKey: projection.materialKey,
          model,
          runtimeJson: "signed-envelope",
        };
        queryMock
          .mockReturnValueOnce(Effect.succeed(lesson))
          .mockImplementationOnce(() => {
            // The next release goes live while the navigation read fails.
            advanceTestRelease("release-next");
            return Effect.fail(cause);
          });
        if (stage === "navigation") {
          queryMock.mockReturnValueOnce(
            Effect.succeed({
              ...lesson,
              model: {
                ...model,
                activeReleaseId: "release-next",
              },
            })
          );
        }
        queryMock.mockReturnValueOnce(Effect.fail(cause));
        expect(
          yield* getMaterialPublication("en", projection.publicPath).pipe(
            Effect.flip
          )
        ).toMatchObject({
          _tag: "MaterialReadError",
          cause,
          stage,
        });
        expect(queryMock).toHaveBeenCalledTimes(stage === "lesson" ? 3 : 4);
        expect(renderMock).not.toHaveBeenCalled();
      })
  );
  it.effect.each([
    new Error("network failure"),
    new ReleaseError({
      code: "CONTENT_RELEASE_INTEGRITY",
      message: "Invalid publication",
    }),
  ])(
    "preserves navigation failures when publication has not advanced: %s",
    (cause) =>
      Effect.gen(function* () {
        queryMock
          .mockReturnValueOnce(
            Effect.succeed({
              materialKey: projection.materialKey,
              model,
              runtimeJson: "signed-envelope",
            })
          )
          .mockReturnValueOnce(Effect.fail(cause));
        expect(
          yield* getMaterialPublication("en", projection.publicPath).pipe(
            Effect.flip
          )
        ).toMatchObject({
          _tag: "MaterialReadError",
          cause,
          stage: "navigation",
        });
        // The second read of the lesson finds it in the content store, so the
        // failed navigation read is the last read of Convex.
        expect(queryMock).toHaveBeenCalledTimes(2);
        expect(renderMock).not.toHaveBeenCalled();
      })
  );
  it.effect(
    "reads the lesson and its navigation once for the page and the social image",
    () =>
      Effect.gen(function* () {
        yield* getMaterialPublication("en", projection.publicPath);
        yield* getMaterialModel("en", projection.publicPath);

        expect(queryMock).toHaveBeenCalledTimes(2);
      })
  );
  it.effect(
    "reads the shell and body once and verifies them before rendering",
    () =>
      Effect.gen(function* () {
        expect(
          yield* getMaterialPublication("en", projection.publicPath)
        ).toMatchObject({
          model: {
            activeReleaseId,
            projection,
          },
          published,
        });
        expect(queryMock).toHaveBeenNthCalledWith(
          1,
          contentRelease.material.lesson,
          {
            appLocale: "en",
            publicPath: projection.publicPath,
          }
        );
        expect(queryMock).toHaveBeenNthCalledWith(
          2,
          contentRelease.material.navigation,
          {
            appLocale: "en",
            expectedActiveReleaseId: activeReleaseId,
            materialKey: projection.materialKey,
          }
        );
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
          materialKey: null,
          model: {
            ...model,
            alternateJson: [],
            projectionJson: null,
          },
          runtimeJson: null,
        })
      );
      expect(
        yield* getMaterialPublication("en", projection.publicPath)
      ).toBeNull();
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
            materialKey: kind === "orphan-body" ? null : projection.materialKey,
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
          yield* getMaterialPublication("en", projection.publicPath).pipe(
            Effect.flip
          )
        ).toMatchObject({
          _tag: "PublishedProjectionError",
        });
        expect(renderMock).not.toHaveBeenCalled();
      })
  );
  it.effect.each([
    {
      activeReleaseId: "release-other",
    },
    {
      activeManifestHash: `sha256:${"b".repeat(64)}`,
    },
  ])("rejects navigation from a different publication: %j", (patch) =>
    Effect.gen(function* () {
      queryMock
        .mockReturnValueOnce(
          Effect.succeed({
            materialKey: projection.materialKey,
            model,
            runtimeJson: "signed-envelope",
          })
        )
        .mockReturnValueOnce(
          Effect.succeed({
            activeReleaseId,
            activeManifestHash: model.activeManifestHash,
            siblingJson: model.siblingJson,
            ...patch,
          })
        );
      expect(
        yield* getMaterialPublication("en", projection.publicPath).pipe(
          Effect.flip
        )
      ).toMatchObject({
        _tag: "PublishedProjectionError",
      });
      expect(renderMock).not.toHaveBeenCalled();
    })
  );
  it.effect.each([
    {
      materialKey: null,
      model,
    },
    {
      materialKey: projection.materialKey,
      model: {
        ...model,
        projectionJson: null,
      },
    },
    {
      materialKey: projection.materialKey,
      model: {
        ...model,
        activeReleaseId: null,
      },
    },
    {
      materialKey: "lesson.test.other",
      model,
    },
  ])("rejects a lesson with an incoherent navigation identity", (source) =>
    Effect.gen(function* () {
      queryMock.mockReturnValueOnce(
        Effect.succeed({
          ...source,
          runtimeJson: "signed-envelope",
        })
      );
      expect(
        yield* getMaterialPublication("en", projection.publicPath).pipe(
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
        yield* getMaterialPublication("en", projection.publicPath).pipe(
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
          yield* getMaterialPublication("en", projection.publicPath).pipe(
            Effect.flip
          )
        ).toMatchObject({
          _tag: "ContentRuntimeVerificationError",
        });
        expect(renderMock).not.toHaveBeenCalled();
      })
  );
});
