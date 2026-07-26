// @vitest-environment node

import { Effect } from "effect";
import { describe, expect, it } from "vitest";
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
  it("decodes exact program and curriculum rows", async () => {
    const [program, route] = await Effect.runPromise(
      Effect.all([
        decodeProgramJson(testProgramRowJson(), "en", "curricula"),
        decodeCurriculumJson(
          testCurriculumRowJson(testProgramRoot),
          "en",
          testProgramRoot.publicPath
        ),
      ])
    );

    expect(program).toEqual(testPublishedProgram);
    expect(route).toEqual(testProgramRoot);
  });

  it.each([
    ["invalid JSON", "{"],
    ["invalid snapshot", "{}"],
    ["wrong record kind", testProgramRowJson()],
  ])("rejects %s curriculum rows", async (_name, source) => {
    await expect(
      Effect.runPromise(
        decodeCurriculumJson(source, "en", "curricula").pipe(Effect.flip)
      )
    ).resolves.toMatchObject({ _tag: "PublishedProjectionError" });
  });

  it("rejects a curriculum row where a program was expected", async () => {
    await expect(
      Effect.runPromise(
        decodeProgramJson(
          testCurriculumRowJson(testProgramRoot),
          "en",
          "curricula"
        ).pipe(Effect.flip)
      )
    ).resolves.toMatchObject({ _tag: "PublishedProjectionError" });
  });
});
