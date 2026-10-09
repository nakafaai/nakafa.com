// @vitest-environment node

import { HttpClient } from "@confect/js";
import { beforeEach, describe, expect, it } from "@effect/vitest";
import { ReleaseIdSchema } from "@nakafa/aksara-contracts/ids";
import { RoutedContentProjectionSchema } from "@nakafa/aksara-contracts/projection/spec";
import refs from "@repo/backend/confect/_generated/refs";
import { createTestPublication } from "@repo/backend/test/content/publication";
import { encodeJsonText } from "@repo/utilities/json";
import { Effect, Layer, Schema } from "effect";
import { readActiveContentRoute } from "@/lib/content/published/route";
import { makeMaterialRuntimeSource } from "@/test/content/material";
import { testArticleProjection } from "@/test/content-article";
import { previewProjection } from "@/test/content-preview";

const fetchQueryMock = vi.hoisted(() => vi.fn());
const activeReleaseId = ReleaseIdSchema.make("release-active");
const input = {
  appLocale: previewProjection.appLocale,
  family: "material",
  publicPath: previewProjection.publicPath,
} satisfies Parameters<typeof readActiveContentRoute>[0];
const routedJson = Schema.encodeSync(
  Schema.fromJsonString(RoutedContentProjectionSchema)
);
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
              query: fetchQueryMock,
            };
          })
        ).pipe(Layer.provide(HttpClient.layer(...args))),
    },
  };
});
beforeEach(() => {
  fetchQueryMock.mockReset();
});
describe("published content route", () => {
  it.effect(
    "resolves owned material and absence from authenticated snapshot rows",
    () =>
      Effect.gen(function* () {
        const fixture = yield* makeMaterialRuntimeSource();
        const context = yield* createTestPublication(fixture.source);
        fetchQueryMock.mockImplementation(context.query);
        const projection = fixture.projections[0];
        const activeReleaseId = fixture.state.activeReleaseId;
        expect(
          yield* readActiveContentRoute({
            appLocale: projection.appLocale,
            family: "material",
            publicPath: projection.publicPath,
          })
        ).toEqual({
          activeReleaseId,
          kind: "found",
          projection,
        });
        expect(fetchQueryMock).toHaveBeenCalledTimes(1);
        expect(
          yield* readActiveContentRoute({
            appLocale: projection.appLocale,
            family: "material",
            publicPath: "subjects/mathematics/technical-topic/missing-section",
          })
        ).toEqual({
          activeReleaseId,
          kind: "missing",
        });
        expect(fetchQueryMock).toHaveBeenCalledTimes(2);
      })
  );
  it.effect(
    "reads an inactive publication through the atomic ownership query",
    () =>
      Effect.gen(function* () {
        fetchQueryMock.mockReturnValue(
          Effect.succeed({
            activeReleaseId: null,
            kind: "unmanaged",
          })
        );
        expect(yield* readActiveContentRoute(input)).toEqual({
          activeReleaseId: null,
          kind: "unmanaged",
        });
        expect(fetchQueryMock).toHaveBeenCalledExactlyOnceWith(
          refs.public.contentRelease.ownership.resolve,
          input
        );
      })
  );
  it.effect.each(["unmanaged", "missing"] as const)(
    "returns the current release with %s ownership without a preflight identity",
    (kind) =>
      Effect.gen(function* () {
        const nextReleaseId = ReleaseIdSchema.make("release-next");
        fetchQueryMock.mockReturnValue(
          Effect.succeed({
            activeReleaseId: nextReleaseId,
            kind,
          })
        );
        expect(yield* readActiveContentRoute(input)).toEqual({
          activeReleaseId: nextReleaseId,
          kind,
        });
        expect(fetchQueryMock).toHaveBeenCalledTimes(1);
      })
  );
  it.effect(
    "decodes each current projection with one query and no artifact fetch",
    () =>
      Effect.gen(function* () {
        const nextReleaseId = ReleaseIdSchema.make("release-next");
        fetchQueryMock
          .mockReturnValueOnce(
            Effect.succeed({
              activeReleaseId,
              kind: "found",
              projectionJson: routedJson(previewProjection),
            })
          )
          .mockReturnValueOnce(
            Effect.succeed({
              activeReleaseId: nextReleaseId,
              kind: "found",
              projectionJson: routedJson(previewProjection),
            })
          );
        expect(yield* readActiveContentRoute(input)).toEqual({
          activeReleaseId,
          kind: "found",
          projection: previewProjection,
        });
        expect(fetchQueryMock).toHaveBeenCalledExactlyOnceWith(
          refs.public.contentRelease.ownership.resolve,
          input
        );
        expect(yield* readActiveContentRoute(input)).toEqual({
          activeReleaseId: nextReleaseId,
          kind: "found",
          projection: previewProjection,
        });
        expect(fetchQueryMock).toHaveBeenCalledTimes(2);
        expect(fetchQueryMock).toHaveBeenCalledTimes(2);
      })
  );
  // The contract codec throws on the locale and parent path mismatches and strips
  // the unexpected key, so those three fixtures keep the plain codec.
  it.effect.each([
    "{",
    "{}",
    encodeJsonText({
      ...previewProjection,
      publicPath: "subjects/mathematics/unrelated",
    }),
    encodeJsonText({
      ...previewProjection,
      appLocale: "de",
    }),
    routedJson(testArticleProjection),
    encodeJsonText({
      ...previewProjection,
      unexpected: true,
    }),
  ])("rejects invalid projection %s without a fallback", (projectionJson) =>
    Effect.gen(function* () {
      fetchQueryMock.mockReturnValue(
        Effect.succeed({
          activeReleaseId,
          kind: "found",
          projectionJson,
        })
      );
      expect(
        yield* readActiveContentRoute(input).pipe(Effect.flip)
      ).toMatchObject({
        _tag: "PublishedProjectionError",
        appLocale: input.appLocale,
        publicPath: input.publicPath,
      });
      expect(fetchQueryMock).toHaveBeenCalledTimes(1);
    })
  );
  it.effect("propagates typed ownership query failures", () =>
    Effect.gen(function* () {
      const failure = new HttpClient.HttpClientError({
        cause: "query unavailable",
      });
      fetchQueryMock.mockReturnValueOnce(Effect.fail(failure));
      expect(yield* readActiveContentRoute(input).pipe(Effect.flip)).toBe(
        failure
      );
      expect(fetchQueryMock).toHaveBeenCalledTimes(1);
    })
  );
});
vi.mock("@/env", () => ({
  env: {
    NEXT_PUBLIC_CONVEX_URL: "https://test.convex.cloud",
  },
}));
