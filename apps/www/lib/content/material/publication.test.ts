// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { ReleaseIdSchema } from "@nakafa/aksara-contracts/ids";
import { ContentRuntimeVerificationError } from "@repo/backend/client/content/errors";
import { api } from "@repo/backend/convex/_generated/api";
import { Effect } from "effect";
import { getMaterialPublication } from "@/lib/content/material/publication";
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
  queryMock
    .mockReset()
    .mockResolvedValue({ model, runtimeJson: "signed-envelope" });
  cacheMock.mockReset();
  deliveryMock.mockReset().mockReturnValue(Effect.succeed(data));
  renderMock.mockReset().mockReturnValue(Effect.succeed(published));
});

describe("coherent material publication", () => {
  it("reads the shell and body once and verifies them before rendering", async () => {
    await expect(
      getMaterialPublication("en", projection.publicPath)
    ).resolves.toMatchObject({
      model: { activeReleaseId, projection },
      published,
    });
    expect(queryMock).toHaveBeenCalledExactlyOnceWith(
      api.contentRelease.material.delivery,
      { appLocale: "en", publicPath: projection.publicPath },
      { url: "https://test.convex.cloud" }
    );
    expect(deliveryMock).toHaveBeenCalledExactlyOnceWith(
      { appLocale: "en", publicPath: projection.publicPath },
      "signed-envelope"
    );
    expect(cacheMock).toHaveBeenCalledExactlyOnceWith("material");
    expect(renderMock).toHaveBeenCalledOnce();
  });

  it("caches an authenticated withdrawal without rendering", async () => {
    queryMock.mockResolvedValueOnce({
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
