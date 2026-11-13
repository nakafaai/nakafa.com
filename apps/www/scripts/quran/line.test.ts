// @vitest-environment node

import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { Effect, FileSystem, Path } from "effect";
import { LINE_FACES, writeLineFaces } from "@/scripts/quran/line";
import { readFaceMetrics } from "@/scripts/quran/woff";

/** The line faces' metrics, in hhea and in OS/2 alike. */
const BALANCED = { ascent: 848, descent: -451, lineGap: 0 };

/** The metrics of each line face in a folder. */
const metricsIn = (folder: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    return yield* Effect.forEach(["arabic.woff2", "latin.woff2"], (face) =>
      fs.readFile(path.join(folder, face)).pipe(Effect.flatMap(readFaceMetrics))
    );
  });

describe("writeLineFaces", () => {
  it.effect(
    "writes both subsets of Amiri Quran with the balanced metrics every engine reads",
    () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const folder = yield* fs.makeTempDirectoryScoped();
        yield* writeLineFaces(yield* path.toFileUrl(`${folder}/`));

        const expected = { hhea: BALANCED, typo: BALANCED };
        expect(yield* metricsIn(folder)).toEqual([expected, expected]);
        // The faces the stylesheet serves carry the same metrics.
        expect(yield* metricsIn(yield* path.fromFileUrl(LINE_FACES))).toEqual([
          expected,
          expected,
        ]);
      }).pipe(Effect.scoped, Effect.provide(NodeServices.layer))
  );
});
