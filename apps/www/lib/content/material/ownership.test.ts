// @vitest-environment node

import { ReleaseIdSchema } from "@nakafa/aksara-contracts/ids";
import { canonicalizeMaterialProjection } from "@nakafa/aksara-contracts/projection/material";
import { MATERIAL_SOURCE_LIMIT } from "@repo/backend/convex/contentRelease/material/limits";
import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  type MaterialSourceCandidate,
  readPublishedMaterialClaims,
  readPublishedMaterialShell,
} from "@/lib/content/material/ownership";
import { previewIdProjection, previewProjection } from "@/test/content-preview";

const fetchMock = vi.hoisted(() => vi.fn());
const releaseId = ReleaseIdSchema.make("material-release");

vi.mock("@/lib/content/runtime/query", async () => {
  const { readTestRuntimeQuery } = await import("@/test/runtime-query");
  return {
    fetchRuntimeQuery: fetchMock,
    readRuntimeQuery: readTestRuntimeQuery,
  };
});

beforeEach(() => {
  fetchMock.mockReset();
});

describe("published material ownership", () => {
  it("reads no claims without a query and rejects duplicate inputs", async () => {
    await expect(
      Effect.runPromise(readPublishedMaterialClaims("en", []))
    ).resolves.toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();

    await expect(
      Effect.runPromise(
        Effect.flip(
          readPublishedMaterialClaims("en", [
            {
              contentKey: previewProjection.contentKey,
              locale: "en",
            },
            {
              contentKey: previewProjection.contentKey,
              locale: "en",
            },
          ])
        )
      )
    ).resolves.toMatchObject({ _tag: "PublishedProjectionError" });
  });

  it("batches exact source claims without changing their order", async () => {
    const candidates: MaterialSourceCandidate[] = Array.from(
      { length: MATERIAL_SOURCE_LIMIT + 1 },
      (_, index) => ({
        contentKey: `material/lesson/mathematics/functions/section-${index + 1}`,
        locale: "en",
      })
    );
    const firstContentKey = "material/lesson/mathematics/functions/section-1";
    const lastContentKey = `material/lesson/mathematics/functions/section-${MATERIAL_SOURCE_LIMIT + 1}`;
    fetchMock
      .mockResolvedValueOnce({
        activeReleaseId: releaseId,
        sourceClaims: [
          {
            contentKey: firstContentKey,
            kind: "missing",
            locale: "en",
          },
        ],
      })
      .mockResolvedValueOnce({
        activeReleaseId: releaseId,
        sourceClaims: [
          {
            contentKey: lastContentKey,
            kind: "missing",
            locale: "en",
          },
        ],
      });

    await expect(
      Effect.runPromise(readPublishedMaterialClaims("en", candidates))
    ).resolves.toMatchObject([
      { contentKey: firstContentKey, kind: "missing" },
      { contentKey: lastContentKey, kind: "missing" },
    ]);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      expect.objectContaining({
        sourceCandidates: candidates.slice(0, MATERIAL_SOURCE_LIMIT),
      })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      expect.anything(),
      expect.objectContaining({
        expectedActiveReleaseId: releaseId,
        sourceCandidates: candidates.slice(MATERIAL_SOURCE_LIMIT),
      })
    );
  });

  it("batches source groups and reads ungrouped claims separately", async () => {
    const ungrouped = {
      contentKey: "material/lesson/mathematics/statistics/mean",
      locale: previewProjection.locale,
    };
    const candidates = [
      {
        contentKey: previewProjection.contentKey,
        locale: previewProjection.locale,
        parentPath: previewProjection.parentPath,
      },
      {
        contentKey: previewIdProjection.contentKey,
        locale: previewIdProjection.locale,
        parentPath: previewIdProjection.parentPath,
      },
      {
        contentKey: "material/lesson/mathematics/algebra/linear-equation",
        locale: previewProjection.locale,
        parentPath: "subjects/mathematics/algebra",
      },
      {
        contentKey: "material/lesson/mathematics/calculus/limit",
        locale: previewProjection.locale,
        parentPath: "subjects/mathematics/calculus",
      },
      ungrouped,
    ];
    fetchMock
      .mockResolvedValueOnce({
        activeReleaseId: releaseId,
        sourceClaims: [],
        sourceProjectionJson: [
          canonicalizeMaterialProjection(previewProjection),
        ],
      })
      .mockResolvedValueOnce({
        activeReleaseId: releaseId,
        sourceClaims: [],
        sourceProjectionJson: [],
      })
      .mockResolvedValueOnce({
        activeReleaseId: releaseId,
        sourceClaims: [
          {
            contentKey: ungrouped.contentKey,
            kind: "missing",
            locale: "en",
          },
        ],
      });

    await expect(
      Effect.runPromise(readPublishedMaterialShell("en", candidates))
    ).resolves.toEqual({
      claims: [
        {
          contentKey: ungrouped.contentKey,
          kind: "missing",
          locale: "en",
        },
      ],
      materials: [previewProjection],
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      expect.anything(),
      expect.objectContaining({ expectedActiveReleaseId: releaseId })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      expect.anything(),
      expect.objectContaining({ expectedActiveReleaseId: releaseId })
    );
  });

  it.each([
    [
      "duplicate",
      [
        canonicalizeMaterialProjection(previewProjection),
        canonicalizeMaterialProjection(previewProjection),
      ],
      previewProjection.parentPath,
    ],
    [
      "locale",
      [canonicalizeMaterialProjection(previewIdProjection)],
      previewProjection.parentPath,
    ],
    [
      "parent",
      [canonicalizeMaterialProjection(previewProjection)],
      "subjects/mathematics/other-topic",
    ],
  ])(
    "rejects invalid %s source group rows",
    async (_label, rows, parentPath) => {
      fetchMock.mockResolvedValueOnce({
        activeReleaseId: releaseId,
        sourceClaims: [],
        sourceProjectionJson: rows,
      });

      await expect(
        Effect.runPromise(
          Effect.flip(
            readPublishedMaterialShell("en", [
              {
                contentKey: previewProjection.contentKey,
                locale: "en",
                parentPath,
              },
            ])
          )
        )
      ).resolves.toMatchObject({ _tag: "PublishedProjectionError" });
    }
  );

  it("rejects an active release change between source batches", async () => {
    const candidates: MaterialSourceCandidate[] = Array.from(
      { length: MATERIAL_SOURCE_LIMIT + 1 },
      (_, index) => ({
        contentKey: `material/lesson/mathematics/functions/section-${index + 1}`,
        locale: "en",
      })
    );
    fetchMock
      .mockResolvedValueOnce({ activeReleaseId: releaseId, sourceClaims: [] })
      .mockResolvedValueOnce({
        activeReleaseId: ReleaseIdSchema.make("next-release"),
        sourceClaims: [],
      });

    await expect(
      Effect.runPromise(
        Effect.flip(readPublishedMaterialClaims("en", candidates))
      )
    ).resolves.toMatchObject({ _tag: "PublishedReleaseMismatchError" });
  });

  it("pins the first exact claim batch to its caller release", async () => {
    fetchMock.mockResolvedValueOnce({
      activeReleaseId: releaseId,
      sourceClaims: [],
    });

    await expect(
      Effect.runPromise(
        readPublishedMaterialClaims(
          "en",
          [{ contentKey: previewProjection.contentKey, locale: "en" }],
          releaseId
        )
      )
    ).resolves.toEqual([]);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ expectedActiveReleaseId: releaseId })
    );
  });

  it("rejects an invalid release identity before decoding claims", async () => {
    fetchMock.mockResolvedValueOnce({
      activeReleaseId: "",
      sourceClaims: [],
    });

    await expect(
      Effect.runPromise(
        Effect.flip(
          readPublishedMaterialClaims("en", [
            { contentKey: previewProjection.contentKey, locale: "en" },
          ])
        )
      )
    ).resolves.toMatchObject({ _tag: "PublishedProjectionError" });
  });
});
