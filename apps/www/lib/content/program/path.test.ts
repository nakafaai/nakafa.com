// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { makeProgramRuntimeSource } from "@repo/backend/test/program/runtime";
import { Effect } from "effect";
import { readPublishedProgramPath } from "@/lib/content/program/path";
import { createTestSnapshotContext } from "@/test/content/snapshot";
import { testCurriculumRowJson, testProgramRoot } from "@/test/content-program";
import { createTestSnapshotQuery } from "@/test/runtime-query";

const readQueryMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/content/runtime/query", () => ({
  readRuntimeQuery: readQueryMock,
}));

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
        ).toEqual({ managed: true, route: null });
        expect(
          yield* readPublishedProgramPath("en", "curriculum/another-program")
        ).toEqual({ managed: true, route: null });
      })
  );
  it.effect(
    "resolves the exact locale route and preserves missing ownership",
    () =>
      Effect.gen(function* () {
        const fixture = yield* makeProgramRuntimeSource();
        const context = yield* createTestSnapshotContext(fixture.source);
        readQueryMock.mockImplementation(createTestSnapshotQuery(context));

        expect(
          yield* readPublishedProgramPath(
            "de",
            "lehrplaene/technisches-programm-1"
          )
        ).toMatchObject({
          managed: true,
          route: { appLocale: "de", title: "Technisches Programm 1" },
        });
        expect(
          yield* readPublishedProgramPath(
            "en",
            "lehrplaene/technisches-programm-1"
          )
        ).toEqual({ managed: true, route: null });
      })
  );
});
