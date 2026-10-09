import { decodeAgentInput } from "@repo/backend/agent/decode";
import { projectNakafaQuranReference } from "@repo/backend/agent/quran/projection";
import { decodePublishedQuranCatalog } from "@repo/backend/client/quran/catalog";
import type { QuranPublicationError } from "@repo/backend/client/quran/publication";
import {
  decodePublishedQuranReference,
  type PublishedQuranReference,
} from "@repo/backend/client/quran/reference";
import refs from "@repo/backend/confect/_generated/refs";
import { QueryRunner } from "@repo/backend/confect/_generated/services";
import type { QuranReferenceArgs } from "@repo/backend/confect/contentRelease/quran/spec";
import { getUnknownErrorMessage } from "@repo/backend/confect/failure";
import { NAKAFA_AGENT_MAX_QURAN_REFERENCE_VERSES } from "@repo/contents/agent/constants";
import {
  NakafaAgentDataReadError,
  NakafaAgentInputError,
} from "@repo/contents/agent/errors";
import { createNakafaContentRefFromGraphProjection } from "@repo/contents/agent/refs";
import {
  type NakafaAgentQuranReferenceInput,
  NakafaAgentQuranReferenceOptionsSchema,
} from "@repo/contents/agent/schema/quran/input";
import { Array as Arr, Effect, Option, Struct } from "effect";

const quranCatalogReference = refs.public.contentRelease.quran.surahs;
const quranPassage = refs.public.contentRelease.quran.passage;

/** Returns one bounded signed Quran reference with semantic source provenance. */
export const getNakafaQuranReference = Effect.fn(
  "agent.getNakafaQuranReference"
)(function* (input: unknown) {
  const { runQuery } = yield* QueryRunner;
  const request = yield* readNakafaQuranRequest(input);
  const result = yield* runQuery(quranPassage, referenceArgs(request)).pipe(
    Effect.mapError(
      (cause) =>
        new NakafaAgentDataReadError({
          cause: getUnknownErrorMessage(cause),
          message: "Unable to read the signed Nakafa Quran reference.",
        })
    )
  );
  const reference = yield* decodePublishedQuranReference(result, {
    appLocale: request.locale,
    surahNumber: request.surah,
  }).pipe(Effect.mapError(quranReadError));
  const identity = yield* projectReferenceIdentity(reference.search, request);
  return yield* projectNakafaQuranReference({
    ...identity,
    reference,
  });
});

/** Decodes and bounds one request against its signed catalog. */
const readNakafaQuranRequest = Effect.fn("agent.readNakafaQuranRequest")(
  function* (input: unknown) {
    const { runQuery } = yield* QueryRunner;
    const parsed = yield* decodeAgentInput(
      NakafaAgentQuranReferenceOptionsSchema,
      input,
      "Invalid Nakafa Quran reference options."
    );
    const lastVerse = parsed.to_verse ?? parsed.from_verse;
    yield* validateRequestedRange(parsed.from_verse, lastVerse);
    const catalogResult = yield* runQuery(quranCatalogReference, {}).pipe(
      Effect.mapError(
        (cause) =>
          new NakafaAgentDataReadError({
            cause: getUnknownErrorMessage(cause),
            message: "Unable to read the signed Nakafa Quran catalog.",
          })
      )
    );
    const catalog = yield* decodePublishedQuranCatalog(catalogResult).pipe(
      Effect.mapError(quranReadError)
    );
    const exceededSurah = Arr.findFirst(
      catalog.surahs,
      (candidate) =>
        candidate.number === parsed.surah &&
        lastVerse > candidate.numberOfVerses
    );
    if (Option.isSome(exceededSurah)) {
      return yield* invalidRange(
        `Surah ${parsed.surah} ends at verse ${exceededSurah.value.numberOfVerses}.`
      );
    }
    return parsed;
  }
);

/** Projects decoded public options into the direct Convex query shape. */
function referenceArgs(input: NakafaAgentQuranReferenceInput) {
  return {
    appLocale: input.locale,
    fromVerse: input.from_verse,
    surahNumber: input.surah,
    ...Struct.renameKeys(Struct.pick(input, ["to_verse"]), {
      to_verse: "toVerse",
    }),
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
