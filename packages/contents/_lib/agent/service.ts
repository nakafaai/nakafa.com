import { getNakafaAgentExercise } from "@repo/contents/_lib/agent/exercise/read";
import { getNakafaAgentQuranReference } from "@repo/contents/_lib/agent/quran/read";
import { getNakafaAgentMarkdown } from "@repo/contents/_lib/agent/read/markdown";
import { parseNakafaContentRef } from "@repo/contents/_lib/agent/refs";
import { getNakafaAgentTaxonomy } from "@repo/contents/_lib/agent/taxonomy/read";
import { getSurah } from "@repo/contents/_lib/quran";
import { Effect, Either, Option } from "effect";

const QURAN_ROUTE_SECTION = "quran";
const QURAN_SURAH_PATTERN = /^\d+$/;

/** Verifies whether a Nakafa content reference resolves to readable content. */
const verifyNakafaContent = Effect.fn("Nakafa.verify")(function* (
  contentRef: string
) {
  const ref = parseNakafaContentRef(contentRef);

  if (Option.isNone(ref)) {
    return false;
  }

  if (ref.value.section === "quran") {
    return yield* verifyNakafaQuranRoute(ref.value.route);
  }

  const content = yield* Effect.either(getNakafaAgentMarkdown(contentRef));

  return Either.match(content, {
    onLeft: () => false,
    onRight: Option.isSome,
  });
});

/** Verifies canonical Quran content routes without loading non-Quran content. */
function verifyNakafaQuranRoute(route: string) {
  const routeSegments = route.split("/");
  const surahSegment = routeSegments.at(1);

  if (
    routeSegments.length !== 2 ||
    routeSegments.at(0) !== QURAN_ROUTE_SECTION ||
    !surahSegment ||
    !QURAN_SURAH_PATTERN.test(surahSegment)
  ) {
    return Effect.succeed(false);
  }

  const surahNumber = Number.parseInt(surahSegment, 10);

  if (surahNumber.toString() !== surahSegment) {
    return Effect.succeed(false);
  }

  return getSurah(surahNumber).pipe(Effect.either, Effect.map(Either.isRight));
}

/** Shared Nakafa read-model service used by MCP and Nina. */
export class Nakafa extends Effect.Service<Nakafa>()("Nakafa", {
  accessors: true,
  succeed: {
    exercise: getNakafaAgentExercise,
    quran: getNakafaAgentQuranReference,
    read: getNakafaAgentMarkdown,
    taxonomy: getNakafaAgentTaxonomy,
    verify: verifyNakafaContent,
  },
}) {}
