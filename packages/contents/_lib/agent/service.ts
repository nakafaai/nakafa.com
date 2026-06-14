import { getNakafaAgentExercise } from "@repo/contents/_lib/agent/exercise/read";
import { getNakafaAgentQuranReference } from "@repo/contents/_lib/agent/quran/read";
import { getNakafaAgentMarkdown } from "@repo/contents/_lib/agent/read/markdown";
import { parseNakafaContentRef } from "@repo/contents/_lib/agent/refs";
import { getNakafaAgentTaxonomy } from "@repo/contents/_lib/agent/taxonomy/read";
import { getSurah } from "@repo/contents/_lib/quran";
import { parseQuranSurahNumberForRoute } from "@repo/contents/_types/graph/projection";
import { Effect, Either, Option } from "effect";

/** Verifies whether a Nakafa content reference resolves to readable content. */
export const verifyNakafaContent = Effect.fn("Nakafa.verify")(function* (
  contentRef: string,
  readContent: typeof getNakafaAgentMarkdown = getNakafaAgentMarkdown,
  loadSurah: typeof getSurah = getSurah
) {
  const ref = parseNakafaContentRef(contentRef);

  if (Option.isNone(ref)) {
    return false;
  }

  if (ref.value.section === "quran") {
    return yield* verifyNakafaQuranRoute(ref.value.route, loadSurah);
  }

  const content = yield* Effect.either(readContent(contentRef));

  return Either.match(content, {
    onLeft: () => false,
    onRight: Option.isSome,
  });
});

/** Verifies canonical Quran content routes without loading non-Quran content. */
function verifyNakafaQuranRoute(route: string, loadSurah: typeof getSurah) {
  return parseQuranSurahNumberForRoute(route).pipe(
    Effect.flatMap(loadSurah),
    Effect.either,
    Effect.map(Either.isRight)
  );
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
