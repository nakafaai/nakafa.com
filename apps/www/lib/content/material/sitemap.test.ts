// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { ReleaseIdSchema } from "@nakafa/aksara-contracts/ids";
import { Effect } from "effect";
import {
  readPublishedMaterialBuckets,
  readPublishedMaterialSitemap,
} from "@/lib/content/material/sitemap";
import { makeMaterialRuntimeSource } from "@/test/content/material";
import { createTestSnapshotContext } from "@/test/content/snapshot";
import {
  createTestRuntimeQuery,
  createTestSnapshotQuery,
} from "@/test/runtime-query";

const runtimeQueryMock = vi.hoisted(() => vi.fn());
const runtimeReadMock = vi.hoisted(() => vi.fn());
const activeReleaseId = ReleaseIdSchema.make("release-material");

vi.mock("@/lib/content/runtime/query", () => ({
  readRuntimeQuery: runtimeReadMock,
}));

beforeEach(() => {
  runtimeQueryMock.mockReset();
  runtimeReadMock.mockImplementation(createTestRuntimeQuery(runtimeQueryMock));
});

describe("published material sitemap", () => {
  it.effect(
    "enumerates every localized route through authenticated bucket reads",
    () =>
      Effect.gen(function* () {
        const fixture = yield* makeMaterialRuntimeSource();
        const context = yield* createTestSnapshotContext(fixture.source);
        runtimeReadMock.mockImplementation(createTestSnapshotQuery(context));

        const inventory = yield* readPublishedMaterialBuckets("de");
        const pages = yield* Effect.forEach(inventory.buckets, (bucket) =>
          readPublishedMaterialSitemap("de", bucket).pipe(
            Effect.flatMap(Effect.fromNullishOr)
          )
        );
        expect(inventory).toMatchObject({
          activeReleaseId: fixture.state.activeReleaseId,
          materialCount: 2,
        });
        expect(
          pages
            .flatMap((page) => page.routes.map((row) => row.publicPath))
            .sort()
        ).toEqual(
          fixture.projections
            .filter((row) => row.appLocale === "de")
            .map((row) => row.publicPath)
            .sort()
        );
      })
  );

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
