// @vitest-environment node

import { ReleaseIdSchema } from "@nakafa/aksara-contracts/ids";
import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  readPublishedMaterialBuckets,
  readPublishedMaterialSitemap,
} from "@/lib/content/material/sitemap";

const runtimeQueryMock = vi.hoisted(() => vi.fn());
const activeReleaseId = ReleaseIdSchema.make("release-material");

vi.mock("@/lib/content/runtime/query", async () => {
  const { createTestRuntimeQuery } = await import("@/test/runtime-query");
  return {
    readRuntimeQuery: createTestRuntimeQuery(runtimeQueryMock),
  };
});

beforeEach(() => {
  runtimeQueryMock.mockReset();
});

describe("published material sitemap", () => {
  it("decodes the release identity and reads one sitemap page", async () => {
    runtimeQueryMock
      .mockResolvedValueOnce({
        activeReleaseId,
        buckets: ["abc"],
        managed: true,
        materialCount: 1,
      })
      .mockResolvedValueOnce({
        routes: [
          {
            lastModified: "2025-04-27",
            publicPath:
              "subjects/mathematics/function-composition-inverse-function/function-concept",
          },
        ],
      });

    await expect(
      Effect.runPromise(readPublishedMaterialBuckets("en"))
    ).resolves.toEqual({
      activeReleaseId,
      buckets: ["abc"],
      materialCount: 1,
    });
    await expect(
      Effect.runPromise(readPublishedMaterialSitemap("en", "abc"))
    ).resolves.toMatchObject({
      routes: [{ lastModified: "2025-04-27" }],
    });
  });

  it("rejects invalid and unmanaged material inventories", async () => {
    runtimeQueryMock
      .mockResolvedValueOnce({
        activeReleaseId: "",
        buckets: [],
        managed: false,
        materialCount: 0,
      })
      .mockResolvedValueOnce({
        activeReleaseId,
        buckets: [],
        managed: false,
        materialCount: 0,
      })
      .mockResolvedValueOnce({
        activeReleaseId: null,
        buckets: [],
        managed: true,
        materialCount: 0,
      });

    for (let attempt = 0; attempt < 3; attempt += 1) {
      await expect(
        Effect.runPromise(readPublishedMaterialBuckets("en").pipe(Effect.flip))
      ).resolves.toMatchObject({ _tag: "PublishedProjectionError" });
    }
  });
});
