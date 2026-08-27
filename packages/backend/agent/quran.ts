import { decodeAgentInput } from "@repo/backend/agent/decode";
import { readAgentQuery } from "@repo/backend/agent/query";
import { projectNakafaQuranReference } from "@repo/backend/agent/quran/projection";
import { decodePublishedQuranCatalog } from "@repo/backend/client/quran/catalog";
import type { QuranPublicationError } from "@repo/backend/client/quran/publication";
import {
  decodePublishedQuranReference,
  type PublishedQuranReference,
} from "@repo/backend/client/quran/reference";
import type { ActionCtx } from "@repo/backend/convex/_generated/server";
import type { readQuranSurahs } from "@repo/backend/convex/contentRelease/quran/catalog";
import type { readQuranReference } from "@repo/backend/convex/contentRelease/quran/reference";
import type { QuranReferenceArgs } from "@repo/backend/convex/contentRelease/quran/spec";
import { NAKAFA_AGENT_MAX_QURAN_REFERENCE_VERSES } from "@repo/contents/_lib/agent/constants";
import {
  NakafaAgentDataReadError,
  NakafaAgentInputError,
} from "@repo/contents/_lib/agent/errors";
import { createNakafaContentRefFromGraphProjection } from "@repo/contents/_lib/agent/refs";
import {
  type NakafaAgentQuranReferenceInput,
  NakafaAgentQuranReferenceOptionsSchema,
} from "@repo/contents/_lib/agent/schema/quran/input";
import { type FunctionReference, makeFunctionReference } from "convex/server";
import { Effect, Option } from "effect";

type QuranCatalogReference = FunctionReference<
  "query",
  "public" | "internal",
  Record<string, never>,
  Effect.Success<ReturnType<typeof readQuranSurahs>>
>;

const quranCatalogReference: QuranCatalogReference = makeFunctionReference(
  "contentRelease/quran:surahs"
);

const quranPassage = makeFunctionReference<
  "query",
  QuranReferenceArgs,
  Effect.Success<ReturnType<typeof readQuranReference>>
>("contentRelease/quran:passage");

/** Returns one bounded signed Quran reference with semantic source provenance. */
export const getNakafaQuranReference = Effect.fn(
  "agent.getNakafaQuranReference"
)(function* (ctx: ActionCtx, input: unknown) {
  const request = yield* readNakafaQuranRequest(
    ctx,
    input,
    quranCatalogReference
  );
  if (Option.isNone(request)) {
    return Option.none();
  }
  const result = yield* readAgentQuery(
    ctx,
    quranPassage,
    referenceArgs(request.value),
    "Unable to read the signed Nakafa Quran reference."
  );
  const reference = yield* decodePublishedQuranReference(result, {
    appLocale: request.value.locale,
    surahNumber: request.value.surah,
  }).pipe(Effect.mapError(quranReadError));
  const identity = yield* projectReferenceIdentity(
    reference.search,
    request.value
  );
  return Option.some(
    yield* projectNakafaQuranReference({ ...identity, reference })
  );
});

/** Decodes and bounds one request against its signed catalog. */
const readNakafaQuranRequest = Effect.fn("agent.readNakafaQuranRequest")(
  function* (
    ctx: ActionCtx,
    input: unknown,
    catalogReference: QuranCatalogReference
  ) {
    const parsed = yield* decodeAgentInput(
      NakafaAgentQuranReferenceOptionsSchema,
      input,
      "Invalid Nakafa Quran reference options."
    );
    const lastVerse = parsed.to_verse ?? parsed.from_verse;
    yield* validateRequestedRange(parsed.from_verse, lastVerse);
    const catalogResult = yield* readAgentQuery(
      ctx,
      catalogReference,
      {},
      "Unable to read the signed Nakafa Quran catalog."
    );
    const catalog = yield* decodePublishedQuranCatalog(catalogResult).pipe(
      Effect.mapError(quranReadError)
    );
    const surah = catalog.surahs.find(
      (candidate) => candidate.number === parsed.surah
    );
    if (!surah) {
      return Option.none();
    }
    if (lastVerse > surah.numberOfVerses) {
      return yield* invalidRange(
        `Surah ${parsed.surah} ends at verse ${surah.numberOfVerses}.`
      );
    }
    return Option.some(parsed);
  }
);

/** Projects decoded public options into the direct Convex query shape. */
function referenceArgs(input: NakafaAgentQuranReferenceInput) {
  return {
    appLocale: input.locale,
    fromVerse: input.from_verse,
    surahNumber: input.surah,
    toVerse: input.to_verse,
  } satisfies QuranReferenceArgs;
}

/** Builds the shared public identity from one verified reference search row. */
const projectReferenceIdentity = Effect.fn(
  "agent.projectQuranReferenceIdentity"
)(function* (
  search: PublishedQuranReference["search"],
  input: NakafaAgentQuranReferenceInput
) {
  const ref = createNakafaContentRefFromGraphProjection({
    ...search.graph,
    content_id: search.graph.assetId,
    locale: search.appLocale,
    route: search.route,
    section: "quran",
  });
  if (Option.isNone(ref)) {
    return yield* new NakafaAgentDataReadError({
      cause: "The signed Quran reference has an invalid graph identity.",
      message: "Unable to read signed Nakafa Quran reference.",
    });
  }
  return {
    appLocale: input.locale,
    includeTafsir: input.include_tafsir,
    ref: ref.value,
  };
});

/** Enforces the public range contract before reading publication rows. */
function validateRequestedRange(fromVerse: number, toVerse: number) {
  if (toVerse < fromVerse) {
    return invalidRange(
      "to_verse must be greater than or equal to from_verse."
    );
  }
  if (toVerse - fromVerse + 1 > NAKAFA_AGENT_MAX_QURAN_REFERENCE_VERSES) {
    return invalidRange(
      `Request at most ${NAKAFA_AGENT_MAX_QURAN_REFERENCE_VERSES} verses at a time.`
    );
  }
  return Effect.void;
}

/** Creates one actionable typed range error. */
function invalidRange(cause: string) {
  return new NakafaAgentInputError({
    cause,
    message: "Invalid Quran verse range.",
  });
}

/** Maps signed Quran failures into the public agent error contract. */
function quranReadError(error: QuranPublicationError) {
  return new NakafaAgentDataReadError({
    cause: error.reason,
    message: `Unable to read signed Nakafa Quran ${error.operation}.`,
  });
}
