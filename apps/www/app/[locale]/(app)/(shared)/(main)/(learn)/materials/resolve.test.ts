// @vitest-environment node

import { Effect, Option } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readMaterialRequestRoute } from "@/app/[locale]/(app)/(shared)/(main)/(learn)/materials/resolve";
import { readActiveMaterialRoute } from "@/lib/content/published/route";
import { previewProjection, previewPublicRoute } from "@/test/content-preview";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/content/published/route", () => ({
  readActiveMaterialRoute: vi.fn(),
}));

const activeMock = vi.mocked(readActiveMaterialRoute);
const params = {
  lesson: ["function-concept"],
  locale: "en",
  topic: "function-composition-inverse-function",
};

beforeEach(() => {
  activeMock.mockReset();
});

describe("material request resolution", () => {
  it("accepts a new active projection without consulting static existence", async () => {
    activeMock.mockReturnValue(
      Effect.succeed({
        activeReleaseId: "release-active",
        kind: "found",
        rendererDomain: "mathematics",
        route: previewPublicRoute,
      })
    );

    await expect(
      Effect.runPromise(readMaterialRequestRoute(params, "mathematics"))
    ).resolves.toEqual(
      Option.some({
        locale: "en",
        owner: "published",
        rendererDomain: "mathematics",
        route: previewPublicRoute,
      })
    );
    expect(activeMock).toHaveBeenCalledWith({
      locale: "en",
      publicPath: previewProjection.publicPath,
    });
  });

  it("keeps owned deletion missing instead of reviving source content", async () => {
    activeMock.mockReturnValue(Effect.succeed({ kind: "missing" }));

    await expect(
      Effect.runPromise(readMaterialRequestRoute(params, "mathematics"))
    ).resolves.toEqual(Option.none());
  });

  it("uses the current source catalog only for unmanaged routes", async () => {
    activeMock.mockReturnValue(Effect.succeed({ kind: "unmanaged" }));

    const result = await Effect.runPromise(
      readMaterialRequestRoute(params, "mathematics")
    );

    expect(Option.isSome(result)).toBe(true);
    if (Option.isSome(result)) {
      expect(result.value).toMatchObject({
        owner: "source",
        rendererDomain: "mathematics",
        route: { publicPath: previewProjection.publicPath },
      });
    }
  });

  it("fails visibly when an active route reaches the wrong renderer", async () => {
    activeMock.mockReturnValue(
      Effect.succeed({
        activeReleaseId: "release-active",
        kind: "found",
        rendererDomain: "chemistry",
        route: previewPublicRoute,
      })
    );

    await expect(
      Effect.runPromise(
        readMaterialRequestRoute(params, "mathematics").pipe(Effect.flip)
      )
    ).resolves.toMatchObject({
      _tag: "MaterialRouteError",
      reason: "renderer-domain",
      value: previewProjection.publicPath,
    });
  });

  it("rejects invalid and incomplete route params before publication lookup", async () => {
    await expect(
      Effect.runPromise(
        readMaterialRequestRoute(
          { ...params, locale: "de" },
          "mathematics"
        ).pipe(Effect.flip)
      )
    ).resolves.toMatchObject({
      _tag: "MaterialRouteError",
      reason: "locale",
      value: "de",
    });
    await expect(
      Effect.runPromise(
        readMaterialRequestRoute({ locale: "en", topic: "topic" }, "generic")
      )
    ).resolves.toEqual(Option.none());
    expect(activeMock).not.toHaveBeenCalled();
  });

  it("preserves missing source results for unmanaged routes", async () => {
    activeMock.mockReturnValue(Effect.succeed({ kind: "unmanaged" }));

    await expect(
      Effect.runPromise(
        readMaterialRequestRoute(
          {
            locale: "en",
            subject: "missing-subject",
            topic: "missing-topic",
          },
          "generic"
        )
      )
    ).resolves.toEqual(Option.none());
  });
});
