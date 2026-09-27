import { QuranSurahNumberSchema } from "@nakafa/aksara-contracts/quran/spec";
import { releaseFail } from "@repo/backend/confect/contentRelease/error";
import type { ContentReferenceInput } from "@repo/backend/confect/contentRelease/reference/spec";
import { articleLayer } from "@repo/backend/content/article/confect";
import { materialLayer } from "@repo/backend/content/material/confect";
import { quranLayer } from "@repo/backend/content/quran/confect";
import { readQuranMarkdown } from "@repo/backend/content/quran/markdown";
import { readContentReference } from "@repo/backend/content/reference/read";
import { tryoutLayer } from "@repo/backend/content/tryout/confect";
import { Effect, Layer, Option, Schema } from "effect";

/** One transactionally consistent source for an agent focused read. */

/** Reads one reference and any Quran body from the same database snapshot. */
export const readAgentContentSource = Effect.fn(
  "contentRelease.readAgentContentSource"
)(function* (input: ContentReferenceInput) {
  const reference = yield* readContentReference(input).pipe(
    Effect.provide(
      Layer.mergeAll(articleLayer, materialLayer, quranLayer, tryoutLayer)
    )
  );
  if (reference === null) {
    return null;
  }
  if (reference.section !== "quran") {
    return {
      kind: "reference" as const,
      reference,
    };
  }
  const surahNumber = yield* parseQuranRoute(reference.route);
  const markdown = yield* readQuranMarkdown(reference.locale, surahNumber).pipe(
    Effect.provide(quranLayer)
  );
  return {
    kind: "quran" as const,
    markdown,
    reference,
    surahNumber,
  };
});

/** Parses one canonical Quran route from an authenticated reference. */
const parseQuranRoute = Effect.fn("contentRelease.parseAgentQuranRoute")(
  function* (route: string) {
    const [section, value, extra] = route.split("/");
    const decoded = Schema.decodeOption(QuranSurahNumberSchema)(Number(value));
    if (
      section !== "quran" ||
      extra !== undefined ||
      Option.isNone(decoded) ||
      route !== `quran/${decoded.value}`
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        "The active Quran reference has an invalid route identity."
      );
    }
    return decoded.value;
  }
);
