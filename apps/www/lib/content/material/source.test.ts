// @vitest-environment node

import { PublicPathSchema } from "@nakafa/aksara-contracts/ids";
import { Effect } from "effect";
import { describe, expect, it, vi } from "vitest";
import {
  readMaterialSourceCandidates,
  reconcileMaterialSourceRoutes,
} from "@/lib/content/material/source";
import {
  makePreviewPublicRoute,
  previewIdProjection,
  previewNextProjection,
  previewProjection,
} from "@/test/content-preview";

const sourceRoute = makePreviewPublicRoute(previewProjection, {
  publicPath:
    "subjects/mathematics/function-composition-inverse-function/old-function-concept",
});
const nextRoute = makePreviewPublicRoute(previewNextProjection);
const idRoute = makePreviewPublicRoute(previewIdProjection);
const topicRoute = {
  ...sourceRoute,
  kind: "subject-topic" as const,
  publicPath: sourceRoute.parentPath,
};

describe("material source reconciliation", () => {
  it("extracts exact lesson identities from canonical curriculum paths", () => {
    expect(
      readMaterialSourceCandidates(
        [
          topicRoute.publicPath,
          sourceRoute.publicPath,
          idRoute.publicPath,
          "subjects/mathematics/missing",
        ],
        "en",
        [sourceRoute, idRoute, topicRoute]
      )
    ).toEqual([
      {
        contentKey: sourceRoute.sourcePath,
        locale: "en",
        parentPath: sourceRoute.parentPath,
      },
    ]);
  });

  it("keeps an empty source topic as a published-group anchor", () => {
    expect(
      readMaterialSourceCandidates([topicRoute.publicPath], "en", [topicRoute])
    ).toEqual([
      {
        contentKey: topicRoute.sourcePath,
        locale: "en",
        parentPath: topicRoute.publicPath,
      },
    ]);
  });

  it("replaces found claims, removes tombstones, and preserves unclaimed routes", async () => {
    await expect(
      Effect.runPromise(
        reconcileMaterialSourceRoutes("en", [sourceRoute, nextRoute, idRoute], {
          claims: [
            {
              contentKey: previewProjection.contentKey,
              kind: "found",
              locale: "en",
              projection: previewProjection,
            },
            {
              contentKey: previewNextProjection.contentKey,
              kind: "missing",
              locale: "en",
            },
          ],
          materials: [previewProjection, previewIdProjection],
        })
      )
    ).resolves.toEqual([idRoute, makePreviewPublicRoute(previewProjection)]);
  });

  it("uses the synchronous Effect fast path required by static prerender", () => {
    const dateNow = vi.spyOn(Date, "now");
    const result = Effect.runSync(
      reconcileMaterialSourceRoutes("en", [sourceRoute], {
        claims: [],
        materials: [],
      })
    );
    const dateNowCalls = dateNow.mock.calls.length;
    dateNow.mockRestore();

    expect(result).toEqual([sourceRoute]);
    expect(dateNowCalls).toBe(0);
  });

  it("preserves a typed failure when a published projection cannot become a route", async () => {
    const malformed = structuredClone(previewProjection);
    Reflect.set(malformed, "publicPath", "");

    await expect(
      Effect.runPromise(
        Effect.flip(
          reconcileMaterialSourceRoutes("en", [sourceRoute], {
            claims: [
              {
                contentKey: previewProjection.contentKey,
                kind: "found",
                locale: "en",
                projection: malformed,
              },
            ],
            materials: [],
          })
        )
      )
    ).resolves.toMatchObject({
      _tag: "PublishedProjectionError",
      locale: "en",
      publicPath: "",
    });
  });

  it("rejects a published route owned by another source identity", async () => {
    await expect(
      Effect.runPromise(
        Effect.flip(
          reconcileMaterialSourceRoutes("en", [nextRoute], {
            claims: [
              {
                contentKey: previewProjection.contentKey,
                kind: "found",
                locale: "en",
                projection: {
                  ...previewProjection,
                  publicPath: PublicPathSchema.make(nextRoute.publicPath),
                },
              },
            ],
            materials: [],
          })
        )
      )
    ).resolves.toMatchObject({
      _tag: "PublishedProjectionError",
      locale: "en",
      publicPath: nextRoute.publicPath,
    });
  });
});
