// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import {
  decodeCurriculumJson,
  decodeProgramJson,
} from "@/lib/content/program/decode";
import {
  testCurriculumRowJson,
  testProgramRoot,
  testProgramRowJson,
  testPublishedProgram,
} from "@/test/content-program";

describe("published program decoding", () => {
  it.effect("decodes exact program and curriculum rows", () =>
    Effect.gen(function* () {
      const [program, route] = yield* Effect.all([
        decodeProgramJson(testProgramRowJson(), "en", "curricula"),
        decodeCurriculumJson(
          testCurriculumRowJson(testProgramRoot),
          "en",
          testProgramRoot.publicPath
        ),
      ]);

      expect(program).toEqual(testPublishedProgram);
      expect(route).toEqual(testProgramRoot);
    })
  );

  it.effect.each([
    ["invalid JSON", "{"],
    ["invalid snapshot", "{}"],
    ["wrong record kind", testProgramRowJson()],
  ] as const)("rejects %s curriculum rows", ([_name, source]) =>
    Effect.gen(function* () {
      const failure = yield* decodeCurriculumJson(
        source,
        "en",
        "curricula"
      ).pipe(Effect.flip);

      expect(failure).toMatchObject({ _tag: "PublishedProjectionError" });
    })
  );

  it.effect("rejects a curriculum row where a program was expected", () =>
    Effect.gen(function* () {
      const failure = yield* decodeProgramJson(
        testCurriculumRowJson(testProgramRoot),
        "en",
        "curricula"
      ).pipe(Effect.flip);

      expect(failure).toMatchObject({ _tag: "PublishedProjectionError" });
    })
  );
});
