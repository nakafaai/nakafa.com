// @vitest-environment node

import { canonicalizeMaterialProjection } from "@nakafa/aksara-contracts/projection/material";
import { MATERIAL_SOURCE_LIMIT } from "@repo/backend/convex/contentRelease/material/limits";
import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  readPublishedMaterialClaims,
  readPublishedMaterialShell,
} from "@/lib/content/material/ownership";
import { previewIdProjection, previewProjection } from "@/test/content-preview";

const fetchMock = vi.hoisted(() => vi.fn());

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
    const candidates = Array.from(
      { length: MATERIAL_SOURCE_LIMIT + 1 },
      (_, index) => ({
        contentKey: `material/lesson/mathematics/functions/section-${index + 1}`,
        locale: "en" as const,
      })
    );
    const firstContentKey = "material/lesson/mathematics/functions/section-1";
    const lastContentKey = `material/lesson/mathematics/functions/section-${MATERIAL_SOURCE_LIMIT + 1}`;
    fetchMock
      .mockResolvedValueOnce({
        sourceClaims: [
          {
            contentKey: firstContentKey,
            kind: "missing",
            locale: "en",
          },
        ],
      })
      .mockResolvedValueOnce({
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
        sourceCandidates: candidates.slice(MATERIAL_SOURCE_LIMIT),
      })
    );
  });

  it("batches source groups and reads ungrouped claims separately", async () => {
    const ungrouped = {
      contentKey: "material/lesson/mathematics/statistics/mean",
      locale: "en" as const,
    };
    const candidates = [
      {
        contentKey: previewProjection.contentKey,
        locale: "en" as const,
        parentPath: previewProjection.parentPath,
      },
      {
        contentKey: previewIdProjection.contentKey,
        locale: "id" as const,
        parentPath: previewIdProjection.parentPath,
      },
      {
        contentKey: "material/lesson/mathematics/algebra/linear-equation",
        locale: "en" as const,
        parentPath: "subjects/mathematics/algebra",
      },
      {
        contentKey: "material/lesson/mathematics/calculus/limit",
        locale: "en" as const,
        parentPath: "subjects/mathematics/calculus",
      },
      ungrouped,
    ];
    fetchMock
      .mockResolvedValueOnce({
        sourceClaims: [],
        sourceProjectionJson: [
          canonicalizeMaterialProjection(previewProjection),
        ],
      })
      .mockResolvedValueOnce({
        sourceClaims: [],
        sourceProjectionJson: [],
      })
      .mockResolvedValueOnce({
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
});
