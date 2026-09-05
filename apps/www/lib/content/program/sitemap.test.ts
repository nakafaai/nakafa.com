// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { makeProgramRuntimeSource } from "@repo/backend/test/program/runtime";
import { Effect } from "effect";
import {
  readPublishedProgramBuckets,
  readPublishedProgramSitemap,
} from "@/lib/content/program/sitemap";
import { createTestSnapshotContext } from "@/test/content/snapshot";
import { createTestSnapshotQuery } from "@/test/runtime-query";

const readQueryMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/content/runtime/query", () => ({
  readRuntimeQuery: readQueryMock,
}));

describe("published curriculum snapshot sitemap", () => {
  it.effect(
    "enumerates every signed locale route exactly once and rejects invalid partitions",
    () =>
      Effect.gen(function* () {
        const fixture = yield* makeProgramRuntimeSource();
        const context = yield* createTestSnapshotContext(fixture.source);
        readQueryMock.mockImplementation(createTestSnapshotQuery(context));

        const catalog = yield* readPublishedProgramBuckets("id");
        expect(catalog).toMatchObject({ managed: true, routeCount: 2 });
        const pages = yield* Effect.forEach(catalog.buckets, (bucket) =>
          readPublishedProgramSitemap("id", bucket)
        );
        expect(
          pages
            .flatMap(
              (page) => page?.routes.map(({ publicPath }) => publicPath) ?? []
            )
            .sort()
        ).toEqual(["kurikulum/program-teknis-1", "kurikulum/program-teknis-2"]);
        expect(
          yield* readPublishedProgramSitemap("id", "invalid").pipe(Effect.flip)
        ).toMatchObject({ _tag: "ReleaseError" });
      })
  );
});
