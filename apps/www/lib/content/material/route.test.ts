// @vitest-environment node

import { ReleaseIdSchema } from "@nakafa/aksara-contracts/ids";
import { canonicalizeMaterialProjection } from "@nakafa/aksara-contracts/projection/material";
import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getPublishedMaterialRoute,
  readPublishedMaterialRoute,
} from "@/lib/content/material/route";
import {
  previewIdProjection,
  previewNextProjection,
  previewProjection,
  previewSourcePath,
} from "@/test/content-preview";

const runtimeQueryMock = vi.hoisted(() => vi.fn());
const cacheMock = vi.hoisted(() => vi.fn());
const activeManifestHash = `sha256:${"a".repeat(64)}`;
const activeReleaseId = ReleaseIdSchema.make("release-material");
const sourceRevision = "a".repeat(40);

vi.mock("@/lib/content/cache", () => ({
  applyContentRuntimeCache: cacheMock,
}));
vi.mock("@/lib/content/runtime/query", async () => {
  const { createTestRuntimeQuery } = await import("@/test/runtime-query");
  return {
    readRuntimeQuery: createTestRuntimeQuery(runtimeQueryMock),
  };
});

/** Builds one complete backend-verified material model response. */
function foundModel(overrides?: {
  readonly activeManifestHash?: null | string;
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
    activeReleaseId:
      overrides?.activeReleaseId === undefined
        ? activeReleaseId
        : overrides.activeReleaseId,
    alternateJson:
      overrides?.alternateJson ??
      [previewProjection, previewIdProjection].map(
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
    sourceClaims: [],
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
  cacheMock.mockReset();
});

describe("published material route", () => {
  it("decodes one complete signed route, locale set, and sibling group", async () => {
    runtimeQueryMock.mockResolvedValueOnce(foundModel());

    await expect(
      getPublishedMaterialRoute("en", previewProjection.publicPath)
    ).resolves.toMatchObject({
      activeReleaseId,
      alternates: [previewProjection, previewIdProjection],
      projection: previewProjection,
      rendererDomain: "mathematics",
      siblings: [previewProjection, previewNextProjection],
      sourceRevision,
    });
    expect(cacheMock).toHaveBeenCalledOnce();
  });

  it("pins a route read to the expected active release", async () => {
    runtimeQueryMock.mockResolvedValueOnce(foundModel());

    await expect(
      getPublishedMaterialRoute(
        "en",
        previewProjection.publicPath,
        activeReleaseId
      )
    ).resolves.toMatchObject({ activeReleaseId });
    expect(runtimeQueryMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ expectedActiveReleaseId: activeReleaseId })
    );
  });

  it("preserves a signed missing-route tombstone", async () => {
    runtimeQueryMock.mockResolvedValueOnce(
      foundModel({
        alternateJson: [],
        projectionJson: null,
        rendererDomain: null,
        siblingJson: [],
        sourcePath: null,
      })
    );

    await expect(
      Effect.runPromise(
        readPublishedMaterialRoute("en", previewProjection.publicPath)
      )
    ).resolves.toMatchObject({
      activeReleaseId,
      alternates: [],
      projection: null,
      sourcePath: null,
    });
  });

  it.each([
    ["active manifest", foundModel({ activeManifestHash: "invalid" })],
    ["missing manifest", foundModel({ activeManifestHash: null })],
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
  ])("rejects an invalid %s", async (_label, result) => {
    runtimeQueryMock.mockResolvedValueOnce(result);

    await expect(
      Effect.runPromise(
        readPublishedMaterialRoute("en", previewProjection.publicPath).pipe(
          Effect.flip
        )
      )
    ).resolves.toMatchObject({ _tag: "PublishedProjectionError" });
  });
});
