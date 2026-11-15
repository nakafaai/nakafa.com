import { Effect, FileSystem, Path } from "effect";
import {
  type VerticalMetricsSchema,
  writeFaceMetrics,
} from "@/scripts/quran/woff";

/**
 * Amiri Quran's vertical metrics for one line of Arabic beside other things, a
 * key's letter or a surah's name, in font units of 1000. The face as published
 * rises 1815 above its baseline and falls 634 below it, so a line box sets its
 * baseline 0.59em below its middle: a key's letter sits low, past its border,
 * and a surah's name sinks under the title beside it. These metrics move the
 * baseline up to where the letters' ink, from the hamza above alef to the tails
 * of jim and mim, is shared most evenly about the line's middle: measured at a
 * key's 18px, jim's ink centre lies 5.6px below it and alef with hamza's 5.8px
 * above it, the two ends of the set.
 *
 * They are written into the font files rather than declared with
 * `ascent-override` and `descent-override`, because Safari reads neither
 * descriptor: there the name kept the published metrics and sank 0.39em below
 * the Latin title beside it.
 */
const BALANCED_METRICS: typeof VerticalMetricsSchema.Type = {
  ascent: 848,
  descent: -451,
  lineGap: 0,
};

/**
 * Each subset of Amiri Quran, and the file its line face is written to. A line
 * takes its metrics from the first face whose range holds the space, so the line
 * face needs the Latin subset too.
 */
const SUBSETS = [
  {
    face: "arabic.woff2",
    source: "@fontsource/amiri-quran/files/amiri-quran-arabic-400-normal.woff2",
  },
  {
    face: "latin.woff2",
    source: "@fontsource/amiri-quran/files/amiri-quran-latin-400-normal.woff2",
  },
] as const;

/** The folder of the line faces, which the app's stylesheet declares as Amiri Quran Line. */
export const LINE_FACES = new URL("../../src/styles/quran/", import.meta.url);

/**
 * Writes Amiri Quran's line faces into a folder: each installed subset of the
 * face with the balanced metrics in its `hhea` and OS/2 tables, and every glyph
 * as published. Run it again after an update of `@fontsource/amiri-quran`.
 */
export const writeLineFaces = Effect.fn("scripts.quran.line.writeLineFaces")(
  function* (folder: URL) {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const directory = yield* path.fromFileUrl(folder);
    yield* fs.makeDirectory(directory, { recursive: true });
    yield* Effect.forEach(
      SUBSETS,
      (subset) =>
        Effect.gen(function* () {
          const source = yield* path.fromFileUrl(
            new URL(import.meta.resolve(subset.source))
          );
          const face = yield* writeFaceMetrics(
            yield* fs.readFile(source),
            BALANCED_METRICS
          );
          yield* fs.writeFile(path.join(directory, subset.face), face);
        }),
      { discard: true }
    );
  }
);
