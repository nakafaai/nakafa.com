// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { ReleaseIdSchema } from "@nakafa/aksara-contracts/ids";
import { api } from "@repo/backend/convex/_generated/api";
import { createTestPublication } from "@repo/backend/test/content/publication";
import { NakafaAgentDataReadError } from "@repo/contents/agent/errors";
import { Effect } from "effect";
import { readActiveContentRoute } from "@/lib/content/published/route";
import { makeMaterialRuntimeSource } from "@/test/content/material";
import { testArticleProjection } from "@/test/content-article";
import { previewProjection } from "@/test/content-preview";
import {
  createTestNativeQuery,
  createTestRuntimeQuery,
} from "@/test/runtime-query";

const fetchQueryMock = vi.hoisted(() => vi.fn());
const readQueryMock = vi.hoisted(() => vi.fn());
const activeReleaseId = ReleaseIdSchema.make("release-active");
const input = {
  appLocale: previewProjection.appLocale,
  family: "material",
  publicPath: previewProjection.publicPath,
} satisfies Parameters<typeof readActiveContentRoute>[0];

vi.mock("@repo/backend/client/nakafa/query", () => ({
  readNakafaRuntimeQuery: readQueryMock,
}));

beforeEach(() => {
  fetchQueryMock.mockReset();
  readQueryMock.mockReset();
  readQueryMock.mockImplementation(createTestRuntimeQuery(fetchQueryMock));
});

describe("published content route", () => {
  it.effect(
    "resolves owned material and absence from authenticated snapshot rows",
    () =>
      Effect.gen(function* () {
        const fixture = yield* makeMaterialRuntimeSource();
        const context = yield* createTestPublication(fixture.source);
        readQueryMock.mockImplementation(createTestNativeQuery(context));
        const projection = fixture.projections[0];
        const activeReleaseId = fixture.state.activeReleaseId;

        expect(
          yield* readActiveContentRoute({
            appLocale: projection.appLocale,
            family: "material",
            publicPath: projection.publicPath,
          })
        ).toEqual({ activeReleaseId, kind: "found", projection });
        expect(readQueryMock).toHaveBeenCalledTimes(1);
        expect(
          yield* readActiveContentRoute({
            appLocale: projection.appLocale,
            family: "material",
            publicPath: "subjects/mathematics/technical-topic/missing-section",
          })
        ).toEqual({ activeReleaseId, kind: "missing" });
        expect(readQueryMock).toHaveBeenCalledTimes(2);
      })
  );

  it.effect(
    "reads an inactive publication through the atomic ownership query",
    () =>
      Effect.gen(function* () {
        fetchQueryMock.mockResolvedValue({
          activeReleaseId: null,
          kind: "unmanaged",
        });

        expect(yield* readActiveContentRoute(input)).toEqual({
          activeReleaseId: null,
          kind: "unmanaged",
        });
        expect(readQueryMock).toHaveBeenCalledExactlyOnceWith(
          "https://test.convex.cloud",
          api.contentRelease.ownership.resolve,
          input
        );
      })
  );

  it.effect.each(["unmanaged", "missing"] as const)(
    "returns the current release with %s ownership without a preflight identity",
    (kind) =>
      Effect.gen(function* () {
        const nextReleaseId = ReleaseIdSchema.make("release-next");
        fetchQueryMock.mockResolvedValue({
          activeReleaseId: nextReleaseId,
          kind,
        });

        expect(yield* readActiveContentRoute(input)).toEqual({
          activeReleaseId: nextReleaseId,
          kind,
        });
        expect(readQueryMock).toHaveBeenCalledTimes(1);
      })
  );

  it.effect(
    "decodes each current projection with one query and no artifact fetch",
    () =>
      Effect.gen(function* () {
        const nextReleaseId = ReleaseIdSchema.make("release-next");
        fetchQueryMock
          .mockResolvedValueOnce({
            activeReleaseId,
            kind: "found",
            projectionJson: JSON.stringify(previewProjection),
          })
          .mockResolvedValueOnce({
            activeReleaseId: nextReleaseId,
            kind: "found",
            projectionJson: JSON.stringify(previewProjection),
          });

        expect(yield* readActiveContentRoute(input)).toEqual({
          activeReleaseId,
          kind: "found",
          projection: previewProjection,
        });
        expect(readQueryMock).toHaveBeenCalledExactlyOnceWith(
          "https://test.convex.cloud",
          api.contentRelease.ownership.resolve,
          input
        );
        expect(yield* readActiveContentRoute(input)).toEqual({
          activeReleaseId: nextReleaseId,
          kind: "found",
          projection: previewProjection,
        });
        expect(readQueryMock).toHaveBeenCalledTimes(2);
        expect(fetchQueryMock).toHaveBeenCalledTimes(2);
      })
  );

  it.effect.each([
    "{",
    "{}",
    JSON.stringify({
      ...previewProjection,
      publicPath: "subjects/mathematics/unrelated",
    }),
    JSON.stringify({ ...previewProjection, appLocale: "de" }),
    JSON.stringify(testArticleProjection),
    JSON.stringify({ ...previewProjection, unexpected: true }),
  ])("rejects invalid projection %s without a fallback", (projectionJson) =>
    Effect.gen(function* () {
      fetchQueryMock.mockResolvedValue({
        activeReleaseId,
        kind: "found",
        projectionJson,
      });

      expect(
        yield* readActiveContentRoute(input).pipe(Effect.flip)
      ).toMatchObject({
        _tag: "PublishedProjectionError",
        appLocale: input.appLocale,
        publicPath: input.publicPath,
      });
      expect(readQueryMock).toHaveBeenCalledTimes(1);
    })
  );

  it.effect("propagates typed ownership query failures", () =>
    Effect.gen(function* () {
      const failure = new NakafaAgentDataReadError({
        cause: "query unavailable",
        message: "Unable to read signed ownership.",
      });
      readQueryMock.mockReturnValueOnce(Effect.fail(failure));

      expect(yield* readActiveContentRoute(input).pipe(Effect.flip)).toBe(
        failure
      );
      expect(readQueryMock).toHaveBeenCalledTimes(1);
    })
  );
});

vi.mock("@/env", () => ({
  env: { NEXT_PUBLIC_CONVEX_URL: "https://test.convex.cloud" },
}));
