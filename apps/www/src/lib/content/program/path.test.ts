// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { createTestPublication } from "@repo/backend/test/content/publication";
import { makeProgramRuntimeSource } from "@repo/backend/test/program/runtime";
import { Effect, Layer } from "effect";
import { readPublishedProgramPath } from "@/lib/content/program/path";
import { activateTestRelease } from "@/test/active";
import {
  testCurriculumRowJson,
  testProgramRoot,
} from "@/test/published/program";
import { resetTestRuntimeCache } from "@/test/store";

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
vi.mock(
  "@/lib/content/published/active",
  async () => (await import("@/test/active")).testActiveModule
);
vi.mock(
  "@/lib/content/store/memory",
  async () => (await import("@/test/store")).testRuntimeCacheModule
);
beforeEach(() => {
  resetTestRuntimeCache();
  activateTestRelease("release-program");
});
describe("published curriculum snapshot paths", () => {
  it.effect(
    "rejects a returned curriculum route that belongs to another request",
    () =>
      Effect.gen(function* () {
        readQueryMock.mockImplementation(() =>
          Effect.succeed({
            managed: true,
            routeJson: testCurriculumRowJson(testProgramRoot),
          })
        );
        expect(
          yield* readPublishedProgramPath("id", testProgramRoot.publicPath)
        ).toEqual({
          managed: true,
          route: null,
        });
        expect(
          yield* readPublishedProgramPath("en", "curriculum/another-program")
        ).toEqual({
          managed: true,
          route: null,
        });
      })
  );
  it.effect(
    "resolves the exact locale route and preserves missing ownership",
    () =>
      Effect.gen(function* () {
        const fixture = yield* makeProgramRuntimeSource();
        const context = yield* createTestPublication(fixture.source);
        readQueryMock.mockImplementation(context.query);
        expect(
          yield* readPublishedProgramPath(
            "de",
            "lehrplaene/technisches-programm-1"
          )
        ).toMatchObject({
          managed: true,
          route: {
            appLocale: "de",
            title: "Technisches Programm 1",
          },
        });
        expect(
          yield* readPublishedProgramPath(
            "en",
            "lehrplaene/technisches-programm-1"
          )
        ).toEqual({
          managed: true,
          route: null,
        });
      })
  );
});
