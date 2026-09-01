// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { ReleaseIdSchema } from "@nakafa/aksara-contracts/ids";
import { Effect } from "effect";
import { readActiveContentRoute } from "@/lib/content/published/route";
import { testArticleProjection } from "@/test/content-article";
import { previewProjection } from "@/test/content-preview";
import { createTestRuntimeQuery } from "@/test/runtime-query";

const fetchQueryMock = vi.hoisted(() => vi.fn());
const readQueryMock = vi.hoisted(() => vi.fn());
const activeReleaseId = ReleaseIdSchema.make("release-active");
const input = {
  activeReleaseId,
  appLocale: previewProjection.appLocale,
  family: "material" as const,
  publicPath: previewProjection.publicPath,
};

vi.mock("@/lib/content/runtime/query", () => ({
  readRuntimeQuery: readQueryMock,
}));

beforeEach(() => {
  fetchQueryMock.mockReset();
  readQueryMock.mockReset();
  readQueryMock.mockImplementation(createTestRuntimeQuery(fetchQueryMock));
});

describe("published content route", () => {
  it.effect("skips route lookup when no content release is active", () =>
    Effect.gen(function* () {
      expect(
        yield* readActiveContentRoute({
          activeReleaseId: null,
          appLocale: input.appLocale,
          family: input.family,
          publicPath: input.publicPath,
        })
      ).toEqual({
        activeReleaseId: null,
        kind: "unmanaged",
      });
      expect(readQueryMock).not.toHaveBeenCalled();
      expect(fetchQueryMock).not.toHaveBeenCalled();
    })
  );

  it.effect(
    "passes unmanaged and owned absence through without projection fallback",
    () =>
      Effect.gen(function* () {
        fetchQueryMock
          .mockResolvedValueOnce({
            activeReleaseId: input.activeReleaseId,
            kind: "unmanaged",
          })
          .mockResolvedValueOnce({
            activeReleaseId: input.activeReleaseId,
            kind: "missing",
          });

        expect(yield* readActiveContentRoute(input)).toEqual({
          activeReleaseId: input.activeReleaseId,
          kind: "unmanaged",
        });
        expect(yield* readActiveContentRoute(input)).toEqual({
          activeReleaseId: input.activeReleaseId,
          kind: "missing",
        });
      })
  );

  it.effect(
    "fails when ownership changes after the caller reads active identity",
    () =>
      Effect.gen(function* () {
        const nextReleaseId = ReleaseIdSchema.make("release-next");
        fetchQueryMock
          .mockResolvedValueOnce({
            activeReleaseId: nextReleaseId,
            kind: "unmanaged",
          })
          .mockResolvedValueOnce({
            activeReleaseId: nextReleaseId,
            kind: "missing",
          });

        expect(
          yield* readActiveContentRoute(input).pipe(Effect.flip)
        ).toMatchObject({
          _tag: "PublishedReleaseMismatchError",
          actualReleaseId: "release-next",
          expectedReleaseId: activeReleaseId,
        });
        expect(
          yield* readActiveContentRoute(input).pipe(Effect.flip)
        ).toMatchObject({
          _tag: "PublishedReleaseMismatchError",
          actualReleaseId: "release-next",
          expectedReleaseId: activeReleaseId,
        });
      })
  );

  it.effect(
    "decodes the canonical routed projection without fetching its artifact",
    () =>
      Effect.gen(function* () {
        fetchQueryMock.mockResolvedValue({
          activeReleaseId,
          kind: "found",
          projectionJson: JSON.stringify(previewProjection),
        });

        expect(yield* readActiveContentRoute(input)).toEqual({
          activeReleaseId,
          kind: "found",
          projection: previewProjection,
        });
        expect(fetchQueryMock).toHaveBeenCalledWith(expect.anything(), {
          appLocale: input.appLocale,
          family: input.family,
          publicPath: input.publicPath,
        });
        expect(readQueryMock).toHaveBeenCalledWith(expect.anything(), {
          appLocale: input.appLocale,
          family: input.family,
          publicPath: input.publicPath,
        });
      })
  );

  it.effect(
    "surfaces malformed stored projections as typed integrity failures",
    () =>
      Effect.gen(function* () {
        fetchQueryMock.mockResolvedValue({
          activeReleaseId,
          kind: "found",
          projectionJson: JSON.stringify({
            ...previewProjection,
            publicPath: "subjects/mathematics/unrelated",
          }),
        });

        expect(
          yield* readActiveContentRoute(input).pipe(Effect.flip)
        ).toMatchObject({
          _tag: "PublishedProjectionError",
          appLocale: input.appLocale,
          publicPath: input.publicPath,
        });

        fetchQueryMock.mockResolvedValue({
          activeReleaseId,
          kind: "found",
          projectionJson: JSON.stringify(testArticleProjection),
        });
        expect(
          yield* readActiveContentRoute(input).pipe(Effect.flip)
        ).toMatchObject({
          _tag: "PublishedProjectionError",
          appLocale: input.appLocale,
          publicPath: input.publicPath,
        });

        fetchQueryMock.mockResolvedValue({
          activeReleaseId,
          kind: "found",
          projectionJson: "{",
        });
        expect(
          yield* readActiveContentRoute(input).pipe(Effect.flip)
        ).toMatchObject({
          _tag: "PublishedProjectionError",
          appLocale: input.appLocale,
          publicPath: input.publicPath,
        });
      })
  );
});
