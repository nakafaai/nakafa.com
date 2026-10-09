// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { createTestPublication } from "@repo/backend/test/content/publication";
import { makeProgramRuntimeSource } from "@repo/backend/test/program/runtime";
import { Array as Arr, Effect, Layer, Order } from "effect";
import {
  readPublishedProgramBuckets,
  readPublishedProgramSitemap,
} from "@/lib/content/program/sitemap";

const readQueryMock = vi.hoisted(() => vi.fn());
vi.mock("@confect/js", async (importOriginal) => {
  const { HttpClient } = await importOriginal<typeof import("@confect/js")>();
  return {
    HttpClient: {
      ...HttpClient,
      layer: (...args: Parameters<typeof HttpClient.layer>) =>
        Layer.effect(
          HttpClient.HttpClient,
          Effect.gen(function* () {
            const client = yield* HttpClient.HttpClient;
            return {
              ...client,
              query: readQueryMock,
            };
          })
        ).pipe(Layer.provide(HttpClient.layer(...args))),
    },
  };
});
describe("published curriculum snapshot sitemap", () => {
  it.effect(
    "enumerates every signed locale route exactly once and rejects invalid partitions",
    () =>
      Effect.gen(function* () {
        const fixture = yield* makeProgramRuntimeSource();
        const context = yield* createTestPublication(fixture.source);
        readQueryMock.mockImplementation(context.query);
        const catalog = yield* readPublishedProgramBuckets("id");
        expect(catalog).toMatchObject({
          managed: true,
          routeCount: 2,
        });
        const pages = yield* Effect.forEach(catalog.buckets, (bucket) =>
          readPublishedProgramSitemap("id", bucket)
        );
        expect(
          Arr.sort(
            Arr.flatMap(pages, (page) =>
              page ? Arr.map(page.routes, ({ publicPath }) => publicPath) : []
            ),
            Order.String
          )
        ).toEqual(["kurikulum/program-teknis-1", "kurikulum/program-teknis-2"]);
        expect(
          yield* readPublishedProgramSitemap("id", "invalid").pipe(Effect.flip)
        ).toMatchObject({
          _tag: "ReleaseError",
          code: "CONTENT_RELEASE_LIMIT",
        });
      })
  );
});
vi.mock("@/env", () => ({
  env: {
    NEXT_PUBLIC_CONVEX_URL: "https://test.convex.cloud",
  },
}));
