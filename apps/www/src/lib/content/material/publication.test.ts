// @vitest-environment node

import { HttpClient } from "@confect/js";
import { beforeEach, describe, expect, it } from "@effect/vitest";
import { ReleaseIdSchema } from "@nakafa/aksara-contracts/ids";
import { MaterialLessonProjectionSchema } from "@nakafa/aksara-contracts/projection/material";
import { ContentRuntimeVerificationError } from "@repo/backend/client/content/errors";
import contentRelease from "@repo/backend/confect/_generated/refs/contentRelease";
import { ReleaseError } from "@repo/backend/confect/contentRelease/error";
import { Array as Arr, Effect, Layer, Schema } from "effect";
import {
  getMaterialModel,
  getMaterialPublication,
} from "@/lib/content/material/publication";
import { activateTestRelease, advanceTestRelease } from "@/test/active";
import {
  previewWireArtifact as artifact,
  previewDeProjection as deProjection,
  previewIdProjection as idProjection,
  previewProjection as projection,
  previewSourcePath as sourcePath,
} from "@/test/content-preview";
import { resetTestRuntimeCache } from "@/test/store";

const queryMock = vi.hoisted(() => vi.fn());
const deliveryMock = vi.hoisted(() => vi.fn());
const renderMock = vi.hoisted(() => vi.fn());
const activeReleaseId = ReleaseIdSchema.make("release-material");
const encodeProjection = Schema.encodeSync(
  Schema.fromJsonString(MaterialLessonProjectionSchema)
);
const model = {
  activeReleaseId,
  activeAppLocales: ["en", "id", "de"],
  alternateJson: Arr.map([projection, idProjection, deProjection], (value) =>
    encodeProjection(value)
  ),
  projectionJson: encodeProjection(projection),
  activeManifestHash: `sha256:${"a".repeat(64)}`,
  rendererDomain: "mathematics",
  siblingJson: [encodeProjection(projection)],
  sourcePath,
  sourceRevision: "a".repeat(40),
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
  "@/lib/content/store/memory",
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
  it("restarts a cold lesson read once when publication advances before navigation", async () => {
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
    await expect(
      getMaterialPublication("en", projection.publicPath)
    ).resolves.toMatchObject({
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
  });
  it.each(["lesson", "navigation"])(
    "bounds the retry when the next %s read fails",
    async (stage) => {
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
      await expect(
        getMaterialPublication("en", projection.publicPath)
      ).rejects.toMatchObject({
        _tag: "MaterialReadError",
        cause,
        stage,
      });
      expect(queryMock).toHaveBeenCalledTimes(stage === "lesson" ? 3 : 4);
      expect(renderMock).not.toHaveBeenCalled();
    }
  );
  it.each([
    new Error("network failure"),
    new ReleaseError({
      code: "CONTENT_RELEASE_INTEGRITY",
      message: "Invalid publication",
    }),
  ])(
    "preserves navigation failures when publication has not advanced: %s",
    async (cause) => {
      queryMock
        .mockReturnValueOnce(
          Effect.succeed({
            materialKey: projection.materialKey,
            model,
            runtimeJson: "signed-envelope",
          })
        )
        .mockReturnValueOnce(Effect.fail(cause));
      await expect(
        getMaterialPublication("en", projection.publicPath)
      ).rejects.toMatchObject({
        _tag: "MaterialReadError",
        cause,
        stage: "navigation",
      });
      // The second read of the lesson finds it in the content store, so the
      // failed navigation read is the last read of Convex.
      expect(queryMock).toHaveBeenCalledTimes(2);
      expect(renderMock).not.toHaveBeenCalled();
    }
  );
  it("reads the lesson and its navigation once for the page and the social image", async () => {
    await getMaterialPublication("en", projection.publicPath);
    await getMaterialModel("en", projection.publicPath);

    expect(queryMock).toHaveBeenCalledTimes(2);
  });
  it("reads the shell and body once and verifies them before rendering", async () => {
    await expect(
      getMaterialPublication("en", projection.publicPath)
    ).resolves.toMatchObject({
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
  });
  it("caches an authenticated withdrawal without rendering", async () => {
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
    await expect(
      getMaterialPublication("en", projection.publicPath)
    ).resolves.toBeNull();
    expect(deliveryMock).not.toHaveBeenCalled();
    expect(renderMock).not.toHaveBeenCalled();
  });
  it.each(["missing-body", "orphan-body"])(
    "rejects %s before rendering",
    async (kind) => {
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
      await expect(
        getMaterialPublication("en", projection.publicPath)
      ).rejects.toMatchObject({
        _tag: "PublishedProjectionError",
      });
      expect(renderMock).not.toHaveBeenCalled();
    }
  );
  it.each([
    {
      activeReleaseId: "release-other",
    },
    {
      activeManifestHash: `sha256:${"b".repeat(64)}`,
    },
  ])("rejects navigation from a different publication: %j", async (patch) => {
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
    await expect(
      getMaterialPublication("en", projection.publicPath)
    ).rejects.toMatchObject({
      _tag: "PublishedProjectionError",
    });
    expect(renderMock).not.toHaveBeenCalled();
  });
  it.each([
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
  ])(
    "rejects a lesson with an incoherent navigation identity",
    async (source) => {
      queryMock.mockReturnValueOnce(
        Effect.succeed({
          ...source,
          runtimeJson: "signed-envelope",
        })
      );
      await expect(
        getMaterialPublication("en", projection.publicPath)
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
      getMaterialPublication("en", projection.publicPath)
    ).rejects.toMatchObject({
      _tag: "PublishedReleaseMismatchError",
    });
    expect(renderMock).not.toHaveBeenCalled();
  });
  it("preserves signed verification failures and never evaluates their body", async () => {
    deliveryMock.mockReturnValueOnce(
      Effect.fail(
        new ContentRuntimeVerificationError({
          cause: "invalid-signature",
        })
      )
    );
    await expect(
      getMaterialPublication("en", projection.publicPath)
    ).rejects.toMatchObject({
      _tag: "ContentRuntimeVerificationError",
    });
    expect(renderMock).not.toHaveBeenCalled();
  });
});
describe("verified material metadata", () => {
  it("resolves the verified model without rendering the body", async () => {
    await expect(
      getMaterialModel("en", projection.publicPath)
    ).resolves.toMatchObject({
      model: {
        activeReleaseId,
        projection,
      },
    });
    expect(renderMock).not.toHaveBeenCalled();
  });
  it("returns null for a withdrawn release without rendering", async () => {
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
    await expect(
      getMaterialModel("en", projection.publicPath)
    ).resolves.toBeNull();
    expect(renderMock).not.toHaveBeenCalled();
  });
});
