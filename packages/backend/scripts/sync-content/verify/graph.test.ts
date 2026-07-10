import type { ConvexConfig } from "@repo/backend/scripts/sync-content/contract/types";
import {
  getTryoutGraphIdentityAlignment,
  verifyGraphIdentity,
} from "@repo/backend/scripts/sync-content/verify/graph";
import { createLearningGraphIdentityFromRoute } from "@repo/contents/_types/learning-graph";
import { locales } from "@repo/utilities/locales";
import { Effect } from "effect";
import { assert, beforeEach, describe, expect, it, vi } from "vitest";

const callConvexQueryMock = vi.hoisted(() => vi.fn());
const getGraphIdentityIntegrityMock = vi.hoisted(() => vi.fn());

vi.mock("@repo/backend/scripts/sync-content/convex/client", () => ({
  callConvexQuery: callConvexQueryMock,
}));

vi.mock("@repo/backend/scripts/sync-content/convex/inspection", () => ({
  getGraphIdentityIntegrity: getGraphIdentityIntegrityMock,
}));

vi.mock("@repo/backend/scripts/sync-content/cli/logging", () => ({
  log: vi.fn(),
  logError: vi.fn(),
  logSuccess: vi.fn(),
}));

const config: ConvexConfig = {
  accessToken: "test-token",
  url: "https://example.convex.cloud",
};
const TKA_ROUTE = "try-out/indonesia/tka/matematika";

beforeEach(() => {
  callConvexQueryMock.mockReset();
  getGraphIdentityIntegrityMock.mockReset();
});

describe("sync-content graph verification", () => {
  it("accepts canonical try-out identities across paginated route pages", async () => {
    callConvexQueryMock
      .mockReturnValueOnce(
        Effect.succeed(
          routePage({
            continueCursor: "next-page",
            isDone: false,
            routes: [contentRoute(TKA_ROUTE)],
          })
        )
      )
      .mockReturnValueOnce(Effect.succeed(routePage({ routes: [] })));

    const result = await Effect.runPromise(
      getTryoutGraphIdentityAlignment(config, { locale: "id" })
    );

    expect(result).toEqual({ checkedRoutes: 1, mismatches: [] });
    expect(callConvexQueryMock.mock.calls.map((call) => call[2])).toEqual([
      expect.objectContaining({
        cursor: null,
        locale: "id",
        prefix: "try-out",
        section: "tryout",
      }),
      expect.objectContaining({ cursor: "next-page", locale: "id" }),
    ]);
  });

  it("rejects localized and unprojectable persisted graph identities", async () => {
    callConvexQueryMock.mockReturnValue(
      Effect.succeed(
        routePage({
          routes: [
            localizedContentRoute(),
            {
              ...contentRoute(TKA_ROUTE),
              route: "try-out/indonesia/tka/unknown",
            },
          ],
        })
      )
    );

    const result = await Effect.runPromise(
      getTryoutGraphIdentityAlignment(config, { locale: "id" })
    );

    expect(result.checkedRoutes).toBe(2);
    expect(result.mismatches).toEqual([
      expect.stringContaining(
        "alignmentId, assetId, conceptId, content_id, learningObjectId, lensId"
      ),
      "id/try-out/indonesia/tka/unknown: source projection unavailable",
    ]);
  });

  it("checks every supported locale when verification is not locale-scoped", async () => {
    callConvexQueryMock.mockReturnValue(
      Effect.succeed(routePage({ routes: [] }))
    );

    const result = await Effect.runPromise(
      getTryoutGraphIdentityAlignment(config, {})
    );
    const checkedLocales = callConvexQueryMock.mock.calls.map(
      (call) => call[2].locale
    );

    expect(result).toEqual({ checkedRoutes: 0, mismatches: [] });
    expect(new Set(checkedLocales)).toEqual(new Set(locales));
  });

  it("combines persisted integrity with local source alignment", async () => {
    getGraphIdentityIntegrityMock.mockReturnValue(
      Effect.succeed(cleanPersistedIntegrity())
    );
    callConvexQueryMock.mockReturnValue(
      Effect.succeed(routePage({ routes: [] }))
    );

    await expect(
      Effect.runPromise(verifyGraphIdentity(config, { locale: "id" }))
    ).resolves.toBe(true);

    getGraphIdentityIntegrityMock.mockReturnValue(
      Effect.succeed(dirtyPersistedIntegrity())
    );
    callConvexQueryMock.mockReturnValue(
      Effect.succeed(
        routePage({
          routes: Array.from({ length: 6 }, (_, index) => ({
            ...contentRoute(TKA_ROUTE),
            route: `try-out/indonesia/tka/unknown-${index}`,
          })),
        })
      )
    );

    await expect(
      Effect.runPromise(verifyGraphIdentity(config, { locale: "id" }))
    ).resolves.toBe(false);
  });
});

/** Builds one mocked runtime route page. */
function routePage({
  continueCursor = "",
  isDone = true,
  routes,
}: {
  continueCursor?: string;
  isDone?: boolean;
  routes: ReturnType<typeof contentRoute>[];
}) {
  return { continueCursor, isDone, page: routes };
}

/** Builds one source-aligned runtime route fixture. */
function contentRoute(route: string) {
  const identity = createLearningGraphIdentityFromRoute({
    locale: "id",
    route,
  });

  assert(identity, `Expected graph identity for ${route}`);

  return {
    ...identity,
    content_id: identity.assetId,
    locale: "id",
    route,
  };
}

/** Recreates the stale localized identity that source verification must reject. */
function localizedContentRoute() {
  const route = contentRoute(TKA_ROUTE);
  const localize = (value: string) =>
    value.replaceAll("mathematics", "matematika");

  return {
    ...route,
    alignmentId: localize(route.alignmentId),
    assetId: localize(route.assetId),
    conceptId: localize(route.conceptId),
    content_id: localize(route.content_id),
    learningObjectId: localize(route.learningObjectId),
    lensId: `${route.lensId}:stale`,
  };
}

/** Builds a clean persisted graph verifier fixture. */
function cleanPersistedIntegrity() {
  return {
    checkedRefs: 1,
    checkedRefInputs: 1,
    firstInvalidRefInput: null,
    firstMissingGraph: null,
    firstMismatchedContentId: null,
    firstRouteShapedContentId: null,
    invalidRefInputs: 0,
    missingGraphRows: 0,
    mismatchedContentIds: 0,
    routeShapedContentIds: 0,
    scannedRows: 1,
  };
}

/** Builds a persisted graph verifier fixture with every structural issue. */
function dirtyPersistedIntegrity() {
  const issue = {
    assetId: "asset:id:stale",
    content_id: "try-out/stale",
    kind: "tryout-track",
    route: TKA_ROUTE,
    section: "tryout",
  };

  return {
    checkedRefs: 1,
    checkedRefInputs: 1,
    firstInvalidRefInput: issue,
    firstMissingGraph: issue,
    firstMismatchedContentId: issue,
    firstRouteShapedContentId: issue,
    invalidRefInputs: 1,
    missingGraphRows: 1,
    mismatchedContentIds: 1,
    routeShapedContentIds: 1,
    scannedRows: 1,
  };
}
