import { Effect } from "effect";
import { readParts, type VerticalMetricsSchema } from "@/scripts/quran/woff";

/** Reads the three metrics stored at an offset of a face's stream. */
const metricsAt = (
  stream: Uint8Array,
  at: number
): typeof VerticalMetricsSchema.Type => {
  const view = new DataView(
    stream.buffer,
    stream.byteOffset,
    stream.byteLength
  );
  return {
    ascent: view.getInt16(at),
    descent: view.getInt16(at + 2),
    lineGap: view.getInt16(at + 4),
  };
};

/**
 * The vertical metrics a WOFF2 face gives a line box: `hhea`, which Apple's
 * platforms and most engines read, and the OS/2 typographic fields, which an
 * engine reads wherever the face sets USE_TYPO_METRICS, as Amiri Quran does.
 * Only the tests read them, to prove what `writeFaceMetrics` wrote.
 */
export const readFaceMetrics = Effect.fn("test.quran.woff.readFaceMetrics")(
  function* (font: Uint8Array) {
    const parts = yield* readParts(font);
    return {
      hhea: metricsAt(parts.stream, parts.hhea),
      typo: metricsAt(parts.stream, parts.typo),
    };
  }
);
