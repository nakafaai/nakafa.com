// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { ReleaseIdSchema } from "@nakafa/aksara-contracts/ids";
import { ACTIVE_APP_LOCALE_CODES } from "@nakafa/aksara-contracts/locale";
import { canonicalizeMaterialProjection } from "@nakafa/aksara-contracts/projection/material";
import { makeMaterialProjection } from "@repo/backend/test/content/material";
import { Effect } from "effect";
import {
  getPublishedMaterialRoute,
  readPublishedMaterialRoute,
} from "@/lib/content/material/route";
import { makeMaterialRuntimeSource } from "@/test/content/material";
import { createTestSnapshotContext } from "@/test/content/snapshot";
import {
  previewDeProjection,
  previewIdProjection,
  previewNextProjection,
  previewProjection,
  previewSourcePath,
} from "@/test/content-preview";
import {
  createTestRuntimeQuery,
  createTestSnapshotQuery,
} from "@/test/runtime-query";

const runtimeQueryMock = vi.hoisted(() => vi.fn());
const runtimeReadMock = vi.hoisted(() => vi.fn());
const cacheMock = vi.hoisted(() => vi.fn());
const activeManifestHash = `sha256:${"a".repeat(64)}`;
const activeReleaseId = ReleaseIdSchema.make("release-material");
const sourceRevision = "a".repeat(40);

vi.mock("@/lib/content/cache", () => ({
  applyContentRuntimeCache: cacheMock,
}));
vi.mock("@/lib/content/runtime/query", () => ({
  readRuntimeQuery: runtimeReadMock,
}));

/** Builds one complete backend-verified material model response. */
function foundModel(overrides?: {
  readonly activeManifestHash?: null | string;
  readonly activeAppLocales?: readonly string[];
  readonly activeReleaseId?: null | string;
  readonly alternateJson?: readonly string[];
  readonly projectionJson?: null | string;
  readonly rendererDomain?: null | string;
  readonly siblingJson?: readonly string[];
  readonly sourcePath?: null | string;
  readonly sourceRevision?: null | string;
}) {
  return {
    activeManifestHash:
      overrides?.activeManifestHash === undefined
        ? activeManifestHash
        : overrides.activeManifestHash,
    activeAppLocales: overrides?.activeAppLocales ?? ACTIVE_APP_LOCALE_CODES,
    activeReleaseId:
      overrides?.activeReleaseId === undefined
        ? activeReleaseId
        : overrides.activeReleaseId,
    alternateJson:
      overrides?.alternateJson ??
      [previewProjection, previewIdProjection, previewDeProjection].map(
        canonicalizeMaterialProjection
      ),
    projectionJson:
      overrides?.projectionJson === undefined
        ? canonicalizeMaterialProjection(previewProjection)
        : overrides.projectionJson,
    rendererDomain:
      overrides?.rendererDomain === undefined
        ? "mathematics"
        : overrides.rendererDomain,
    siblingJson:
      overrides?.siblingJson ??
      [previewProjection, previewNextProjection].map(
        canonicalizeMaterialProjection
      ),
    sourcePath:
      overrides?.sourcePath === undefined
        ? previewSourcePath
        : overrides.sourcePath,
    sourceProjectionJson: [],
    sourceRevision:
      overrides?.sourceRevision === undefined
        ? sourceRevision
        : overrides.sourceRevision,
  };
}

beforeEach(() => {
  runtimeQueryMock.mockReset();
  runtimeReadMock.mockImplementation(createTestRuntimeQuery(runtimeQueryMock));
  cacheMock.mockReset();
});

describe("published material route", () => {
  it.effect(
    "resolves a complete signed route and a missing route from serving rows",
    () =>
      Effect.gen(function* () {
        const fixture = yield* makeMaterialRuntimeSource();
        const context = yield* createTestSnapshotContext(fixture.source);
        runtimeReadMock.mockImplementation(createTestSnapshotQuery(context));
        const projection = makeMaterialProjection("en", 1);

        const route = yield* readPublishedMaterialRoute(
          "en",
          projection.publicPath
        );
        expect(route).toMatchObject({
          activeReleaseId: fixture.state.activeReleaseId,
          projection,
          rendererDomain: "mathematics",
        });
        expect(route.alternates).toHaveLength(3);
        expect(route.siblings).toHaveLength(2);
        expect(
          yield* readPublishedMaterialRoute("en", "subjects/missing")
        ).toMatchObject({
          activeReleaseId: fixture.state.activeReleaseId,
          projection: null,
          alternates: [],
          siblings: [],
        });
      })
  );

  it.effect(
    "decodes one complete signed route, locale set, and sibling group",
    () =>
      Effect.gen(function* () {
        runtimeQueryMock.mockResolvedValueOnce(foundModel());

        const route = yield* Effect.tryPromise(() =>
          getPublishedMaterialRoute("en", previewProjection.publicPath)
        );
        expect(route).toMatchObject({
          activeReleaseId,
          alternates: [
            previewProjection,
            previewIdProjection,
            previewDeProjection,
          ],
          projection: previewProjection,
          rendererDomain: "mathematics",
          siblings: [previewProjection, previewNextProjection],
          sourceRevision,
        });
        expect(runtimeQueryMock).toHaveBeenCalledOnce();
        expect(cacheMock).toHaveBeenCalledOnce();
      })
  );

  it.effect("pins a route read to the expected active release", () =>
    Effect.gen(function* () {
      runtimeQueryMock.mockResolvedValueOnce(foundModel());

      const route = yield* Effect.tryPromise(() =>
        getPublishedMaterialRoute(
          "en",
          previewProjection.publicPath,
          activeReleaseId
        )
      );
      expect(route).toMatchObject({ activeReleaseId });
      expect(runtimeQueryMock).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ expectedActiveReleaseId: activeReleaseId })
      );
    })
  );

  it.effect("preserves an active release mismatch for pinned callers", () =>
    Effect.gen(function* () {
      const expectedReleaseId = ReleaseIdSchema.make("release-previous");
      runtimeQueryMock.mockResolvedValueOnce(foundModel());

      const mismatch = yield* readPublishedMaterialRoute(
        "en",
        previewProjection.publicPath,
        expectedReleaseId
      ).pipe(Effect.flip);
      expect(mismatch).toMatchObject({
        _tag: "PublishedReleaseMismatchError",
        actualReleaseId: activeReleaseId,
        expectedReleaseId,
      });
    })
  );

  it.effect("preserves a signed missing-route tombstone", () =>
    Effect.gen(function* () {
      runtimeQueryMock.mockResolvedValueOnce(
        foundModel({
          alternateJson: [],
          projectionJson: null,
          rendererDomain: null,
          siblingJson: [],
          sourcePath: null,
        })
      );

      const route = yield* readPublishedMaterialRoute(
        "en",
        previewProjection.publicPath
      );
      expect(route).toMatchObject({
        activeReleaseId,
        alternates: [],
        projection: null,
        sourcePath: null,
      });
    })
  );

  it.effect.each([
    ["active manifest", foundModel({ activeManifestHash: "invalid" })],
    ["missing manifest", foundModel({ activeManifestHash: null })],
    ["active locales", foundModel({ activeAppLocales: ["id", "en", "de"] })],
    ["missing release", foundModel({ activeReleaseId: null })],
    ["source revision", foundModel({ sourceRevision: "main" })],
    ["missing renderer", foundModel({ rendererDomain: null })],
    ["renderer", foundModel({ rendererDomain: "unknown" })],
    ["missing source path", foundModel({ sourcePath: null })],
    ["source path", foundModel({ sourcePath: "outside/corpus" })],
    [
      "current route",
      foundModel({
        projectionJson: canonicalizeMaterialProjection(previewIdProjection),
      }),
    ],
    [
      "complete locale set",
      foundModel({
        alternateJson: [canonicalizeMaterialProjection(previewProjection)],
      }),
    ],
    [
      "duplicate locale",
      foundModel({
        alternateJson: [
          canonicalizeMaterialProjection(previewProjection),
          canonicalizeMaterialProjection(previewProjection),
        ],
      }),
    ],
    [
      "counterpart",
      foundModel({
        alternateJson: [
          canonicalizeMaterialProjection(previewProjection),
          canonicalizeMaterialProjection({
            ...previewIdProjection,
            contentKey: previewNextProjection.contentKey,
          }),
        ],
      }),
    ],
    [
      "sibling",
      foundModel({
        siblingJson: [canonicalizeMaterialProjection(previewIdProjection)],
      }),
    ],
    ["current sibling", foundModel({ siblingJson: [] })],
    ["projection JSON", foundModel({ projectionJson: "{}" })],
    ["alternate JSON", foundModel({ alternateJson: ["{}"] })],
    ["sibling JSON", foundModel({ siblingJson: ["{}"] })],
  ])("rejects an invalid %s", ([, result]) =>
    Effect.gen(function* () {
      runtimeQueryMock.mockResolvedValueOnce(result);

      const failure = yield* readPublishedMaterialRoute(
        "en",
        previewProjection.publicPath
      ).pipe(Effect.flip);
      expect(failure).toMatchObject({ _tag: "PublishedProjectionError" });
    })
  );
});
