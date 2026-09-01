// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { ReleaseIdSchema } from "@nakafa/aksara-contracts/ids";
import { Effect } from "effect";
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
  it.effect("decodes the release identity and reads one sitemap page", () =>
    Effect.gen(function* () {
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

      expect(yield* readPublishedMaterialBuckets("en")).toEqual({
        activeReleaseId,
        buckets: ["abc"],
        materialCount: 1,
      });
      expect(yield* readPublishedMaterialSitemap("en", "abc")).toMatchObject({
        routes: [{ lastModified: "2025-04-27" }],
      });
    })
  );

  it.effect("rejects invalid and unmanaged material inventories", () =>
    Effect.gen(function* () {
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
        const failure = yield* readPublishedMaterialBuckets("en").pipe(
          Effect.flip
        );
        expect(failure).toMatchObject({ _tag: "PublishedProjectionError" });
      }
    })
  );
});
