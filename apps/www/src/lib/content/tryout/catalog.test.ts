// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { fixtureSetPath } from "@repo/backend/test/assessment/snapshot";
import { tryoutWorld } from "@repo/backend/test/tryout/world";
import { Effect, Layer } from "effect";
import {
  readPublishedTryoutExamPage,
  readPublishedTryoutSectionPage,
} from "@/lib/content/tryout/catalog";
import { resetTestRuntimeCache } from "@/test/store";

const runtimeQueryMock = vi.hoisted(() => vi.fn());
vi.mock(
  "@/lib/content/store/memory",
  async () => (await import("@/test/store")).testRuntimeCacheModule
);
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
              query: runtimeQueryMock,
            };
          })
        ).pipe(Layer.provide(HttpClient.layer(...args))),
    },
  };
});

const SECTION_PATH = `${fixtureSetPath("set-1", "en")}/section-a`;

describe("published try-out pages for routing", () => {
  beforeEach(() => {
    resetTestRuntimeCache();
    runtimeQueryMock.mockReset();
  });

  it.effect("reads a live exam with its tracks", () =>
    Effect.gen(function* () {
      const world = yield* tryoutWorld();
      runtimeQueryMock.mockImplementation(world.visitor.query);

      expect(
        yield* readPublishedTryoutExamPage({
          appLocale: "en",
          publicPath: "try-out/indonesia/snbt-en",
        })
      ).toMatchObject({
        exam: { examKey: "snbt" },
        tracks: [{ trackKey: "2027" }],
      });
    })
  );

  it.effect("returns no exam page for an absent exam", () =>
    Effect.gen(function* () {
      const world = yield* tryoutWorld();
      runtimeQueryMock.mockImplementation(world.visitor.query);

      expect(
        yield* readPublishedTryoutExamPage({
          appLocale: "en",
          publicPath: "try-out/indonesia/tka-en",
        })
      ).toBeNull();
    })
  );

  it.effect("reads a visible section as a live page", () =>
    Effect.gen(function* () {
      const world = yield* tryoutWorld();
      runtimeQueryMock.mockImplementation(world.visitor.query);

      expect(
        yield* readPublishedTryoutSectionPage({
          appLocale: "en",
          publicPath: SECTION_PATH,
        })
      ).toMatchObject({
        section: { sectionKey: "section-a" },
      });
    })
  );

  it.effect("returns no section page for an internal entry", () =>
    Effect.gen(function* () {
      // An internal entry has no route of its own, so the section's would-be route reads nothing.
      const world = yield* tryoutWorld({ entry: true });
      runtimeQueryMock.mockImplementation(world.visitor.query);

      expect(
        yield* readPublishedTryoutSectionPage({
          appLocale: "en",
          publicPath: SECTION_PATH,
        })
      ).toBeNull();
    })
  );
});
