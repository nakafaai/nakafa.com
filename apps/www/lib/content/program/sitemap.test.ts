// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { createTestPublication } from "@repo/backend/test/content/publication";
import { makeProgramRuntimeSource } from "@repo/backend/test/program/runtime";
import { Effect } from "effect";
import {
  readPublishedProgramBuckets,
  readPublishedProgramSitemap,
} from "@/lib/content/program/sitemap";
import { createTestNativeQuery } from "@/test/runtime-query";

const readQueryMock = vi.hoisted(() => vi.fn());
vi.mock("@repo/backend/client/nakafa/query", () => ({
  readNakafaRuntimeQuery: readQueryMock,
}));

describe("published curriculum snapshot sitemap", () => {
  it.effect(
    "enumerates every signed locale route exactly once and rejects invalid partitions",
    () =>
      Effect.gen(function* () {
        const fixture = yield* makeProgramRuntimeSource();
        const context = yield* createTestPublication(fixture.source);
        readQueryMock.mockImplementation(createTestNativeQuery(context));

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
        ).toMatchObject({ _tag: "NakafaAgentDataReadError" });
      })
  );
});

vi.mock("@/env", () => ({
  env: { NEXT_PUBLIC_CONVEX_URL: "https://test.convex.cloud" },
}));
