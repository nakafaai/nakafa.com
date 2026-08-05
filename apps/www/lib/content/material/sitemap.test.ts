// @vitest-environment node

import { ReleaseIdSchema } from "@nakafa/aksara-contracts/ids";
import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  readPublishedMaterialBuckets,
  readPublishedMaterialSitemap,
} from "@/lib/content/material/sitemap";

const fetchMock = vi.hoisted(() => vi.fn());
const activeReleaseId = ReleaseIdSchema.make("release-material");

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

describe("published material sitemap", () => {
  it("decodes the release identity and reads one sitemap page", async () => {
    fetchMock
      .mockResolvedValueOnce({
        activeReleaseId,
        buckets: ["abc"],
        managed: true,
        materialCount: 1,
      })
      .mockResolvedValueOnce({
        routes: [
          {
            date: "2025-04-27",
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
      routes: [{ date: "2025-04-27" }],
    });
  });

  it("rejects invalid and unmanaged material inventories", async () => {
    fetchMock
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
