// @vitest-environment node

import type { HttpClient } from "@confect/js";
import { beforeEach, describe, expect, it } from "@effect/vitest";
import contentRelease from "@repo/backend/confect/_generated/refs/contentRelease";
import { Effect, Layer } from "effect";
import { getMaterialModel } from "@/lib/content/material/model";
import { activateTestRelease } from "@/test/active";
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

describe("verified material metadata", () => {
  it.effect("resolves the verified model without rendering the body", () =>
    Effect.gen(function* () {
      expect(
        yield* getMaterialModel("en", projection.publicPath)
      ).toMatchObject({
        model: {
          activeReleaseId,
          projection,
        },
      });
      expect(renderMock).not.toHaveBeenCalled();
    })
  );
  it.effect("returns null for a withdrawn release without rendering", () =>
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
      expect(yield* getMaterialModel("en", projection.publicPath)).toBeNull();
      expect(renderMock).not.toHaveBeenCalled();
    })
  );
});
