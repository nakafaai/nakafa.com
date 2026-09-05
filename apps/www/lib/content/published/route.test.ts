// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { ReleaseIdSchema } from "@nakafa/aksara-contracts/ids";
import { Effect } from "effect";
import { readActiveContentRoute } from "@/lib/content/published/route";
import { makeMaterialRuntimeSource } from "@/test/content/material";
import { createTestSnapshotContext } from "@/test/content/snapshot";
import { testArticleProjection } from "@/test/content-article";
import { previewProjection } from "@/test/content-preview";
import {
  createTestRuntimeQuery,
  createTestSnapshotQuery,
} from "@/test/runtime-query";

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
  it.effect(
    "resolves owned material and absence from authenticated snapshot rows",
    () =>
      Effect.gen(function* () {
        const fixture = yield* makeMaterialRuntimeSource();
        const context = yield* createTestSnapshotContext(fixture.source);
        readQueryMock.mockImplementation(createTestSnapshotQuery(context));
        const projection = fixture.projections[0];
        const activeReleaseId = fixture.state.activeReleaseId;

        expect(
          yield* readActiveContentRoute({
            activeReleaseId,
            appLocale: projection.appLocale,
            family: "material",
            publicPath: projection.publicPath,
          })
        ).toEqual({ activeReleaseId, kind: "found", projection });
        expect(
          yield* readActiveContentRoute({
            activeReleaseId,
            appLocale: projection.appLocale,
            family: "material",
            publicPath: "subjects/mathematics/technical-topic/missing-section",
          })
        ).toEqual({ activeReleaseId, kind: "missing" });
      })
  );
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
        expect(readQueryMock).toHaveBeenCalledWith(
          expect.anything(),
          {
            appLocale: input.appLocale,
            family: input.family,
            publicPath: input.publicPath,
          },
          expect.any(Function)
        );
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
