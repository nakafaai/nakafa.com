// @vitest-environment node

import { canonicalizeMaterialProjection } from "@nakafa/aksara-contracts/projection/material";
import type { api } from "@repo/backend/convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
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

const fetchMock = vi.hoisted(() => vi.fn());
const cacheMock = vi.hoisted(() => vi.fn());
const activeManifestHash = `sha256:${"a".repeat(64)}`;
const activeReleaseId = "release-material";
const sourceRevision = "a".repeat(40);
type MaterialSourceClaimResult = FunctionReturnType<
  typeof api.contentRelease.material.route
>["sourceClaims"][number];
type MaterialSourceClaimInput = Omit<
  MaterialSourceClaimResult,
  "contentKey"
> & {
  readonly contentKey: string;
};

vi.mock("@/lib/content/cache", () => ({
  applyContentRuntimeCache: cacheMock,
}));
vi.mock("@/lib/content/runtime/query", async () => {
  const { readTestRuntimeQuery } = await import("@/test/runtime-query");
  return {
    fetchRuntimeQuery: fetchMock,
    readRuntimeQuery: readTestRuntimeQuery,
  };
});

/** Builds one complete backend-verified material model response. */
function foundModel(overrides?: {
  readonly alternateJson?: readonly string[];
  readonly familyManaged?: boolean;
  readonly projectionJson?: null | string;
  readonly rendererDomain?: null | string;
  readonly siblingJson?: readonly string[];
  readonly sourceClaims?: readonly MaterialSourceClaimInput[];
}) {
  return {
    activeManifestHash,
    activeReleaseId,
    alternateJson:
      overrides?.alternateJson ??
      [previewProjection, previewIdProjection].map(
        canonicalizeMaterialProjection
      ),
    familyManaged: overrides?.familyManaged ?? true,
    managed: true,
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
    sourceClaims: overrides?.sourceClaims ?? [],
    sourcePath: previewSourcePath,
    sourceRevision,
  };
}

beforeEach(() => {
  fetchMock.mockReset();
  cacheMock.mockReset();
});

describe("published material route", () => {
  it("decodes one complete route, locale set, and sibling group", async () => {
    fetchMock.mockResolvedValueOnce(foundModel());

    await expect(
      getPublishedMaterialRoute("en", previewProjection.publicPath)
    ).resolves.toMatchObject({
      activeReleaseId,
      alternates: [previewProjection, previewIdProjection],
      managed: true,
      projection: previewProjection,
      rendererDomain: "mathematics",
      siblings: [previewProjection, previewNextProjection],
      sourceRevision,
    });
    expect(cacheMock).toHaveBeenCalledOnce();
  });

  it("accepts a partial locale shell for one exact-owned route", async () => {
    const sourceCandidates = [
      {
        contentKey: previewProjection.contentKey,
        locale: previewProjection.locale,
      },
      {
        contentKey: previewNextProjection.contentKey,
        locale: previewNextProjection.locale,
      },
    ];
    fetchMock.mockResolvedValueOnce(
      foundModel({
        alternateJson: [canonicalizeMaterialProjection(previewProjection)],
        familyManaged: false,
        siblingJson: [canonicalizeMaterialProjection(previewProjection)],
        sourceClaims: [
          {
            contentKey: previewProjection.contentKey,
            kind: "found",
            locale: previewProjection.locale,
            projectionJson: canonicalizeMaterialProjection(previewProjection),
          },
          {
            contentKey: previewNextProjection.contentKey,
            kind: "missing",
            locale: previewNextProjection.locale,
          },
        ],
      })
    );

    await expect(
      getPublishedMaterialRoute(
        "en",
        previewProjection.publicPath,
        sourceCandidates
      )
    ).resolves.toMatchObject({
      alternates: [previewProjection],
      familyManaged: false,
      projection: previewProjection,
      siblings: [previewProjection],
      sourceClaims: [
        {
          contentKey: previewProjection.contentKey,
          kind: "found",
          projection: previewProjection,
        },
        {
          contentKey: previewNextProjection.contentKey,
          kind: "missing",
        },
      ],
    });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ sourceCandidates })
    );
  });

  it("distinguishes unmanaged and managed missing routes", async () => {
    fetchMock
      .mockResolvedValueOnce({
        activeManifestHash: null,
        activeReleaseId: null,
        alternateJson: [],
        familyManaged: false,
        managed: false,
        projectionJson: null,
        rendererDomain: null,
        siblingJson: [],
        sourceClaims: [],
        sourcePath: null,
        sourceRevision: null,
      })
      .mockResolvedValueOnce(
        foundModel({
          alternateJson: [],
          projectionJson: null,
          rendererDomain: null,
          siblingJson: [],
        })
      );

    await expect(
      Effect.runPromise(
        readPublishedMaterialRoute("en", previewProjection.publicPath)
      )
    ).resolves.toMatchObject({ managed: false, projection: null });
    await expect(
      Effect.runPromise(
        readPublishedMaterialRoute("en", previewProjection.publicPath)
      )
    ).resolves.toMatchObject({ managed: true, projection: null });
  });

  it.each([
    [
      "active identity",
      {
        ...foundModel(),
        activeManifestHash: "invalid",
      },
    ],
    [
      "missing active identity",
      {
        ...foundModel(),
        activeReleaseId: null,
      },
    ],
    ["missing renderer", foundModel({ rendererDomain: null })],
    ["renderer", foundModel({ rendererDomain: "unknown" })],
    [
      "current route",
      foundModel({
        projectionJson: canonicalizeMaterialProjection(previewIdProjection),
      }),
    ],
    [
      "locale set",
      foundModel({
        alternateJson: [canonicalizeMaterialProjection(previewProjection)],
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
    [
      "source claim",
      foundModel({
        sourceClaims: [
          {
            contentKey: previewNextProjection.contentKey,
            kind: "missing",
            locale: previewNextProjection.locale,
          },
        ],
      }),
    ],
  ])("rejects an invalid %s", async (_label, result) => {
    fetchMock.mockResolvedValueOnce(result);

    await expect(
      Effect.runPromise(
        readPublishedMaterialRoute("en", previewProjection.publicPath).pipe(
          Effect.flip
        )
      )
    ).resolves.toMatchObject({ _tag: "PublishedProjectionError" });
  });

  it("rejects malformed, mismatched, and duplicate source claims", async () => {
    const sourceCandidate = {
      contentKey: previewProjection.contentKey,
      locale: previewProjection.locale,
    };
    const invalidKey = foundModel({
      sourceClaims: [
        {
          contentKey: "",
          kind: "missing",
          locale: previewProjection.locale,
        },
      ],
    });
    const mismatchedProjection = foundModel({
      sourceClaims: [
        {
          contentKey: previewProjection.contentKey,
          kind: "found",
          locale: previewProjection.locale,
          projectionJson: canonicalizeMaterialProjection(previewIdProjection),
        },
      ],
    });
    const duplicateClaims = foundModel({
      sourceClaims: [
        {
          contentKey: previewProjection.contentKey,
          kind: "missing",
          locale: previewProjection.locale,
        },
        {
          contentKey: previewProjection.contentKey,
          kind: "missing",
          locale: previewProjection.locale,
        },
      ],
    });
    fetchMock
      .mockResolvedValueOnce(invalidKey)
      .mockResolvedValueOnce(mismatchedProjection)
      .mockResolvedValueOnce(duplicateClaims);

    await expect(
      Effect.runPromise(
        readPublishedMaterialRoute("en", previewProjection.publicPath).pipe(
          Effect.flip
        )
      )
    ).resolves.toMatchObject({ _tag: "PublishedProjectionError" });
    await expect(
      Effect.runPromise(
        readPublishedMaterialRoute("en", previewProjection.publicPath, [
          sourceCandidate,
        ]).pipe(Effect.flip)
      )
    ).resolves.toMatchObject({ _tag: "PublishedProjectionError" });
    await expect(
      Effect.runPromise(
        readPublishedMaterialRoute("en", previewProjection.publicPath, [
          sourceCandidate,
        ]).pipe(Effect.flip)
      )
    ).resolves.toMatchObject({ _tag: "PublishedProjectionError" });
  });
});
