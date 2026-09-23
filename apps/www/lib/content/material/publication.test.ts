// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { ReleaseIdSchema } from "@nakafa/aksara-contracts/ids";
import { ContentRuntimeVerificationError } from "@repo/backend/client/content/errors";
import { api } from "@repo/backend/convex/_generated/api";
import { getFunctionName } from "convex/server";
import { ConvexError } from "convex/values";
import { Effect } from "effect";
import {
  getMaterialModel,
  getMaterialPublication,
} from "@/lib/content/material/publication";
import {
  previewWireArtifact as artifact,
  previewDeProjection as deProjection,
  previewIdProjection as idProjection,
  previewProjection as projection,
  previewSourcePath as sourcePath,
} from "@/test/content-preview";

const queryMock = vi.hoisted(() => vi.fn());
const cacheMock = vi.hoisted(() => vi.fn());
const deliveryMock = vi.hoisted(() => vi.fn());
const renderMock = vi.hoisted(() => vi.fn());
const activeReleaseId = ReleaseIdSchema.make("release-material");
const model = {
  activeReleaseId,
  activeAppLocales: ["en", "id", "de"],
  alternateJson: [projection, idProjection, deProjection].map((value) =>
    JSON.stringify(value)
  ),
  projectionJson: JSON.stringify(projection),
  activeManifestHash: `sha256:${"a".repeat(64)}`,
  rendererDomain: "mathematics",
  siblingJson: [JSON.stringify(projection)],
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

vi.mock("@/lib/content/published/body", () => ({ readRenderedBody: vi.fn() }));
vi.mock("convex/nextjs", () => ({ fetchQuery: queryMock }));
vi.mock("next/cache", () => ({ cacheLife: vi.fn() }));
vi.mock("@/env", () => ({
  env: { NEXT_PUBLIC_CONVEX_URL: "https://test.convex.cloud" },
}));
vi.mock("@/lib/content/cache", () => ({ applyContentCache: cacheMock }));
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
  queryMock.mockReset().mockImplementation((reference) =>
    Promise.resolve(
      getFunctionName(reference) ===
        getFunctionName(api.contentRelease.material.navigation)
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
  cacheMock.mockReset();
  deliveryMock.mockReset().mockReturnValue(Effect.succeed(data));
  renderMock.mockReset().mockReturnValue(Effect.succeed(published));
});

describe("coherent material publication", () => {
  it("restarts a cold lesson read once when publication advances before navigation", async () => {
    const nextRelease = ReleaseIdSchema.make("release-next");
    const nextModel = { ...model, activeReleaseId: nextRelease };
    queryMock
      .mockResolvedValueOnce({
        materialKey: projection.materialKey,
        model,
        runtimeJson: "old-envelope",
      })
      // Next cache boundaries serialize errors and do not preserve ConvexError.
      .mockRejectedValueOnce(new Error("Cached navigation read failed"))
      .mockResolvedValueOnce({
        materialKey: projection.materialKey,
        model: nextModel,
        runtimeJson: "new-envelope",
      })
      .mockResolvedValueOnce({
        activeReleaseId: nextRelease,
        activeManifestHash: model.activeManifestHash,
        siblingJson: model.siblingJson,
      });
    deliveryMock.mockReturnValueOnce(
      Effect.succeed({ ...data, activeReleaseId: nextRelease })
    );
    await expect(
      getMaterialPublication("en", projection.publicPath)
    ).resolves.toMatchObject({ model: { activeReleaseId: nextRelease } });
    expect(queryMock).toHaveBeenCalledTimes(4);
    expect(queryMock).toHaveBeenNthCalledWith(
      4,
      api.contentRelease.material.navigation,
      {
        appLocale: "en",
        expectedActiveReleaseId: nextRelease,
        materialKey: projection.materialKey,
      },
      { url: "https://test.convex.cloud" }
    );
    expect(deliveryMock).toHaveBeenCalledExactlyOnceWith(
      { appLocale: "en", publicPath: projection.publicPath },
      "new-envelope"
    );
  });

  it.each(["lesson", "navigation"])(
    "bounds the retry when the next %s read fails",
    async (stage) => {
      const cause = new ConvexError({ code: "CONTENT_RELEASE_STATE" });
      const lesson = {
        materialKey: projection.materialKey,
        model,
        runtimeJson: "signed-envelope",
      };
      queryMock.mockResolvedValueOnce(lesson).mockRejectedValueOnce(cause);
      if (stage === "navigation") {
        queryMock.mockResolvedValueOnce({
          ...lesson,
          model: { ...model, activeReleaseId: "release-next" },
        });
      }
      queryMock.mockRejectedValueOnce(cause);
      await expect(
        getMaterialPublication("en", projection.publicPath)
      ).rejects.toMatchObject({ _tag: "MaterialReadError", cause, stage });
      expect(queryMock).toHaveBeenCalledTimes(stage === "lesson" ? 3 : 4);
      expect(renderMock).not.toHaveBeenCalled();
    }
  );

  it.each([
    new Error("network failure"),
    new ConvexError({ code: "CONTENT_RELEASE_INTEGRITY" }),
  ])(
    "preserves navigation failures when publication has not advanced: %s",
    async (cause) => {
      queryMock
        .mockResolvedValueOnce({
          materialKey: projection.materialKey,
          model,
          runtimeJson: "signed-envelope",
        })
        .mockRejectedValueOnce(cause);
      await expect(
        getMaterialPublication("en", projection.publicPath)
      ).rejects.toMatchObject({
        _tag: "MaterialReadError",
        cause,
        stage: "navigation",
      });
      expect(queryMock).toHaveBeenCalledTimes(3);
      expect(renderMock).not.toHaveBeenCalled();
    }
  );

  it("reads the shell and body once and verifies them before rendering", async () => {
    await expect(
      getMaterialPublication("en", projection.publicPath)
    ).resolves.toMatchObject({
      model: { activeReleaseId, projection },
      published,
    });
    expect(queryMock).toHaveBeenNthCalledWith(
      1,
      api.contentRelease.material.lesson,
      { appLocale: "en", publicPath: projection.publicPath },
      { url: "https://test.convex.cloud" }
    );
    expect(queryMock).toHaveBeenNthCalledWith(
      2,
      api.contentRelease.material.navigation,
      {
        appLocale: "en",
        expectedActiveReleaseId: activeReleaseId,
        materialKey: projection.materialKey,
      },
      { url: "https://test.convex.cloud" }
    );
    expect(deliveryMock).toHaveBeenCalledExactlyOnceWith(
      { appLocale: "en", publicPath: projection.publicPath },
      "signed-envelope"
    );
    expect(cacheMock).toHaveBeenCalledWith("material");
    expect(renderMock).toHaveBeenCalledOnce();
  });

  it("caches an authenticated withdrawal without rendering", async () => {
    queryMock.mockResolvedValueOnce({
      materialKey: null,
      model: { ...model, alternateJson: [], projectionJson: null },
      runtimeJson: null,
    });
    await expect(
      getMaterialPublication("en", projection.publicPath)
    ).resolves.toBeNull();
    expect(cacheMock).toHaveBeenCalledWith("material");
    expect(deliveryMock).not.toHaveBeenCalled();
    expect(renderMock).not.toHaveBeenCalled();
  });

  it.each(["missing-body", "orphan-body"])(
    "rejects %s before rendering",
    async (kind) => {
      queryMock.mockResolvedValueOnce({
        materialKey: kind === "orphan-body" ? null : projection.materialKey,
        model:
          kind === "orphan-body"
            ? { ...model, alternateJson: [], projectionJson: null }
            : model,
        runtimeJson: kind === "missing-body" ? null : "signed-envelope",
      });
      await expect(
        getMaterialPublication("en", projection.publicPath)
      ).rejects.toMatchObject({
        _tag: "PublishedProjectionError",
      });
      expect(renderMock).not.toHaveBeenCalled();
    }
  );

  it.each([
    { activeReleaseId: "release-other" },
    { activeManifestHash: `sha256:${"b".repeat(64)}` },
  ])("rejects navigation from a different publication: %j", async (patch) => {
    queryMock
      .mockResolvedValueOnce({
        materialKey: projection.materialKey,
        model,
        runtimeJson: "signed-envelope",
      })
      .mockResolvedValueOnce({
        activeReleaseId,
        activeManifestHash: model.activeManifestHash,
        siblingJson: model.siblingJson,
        ...patch,
      });
    await expect(
      getMaterialPublication("en", projection.publicPath)
    ).rejects.toMatchObject({ _tag: "PublishedProjectionError" });
    expect(renderMock).not.toHaveBeenCalled();
  });

  it.each([
    { materialKey: null, model },
    {
      materialKey: projection.materialKey,
      model: { ...model, projectionJson: null },
    },
    {
      materialKey: projection.materialKey,
      model: { ...model, activeReleaseId: null },
    },
    { materialKey: "lesson.test.other", model },
  ])(
    "rejects a lesson with an incoherent navigation identity",
    async (source) => {
      queryMock.mockResolvedValueOnce({
        ...source,
        runtimeJson: "signed-envelope",
      });
      await expect(
        getMaterialPublication("en", projection.publicPath)
      ).rejects.toMatchObject({ _tag: "PublishedProjectionError" });
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
        new ContentRuntimeVerificationError({ cause: "invalid-signature" })
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
      model: { activeReleaseId, projection },
    });
    expect(renderMock).not.toHaveBeenCalled();
    expect(cacheMock).toHaveBeenCalledWith("material");
  });

  it("returns null for a withdrawn release without rendering", async () => {
    queryMock.mockResolvedValueOnce({
      materialKey: null,
      model: { ...model, alternateJson: [], projectionJson: null },
      runtimeJson: null,
    });
    await expect(
      getMaterialModel("en", projection.publicPath)
    ).resolves.toBeNull();
    expect(renderMock).not.toHaveBeenCalled();
  });
});
